import asyncio
import time
import unittest
from unittest.mock import patch
import httpx
from app.config import settings
from app.services.thingsboard_service import ThingsBoardService
from app.services.weather_service import WeatherService
from app.services.tide_service import TideService


class TelemetryTests(unittest.IsolatedAsyncioTestCase):
    async def service(self, handler):
        service = ThingsBoardService()
        await service.tb_client.aclose()
        service.tb_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        service.jwt_token = 'valid'
        service.token_expiry = time.time() + 300
        self.addAsyncCleanup(service.tb_client.aclose)
        return service

    def reading(self, age=0, water='42', **extra):
        ts = int(time.time() * 1000) - age * 1000
        values = {'parent_id': 'road-01', 'segment_idx': '0', 'water_level_cm': water, **extra}
        return {key: [{'ts': ts, 'value': value}] for key, value in values.items()}

    async def test_all_pages_and_newest_device_win(self):
        pages = []
        def handler(request):
            if request.url.path == '/api/tenant/devices':
                page = int(request.url.params['page']); pages.append(page)
                name = 'new' if page == 0 else 'old'
                return httpx.Response(200, json={'data': [{'id': {'id': name}, 'name': name}], 'hasNext': page == 0})
            return httpx.Response(200, json=self.reading(age=120 if '/old/' in request.url.path else 0))
        service = await self.service(handler)
        devices, error = await service.get_snapshot()
        self.assertEqual(pages, [0, 1])
        self.assertEqual(devices[0].device_id, 'new')
        self.assertEqual(devices[0].status, 'WARNING')
        self.assertIsNone(error)
        self.assertEqual(service.get_city_summary(devices).total_active_devices, 1)
        await asyncio.gather(*(service.get_live_devices() for _ in range(8)))
        self.assertEqual(pages, [0, 1], 'REST and WS must share upstream reads')

    async def test_connection_failure_is_visible_and_never_zero_measurements(self):
        def handler(request):
            raise httpx.ConnectError('DNS failure', request=request)
        service = await self.service(handler)
        devices, error = await service.get_snapshot()
        self.assertTrue(error)
        self.assertTrue(all(d.status == 'OFFLINE' and d.water_level_cm is None and d.error for d in devices))
        self.assertIsNone(service.get_city_summary(devices).avg_water_level_cm)
        self.assertTrue(all(r.max_water_cm is None for r in service.get_flooded_roads(devices)))
        self.assertTrue(all(n.water_level_cm is None and n.error for z in service.get_flood_zones(devices) for n in z.nodes))

    async def test_stale_water_is_not_revived_by_fresh_other_keys(self):
        data = self.reading(age=120)
        data['temperature_c'] = [{'ts': int(time.time()*1000), 'value': '30'}]
        def handler(request):
            if '/tenant/devices' in request.url.path:
                return httpx.Response(200, json={'data': [{'id': {'id': 'x'}, 'name': 'x'}]})
            return httpx.Response(200, json=data)
        service = await self.service(handler)
        devices, error = await service.get_snapshot()
        self.assertEqual(devices[0].status, 'OFFLINE')
        self.assertIsNone(devices[0].water_level_cm)
        self.assertTrue(error)

    async def test_unmapped_device_never_assigned_by_list_position(self):
        self.assertIsNone(ThingsBoardService._station_index({}, 'HCM_Vehicle_old_451'))
        self.assertEqual(ThingsBoardService._station_index({}, 'VN-HCM-050'), 49)
        self.assertEqual(ThingsBoardService._station_index({}, 'HCM_Vehicle_old_05'), 4)

    async def test_expired_jwt_reauth_once(self):
        calls = []
        def handler(request):
            calls.append(request.url.path)
            if request.url.path == '/api/auth/login':
                return httpx.Response(200, json={'token': 'refreshed'})
            if request.headers['X-Authorization'] == 'Bearer valid':
                return httpx.Response(401)
            return httpx.Response(200, json={'data': [], 'hasNext': False})
        service = await self.service(handler)
        with patch.object(settings, 'THINGSBOARD_USERNAME', 'test'), patch.object(settings, 'THINGSBOARD_PASSWORD', 'test'):
            await service.get_snapshot()
        self.assertEqual(calls.count('/api/auth/login'), 1)
        self.assertEqual(service.jwt_token, 'refreshed')

    async def test_partial_failure_keeps_successful_station(self):
        def handler(request):
            if '/tenant/devices' in request.url.path:
                return httpx.Response(200, json={'data': [{'id': {'id': name}, 'name': name} for name in ['ok', 'broken']]})
            if '/broken/' in request.url.path: return httpx.Response(503)
            return httpx.Response(200, json=self.reading())
        service = await self.service(handler)
        devices, error = await service.get_snapshot()
        self.assertEqual(devices[0].status, 'WARNING')
        self.assertIn('1/2', error)

    async def test_missing_credentials_explicit(self):
        service = ThingsBoardService()
        self.addAsyncCleanup(service.tb_client.aclose)
        with patch.object(settings, 'THINGSBOARD_USERNAME', ''), patch.object(settings, 'THINGSBOARD_PASSWORD', ''):
            devices, error = await service.get_snapshot()
        self.assertIn('tài khoản', error)
        self.assertIsNone(devices[0].water_level_cm)

    async def test_tides_have_full_hcm_stations(self):
        tides = await TideService.get_tide_data()
        self.assertEqual(len(tides), 10)
        self.assertIsNone(TideService.unavailable_reason)

    async def test_weather_failure_has_no_baseline(self):
        WeatherService._cached = None
        WeatherService._expires = 0
        class BrokenClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def get(self, *args, **kwargs): raise httpx.ConnectError('offline')
        with patch('app.services.weather_service.httpx.AsyncClient', return_value=BrokenClient()):
            weather = await WeatherService.get_current_weather()
        self.assertTrue(weather['error'])
        self.assertIsNone(weather['temperature_c'])
        self.assertIsNone(weather['rainfall_mm'])
        WeatherService._cached = None
        WeatherService._expires = 0

if __name__ == '__main__': unittest.main()
