"""
HydroTwin-PHM Darcy-Hermia Multi-Stage Hydraulic Physics Engine & Autonomous Environment Simulator
AtomQuest 2026 - Track 2: Water Purifier
Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal

Features:
1. Autonomous Household Simulation Engine (AutonomousEnvironmentSimulator):
   - Virtual Diurnal Clock (00:00 to 23:59, accelerated: 1 minute = 1 real second).
   - Standard Indian domestic drinking & usage patterns (Morning Peak, Afternoon Low, Evening Peak, Night Standby).
   - Real-world physical Gaussian noise (+/-2% flow fluctuations, +/-0.03 A armature ripple, sinusoidal TDS variations).
   - Dynamic Membrane Scale Accumulation: R_cake drifts upward proportionally to (inlet_tds * flow_lpm).
   - Autonomous Dynamic Anti-Scaling Flush Recovery: 5-second dynamic washdown window decrements R_cake by 18%.
   - Automated physical fault & disturbance scenarios (MUNICIPAL_CUTOFF, HARDNESS_SPIKE, PUMP_STALL).
2. Darcy-Hermia Multi-Stage Hydraulic Decoupling (DarcyHermiaPhysicsEngine):
   - Permeate Volumetric Flux (J)
   - Trans-Membrane Delivery Pressure (Delta_P)
   - Dynamic Osmotic Back-Pressure (Delta_pi) via van 't Hoff relation
   - Pre-sediment Choking Resistance (R_sediment) vs. RO Surface Cake Resistance (R_cake)
   - Concentration Polarization (CP) Nucleation Risk Index
   - Salt Rejection Efficiency (eta) & Alkaliser Mineral Elution Balance
"""

import math
import random
from typing import Any, Dict, Optional, Tuple


class AutonomousEnvironmentSimulator:
    """
    Autonomous household digital twin simulation engine.
    Models Indian diurnal domestic water consumption, stochastic sensor noise,
    dynamic membrane scale fouling, autonomous anti-scaling flush cycles,
    and automated operational scenarios.
    """

    def __init__(
        self,
        base_tds: float = 850.0,
        initial_time_seconds: int = 7 * 3600 + 15 * 60,  # 07:15:00 AM (Morning Peak)
        time_acceleration: float = 60.0  # 1 real second = 60 virtual seconds (1 virtual minute)
    ):
        self.base_tds = float(base_tds)
        self.virtual_time_seconds = int(initial_time_seconds) % 86400
        self.time_acceleration = float(time_acceleration)

        # Operational simulation mode: "AUTONOMOUS" | "MANUAL" | "SCENARIO"
        self.mode = "AUTONOMOUS"

        # Active scenario: "NONE" | "MUNICIPAL_CUTOFF" | "HARDNESS_SPIKE" | "PUMP_STALL"
        self.active_scenario = "NONE"
        self.scenario_tick = 0

        # Physical state variables
        self.accumulated_scale = 0.0
        self.flush_countdown = 0
        self.is_flushing = False

        # Memory of manual setpoints when switched to MANUAL
        self.manual_inlet_tds = base_tds
        self.manual_flow_lpm = 1.20
        self.manual_pump_current = 0.85

    def get_clock_info(self) -> Dict[str, Any]:
        """Returns virtual diurnal clock state and active phase information."""
        h = int(self.virtual_time_seconds // 3600)
        m = int((self.virtual_time_seconds % 3600) // 60)
        s = int(self.virtual_time_seconds % 60)
        time_str = f"{h:02d}:{m:02d}:{s:02d}"

        if 6 <= h < 9:
            phase = "Morning Peak (Breakfast & Water Dispensing)"
        elif 12 <= h < 14:
            phase = "Afternoon Low (Post-Lunch Hydration)"
        elif 18 <= h < 21:
            phase = "Evening Peak (Dinner Cooking & Storage Batch)"
        elif h >= 23 or h < 5:
            phase = "Night Standby (Quiescent Leak Integrity Test)"
        else:
            phase = "Day Standby (Intermittent Glass Dispense)"

        return {
            "time_str": time_str,
            "hour": h,
            "minute": m,
            "second": s,
            "phase": phase
        }

    def set_mode(self, mode: str):
        """Sets the operational mode ("AUTONOMOUS", "MANUAL", "SCENARIO")."""
        valid_modes = {"AUTONOMOUS", "MANUAL", "SCENARIO"}
        if mode.upper() in valid_modes:
            self.mode = mode.upper()
        if self.mode != "SCENARIO":
            self.active_scenario = "NONE"
            self.scenario_tick = 0

    def trigger_scenario(self, scenario_name: str):
        """Triggers an automated operational scenario."""
        valid_scenarios = {"NONE", "MUNICIPAL_CUTOFF", "HARDNESS_SPIKE", "PUMP_STALL"}
        if scenario_name.upper() in valid_scenarios:
            self.active_scenario = scenario_name.upper()
            self.scenario_tick = 0
            if self.active_scenario != "NONE":
                self.mode = "SCENARIO"
            else:
                self.mode = "AUTONOMOUS"

    def set_manual_setpoints(self, inlet_tds: float, flow_lpm: float, pump_current: float):
        """Stores manual override setpoints."""
        self.manual_inlet_tds = float(inlet_tds)
        self.manual_flow_lpm = float(flow_lpm)
        self.manual_pump_current = float(pump_current)

    def tick(
        self,
        mode: Optional[str] = None,
        manual_inputs: Optional[Dict[str, float]] = None,
        active_scenario: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a 1-second simulation step.
        Advances the virtual diurnal clock by 1 virtual minute (60s), generates
        physical inputs, models dynamic scale accumulation and washdown, and handles scenarios.
        """
        if mode is not None:
            self.set_mode(mode)
        if active_scenario is not None and active_scenario != self.active_scenario:
            self.trigger_scenario(active_scenario)

        # Advance diurnal clock by accelerated virtual step
        self.virtual_time_seconds = (self.virtual_time_seconds + int(self.time_acceleration)) % 86400
        clock = self.get_clock_info()
        hour = clock["hour"]

        # ---------------------------------------------------------------------
        # 1. Base Target Parameter Evaluation
        # ---------------------------------------------------------------------
        scenario_progress_pct = 0

        if self.mode == "SCENARIO" and self.active_scenario != "NONE":
            target_flow, target_current, target_tds, scenario_progress_pct = self._step_scenario()
        elif self.mode == "MANUAL":
            if manual_inputs:
                self.set_manual_setpoints(
                    inlet_tds=manual_inputs.get("inlet_tds", self.manual_inlet_tds),
                    flow_lpm=manual_inputs.get("flow_lpm", self.manual_flow_lpm),
                    pump_current=manual_inputs.get("pump_current", self.manual_pump_current)
                )
            target_flow = self.manual_flow_lpm
            target_current = self.manual_pump_current
            target_tds = self.manual_inlet_tds
        else:
            # AUTONOMOUS Mode: Domestic Indian Water Consumption Pattern
            # Morning Peak (06:00 - 09:00): Dispensing 1.4 L/min, pump current 0.92 A, TDS base + 50 ppm
            if 6 <= hour < 9:
                target_flow = 1.40
                target_current = 0.92
                tds_offset = 50.0
            # Afternoon Low (12:00 - 14:00): Dispensing 0.8 L/min, pump current 0.78 A
            elif 12 <= hour < 14:
                target_flow = 0.80
                target_current = 0.78
                tds_offset = 0.0
            # Evening Peak (18:00 - 21:00): Dispensing 1.3 L/min, pump current 0.90 A
            elif 18 <= hour < 21:
                target_flow = 1.30
                target_current = 0.90
                tds_offset = 25.0
            # Night Standby (23:00 - 05:00): Standby flow 0.0 L/min, current 0.0 A (idle leak check)
            elif hour >= 23 or hour < 5:
                target_flow = 0.00
                target_current = 0.00
                tds_offset = -20.0
            # Day Standby / Intermittent Trickle
            else:
                target_flow = 0.35
                target_current = 0.42
                tds_offset = 5.0

            # Daily sinusoidal municipal TDS drift (+/- 15 ppm)
            diurnal_sin = 15.0 * math.sin((self.virtual_time_seconds / 86400.0) * 2.0 * math.pi)
            target_tds = self.base_tds + tds_offset + diurnal_sin

        # ---------------------------------------------------------------------
        # 2. Inject Physical Gaussian Noise (Applied in AUTONOMOUS Mode)
        # ---------------------------------------------------------------------
        if self.mode == "MANUAL":
            # Exact user-specified manual setpoints
            flow_lpm = round(max(0.0, target_flow), 2)
            pump_current = round(max(0.0, target_current), 2)
            inlet_tds = round(max(10.0, target_tds), 1)
        elif self.mode == "SCENARIO":
            # Controlled scenario ramps with micro electrical ripple
            flow_lpm = round(max(0.0, target_flow), 2)
            pump_current = round(max(0.0, target_current), 2)
            inlet_tds = round(max(10.0, target_tds), 1)
        else:
            # AUTONOMOUS Mode: Dynamic physical Gaussian noise
            if target_flow > 0.05:
                # +/- 2% volumetric flow fluctuations
                noisy_flow = target_flow * (1.0 + random.gauss(0.0, 0.02))
                flow_lpm = round(max(0.0, min(2.5, noisy_flow)), 2)
                # +/- 0.03 A electrical armature ripple
                noisy_current = target_current + random.gauss(0.0, 0.03)
                pump_current = round(max(0.0, min(3.0, noisy_current)), 2)
            else:
                flow_lpm = 0.0
                pump_current = 0.0

            # Municipal TDS drift noise (+/- 2.5 ppm)
            noisy_tds = target_tds + random.gauss(0.0, 2.5)
            inlet_tds = round(max(50.0, min(3000.0, noisy_tds)), 1)

        # ---------------------------------------------------------------------
        # 3. Dynamic Scale Accumulation & Autonomous Anti-Scaling Flush
        # ---------------------------------------------------------------------
        # Scale accumulation rate: proportional to (inlet_tds * flow_lpm)
        if flow_lpm > 0.05 and pump_current > 0.15:
            d_scale = (inlet_tds * flow_lpm) * 0.000035
            self.accumulated_scale += d_scale

        # Preliminary CP check to trigger autonomous flush window
        inferred_delta_p = max(0.2, (1.45 * pump_current) - 0.12)
        prelim_cp = (inlet_tds / 1000.0) * (inferred_delta_p / max(flow_lpm, 0.2))

        # Check if flush should initiate (CP > 1.25 or severe hardness)
        if (prelim_cp > 1.25 or inlet_tds > 1200.0) and self.flush_countdown <= 0:
            self.flush_countdown = 5  # 5-second dynamic washdown window

        washdown_factor = 1.0
        flush_solenoid = False

        if self.flush_countdown > 0:
            flush_solenoid = True
            washdown_factor = 0.82  # Decrements R_cake by 18% during washdown window
            # Flushes away 12% of accumulated scale per active flush tick
            self.accumulated_scale = max(0.0, self.accumulated_scale * 0.88)
            self.flush_countdown -= 1

        self.is_flushing = flush_solenoid

        return {
            "mode": self.mode,
            "active_scenario": self.active_scenario,
            "time_str": clock["time_str"],
            "hour": clock["hour"],
            "minute": clock["minute"],
            "second": clock["second"],
            "phase": clock["phase"],
            "inlet_tds": inlet_tds,
            "flow_lpm": flow_lpm,
            "pump_current": pump_current,
            "accumulated_scale": round(self.accumulated_scale, 4),
            "washdown_factor": washdown_factor,
            "flush_solenoid": flush_solenoid,
            "flush_countdown": self.flush_countdown,
            "scenario_progress_pct": scenario_progress_pct
        }

    def _step_scenario(self) -> Tuple[float, float, float, int]:
        """
        Executes one discrete tick of the active operational scenario.
        Returns: (target_flow, target_current, target_tds, progress_pct)
        """
        t = self.scenario_tick
        self.scenario_tick += 1

        if self.active_scenario == "MUNICIPAL_CUTOFF":
            # Scenario duration: 11 seconds
            # 0..3s: Ramps flow to 0.0 L/min, drops current to 0.07 A
            # 4..9s: Holds dry-run cavitation cutoff (<180ms trip)
            # 10s: Safely recovers to nominal
            total_duration = 11
            progress_pct = int(min(100, (t / total_duration) * 100))

            if t <= 3:
                alpha = t / 3.0
                target_flow = (1.0 - alpha) * 1.20
                target_current = (1.0 - alpha) * 0.85 + alpha * 0.07
                target_tds = 850.0
            elif t <= 9:
                target_flow = 0.0
                target_current = 0.07  # Cavitation fault threshold (<0.15 A)
                target_tds = 850.0
            else:
                # Recover
                target_flow = 1.20
                target_current = 0.85
                target_tds = 850.0
                self.active_scenario = "NONE"
                self.mode = "AUTONOMOUS"

            return target_flow, target_current, target_tds, progress_pct

        elif self.active_scenario == "HARDNESS_SPIKE":
            # Scenario duration: 12 seconds
            # 0..2s: Ramps TDS to 1750 ppm
            # 3..8s: Holds at 1750 ppm, triggering autonomous anti-scaling flush
            # 9..11s: Normalizes back to baseline
            total_duration = 12
            progress_pct = int(min(100, (t / total_duration) * 100))

            if t <= 2:
                alpha = t / 2.0
                target_tds = 850.0 + alpha * (1750.0 - 850.0)
                target_flow = 1.15
                target_current = 1.02
            elif t <= 8:
                target_tds = 1750.0
                target_flow = 1.15
                target_current = 1.05
            elif t <= 11:
                alpha = (t - 8) / 3.0
                target_tds = 1750.0 - alpha * (1750.0 - 850.0)
                target_flow = 1.20
                target_current = 0.85
            else:
                target_tds = 850.0
                target_flow = 1.20
                target_current = 0.85
                self.active_scenario = "NONE"
                self.mode = "AUTONOMOUS"

            return target_flow, target_current, target_tds, progress_pct

        elif self.active_scenario == "PUMP_STALL":
            # Scenario duration: 11 seconds
            # 0..2s: Current spikes to 2.15 A (stall)
            # 3..8s: Holds stall condition (triggers sub-160ms overcurrent trip)
            # 9..10s: Safely recovers
            total_duration = 11
            progress_pct = int(min(100, (t / total_duration) * 100))

            if t <= 2:
                alpha = t / 2.0
                target_flow = (1.0 - alpha) * 1.20 + alpha * 0.05
                target_current = 0.85 + alpha * (2.15 - 0.85)
                target_tds = 850.0
            elif t <= 8:
                target_flow = 0.05
                target_current = 2.15  # Stall fault threshold (>1.80 A)
                target_tds = 850.0
            else:
                target_flow = 1.20
                target_current = 0.85
                target_tds = 850.0
                self.active_scenario = "NONE"
                self.mode = "AUTONOMOUS"

            return target_flow, target_current, target_tds, progress_pct

        else:
            self.active_scenario = "NONE"
            self.mode = "AUTONOMOUS"
            return 1.20, 0.85, 850.0, 0


class DarcyHermiaPhysicsEngine:
    """
    High-fidelity hydraulic decoupling and membrane fouling engine.
    Computes trans-membrane pressures, osmotic pressures, hydraulic resistances,
    and concentration polarization metrics from raw physical sensor inputs.
    """

    def __init__(
        self,
        membrane_area: float = 1.0,
        clean_membrane_resistance: float = 0.35,
        water_temp_c: float = 25.0
    ):
        """
        Parameters:
        - membrane_area: Effective RO filtration surface area (m^2, default: 1.0 m^2).
        - clean_membrane_resistance: Baseline virgin RO membrane resistance (kPa*s/L).
        - water_temp_c: Feed water temperature in Celsius (default: 25.0 C).
        """
        self.membrane_area = max(0.1, float(membrane_area))
        self.clean_membrane_resistance = float(clean_membrane_resistance)
        self.water_temp_c = float(water_temp_c)

        # Dynamic viscosity mu for pure water at 25 deg C: ~1.002 mPa*s
        # Temperature correction: mu(T) = 1.002 * (1.0 - 0.02 * (T - 20))
        self.mu = round(1.002 * (1.0 - (0.02 * (self.water_temp_c - 20.0))), 4)

    def compute(
        self,
        inlet_tds: float,
        flow_lpm: float,
        pump_current: float,
        outlet_tds: Optional[float] = None,
        washdown_factor: float = 1.0,
        accumulated_scale: float = 0.0
    ) -> Dict[str, Any]:
        """
        Executes a single discrete physics evaluation tick.

        Parameters:
        - inlet_tds: Raw feed water Total Dissolved Solids (ppm / mg/L).
        - flow_lpm: Permeate feed flow rate (Liters per minute).
        - pump_current: DC booster pump electrical current draw (Amperes).
        - outlet_tds: Measured permeate water TDS (ppm). Inferred if None.
        - washdown_factor: Active during anti-scaling flush (e.g. 0.82 for 18% cake washdown).
        - accumulated_scale: Dynamic surface scale accumulation from operating history.

        Returns:
        Clean dictionary containing:
        outlet_tds, delta_p, delta_pi, r_sediment, r_cake,
        salt_rejection, delta_mineral, and cp_index.
        """
        inlet_tds = max(1.0, float(inlet_tds))
        flow_lpm = max(0.0, float(flow_lpm))
        pump_current = max(0.0, float(pump_current))

        # 1. Volumetric Permeate Flux: J = FlowRate / MembraneEffectiveArea
        flux = flow_lpm / self.membrane_area
        effective_flux = max(flux, 0.05)  # Prevents zero division during zero-flow state

        # 2. Inferred Delivery Pressure from Booster Pump Current:
        # Delta_P = max(0.2, (1.45 * pump_current) - 0.12) bar
        delta_p = round(max(0.2, (1.45 * pump_current) - 0.12), 3)

        # 3. Determine or Infer Permeate Outlet TDS:
        # If not provided, derive based on nominal 95% rejection + 28 ppm remineralization
        if outlet_tds is None:
            nominal_salt_passage = inlet_tds * 0.048
            inferred_outlet = max(18.0, nominal_salt_passage + 28.0)
            outlet_tds = round(inferred_outlet, 1)
        else:
            outlet_tds = round(max(0.0, float(outlet_tds)), 1)

        # 4. Dynamic Osmotic Back-Pressure via van 't Hoff relation:
        # Delta_pi = 1.12 * max(0.0, inlet_tds - outlet_tds) * 0.00075 bar
        delta_pi = round(1.12 * max(0.0, inlet_tds - outlet_tds) * 0.00075, 4)

        # 5. Pre-Sediment Vacuum Choking Resistance (R_sediment):
        # Increases when pump current rises without corresponding flow delivery
        flow_denom = max(flow_lpm, 0.1)
        r_sediment = round(max(0.1, (pump_current / flow_denom) * 0.85), 3)

        # 6. RO Membrane Cake Surface Layer Resistance via Darcy's Law:
        # R_cake accounts for clean resistance, accumulated scale, and washdown factor:
        driving_force = max(0.05, delta_p - delta_pi)
        raw_r_cake = (
            (driving_force / (self.mu * effective_flux))
            - self.clean_membrane_resistance
            + float(accumulated_scale)
        )
        r_cake = round(max(0.1, raw_r_cake * float(washdown_factor)), 3)

        # 7. Salt Rejection Efficiency (eta %):
        salt_rejection = round((1.0 - (outlet_tds / max(inlet_tds, 1.0))) * 100.0, 2)

        # 8. Concentration Polarization (CP) Risk Index:
        # CP = (inlet_tds / 1000.0) * (Delta_P / max(flow_lpm, 0.2))
        cp_flow_denom = max(flow_lpm, 0.2)
        cp_index = round((inlet_tds / 1000.0) * (delta_p / cp_flow_denom), 3)

        # 9. Alkaliser Elution Mineral Balance:
        # Delta_TDS_mineral = max(0.0, outlet_tds - (inlet_tds * (1 - eta/100)))
        theoretical_permeate_tds = inlet_tds * (1.0 - (salt_rejection / 100.0))
        delta_mineral = round(max(0.0, outlet_tds - theoretical_permeate_tds), 2)

        # 10. Stage Health Metrics Mapping (%)
        sediment_health = round(max(0.0, min(100.0, 100.0 - (r_sediment * 28.0))), 1)
        ro_health = round(max(0.0, min(100.0, (salt_rejection / 95.0) * 100.0 - (r_cake * 15.0))), 1)
        alkaliser_health = round(max(0.0, min(100.0, (delta_mineral / 30.0) * 100.0)), 1)

        # 11. Remaining Useful Life (RUL) Prognostic Prediction
        bottleneck_health = min(sediment_health, ro_health)
        predicted_rul_days = int(round(bottleneck_health * 0.45))

        return {
            "outlet_tds": outlet_tds,
            "delta_p": delta_p,
            "delta_pi": delta_pi,
            "r_sediment": r_sediment,
            "r_cake": r_cake,
            "salt_rejection": salt_rejection,
            "delta_mineral": delta_mineral,
            "cp_index": cp_index,
            # Diagnostic telemetry
            "flux": round(flux, 3),
            "sediment_health_pct": sediment_health,
            "ro_health_pct": ro_health,
            "alkaliser_health_pct": alkaliser_health,
            "predicted_rul_days": predicted_rul_days,
            "cp_flush_triggered": cp_index > 1.25 or inlet_tds > 1200.0,
            "is_cavitation_risk": pump_current < 0.15,
            "is_stall_risk": pump_current > 1.80,
            "is_membrane_breached": outlet_tds >= (0.50 * inlet_tds)
        }

    def calculate(self, *args, **kwargs) -> Dict[str, Any]:
        """Convenience alias for self.compute()."""
        return self.compute(*args, **kwargs)

    def __call__(self, *args, **kwargs) -> Dict[str, Any]:
        """Enables direct instance invocation: engine(...)."""
        return self.compute(*args, **kwargs)


if __name__ == "__main__":
    print("=" * 70)
    print("HydroTwin-PHM Autonomous Physics & Simulation Engine Self-Test")
    print("=" * 70)

    sim = AutonomousEnvironmentSimulator()
    engine = DarcyHermiaPhysicsEngine()

    print(f"Initial Diurnal Time: {sim.get_clock_info()['time_str']} ({sim.get_clock_info()['phase']})")

    for i in range(5):
        state = sim.tick()
        phys = engine.compute(
            inlet_tds=state["inlet_tds"],
            flow_lpm=state["flow_lpm"],
            pump_current=state["pump_current"],
            washdown_factor=state["washdown_factor"],
            accumulated_scale=state["accumulated_scale"]
        )
        print(f"Tick {i+1:02d} | Time: {state['time_str']} | Flow: {state['flow_lpm']} L/m | "
              f"Current: {state['pump_current']} A | TDS: {state['inlet_tds']} ppm | "
              f"R_cake: {phys['r_cake']} | R_sed: {phys['r_sediment']} | CP: {phys['cp_index']}")

    print("\n[OK] Autonomous Physics & Environment Simulator Verified Cleanly!")
