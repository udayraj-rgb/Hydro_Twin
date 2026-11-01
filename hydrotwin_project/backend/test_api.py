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


if __name__ == "__main__":
    unittest.main()
