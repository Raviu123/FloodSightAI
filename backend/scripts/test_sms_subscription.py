import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

print('--- TEST 1: Connect phone number to ZONE-01 by ID ---')
sub1_res = client.post('/api/v1/zones/subscribe-sms', json={
    'phone_number': '+14155550101',
    'zone_id': 'ZONE-01',
    'name': 'Resident Alice'
})
print('Subscribe 1 Status:', sub1_res.status_code)
print('Subscribe 1 Body:', sub1_res.json())
assert sub1_res.status_code == 200
assert sub1_res.json()['subscription']['zone_id'] == 'ZONE-01'
assert 'Mangalore' in sub1_res.json()['subscription']['zone_name']

print('\n--- TEST 2: Connect phone number by Zone Name ---')
sub2_res = client.post('/api/v1/sms/subscribe-zone', json={
    'phone_number': '+16475550187',
    'zone_name': 'Udupi Lowland Swamps',
    'name': 'Resident Bob'
})
print('Subscribe 2 Status:', sub2_res.status_code)
print('Subscribe 2 Body:', sub2_res.json())
assert sub2_res.status_code == 200
assert sub2_res.json()['subscription']['zone_id'] == 'ZONE-02'

print('\n--- TEST 3: List all subscribers ---')
list_res = client.get('/api/v1/zones/subscribers')
print('List status:', list_res.status_code)
print('Total subscribers:', list_res.json()['total_count'])
assert list_res.json()['total_count'] >= 2

print('\n--- TEST 4: Trigger Instant Test Critical Alert for ZONE-01 ---')
test_alert_res = client.post('/api/v1/zones/ZONE-01/test-critical-sms')
print('Test Alert Status:', test_alert_res.status_code)
print('Test Alert Body:', test_alert_res.json())
assert test_alert_res.status_code == 200
assert test_alert_res.json()['success'] is True
assert '+14155550101' in test_alert_res.json()['data']['recipients_notified']

print('\n--- TEST 5: Run High Surge Simulation That Classifies Zones as CRITICAL ---')
sim_res = client.post('/api/v1/simulation/run', json={
    'tide_level_meters': 4.5,
    'rainfall_mm_per_hour': 180.0,
    'forecast_hours': 6,
    'cyclone_active': True,
    'soil_saturation': 0.95
})
print('Simulation Status:', sim_res.status_code)
sim_data = sim_res.json()
print('Critical Zones Count:', sim_data['critical_zones_count'])
auto_alerts = sim_data.get('auto_sms_alerts', [])
print('Auto SMS Alerts Dispatched in Simulation:', len(auto_alerts))
for alert in auto_alerts:
    print('   -> Alert fired for', alert['zone_id'], alert['zone_name'], 'to recipients:', alert['recipients_notified'])
assert sim_res.status_code == 200
assert len(auto_alerts) > 0

print('\n--- TEST 6: Unsubscribe Bob ---')
unsub_res = client.delete('/api/v1/zones/unsubscribe-sms', params={'phone_number': '+16475550187'})
print('Unsubscribe status:', unsub_res.status_code, unsub_res.json())
assert unsub_res.status_code == 200

print('\nALL SUITE VERIFICATIONS PASSED CLEANLY!')
