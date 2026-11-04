"""
HydroTwin-PHM FastAPI Endpoints & Integration Verification Suite
AtomQuest 2026 - Track 2: Water Purifier
Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal
"""

import sys
import os
import unittest
from fastapi.testclient import TestClient

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

import main


class TestHydroTwinAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Initialize DB and client
        main.database.init_db()
        cls.client = TestClient(main.app)

    def setUp(self):
        main.simulator.flush_countdown = 0
        main.simulator.is_flushing = False
        main.simulator.accumulated_scale = 0.0
        main.simulator.mode = "MANUAL"
        main.simulator.active_scenario = "NONE"
        main.current_sensors.outlet_tds = None

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "OPERATIONAL")
        self.assertIn("endpoints", data)

    def test_fleet_endpoint(self):
        response = self.client.get("/api/fleet")
        self.assertEqual(response.status_code, 200)
        fleet = response.json()
        self.assertEqual(len(fleet), 5)
        cities = {f["city"] for f in fleet}
        self.assertTrue({"Bhopal", "Sehore", "Ahmedabad", "Jaipur", "Indore"}.issubset(cities))

    def test_fleet_state_filtering(self):
        # Test Maharashtra 5 major cities
        response_mh = self.client.get("/api/fleet?state=Maharashtra")
        self.assertEqual(response_mh.status_code, 200)
        fleet_mh = response_mh.json()
        self.assertEqual(len(fleet_mh), 5)
        cities_mh = {f["city"] for f in fleet_mh}
        self.assertTrue({"Mumbai", "Pune", "Nagpur", "Nashik"}.issubset(cities_mh))
        for unit in fleet_mh:
            self.assertEqual(unit["state"], "Maharashtra")
            self.assertIn("ATOM-WP-2026", unit["device_id"])
            self.assertTrue(len(unit["customer_name"]) > 2)

        # Test Karnataka 5 major cities
        response_ka = self.client.get("/api/fleet?state=Karnataka")
        self.assertEqual(response_ka.status_code, 200)
        fleet_ka = response_ka.json()
        self.assertEqual(len(fleet_ka), 5)
        cities_ka = {f["city"] for f in fleet_ka}
        self.assertTrue({"Bengaluru", "Mysuru", "Mangaluru"}.issubset(cities_ka))

    def test_fleet_states_summary_endpoint(self):
        response = self.client.get("/api/fleet/states")
        self.assertEqual(response.status_code, 200)
        states = response.json()
        self.assertEqual(len(states), 15)
        state_names = {s["state"] for s in states}
        self.assertIn("Madhya Pradesh", state_names)
        self.assertIn("Maharashtra", state_names)
        self.assertIn("Delhi (NCR)", state_names)
        self.assertIn("Tamil Nadu", state_names)
        self.assertIn("Rajasthan", state_names)
        for s in states:
            self.assertEqual(s["unit_count"], 5)
            self.assertGreater(s["avg_raw_tds"], 100)
            self.assertGreater(s["avg_health"], 0)

    def test_update_sensors_nominal(self):
        payload = {
            "inlet_tds": 850.0,
            "flow_lpm": 1.20,
            "pump_current": 0.85
        }
        response = self.client.post("/api/update_sensors", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        state = data["latest_state"]

        self.assertEqual(state["sensors"]["inlet_tds"], 850.0)
        self.assertTrue(state["actuators"]["relay_pump"])
        self.assertTrue(state["actuators"]["inlet_valve"])
        self.assertFalse(state["actuators"]["flush_solenoid"])
        self.assertGreater(state["prognostics"]["rul_days"], 14)
        self.assertFalse(state["prognostics"]["auto_dispatch"])

    def test_dynamic_anti_scaling_flush(self):
        # Hard water spike: 1600 ppm triggers anti-scaling dynamic micro-flush
        payload = {
            "inlet_tds": 1600.0,
            "flow_lpm": 1.10,
            "pump_current": 1.05
        }
        response = self.client.post("/api/update_sensors", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        state = data["latest_state"]

        self.assertTrue(state["actuators"]["flush_solenoid"])
        self.assertIn("Anti-Scaling Dynamic Micro-Flush", state["status"])

    def test_cavitation_fault_trip(self):
        # Dry-run cavitation: Pump current < 0.15 A -> Cut off pump relay
        payload = {
            "inlet_tds": 850.0,
            "flow_lpm": 0.1,
            "pump_current": 0.08
        }
        response = self.client.post("/api/update_sensors", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        state = data["latest_state"]

        self.assertFalse(state["actuators"]["relay_pump"])
        self.assertIn("Dry-Run Cavitation", state["status"])

    def test_motor_stall_trip(self):
        # Motor stall: Pump current > 1.80 A -> Cut off pump relay
        payload = {
            "inlet_tds": 850.0,
            "flow_lpm": 0.2,
            "pump_current": 1.95
        }
        response = self.client.post("/api/update_sensors", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        state = data["latest_state"]

        self.assertFalse(state["actuators"]["relay_pump"])
        self.assertIn("Motor Armature Overcurrent Stall", state["status"])

    def test_membrane_breach_lockout(self):
        # Acute rupture: Outlet TDS >= 50% of inlet TDS
        payload = {
            "inlet_tds": 900.0,
            "flow_lpm": 1.3,
            "pump_current": 0.85,
            "outlet_tds": 750.0
        }
        response = self.client.post("/api/update_sensors", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        state = data["latest_state"]

        self.assertFalse(state["actuators"]["inlet_valve"])
        self.assertIn("Membrane Rupture", state["status"])

    def test_auto_dispatch_order_generation(self):
        # Severe fouling causing RUL <= 14 days
        payload = {
            "inlet_tds": 850.0,
            "flow_lpm": 0.1,
            "pump_current": 1.20  # High R_sediment = (1.20 / 0.1) * 0.85 = 10.2 -> health = 0%
        }
        response = self.client.post("/api/update_sensors", json=payload)
        self.assertEqual(response.status_code, 200)
        state = response.json()["latest_state"]

        self.assertTrue(state["prognostics"]["auto_dispatch"])
        self.assertLessEqual(state["prognostics"]["rul_days"], 14)

        # Check that order was logged in database
        orders_resp = self.client.get("/api/orders")
        self.assertEqual(orders_resp.status_code, 200)
        orders = orders_resp.json()["orders"]
        self.assertGreater(len(orders), 0)
        self.assertEqual(orders[0]["device_id"], "ATOM-WP-2026-0042")
        self.assertEqual(orders[0]["order_status"], "ORDER DISPATCHED")

    def test_recent_telemetry_endpoint(self):
        response = self.client.get("/api/telemetry/recent?limit=10")
        self.assertEqual(response.status_code, 200)
        telemetry = response.json()
        self.assertIn("telemetry", telemetry)
        self.assertGreater(len(telemetry["telemetry"]), 0)

    def test_consumer_control_municipal_adaptive(self):
        payload = {
            "source_water": "MUNICIPAL",
            "mode": "ADAPTIVE",
            "manual_flush": False
        }
        response = self.client.post("/api/consumer/control", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("applied_setpoints", data)
        self.assertEqual(data["applied_setpoints"]["source_water"], "MUNICIPAL")
        self.assertEqual(data["applied_setpoints"]["inlet_tds"], 320.0)
        self.assertEqual(data["applied_setpoints"]["flow_lpm"], 1.40)
        self.assertEqual(data["applied_setpoints"]["pump_current"], 0.72)

    def test_consumer_control_borewell_ro_uv(self):
        payload = {
            "source_water": "BOREWELL",
            "mode": "RO_UV",
            "manual_flush": False
        }
        response = self.client.post("/api/consumer/control", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["applied_setpoints"]["source_water"], "BOREWELL")
        self.assertEqual(data["applied_setpoints"]["inlet_tds"], 920.0)
        self.assertEqual(data["applied_setpoints"]["flow_lpm"], 1.10)
        self.assertEqual(data["applied_setpoints"]["pump_current"], 0.95)

    def test_consumer_control_tastetune(self):
        payload = {
            "source_water": "BOREWELL",
            "mode": "TASTETUNE",
            "target_tds": 85.0,
            "manual_flush": False
        }
        response = self.client.post("/api/consumer/control", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["applied_setpoints"]["target_tds"], 85.0)
        state = data["latest_state"]
        self.assertEqual(state["sensors"]["outlet_tds"], 85.0)

    def test_consumer_control_vacay(self):
        payload = {
            "source_water": "TANKER",
            "mode": "VACAY",
            "manual_flush": False
        }
        response = self.client.post("/api/consumer/control", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["applied_setpoints"]["flow_lpm"], 0.20)
        self.assertEqual(data["applied_setpoints"]["pump_current"], 0.35)

    def test_consumer_control_manual_flush(self):
        payload = {
            "source_water": "BOREWELL",
            "mode": "ADAPTIVE",
            "manual_flush": True
        }
        response = self.client.post("/api/consumer/control", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["applied_setpoints"]["flush_active"])
        state = data["latest_state"]
        self.assertTrue(state["actuators"]["flush_solenoid"])

    def test_consumer_control_validation_errors(self):
        # Invalid source_water
        resp1 = self.client.post("/api/consumer/control", json={"source_water": "RIVER", "mode": "ADAPTIVE"})
        self.assertEqual(resp1.status_code, 400)

        # Invalid mode
        resp2 = self.client.post("/api/consumer/control", json={"source_water": "BOREWELL", "mode": "TURBO"})
        self.assertEqual(resp2.status_code, 400)

        # target_tds out of range (< 30)
        resp3 = self.client.post("/api/consumer/control", json={"mode": "TASTETUNE", "target_tds": 15.0})
        self.assertEqual(resp3.status_code, 422)

    def test_consumer_diagnostics_endpoint(self):
        response = self.client.get("/api/consumer/diagnostics")
        self.assertEqual(response.status_code, 200)
        diag = response.json()
        self.assertIn("timestamp", diag)
        self.assertIn("device_id", diag)
        self.assertIn("overall_health_score", diag)
        self.assertIn("system_status", diag)
        self.assertIn("diagnostics", diag)

        components = diag["diagnostics"]
        self.assertIn("booster_pump", components)
        self.assertIn("ro_membrane", components)
        self.assertIn("alkaline_remineralizer", components)
        self.assertIn("filtration_stages", components)

        self.assertIn(components["booster_pump"]["status"], {"NOMINAL", "SAFETY_TRIP_CAVITATION", "SAFETY_TRIP_OVERCURRENT_STALL"})
        self.assertIn(components["ro_membrane"]["fouling_level"], {"OPTIMAL", "MODERATE_FOULING", "CRITICAL_SCALING"})
        self.assertIn(components["alkaline_remineralizer"]["status"], {"OPTIMAL_MINERALIZATION", "ACCEPTABLE", "DEPLETED"})
        self.assertIsInstance(diag["overall_health_score"], (int, float))

    def test_portal_auth_login_endpoints(self):
        # 1. Test Engineering HIL login
        resp_hil = self.client.post("/api/auth/login", json={
            "username": "alok.mishra@atomberg.internal",
            "password": "AtombergHIL@2026",
            "role": "hil"
        })
        self.assertEqual(resp_hil.status_code, 200)
        data_hil = resp_hil.json()
        self.assertTrue(data_hil["authenticated"])
        self.assertEqual(data_hil["portal"], "hil")
        self.assertEqual(data_hil["badge"], "ENGINEERING LEVEL 3 CLEARANCE")
        self.assertIn("who_uses_it", data_hil)
        self.assertIn("why_it_exists", data_hil)

        # 2. Test Consumer login
        resp_consumer = self.client.post("/api/auth/login", json={
            "username": "rajesh.sharma@gmail.com",
            "password": "WaterSafe@2026",
            "role": "consumer"
        })
        self.assertEqual(resp_consumer.status_code, 200)
        data_consumer = resp_consumer.json()
        self.assertTrue(data_consumer["authenticated"])
        self.assertEqual(data_consumer["portal"], "consumer")
        self.assertEqual(data_consumer["badge"], "HOMEOWNER & END-USER")

        # 3. Test OEM Fleet login
        resp_fleet = self.client.post("/api/auth/login", json={
            "username": "vikram.rathore@atomberg.com",
            "password": "FleetOps@2026",
            "role": "fleet"
        })
        self.assertEqual(resp_fleet.status_code, 200)
        data_fleet = resp_fleet.json()
        self.assertTrue(data_fleet["authenticated"])
        self.assertEqual(data_fleet["portal"], "fleet")
        self.assertEqual(data_fleet["badge"], "REGIONAL SERVICE & D2C SUPPLY CHAIN")

        # 4. Test Invalid role
        resp_invalid = self.client.post("/api/auth/login", json={
            "username": "user",
            "password": "pass",
            "role": "unknown_tier"
        })
        self.assertEqual(resp_invalid.status_code, 400)

    def test_telemetry_latest_and_contract_completeness(self):
        # Trigger an update so latest_packet is populated
        self.client.post("/api/update_sensors", json={
            "inlet_tds": 850.0,
            "flow_lpm": 1.20,
            "pump_current": 0.85
        })

        # Test both /api/state and /api/telemetry/latest
        for endpoint in ["/api/state", "/api/telemetry/latest"]:
            resp = self.client.get(endpoint)
            self.assertEqual(resp.status_code, 200)
            data = resp.json()

            # Verify checklist required keys:
            required_keys = [
                "device_id", "inlet_tds", "outlet_tds", "flow_lpm", "pump_current", "delta_p",
                "r_sediment", "r_cake", "r_sed_slope", "r_cake_slope", "salt_rejection",
                "delta_mineral", "cp_index", "sediment_health", "carbon_health", "ro_health",
                "alkaliser_health", "rul_days", "auto_dispatch", "failing_stage",
                "relay_pump", "inlet_valve", "flush_solenoid", "status"
            ]
            for key in required_keys:
                self.assertIn(key, data, f"Missing required telemetry contract key: '{key}'")
                self.assertIsNotNone(data[key], f"Key '{key}' is None")

            # Verify grouped structures are also present
            for grp in ["sensors", "actuators", "physics", "prognostics", "simulation"]:
                self.assertIn(grp, data)

    def test_database_slope_columns_logged(self):
        # Verify columns exist in SQLite schema
        conn = main.database.get_db_connection()
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(telemetry);").fetchall()}
        conn.close()
        self.assertIn("r_sed_slope", cols)
        self.assertIn("r_cake_slope", cols)

        # Log a test frame and verify retrieval
        row_id = main.database.log_telemetry({
            "device_id": "TEST-DEVICE-01",
            "inlet_tds": 850.0,
            "outlet_tds": 42.0,
            "flow_lpm": 1.20,
            "pump_current": 0.85,
            "delta_p": 1.11,
            "r_sediment": 0.60,
            "r_cake": 0.18,
            "r_sed_slope": 0.0085,
            "r_cake_slope": 0.0142,
            "salt_rejection": 95.2,
            "status": "NOMINAL"
        })
        self.assertGreater(row_id, 0)

        recent = main.database.get_recent_telemetry(limit=5)
        self.assertTrue(len(recent) > 0)
        latest_row = recent[-1]
        self.assertIn("r_sed_slope", latest_row)
        self.assertIn("r_cake_slope", latest_row)


if __name__ == "__main__":
    unittest.main()
