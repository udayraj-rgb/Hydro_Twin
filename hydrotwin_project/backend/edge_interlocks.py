"""
HydroTwin-PHM Deterministic Edge Interlocks Module
AtomQuest 2026 - Track 2: Water Purifier
Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal

Sub-200ms deterministic edge safety supervisor enforcing hardware-level interlocks
against dry-run cavitation, motor armature stalls, and acute membrane breach.
"""

from typing import Any, Dict, Union


class DeterministicEdgeInterlocks:
    """
    Hardware-in-the-Loop (HIL) safety interlock controller.
    Runs fast deterministic evaluations to protect the booster pump,
    valves, and consumer health.
    """

    def __init__(
        self,
        cavitation_current_threshold: float = 0.15,
        stall_current_threshold: float = 1.80,
        breach_ratio_threshold: float = 0.50,
        breach_min_inlet_tds: float = 200.0
    ):
        self.cavitation_threshold = float(cavitation_current_threshold)
        self.stall_threshold = float(stall_current_threshold)
        self.breach_ratio_threshold = float(breach_ratio_threshold)
        self.breach_min_inlet_tds = float(breach_min_inlet_tds)

    def evaluate(
        self,
        pump_current: float,
        inlet_tds: float,
        outlet_tds: float
    ) -> Dict[str, Union[str, bool]]:
        """
        Deterministic evaluation logic running sub-200ms rules:
        - If pump_current < 0.15 A ->
          status = "SAFETY TRIP (<180ms): Dry-Run Cavitation Detected", relay_pump = False
        - Else if pump_current > 1.80 A ->
          status = "SAFETY TRIP (<160ms): Motor Armature Overcurrent Stall", relay_pump = False
        - If outlet_tds >= (0.50 * inlet_tds) and inlet_tds > 200 ->
          status = "CRITICAL BREACH: Membrane Rupture Detected. Water Dispense Halted", inlet_valve = False

        Default when nominal:
        status = "NOMINAL", relay_pump = True, inlet_valve = True
        """
        pump_current = float(pump_current)
        inlet_tds = float(inlet_tds)
        outlet_tds = float(outlet_tds)

        # Baseline nominal defaults
        status = "NOMINAL"
        relay_pump = True
        inlet_valve = True

        faults = []

        # Rule 1 & 2: Pump electrical current supervisor
        if pump_current < self.cavitation_threshold:
            relay_pump = False
            faults.append("SAFETY TRIP (<180ms): Dry-Run Cavitation Detected")
        elif pump_current > self.stall_threshold:
            relay_pump = False
            faults.append("SAFETY TRIP (<160ms): Motor Armature Overcurrent Stall")

        # Rule 3: Membrane rupture supervisor
        if outlet_tds >= (self.breach_ratio_threshold * inlet_tds) and inlet_tds > self.breach_min_inlet_tds:
            inlet_valve = False
            faults.append("CRITICAL BREACH: Membrane Rupture Detected. Water Dispense Halted")

        # Formulate consolidated status
        if faults:
            status = " | ".join(faults)

        return {
            "status": status,
            "relay_pump": relay_pump,
            "inlet_valve": inlet_valve
        }

    def __call__(self, *args, **kwargs) -> Dict[str, Union[str, bool]]:
        return self.evaluate(*args, **kwargs)


if __name__ == "__main__":
    print("=" * 65)
    print("HydroTwin-PHM Deterministic Edge Interlocks Verification")
    print("=" * 65)

    interlocks = DeterministicEdgeInterlocks()

    # Case 1: Nominal
    nom = interlocks.evaluate(pump_current=0.85, inlet_tds=850.0, outlet_tds=42.0)
    print("\n[Case 1: Nominal]")
    print(f"  Result: {nom}")
    assert nom["status"] == "NOMINAL" and nom["relay_pump"] and nom["inlet_valve"]

    # Case 2: Cavitation
    cav = interlocks.evaluate(pump_current=0.08, inlet_tds=850.0, outlet_tds=42.0)
    print("\n[Case 2: Dry-Run Cavitation]")
    print(f"  Result: {cav}")
    assert "Dry-Run Cavitation" in cav["status"] and not cav["relay_pump"]

    # Case 3: Overcurrent Stall
    stall = interlocks.evaluate(pump_current=1.92, inlet_tds=850.0, outlet_tds=42.0)
    print("\n[Case 3: Motor Armature Stall]")
    print(f"  Result: {stall}")
    assert "Motor Armature Overcurrent Stall" in stall["status"] and not stall["relay_pump"]

    # Case 4: Membrane Rupture
    breach = interlocks.evaluate(pump_current=0.85, inlet_tds=850.0, outlet_tds=480.0)
    print("\n[Case 4: Membrane Rupture]")
    print(f"  Result: {breach}")
    assert "CRITICAL BREACH" in breach["status"] and not breach["inlet_valve"]

    print("\nAll deterministic edge interlock tests passed successfully!")
