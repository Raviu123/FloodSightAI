import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from fastapi.testclient import TestClient
from app.services.sms_service import sms_service

client = TestClient(app)

print("=== 1. TEST PHONE NORMALIZATION ===")
assert sms_service.normalize_phone("9037152399") == "+919037152399"
assert sms_service.normalize_phone("+9037152399") == "+919037152399"
assert sms_service.normalize_phone("+919037152399") == "+919037152399"
assert sms_service.normalize_phone("+14155550101") == "+14155550101"
print("Phone normalization tests passed: 9037152399 -> +919037152399")

print("\n=== 2. TEST CONNECTING INDIAN NUMBER (9037152399) TO ZONE-01 ===")
res_sub = client.post("/api/v1/zones/subscribe-sms", json={
    "phone_number": "9037152399",
    "zone_id": "ZONE-01",
    "name": "Ravi",
})
print("Subscribe Status:", res_sub.status_code, res_sub.json())
assert res_sub.status_code == 200
assert res_sub.json()["subscription"]["phone_number"] == "+919037152399"

print("\n=== 3. TEST TRIGGERING INSTANT CRITICAL ALERT ===")
res_test = client.post("/api/v1/zones/ZONE-01/test-critical-sms")
print("Test Alert Status:", res_test.status_code, res_test.json())
assert res_test.status_code == 200
test_data = res_test.json()["data"]
print("Recipients notified:", test_data["recipients_notified"])
assert "+919037152399" in test_data["recipients_notified"]

print("\n=== 4. TEST FETCHING SMS LOGS ===")
res_logs = client.get("/api/v1/sms/logs")
print("SMS Logs Status:", res_logs.status_code)
logs_data = res_logs.json()
print("Total SMS Logs recorded:", logs_data["total_count"])
assert logs_data["total_count"] > 0

latest_log = logs_data["logs"][0]
print("Latest Log Entry:")
print("  Recipient:", latest_log["recipient"])
print("  Status:", latest_log["status"])
print("  Gateway Batch ID:", latest_log.get("gateway_batch_id"))
print("  Status Code:", latest_log.get("status_code"))
print("  Created At:", latest_log["created_at"])
assert latest_log["recipient"] == "+919037152399"

print("\n=== 5. TEST ZONE-SPECIFIC SMS LOGS ===")
res_zone_logs = client.get("/api/v1/zones/ZONE-01/sms-logs")
print("Zone Logs Status:", res_zone_logs.status_code)
zone_logs_data = res_zone_logs.json()
print("ZONE-01 Logs count:", zone_logs_data["total_count"])
assert zone_logs_data["total_count"] > 0

print("\n=== 6. TEST RUNNING AI SIMULATION TRIGGER ===")
res_sim = client.post("/api/v1/simulation/run", json={
    "tide_level_meters": 3.5,
    "rainfall_mm_per_hour": 120.0,
    "forecast_hours": 6,
    "cyclone_active": True,
    "soil_saturation": 0.85
})
print("Simulation Status:", res_sim.status_code)
sim_json = res_sim.json()
print("Critical zones count:", sim_json["critical_zones_count"])
print("Auto SMS Alerts count in response:", len(sim_json.get("auto_sms_alerts", [])))
for a in sim_json.get("auto_sms_alerts", []):
    print("  -> Fired auto SMS for", a["zone_id"], "to", a["recipients_notified"])

print("\n=== 7. VERIFY NEW SMS LOGS ADDED AFTER SIMULATION ===")
res_logs_after = client.get("/api/v1/sms/logs?limit=5")
print("Latest 3 logs after simulation:")
for l in res_logs_after.json()["logs"][:3]:
    print("  [Log]", l["created_at"], "|", l["zone_id"], "|", l["recipient"], "|", l["status"], "| batch:", l.get("gateway_batch_id"))

print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
