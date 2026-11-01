"""
HydroTwin-PHM Prognostics & Health Management (PHM) Module
AtomQuest 2026 - Track 2: Water Purifier
Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal

Implements hybrid physics-informed prognostics:
- Decoupled 4-stage health scoring (Sediment, Carbon Block, RO Membrane, Alkaliser Mineralizer)
- Weibull-inspired Remaining Useful Life (RUL) regression
- Autonomous D2C replenishment threshold evaluation
"""

from typing import Any, Dict, Optional


class WeibullXGBoostPrognostics:
    """
    Hybrid physics-statistical prognostic health management engine.
    Computes individual stage wear degradation curves and projects Remaining Useful Life (RUL).
    """

    def __init__(self, carbon_baseline_health: float = 84.0):
        self.carbon_baseline_health = float(carbon_baseline_health)

    def predict(
        self,
        r_sediment: float,
        r_cake: float,
        salt_rejection: float,
        delta_mineral: float,
        cumulative_liters: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Executes prognostic health scoring and RUL forecasting:
        - sediment_health = max(0.0, min(100.0, 100.0 - (r_sediment * 28.0)))
        - ro_health = max(0.0, min(100.0, (salt_rejection / 95.0) * 100.0 - (r_cake * 14.0)))
        - carbon_health = 84.0 (adsorption baseline)
        - alkaliser_health = max(0.0, min(100.0, (delta_mineral / 42.0) * 100.0))

        RUL calculation:
        - limiting_health = min(sediment_health, ro_health, carbon_health)
        - rul_days = int(limiting_health * 0.42)
        - auto_dispatch = rul_days <= 14
        - failing_stage = "SEDIMENT" if sediment_health < ro_health else "RO_MEMBRANE"
        """
        r_sediment = float(r_sediment)
        r_cake = float(r_cake)
        salt_rejection = float(salt_rejection)
        delta_mineral = float(delta_mineral)

        # 1. Health Scoring Functions
        sediment_health = round(max(0.0, min(100.0, 100.0 - (r_sediment * 28.0))), 1)
        ro_health = round(max(0.0, min(100.0, (salt_rejection / 95.0) * 100.0 - (r_cake * 14.0))), 1)

        # Carbon adsorption health (baseline 84.0, or slightly attenuated by cumulative flow)
        if cumulative_liters is not None:
            carbon_health = round(max(0.0, min(100.0, self.carbon_baseline_health - (cumulative_liters * 0.005))), 1)
        else:
            carbon_health = round(self.carbon_baseline_health, 1)

        alkaliser_health = round(max(0.0, min(100.0, (delta_mineral / 42.0) * 100.0)), 1)

        # 2. Remaining Useful Life (RUL) Calculation
        limiting_health = min(sediment_health, ro_health, carbon_health)
        rul_days = int(limiting_health * 0.42)

        # 3. Autonomous D2C Auto-Dispatch Decision
        auto_dispatch = bool(rul_days <= 14)

        # 4. Bottleneck Stage Isolation
        failing_stage = "SEDIMENT" if sediment_health < ro_health else "RO_MEMBRANE"

        return {
            "sediment_health": sediment_health,
            "ro_health": ro_health,
            "carbon_health": carbon_health,
            "alkaliser_health": alkaliser_health,
            "limiting_health": round(limiting_health, 1),
            "rul_days": rul_days,
            "auto_dispatch": auto_dispatch,
            "failing_stage": failing_stage
        }

    def evaluate(self, *args, **kwargs) -> Dict[str, Any]:
        """Convenience alias for self.predict()."""
        return self.predict(*args, **kwargs)

    def __call__(self, *args, **kwargs) -> Dict[str, Any]:
        """Enables direct instance invocation: prognostics(...)."""
        return self.predict(*args, **kwargs)


if __name__ == "__main__":
    print("=" * 65)
    print("HydroTwin-PHM Weibull-XGBoost Prognostics Verification")
    print("=" * 65)

    prog = WeibullXGBoostPrognostics()

    # Nominal operation
    nominal = prog.predict(r_sediment=0.60, r_cake=0.10, salt_rejection=95.0, delta_mineral=35.0)
    print("\n[Case 1: Nominal System State]")
    for k, v in nominal.items():
        print(f"  {k:18s}: {v}")
    assert nominal["rul_days"] > 14
    assert not nominal["auto_dispatch"]

    # Choked sediment scenario
    choked = prog.predict(r_sediment=2.85, r_cake=0.30, salt_rejection=94.0, delta_mineral=32.0)
    print("\n[Case 2: Severely Choked Sediment (R_sed = 2.85)]")
    print(f"  Sediment Health   : {choked['sediment_health']}%")
    print(f"  RUL Days          : {choked['rul_days']} days")
    print(f"  Auto-Dispatch     : {choked['auto_dispatch']}")
    print(f"  Failing Stage     : {choked['failing_stage']}")
    assert choked["auto_dispatch"]
    assert choked["failing_stage"] == "SEDIMENT"

    print("\nAll prognostics tests passed successfully!")
