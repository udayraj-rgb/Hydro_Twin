"""
HydroTwin-PHM Autonomous Environment Simulator & Dynamic Engine Verification Suite
AtomQuest 2026 - Track 2: Water Purifier
Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal
"""

import os
import sys
import unittest
from fastapi.testclient import TestClient

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

import main
from physics_engine import AutonomousEnvironmentSimulator, DarcyHermiaPhysicsEngine


class TestAutonomousSimulation(unittest.TestCase):

    def setUp(self):
        self.sim = AutonomousEnvironmentSimulator(base_tds=850.0)
        self.engine = DarcyHermiaPhysicsEngine()

    def test_diurnal_clock_acceleration(self):
        # Initial: 07:15:00
        initial_clock = self.sim.get_clock_info()
        self.assertEqual(initial_clock["time_str"], "07:15:00")
        self.assertIn("Morning Peak", initial_clock["phase"])

        # Tick 1: advances by 1 virtual minute (60s)
        state_1 = self.sim.tick()
        self.assertEqual(state_1["time_str"], "07:16:00")
        self.assertEqual(state_1["hour"], 7)
        self.assertEqual(state_1["minute"], 16)

        # Tick 44: reaches 08:00:00
        for _ in range(44):
            state_last = self.sim.tick()
        self.assertEqual(state_last["time_str"], "08:00:00")
        self.assertEqual(state_last["hour"], 8)

    def test_diurnal_phases_and_drinking_patterns(self):
        # 1. Test Morning Peak (07:00)
        sim_morning = AutonomousEnvironmentSimulator(initial_time_seconds=7 * 3600)
        state_m = sim_morning.tick(mode="AUTONOMOUS")
        self.assertGreaterEqual(state_m["flow_lpm"], 1.30)
        self.assertLessEqual(state_m["flow_lpm"], 1.50)
        self.assertGreaterEqual(state_m["pump_current"], 0.85)
        self.assertGreaterEqual(state_m["inlet_tds"], 850.0)

        # 2. Test Afternoon Low (13:00)
        sim_afternoon = AutonomousEnvironmentSimulator(initial_time_seconds=13 * 3600)
        state_a = sim_afternoon.tick(mode="AUTONOMOUS")
        self.assertGreaterEqual(state_a["flow_lpm"], 0.70)
        self.assertLessEqual(state_a["flow_lpm"], 0.90)
        self.assertGreaterEqual(state_a["pump_current"], 0.70)

        # 3. Test Evening Peak (19:30)
        sim_evening = AutonomousEnvironmentSimulator(initial_time_seconds=19 * 3600 + 30 * 60)
        state_e = sim_evening.tick(mode="AUTONOMOUS")
        self.assertGreaterEqual(state_e["flow_lpm"], 1.20)
        self.assertLessEqual(state_e["flow_lpm"], 1.40)

        # 4. Test Night Standby (02:00)
        sim_night = AutonomousEnvironmentSimulator(initial_time_seconds=2 * 3600)
        state_n = sim_night.tick(mode="AUTONOMOUS")
        self.assertEqual(state_n["flow_lpm"], 0.0)
        self.assertEqual(state_n["pump_current"], 0.0)

    def test_dynamic_scale_accumulation_and_washdown(self):
        sim = AutonomousEnvironmentSimulator(initial_time_seconds=7 * 3600)
        # Advance 10 ticks in morning peak: flow > 0 -> scale accumulates
        for _ in range(10):
            state = sim.tick(mode="AUTONOMOUS")

        self.assertGreater(state["accumulated_scale"], 0.0)

        # Now test DarcyHermiaPhysicsEngine incorporates scale and washdown
        phys_nominal = self.engine.compute(
            inlet_tds=850.0,
            flow_lpm=1.20,
            pump_current=0.85,
            washdown_factor=1.0,
            accumulated_scale=0.0
        )
        phys_fouled = self.engine.compute(
            inlet_tds=850.0,
            flow_lpm=1.20,
            pump_current=0.85,
            washdown_factor=1.0,
            accumulated_scale=0.25
        )
        # Fouled membrane must have higher R_cake
        self.assertGreater(phys_fouled["r_cake"], phys_nominal["r_cake"])

        # During washdown, R_cake is reduced by 18% (washdown_factor = 0.82)
        phys_washed = self.engine.compute(
            inlet_tds=850.0,
            flow_lpm=1.20,
            pump_current=0.85,
            washdown_factor=0.82,
            accumulated_scale=0.25
        )
        self.assertLess(phys_washed["r_cake"], phys_fouled["r_cake"])

    def test_municipal_cutoff_scenario(self):
        sim = AutonomousEnvironmentSimulator()
        sim.trigger_scenario("MUNICIPAL_CUTOFF")

        # Ticks 0..3: flow and current drop
        for _ in range(3):
            s = sim.tick()

        # Tick 4: in hold period, flow is 0.0, current is 0.07 A (<0.15 A dry-run trip)
        s_hold = sim.tick()
        self.assertEqual(s_hold["flow_lpm"], 0.0)
        self.assertAlmostEqual(s_hold["pump_current"], 0.07, places=2)

        # Interlock check on this state
        interlock = main.edge_interlocks.evaluate(
            pump_current=s_hold["pump_current"],
            inlet_tds=s_hold["inlet_tds"],
            outlet_tds=42.0
        )
        self.assertFalse(interlock["relay_pump"])
        self.assertIn("Dry-Run Cavitation", interlock["status"])

        # Fast forward through hold (until tick 11) -> recovers
        for _ in range(8):
            s_rec = sim.tick()
        self.assertEqual(s_rec["mode"], "AUTONOMOUS")
        self.assertEqual(s_rec["active_scenario"], "NONE")
        self.assertGreater(s_rec["flow_lpm"], 0.5)

    def test_hardness_spike_scenario(self):
        sim = AutonomousEnvironmentSimulator()
        sim.trigger_scenario("HARDNESS_SPIKE")

        # Ticks 0..2 ramp to 1750 ppm
        for _ in range(3):
            s = sim.tick()

        # Tick 3: at 1750 ppm
        self.assertGreaterEqual(s["inlet_tds"], 1700.0)
        # Dynamic anti-scaling flush triggered
        self.assertTrue(s["flush_solenoid"])
        self.assertEqual(s["washdown_factor"], 0.82)

    def test_pump_stall_scenario(self):
        sim = AutonomousEnvironmentSimulator()
        sim.trigger_scenario("PUMP_STALL")

        # Ticks 0..3: ramps to 2.15 A
        for _ in range(4):
            s = sim.tick()

        self.assertAlmostEqual(s["pump_current"], 2.15, places=2)
        interlock = main.edge_interlocks.evaluate(
            pump_current=s["pump_current"],
            inlet_tds=s["inlet_tds"],
            outlet_tds=42.0
        )
        self.assertFalse(interlock["relay_pump"])
        self.assertIn("Overcurrent Stall", interlock["status"])


class TestAutonomousAPIEndpoints(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        main.database.init_db()
        cls.client = TestClient(main.app)

    def test_mode_update_endpoint(self):
        # Set to AUTONOMOUS
        resp = self.client.post("/api/mode", json={"mode": "AUTONOMOUS", "active_scenario": "NONE"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["simulation"]["mode"], "AUTONOMOUS")

        # Set to SCENARIO HARDNESS_SPIKE
        resp2 = self.client.post("/api/mode", json={"mode": "SCENARIO", "active_scenario": "HARDNESS_SPIKE"})
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertEqual(data2["simulation"]["active_scenario"], "HARDNESS_SPIKE")

    def test_named_scenario_endpoint(self):
        resp = self.client.post("/api/scenario/MUNICIPAL_CUTOFF")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["simulation"]["active_scenario"], "MUNICIPAL_CUTOFF")

        # Cancel scenario
        resp2 = self.client.post("/api/scenario/NONE")
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertEqual(data2["simulation"]["active_scenario"], "NONE")
        self.assertEqual(data2["simulation"]["mode"], "AUTONOMOUS")


if __name__ == "__main__":
    unittest.main()
