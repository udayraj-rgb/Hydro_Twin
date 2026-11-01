"""
HydroTwin-PHM Backend Verification Suite
AtomQuest 2026 - Track 2: Water Purifier
Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal
"""

import os
import sys
import tempfile
import unittest

# Ensure current backend directory is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from database import get_recent_orders, get_recent_telemetry, init_db, log_order, log_telemetry
from physics_engine import DarcyHermiaPhysicsEngine


class TestHydroTwinBackend(unittest.TestCase):

    def setUp(self):
        # Create an isolated temporary SQLite database for unit tests
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        init_db(self.temp_db_path)
        self.engine = DarcyHermiaPhysicsEngine(membrane_area=1.0, clean_membrane_resistance=0.35)

    def tearDown(self):
        os.close(self.temp_db_fd)
        if os.path.exists(self.temp_db_path):
            try:
                os.remove(self.temp_db_path)
            except OSError:
                pass

    def test_database_telemetry_flow(self):
        # 1. Insert multiple frames
        frame_1 = {
            "device_id": "ATOM-WP-2026-0042",
            "inlet_tds": 850.0,
            "outlet_tds": 42.0,
            "flow_lpm": 1.20,
            "pump_current": 0.85,
            "delta_p": 1.11,
            "r_sediment": 0.60,
            "r_cake": 1.12,
            "salt_rejection": 95.05,
            "status": "NOMINAL"
        }
        id_1 = log_telemetry(frame_1, db_path=self.temp_db_path)
        self.assertGreater(id_1, 0)

        frame_2 = {
            "device_id": "ATOM-WP-2026-0042",
            "inlet_tds": 1600.0,
            "outlet_tds": 75.0,
            "flow_lpm": 1.10,
            "pump_current": 1.05,
            "delta_p": 1.40,
            "r_sediment": 0.81,
            "r_cake": 1.45,
            "salt_rejection": 95.31,
            "status": "CP_FLUSH"
        }
        id_2 = log_telemetry(frame_2, db_path=self.temp_db_path)
        self.assertEqual(id_2, id_1 + 1)

        # 2. Retrieve recent telemetry
        records = get_recent_telemetry(limit=10, db_path=self.temp_db_path)
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]["id"], id_1)
        self.assertEqual(records[1]["id"], id_2)
        self.assertEqual(records[1]["status"], "CP_FLUSH")

    def test_database_order_flow(self):
        order_id = log_order(
            device_id="ATOM-WP-2026-0042",
            customer_name="Sunita Sharma",
            city="Jaipur",
            stage="RO Membrane",
            rul_days=9,
            order_status="ORDER DISPATCHED",
            db_path=self.temp_db_path
        )
        self.assertGreater(order_id, 0)

        orders = get_recent_orders(limit=5, db_path=self.temp_db_path)
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["customer_name"], "Sunita Sharma")
        self.assertEqual(orders[0]["predicted_rul_days"], 9)
        self.assertEqual(orders[0]["order_status"], "ORDER DISPATCHED")

    def test_physics_engine_nominal_state(self):
        result = self.engine.compute(
            inlet_tds=850.0,
            flow_lpm=1.20,
            pump_current=0.85,
            outlet_tds=42.0
        )
        required_keys = [
            "outlet_tds", "delta_p", "delta_pi", "r_sediment",
            "r_cake", "salt_rejection", "delta_mineral", "cp_index"
        ]
        for key in required_keys:
            self.assertIn(key, result, f"Missing required key: {key}")

        # Verification of numerical bounds
        self.assertAlmostEqual(result["delta_p"], 1.112, places=2)
        self.assertGreater(result["salt_rejection"], 94.0)
        self.assertFalse(result["is_cavitation_risk"])
        self.assertFalse(result["is_stall_risk"])
        self.assertFalse(result["is_membrane_breached"])

    def test_physics_engine_hard_water_and_cp_flush(self):
        result = self.engine.compute(
            inlet_tds=1600.0,
            flow_lpm=1.0,
            pump_current=1.0
        )
        # CP = (1600/1000) * (Delta_P / 1.0)
        self.assertGreater(result["cp_index"], 1.25)
        self.assertTrue(result["cp_flush_triggered"])

    def test_physics_engine_cavitation_and_stall(self):
        cavitation = self.engine.compute(inlet_tds=800.0, flow_lpm=0.1, pump_current=0.08)
        self.assertTrue(cavitation["is_cavitation_risk"])

        stall = self.engine.compute(inlet_tds=800.0, flow_lpm=0.2, pump_current=1.95)
        self.assertTrue(stall["is_stall_risk"])

    def test_physics_engine_membrane_breach(self):
        breach = self.engine.compute(inlet_tds=1000.0, flow_lpm=1.2, pump_current=0.85, outlet_tds=600.0)
        self.assertTrue(breach["is_membrane_breached"])
        self.assertLess(breach["salt_rejection"], 50.0)


if __name__ == "__main__":
    unittest.main()
