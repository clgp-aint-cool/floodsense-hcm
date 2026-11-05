import asyncio
import time
import unittest
from unittest.mock import patch
import httpx
from app.config import settings
from app.services.thingsboard_service import ThingsBoardService


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
        values = {'device_id': 'VN-HCM-001', 'water_level_cm': water, **extra}
        return {key: [{'ts': ts, 'value': value}] for key, value in values.items()}

    async def test_all_pages_and_newest_device_win(self):
        pages = []
        def handler(request):
            if request.url.path == '/api/tenant/devices':
                page = int(request.url.params['page']); pages.append(page)
                name = 'new' if page == 0 else 'old'
                return httpx.Response(200, json={'data': [{'id': {'id': name}, 'name': name}], 'hasNext': page == 0})
            return httpx.Response(200, json=self.reading(age=60 if '/old/' in request.url.path else 0))
        service = await self.service(handler)
        devices, error = await service.get_snapshot()
        self.assertEqual(pages, [0, 1])
        self.assertEqual(devices[0].device_id, 'VN-HCM-001')
        self.assertEqual(devices[0].water_level_cm, 42)
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

    async def test_stale_water_is_not_revived_by_fresh_other_keys(self):
        data = self.reading(age=150)
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
        service = ThingsBoardService()
        self.addAsyncCleanup(service.tb_client.aclose)
        self.assertEqual(len(service.stations), 50)
        self.assertIsNone(service._station_index({}, 'some_other_device'))
        self.assertEqual(service._station_index({}, 'VN-HCM-050'), 49)
        data = {'device_id': [{'ts': 1, 'value': 'VN-HCM-005'}]}
        self.assertEqual(service._station_index(data, 'anything'), 4)

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


if __name__ == '__main__': unittest.main()
