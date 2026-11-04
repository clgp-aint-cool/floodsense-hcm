import asyncio
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
import time
import unittest
from unittest.mock import patch

import httpx
from app.services.weather_service import WeatherService


class WeatherTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        WeatherService._cached = None
        WeatherService._expires = 0
        WeatherService._blocked_until = {}
        WeatherService._failures = {}

    def tearDown(self):
        self.setUp()

    def open_data(self, **changes):
        current = {'temperature_2m': 28.3, 'relative_humidity_2m': 83, 'rain': 0,
                   'time': datetime.now(timezone.utc).isoformat(), 'interval': 900}
        current.update(changes)
        return {'current': current}

    def met_data(self, age=0):
        return {'properties': {'timeseries': [{
            'time': (datetime.now(timezone.utc) - timedelta(seconds=age)).isoformat(),
            'data': {'instant': {'details': {'air_temperature': 28.3, 'relative_humidity': 81.6}},
                     'next_1_hours': {'details': {'precipitation_amount': 0.2}}}}]}}

    async def call(self, handler):
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        with patch('app.services.weather_service.httpx.AsyncClient', return_value=client):
            return await WeatherService.get_current_weather()

    async def test_success_preserves_zero_and_interval_and_caches_concurrent_reads(self):
        calls = []
        def handler(request):
            calls.append(request)
            return httpx.Response(200, json=self.open_data())
        result = await self.call(handler)
        self.assertEqual(result['rainfall_mm'], 0)
        self.assertEqual(result['temperature_c'], 28.3)
        self.assertEqual(result['rain_period_minutes'], 15)
        self.assertEqual(result['source'], 'Open-Meteo')
        self.assertGreater(WeatherService._expires - time.monotonic(), 3500)
        await asyncio.gather(*(WeatherService.get_current_weather() for _ in range(20)))
        self.assertEqual(len(calls), 1)

    async def test_quota_fallback_and_cooldown(self):
        calls = []
        def handler(request):
            calls.append(request.url.host)
            if request.url.host == 'api.open-meteo.com':
                return httpx.Response(429, headers={'Retry-After': '90000'})
            self.assertIn('github.com/tranduyloc895', request.headers['user-agent'])
            return httpx.Response(200, json=self.met_data())
        result = await self.call(handler)
        self.assertEqual(result['source'], 'MET Norway')
        self.assertEqual(result['humidity_percent'], 81.6)
        self.assertEqual(result['rainfall_mm'], 0.2)
        self.assertTrue(result['is_forecast'])
        self.assertEqual(result['rain_period_minutes'], 60)
        self.assertIn('429', result['notice'])
        self.assertGreater(WeatherService._blocked_until['Open-Meteo'] - time.monotonic(), 89900)
        WeatherService._expires = 0
        await self.call(handler)
        self.assertEqual(calls.count('api.open-meteo.com'), 1)

    async def test_both_sources_fail_nulls_and_errors_are_cached(self):
        calls = []
        def handler(request):
            calls.append(request)
            return httpx.Response(503)
        result = await self.call(handler)
        self.assertTrue(all(result[k] is None for k in ('temperature_c', 'humidity_percent', 'rainfall_mm')))
        self.assertIn('Open-Meteo: HTTP 503', result['error'])
        self.assertIn('MET Norway: HTTP 503', result['error'])
        await WeatherService.get_current_weather()
        self.assertEqual(len(calls), 2)

    async def test_invalid_primary_and_stale_fallback_are_never_published(self):
        def handler(request):
            if request.url.host == 'api.open-meteo.com':
                return httpx.Response(200, json=self.open_data(relative_humidity_2m=101))
            return httpx.Response(200, json=self.met_data(age=10800))
        result = await self.call(handler)
        self.assertTrue(result['error'])
        self.assertIsNone(result['temperature_c'])

    async def test_expires_header_is_respected(self):
        expires = format_datetime(datetime.now(timezone.utc) + timedelta(seconds=4200))
        result = await self.call(lambda request: httpx.Response(200, json=self.open_data(), headers={'Expires': expires}))
        self.assertIsNone(result['error'])
        self.assertGreater(WeatherService._expires - time.monotonic(), 4190)

    async def test_cache_never_serves_expired_measurements_before_provider_allows_refresh(self):
        await self.call(lambda request: httpx.Response(200, json=self.open_data()))
        WeatherService._cached['updated_at'] = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
        result = await WeatherService.get_current_weather()
        self.assertTrue(result['error'])
        self.assertIsNone(result['temperature_c'])


if __name__ == '__main__':
    unittest.main()
