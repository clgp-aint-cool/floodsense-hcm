import asyncio
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import logging
import math
import random
import time

import httpx
from ..config import settings

logger = logging.getLogger(__name__)


class WeatherService:
    _lock = asyncio.Lock()
    _cached = None
    _expires = 0.0
    _blocked_until = {}
    _failures = {}

    @staticmethod
    def _timestamp(value):
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

    @classmethod
    def _validate(cls, result):
        for key in ('temperature_c', 'humidity_percent', 'rainfall_mm'):
            value = float(result[key])
            if not math.isfinite(value):
                raise ValueError('invalid weather measurement')
            result[key] = value
        if not 0 <= result['humidity_percent'] <= 100 or result['rainfall_mm'] < 0:
            raise ValueError('invalid weather measurement range')
        age = (datetime.now(timezone.utc) - cls._timestamp(result['updated_at'])).total_seconds()
        if not -900 <= age <= 7200:
            raise ValueError('weather timestamp is stale or in the future')
        return result

    @staticmethod
    def _header_delay(value, default=0):
        if not value:
            return default
        try:
            return max(default, int(value))
        except ValueError:
            try:
                return max(default, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError, OverflowError):
                return default

    @classmethod
    async def _fetch(cls, client, source):
        if source == 'Open-Meteo':
            response = await client.get(settings.OPEN_METEO_WEATHER_URL, params={
                'latitude': settings.HCMC_LAT, 'longitude': settings.HCMC_LON,
                'current': 'temperature_2m,relative_humidity_2m,rain', 'timezone': 'UTC',
            })
            response.raise_for_status()
            current = response.json()['current']
            result = {
                'temperature_c': current['temperature_2m'],
                'humidity_percent': current['relative_humidity_2m'],
                'rainfall_mm': current['rain'], 'updated_at': current['time'],
                'rain_period_minutes': int(current['interval']) // 60,
                'is_forecast': False, 'source_url': 'https://open-meteo.com/',
            }
        else:
            response = await client.get(settings.MET_NORWAY_WEATHER_URL,
                params={'lat': f'{settings.HCMC_LAT:.4f}', 'lon': f'{settings.HCMC_LON:.4f}'},
                headers={'User-Agent': 'HCMFloodWarning/1.0 github.com/tranduyloc895/iot-thingsboard'})
            response.raise_for_status()
            series = response.json()['properties']['timeseries']
            now = datetime.now(timezone.utc)
            point = max((p for p in series if cls._timestamp(p['time']) <= now), key=lambda p: p['time'])
            instant = point['data']['instant']['details']
            result = {
                'temperature_c': instant['air_temperature'],
                'humidity_percent': instant['relative_humidity'],
                'rainfall_mm': point['data']['next_1_hours']['details']['precipitation_amount'],
                'updated_at': point['time'], 'rain_period_minutes': 60,
                'is_forecast': True, 'source_url': 'https://www.met.no/en',
            }
        result = cls._validate(result)
        if result['rain_period_minutes'] <= 0:
            raise ValueError('invalid precipitation interval')
        return result, response

    @classmethod
    async def get_current_weather(cls) -> dict:
        async with cls._lock:
            if cls._cached is not None and time.monotonic() < cls._expires:
                cached = dict(cls._cached)
                if not cached.get('error'):
                    try:
                        cls._validate(cached)
                    except (ValueError, KeyError, TypeError):
                        cached.update(temperature_c=None, humidity_percent=None, rainfall_mm=None,
                                      error='Dữ liệu thời tiết đã quá hạn. Đang chờ nguồn cập nhật.')
                return cached
            result = None
            ttl = 900
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                for source in ('Open-Meteo', 'MET Norway'):
                    if time.monotonic() < cls._blocked_until.get(source, 0):
                        continue
                    try:
                        result, response = await cls._fetch(client, source)
                        # Six replicas now make about 144 calls/day rather than 8,640.
                        ttl = 3600 + random.uniform(0, 300)
                        ttl = cls._header_delay(response.headers.get('Expires'), ttl)
                        cls._failures.pop(source, None)
                        result.update(source=source, error=None,
                                      notice='; '.join(cls._failures.values()) or None)
                        break
                    except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError) as exc:
                        response = exc.response if isinstance(exc, httpx.HTTPStatusError) else None
                        status = response.status_code if response is not None else None
                        reason = f'HTTP {status}' if status else type(exc).__name__
                        logger.warning('Weather fetch failed: provider=%s reason=%s', source, reason)
                        cls._failures[source] = f'{source}: {reason}'
                        # Daily quota errors must not be retried every WS frame.
                        delay = 86400 if status == 429 else 900
                        if response is not None:
                            delay = cls._header_delay(response.headers.get('Retry-After'), delay)
                        cls._blocked_until[source] = time.monotonic() + delay
                        result = None
            if result is None:
                result = {'temperature_c': None, 'humidity_percent': None, 'rainfall_mm': None,
                          'source': 'Open-Meteo / MET Norway',
                          'error': 'Không lấy được thời tiết. ' + '; '.join(cls._failures.values()) + '. Đang chờ thử lại.'}
            cls._cached = result
            cls._expires = time.monotonic() + ttl
            return dict(result)
