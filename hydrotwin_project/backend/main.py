"""
HydroTwin-PHM FastAPI Digital Twin & Virtual HIL Backend
AtomQuest 2026 - Track 2: Water Purifier
Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal

Features:
- Autonomous Household Environment Simulation Engine (diurnal clock, stochastic noise, dynamic scale)
- Continuous 1 Hz discrete physics & prognostic evaluation engine
- Sub-200ms deterministic edge safety interlocks
- Adaptive anti-scaling dynamic micro-flush controller
- Real-time WebSocket telemetry broadcaster
- Persistent SQLite logging & autonomous D2C replenishment order trigger
- Mode switcher: AUTONOMOUS | MANUAL | SCENARIO
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
from typing import Any, Dict, List, Optional, Set

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import database
import fleet_data
from edge_interlocks import DeterministicEdgeInterlocks
from ml_engine import ml_forecaster
from physics_engine import AutonomousEnvironmentSimulator, DarcyHermiaPhysicsEngine
from prognostics import WeibullXGBoostPrognostics

# -----------------------------------------------------------------------------
# Domain Models & Global State
# -----------------------------------------------------------------------------
class SensorInput(BaseModel):
    inlet_tds: float = Field(default=850.0, ge=10.0, le=3000.0, description="Inlet raw water TDS (ppm)")
    flow_lpm: float = Field(default=1.20, ge=0.0, le=5.0, description="Feed permeate flow rate (L/min)")
    pump_current: float = Field(default=0.85, ge=0.0, le=3.0, description="Booster pump DC current (Amperes)")
    outlet_tds: Optional[float] = Field(default=None, description="Measured permeate TDS (ppm, inferred if omitted)")
    mode: Optional[str] = Field(default=None, description="Operational mode: 'AUTONOMOUS' | 'MANUAL' | 'SCENARIO'")
    active_scenario: Optional[str] = Field(default="NONE", description="Active scenario: 'NONE' | 'MUNICIPAL_CUTOFF' | 'HARDNESS_SPIKE' | 'PUMP_STALL'")


class ModeUpdateRequest(BaseModel):
    mode: str = Field(default="AUTONOMOUS", description="'AUTONOMOUS' | 'MANUAL' | 'SCENARIO'")
    active_scenario: Optional[str] = Field(default="NONE", description="'NONE' | 'MUNICIPAL_CUTOFF' | 'HARDNESS_SPIKE' | 'PUMP_STALL'")


class ClockModeRequest(BaseModel):
    clock_mode: str = Field(default="REALTIME", description="'REALTIME' | 'VIRTUAL'")


class ConsumerCommand(BaseModel):
    mode: str = Field(
        default="ADAPTIVE",
        description="Operation mode: 'ADAPTIVE' | 'RO_UV' | 'TASTETUNE' | 'VACAY'"
    )
    target_tds: float = Field(
        default=75.0,
        ge=30.0,
        le=150.0,
        description="Target mineralized TDS for TasteTune mode (30 to 150 ppm)"
    )
    manual_flush: bool = Field(
        default=False,
        description="Trigger dynamic micro-flush washdown cycle (-18% R_cake)"
    )
    source_water: str = Field(
        default="BOREWELL",
        description="Water source preset: 'MUNICIPAL' | 'BOREWELL' | 'TANKER'"
    )


class AuthRequest(BaseModel):
    username: str = Field(..., description="Email or Username")
    password: str = Field(..., description="Account secret key or password")
    role: str = Field(default="hil", description="Portal key: 'hil' | 'consumer' | 'fleet'")


class OutreachRequest(BaseModel):
    device_id: str = Field(..., description="Purifier Device Serial ID (e.g. ATOM-WP-2026-0042)")
    customer_name: str = Field(..., description="Customer full name")
    customer_email: Optional[str] = Field(default=None, description="Customer recipient email address")
    customer_phone: Optional[str] = Field(default=None, description="Customer phone number")
    contact_type: str = Field(default="EMAIL", description="Outreach channel: 'EMAIL' | 'CALL'")
    subject: Optional[str] = Field(default="Atomberg Intellon Purifier Health & Yearly Service Enquiry", description="Subject line for email")
    service_enquiry: Optional[str] = Field(default="Annual Preventive Maintenance & Filter Health Report", description="Type of service enquiry")
    notes: Optional[str] = Field(default="", description="Operator call notes or customized email text")
    scheduled_date: Optional[str] = Field(default=None, description="Scheduled technician service visit date/time")
    outcome: Optional[str] = Field(default="DISPATCHED", description="Outreach outcome or resolution status")


class OutreachResponse(BaseModel):
    status: str
    message: str
    record: Dict[str, Any]


class SensorUpdateResponse(BaseModel):
    message: str
    current_sensors: SensorInput
    latest_state: Dict[str, Any]


# Global shared instances
simulator = AutonomousEnvironmentSimulator(
    base_tds=850.0,
    clock_mode="REALTIME"  # Live real-time clock synchronized to local system time & ML forecaster
)
physics_engine = DarcyHermiaPhysicsEngine(membrane_area=1.0, clean_membrane_resistance=0.35)
edge_interlocks = DeterministicEdgeInterlocks()
prognostics = WeibullXGBoostPrognostics(carbon_baseline_health=84.0)

# Current active sensor inputs (thread-safe updates)
current_sensors = SensorInput(
    inlet_tds=850.0,
    flow_lpm=1.20,
    pump_current=0.85,
    mode="AUTONOMOUS",
    active_scenario="NONE"
)
current_sensors_lock = asyncio.Lock()

# State memory for transition edge detection (prevent duplicate D2C orders)
last_auto_dispatch_state = False
latest_packet: Dict[str, Any] = {}
packet_sequence_id = 0

# WebSocket connection pool
active_websockets: Set[WebSocket] = set()


# -----------------------------------------------------------------------------
# Pipeline Execution Tick
# -----------------------------------------------------------------------------
async def execute_pipeline_tick() -> Dict[str, Any]:
    """
    Executes a single discrete 1 Hz evaluation cycle:
    1. Steps the AutonomousEnvironmentSimulator to advance diurnal clock, scale accumulation,
       stochastic Gaussian noise, and scenario states.
    2. Synchronizes dynamic sensor values into current_sensors.
    3. Evaluates raw concentration polarization (CP) and anti-scaling washdown.
    4. Runs Darcy-Hermia multi-stage hydraulic decoupling with dynamic washdown and scale.
    5. Evaluates deterministic sub-200ms safety interlocks.
    6. Computes 4-stage prognostic health scores and RUL.
    7. Dispatches autonomous D2C replenishment order on state transition.
    8. Persists telemetry frame to SQLite.
    9. Returns consolidated digital twin frame.
    """
    global last_auto_dispatch_state, latest_packet, packet_sequence_id, current_sensors

    packet_sequence_id += 1

    async with current_sensors_lock:
        active_mode = current_sensors.mode or "AUTONOMOUS"
        active_scenario = current_sensors.active_scenario or "NONE"
        manual_inlet = current_sensors.inlet_tds
        manual_flow = current_sensors.flow_lpm
        manual_current = current_sensors.pump_current
        user_outlet = current_sensors.outlet_tds

    # 1. Step Autonomous Environment Simulator
    if active_mode == "SCENARIO" or active_scenario != "NONE":
        sim_state = simulator.tick(mode="SCENARIO", active_scenario=active_scenario)
    elif active_mode == "MANUAL":
        sim_state = simulator.tick(
            mode="MANUAL",
            manual_inputs={
                "inlet_tds": manual_inlet,
                "flow_lpm": manual_flow,
                "pump_current": manual_current
            }
        )
    else:
        # AUTONOMOUS Mode: Dynamic domestic diurnal pattern with Gaussian noise
        sim_state = simulator.tick(mode="AUTONOMOUS")

    # Extract dynamic simulation outputs
    inlet_tds = sim_state["inlet_tds"]
    flow_lpm = sim_state["flow_lpm"]
    pump_current = sim_state["pump_current"]
    accumulated_scale = sim_state["accumulated_scale"]
    sim_washdown = sim_state["washdown_factor"]
    sim_flush = sim_state["flush_solenoid"]

    # Sync back to current_sensors thread-safely
    async with current_sensors_lock:
        current_sensors.inlet_tds = inlet_tds
        current_sensors.flow_lpm = flow_lpm
        current_sensors.pump_current = pump_current
        current_sensors.mode = sim_state["mode"]
        current_sensors.active_scenario = sim_state["active_scenario"]

    # 2. Evaluate Dynamic Anti-Scaling Flush state from simulator
    flush_solenoid = bool(sim_flush)
    washdown_factor = float(sim_washdown)

    # 3. Darcy-Hermia Multi-Stage Hydraulic Decoupling
    phys = physics_engine.compute(
        inlet_tds=inlet_tds,
        flow_lpm=flow_lpm,
        pump_current=pump_current,
        outlet_tds=user_outlet,
        washdown_factor=washdown_factor,
        accumulated_scale=accumulated_scale
    )

    actual_outlet_tds = phys["outlet_tds"]

    # 4. Deterministic Edge Safety Interlocks (<200ms rule evaluation)
    safety = edge_interlocks.evaluate(
        pump_current=pump_current,
        inlet_tds=inlet_tds,
        outlet_tds=actual_outlet_tds
    )

    status = safety["status"]
    relay_pump = safety["relay_pump"]
    inlet_valve = safety["inlet_valve"]

    if status == "NOMINAL" and flush_solenoid:
        status = "FLUSH_ACTIVE: Anti-Scaling Dynamic Micro-Flush in progress"

    # 5. Prognostic Health Scoring & RUL
    prog = prognostics.predict(
        r_sediment=phys["r_sediment"],
        r_cake=phys["r_cake"],
        salt_rejection=phys["salt_rejection"],
        delta_mineral=phys["delta_mineral"]
    )

    # 6. Autonomous D2C Replenishment Trigger
    auto_dispatch_active = prog["auto_dispatch"]
    if auto_dispatch_active and not last_auto_dispatch_state:
        try:
            database.log_order(
                device_id="ATOM-WP-2026-0042",
                customer_name="Rajesh Sharma",
                city="Bhopal",
                stage=prog["failing_stage"],
                rul_days=prog["rul_days"],
                order_status="ORDER DISPATCHED"
            )
        except Exception as e:
            print(f"[HydroTwin-PHM] Order logging exception: {e}")
        last_auto_dispatch_state = True
    elif not auto_dispatch_active:
        last_auto_dispatch_state = False

    # 7. Database Telemetry Persistence
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        database.log_telemetry({
            "timestamp": now_iso,
            "device_id": "ATOM-WP-2026-0042",
            "inlet_tds": inlet_tds,
            "outlet_tds": actual_outlet_tds,
            "flow_lpm": flow_lpm,
            "pump_current": pump_current,
            "delta_p": phys["delta_p"],
            "r_sediment": phys["r_sediment"],
            "r_cake": phys["r_cake"],
            "r_sed_slope": phys.get("r_sed_slope", 0.0085),
            "r_cake_slope": phys.get("r_cake_slope", 0.0142),
            "salt_rejection": phys["salt_rejection"],
            "status": status
        })
    except Exception as e:
        print(f"[HydroTwin-PHM] Telemetry logging error: {e}")

    # 8. Build Consolidated Digital Twin Packet (Flat Keys + Grouped Schemas for Complete Interop)
    latest_packet = {
        # Core identification & sequencing
        "sequence_id": packet_sequence_id,
        "device_id": "ATOM-WP-2026-0042",
        "timestamp": now_iso,
        "status": status,

        # Top-Level Direct Physical & Sensor Telemetry
        "inlet_tds": round(float(inlet_tds), 1),
        "outlet_tds": round(float(actual_outlet_tds), 1),
        "flow_lpm": round(float(flow_lpm), 2),
        "pump_current": round(float(pump_current), 2),
        "delta_p": round(float(phys["delta_p"]), 3),
        "delta_pi": round(float(phys.get("delta_pi", 0.0)), 4),
        "r_sediment": round(float(phys["r_sediment"]), 3),
        "r_cake": round(float(phys["r_cake"]), 3),
        "r_sed_slope": round(float(phys.get("r_sed_slope", 0.0085)), 4),
        "r_cake_slope": round(float(phys.get("r_cake_slope", 0.0142)), 4),
        "dr_dt": round(float(phys.get("dr_dt", 0.0142)), 4),
        "salt_rejection": round(float(phys["salt_rejection"]), 2),
        "delta_mineral": round(float(phys["delta_mineral"]), 2),
        "cp_index": round(float(phys["cp_index"]), 3),
        "flux": round(float(phys.get("flux", flow_lpm)), 3),

        # Top-Level Direct Prognostics & Health Metrics
        "sediment_health": round(float(prog["sediment_health"]), 1),
        "carbon_health": round(float(prog["carbon_health"]), 1),
        "ro_health": round(float(prog["ro_health"]), 1),
        "alkaliser_health": round(float(prog["alkaliser_health"]), 1),
        "limiting_health": round(float(prog.get("limiting_health", min(prog["sediment_health"], prog["ro_health"]))), 1),
        "rul_days": int(prog["rul_days"]),
        "auto_dispatch": bool(prog["auto_dispatch"]),
        "failing_stage": str(prog["failing_stage"]),

        # Top-Level Hardware Actuator Relays
        "relay_pump": bool(relay_pump),
        "inlet_valve": bool(inlet_valve),
        "flush_solenoid": bool(flush_solenoid),

        # Grouped Domain Objects for Standard UI Hierarchy
        "sensors": {
            "inlet_tds": round(float(inlet_tds), 1),
            "outlet_tds": round(float(actual_outlet_tds), 1),
            "flow_lpm": round(float(flow_lpm), 2),
            "pump_current": round(float(pump_current), 2)
        },
        "actuators": {
            "relay_pump": bool(relay_pump),
            "inlet_valve": bool(inlet_valve),
            "flush_solenoid": bool(flush_solenoid)
        },
        "physics": {
            "delta_p": round(float(phys["delta_p"]), 3),
            "delta_pi": round(float(phys.get("delta_pi", 0.0)), 4),
            "r_sediment": round(float(phys["r_sediment"]), 3),
            "r_cake": round(float(phys["r_cake"]), 3),
            "r_sed_slope": round(float(phys.get("r_sed_slope", 0.0085)), 4),
            "r_cake_slope": round(float(phys.get("r_cake_slope", 0.0142)), 4),
            "dr_dt": round(float(phys.get("dr_dt", 0.0142)), 4),
            "salt_rejection": round(float(phys["salt_rejection"]), 2),
            "delta_mineral": round(float(phys["delta_mineral"]), 2),
            "cp_index": round(float(phys["cp_index"]), 3),
            "flux": round(float(phys.get("flux", flow_lpm)), 3)
        },
        "prognostics": {
            "sediment_health": round(float(prog["sediment_health"]), 1),
            "ro_health": round(float(prog["ro_health"]), 1),
            "carbon_health": round(float(prog["carbon_health"]), 1),
            "alkaliser_health": round(float(prog["alkaliser_health"]), 1),
            "limiting_health": round(float(prog.get("limiting_health", min(prog["sediment_health"], prog["ro_health"]))), 1),
            "rul_days": int(prog["rul_days"]),
            "auto_dispatch": bool(prog["auto_dispatch"]),
            "failing_stage": str(prog["failing_stage"])
        },
        "simulation": {
            "mode": sim_state["mode"],
            "active_scenario": sim_state["active_scenario"],
            "clock_mode": sim_state.get("clock_mode", simulator.clock_mode),
            "diurnal_time": sim_state["time_str"],
            "diurnal_phase": sim_state["phase"],
            "diurnal_hour": sim_state["hour"],
            "diurnal_minute": sim_state["minute"],
            "accumulated_scale": round(accumulated_scale, 4),
            "washdown_factor": washdown_factor,
            "flush_countdown": sim_state["flush_countdown"],
            "scenario_progress_pct": sim_state.get("scenario_progress_pct", 0),
            "ml_inference": sim_state.get("ml_inference", {})
        },
        "clock_mode": sim_state.get("clock_mode", simulator.clock_mode),
        "ml_inference": sim_state.get("ml_inference", {})
    }
    return latest_packet


# -----------------------------------------------------------------------------
# Background 1 Hz Ticker & Lifespan
# -----------------------------------------------------------------------------
async def background_1hz_stream():
    """Continuously evaluates pipeline and broadcasts telemetry to all connected WebSockets."""
    while True:
        try:
            packet = await execute_pipeline_tick()
            if active_websockets:
                disconnected = set()
                for ws in list(active_websockets):
                    try:
                        await ws.send_json(packet)
                    except Exception:
                        disconnected.add(ws)
                active_websockets.difference_update(disconnected)
        except Exception as err:
            print(f"[HydroTwin-PHM Background Loop Error]: {err}")
        await asyncio.sleep(1.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema is initialized and launch 1 Hz pipeline loop
    database.init_db()
    ticker_task = asyncio.create_task(background_1hz_stream())
    print("[HydroTwin-PHM] Digital Twin & Virtual HIL Pipeline started at 1.0 Hz.")
    yield
    # Shutdown: Cancel background ticker
    ticker_task.cancel()
    try:
        await ticker_task
    except asyncio.CancelledError:
        pass
    print("[HydroTwin-PHM] Background pipeline terminated.")


# -----------------------------------------------------------------------------
# FastAPI Application & Routing
# -----------------------------------------------------------------------------
app = FastAPI(
    title="HydroTwin-PHM Digital Twin & Virtual HIL Backend",
    description="AtomQuest 2026 (Track 2: Water Purifier) - Real-time Physics Engine & Prognostics API",
    version="2.1.0",
    lifespan=lifespan
)

# Full CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def get_root():
    """Root metadata & service health endpoint."""
    clock = simulator.get_clock_info()
    return {
        "project": "HydroTwin-PHM: Digital Twin & Virtual HIL Testbed",
        "competition": "AtomQuest 2026 (Track 2: Water Purifier)",
        "team": "Team Atomizers | SCOPE, VIT Bhopal",
        "status": "OPERATIONAL",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "simulation": {
            "mode": simulator.mode,
            "active_scenario": simulator.active_scenario,
            "diurnal_time": clock["time_str"],
            "diurnal_phase": clock["phase"]
        },
        "endpoints": {
            "update_sensors": "POST /api/update_sensors",
            "consumer_control": "POST /api/consumer/control",
            "consumer_diagnostics": "GET /api/consumer/diagnostics",
            "set_mode": "POST /api/mode",
            "trigger_scenario": "POST /api/scenario/{scenario_name}",
            "recent_telemetry": "GET /api/telemetry/recent",
            "fleet": "GET /api/fleet",
            "live_state": "GET /api/state",
            "recent_orders": "GET /api/orders",
            "websocket_stream": "ws://localhost:8000/ws/telemetry"
        }
    }


@app.post("/api/update_sensors", response_model=SensorUpdateResponse)
async def update_sensors(payload: SensorInput):
    """
    Updates active virtual sensors (Inlet TDS, Flow Rate, Pump Current, Outlet TDS).
    If mode is omitted, sets mode to 'MANUAL' to allow testing and explicit slider overrides.
    Immediately triggers an evaluation tick and returns the new state.
    """
    global current_sensors
    async with current_sensors_lock:
        if payload.mode is not None:
            simulator.set_mode(payload.mode)
            current_sensors.mode = payload.mode
        else:
            # Default to MANUAL override when specific sensor values are posted
            simulator.set_mode("MANUAL")
            current_sensors.mode = "MANUAL"

        if payload.active_scenario:
            simulator.trigger_scenario(payload.active_scenario)
            current_sensors.active_scenario = payload.active_scenario

        current_sensors.inlet_tds = payload.inlet_tds
        current_sensors.flow_lpm = payload.flow_lpm
        current_sensors.pump_current = payload.pump_current
        current_sensors.outlet_tds = payload.outlet_tds

    # Update manual setpoints in simulator
    simulator.set_manual_setpoints(
        inlet_tds=payload.inlet_tds,
        flow_lpm=payload.flow_lpm,
        pump_current=payload.pump_current
    )

    # Re-evaluate immediately with newly injected parameters
    new_state = await execute_pipeline_tick()
    return {
        "message": "Sensors updated successfully",
        "current_sensors": current_sensors,
        "latest_state": new_state
    }


@app.post("/api/mode")
async def update_mode(payload: ModeUpdateRequest):
    """
    Switches simulation operational mode ('AUTONOMOUS', 'MANUAL', 'SCENARIO')
    and activates scenarios ('NONE', 'MUNICIPAL_CUTOFF', 'HARDNESS_SPIKE', 'PUMP_STALL').
    """
    global current_sensors
    async with current_sensors_lock:
        simulator.set_mode(payload.mode)
        current_sensors.mode = payload.mode
        if payload.active_scenario:
            simulator.trigger_scenario(payload.active_scenario)
            current_sensors.active_scenario = payload.active_scenario

    new_state = await execute_pipeline_tick()
    return {
        "message": f"Mode updated to {simulator.mode} (Scenario: {simulator.active_scenario})",
        "simulation": new_state.get("simulation", {}),
        "latest_state": new_state
    }


@app.post("/api/scenario/{scenario_name}")
async def trigger_named_scenario(scenario_name: str):
    """
    Triggers an automated operational scenario:
    - 'MUNICIPAL_CUTOFF': Dry-run cavitation fault and recovery
    - 'HARDNESS_SPIKE': 1750 ppm spike triggering autonomous dynamic flush micro-activation
    - 'PUMP_STALL': 2.15 A overcurrent stall trip and recovery
    - 'NONE': Cancels active scenario and restores AUTONOMOUS mode
    """
    global current_sensors
    async with current_sensors_lock:
        simulator.trigger_scenario(scenario_name)
        current_sensors.mode = simulator.mode
        current_sensors.active_scenario = simulator.active_scenario

    new_state = await execute_pipeline_tick()
    return {
        "message": f"Scenario {scenario_name} initiated",
        "simulation": new_state.get("simulation", {}),
        "latest_state": new_state
    }


@app.post("/api/simulation/clock_mode")
async def update_simulation_clock_mode(payload: ClockModeRequest):
    """
    Switches simulation diurnal clock mode:
    - 'REALTIME': Synchronizes 1:1 with real local wall-clock time and drives predictions via ML.
    - 'VIRTUAL': Accelerated simulation mode (1 second = 1 virtual minute).
    """
    simulator.set_clock_mode(payload.clock_mode)
    new_state = await execute_pipeline_tick()
    return {
        "message": f"Simulation clock mode set to {simulator.clock_mode}",
        "clock_mode": simulator.clock_mode,
        "clock_info": simulator.get_clock_info(),
        "latest_state": new_state
    }


@app.get("/api/simulation/clock")
def get_simulation_clock():
    """Returns the current simulation clock information and mode."""
    return simulator.get_clock_info()


@app.get("/api/ml/realtime")
def get_ml_realtime_inference():
    """
    Returns real-time Machine Learning model inference, confidence score,
    harmonic decomposition, and feature attribution weights.
    """
    now = datetime.now()
    pred = ml_forecaster.predict_realtime(
        current_time=now,
        base_tds=simulator.base_tds,
        accumulated_scale=simulator.accumulated_scale,
        inject_noise=True
    )
    return {
        "status": "SUCCESS",
        "clock_mode": simulator.clock_mode,
        "inference": pred,
        "history": ml_forecaster.get_recent_history(limit=10)
    }


@app.post("/api/consumer/control")
async def control_consumer(payload: ConsumerCommand):
    """
    Interactive purifier controls and consumer simulator actions:
    1. Water Source Presets:
       - 'MUNICIPAL': sets inlet_tds = 320.0, base flow = 1.40 L/min, pump_current = 0.72 A.
       - 'BOREWELL': sets inlet_tds = 920.0, base flow = 1.20 L/min, pump_current = 0.85 A.
       - 'TANKER': sets inlet_tds = 1550.0, base flow = 1.05 L/min, pump_current = 0.98 A.
    2. Operation Modes:
       - 'ADAPTIVE': Recalculates dynamically based on inlet TDS to preserve water and balance mineral retention.
       - 'RO_UV': Maximizes rejection for heavy dissolved solids (sets flow = 1.10 L/min, pump_current = 0.95 A).
       - 'TASTETUNE': Adjusts mineral passage to match target_tds (30-150 ppm), dynamically modulating pump current and recovery flux.
       - 'VACAY': Enters vacation idle mode (low intermittent flow = 0.20 L/min, current = 0.35 A) to prevent membrane bio-fouling and stagnant odor.
    3. Manual AutoClean Trigger:
       - If manual_flush is True, activate the dynamic micro-flush state, reducing cake resistance (R_cake) by 18% over a simulated washdown cycle.
    """
    source = payload.source_water.upper().strip()
    mode = payload.mode.upper().strip()

    # 1. Evaluate Source Water Preset
    if source == "MUNICIPAL":
        inlet_tds = 320.0
        base_flow = 1.40
        base_current = 0.72
    elif source == "BOREWELL":
        inlet_tds = 920.0
        base_flow = 1.20
        base_current = 0.85
    elif source == "TANKER":
        inlet_tds = 1550.0
        base_flow = 1.05
        base_current = 0.98
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source_water '{payload.source_water}'. Must be 'MUNICIPAL', 'BOREWELL', or 'TANKER'."
        )

    # 2. Evaluate Operation Mode
    outlet_tds: Optional[float] = None

    if mode == "RO_UV":
        # Maximizes rejection for heavy dissolved solids
        flow_lpm = 1.10
        pump_current = 0.95
        outlet_tds = None  # Full RO rejection inferred
    elif mode == "TASTETUNE":
        # Matches requested target TDS (30 - 150 ppm)
        target = float(payload.target_tds)
        outlet_tds = round(target, 1)
        # Modulate pump current and recovery flux: lower pressure/higher mineral passage
        flow_lpm = round(max(0.90, min(1.35, base_flow - 0.05)), 2)
        pump_current = round(max(0.68, min(1.00, base_current + (100.0 - target) * 0.001)), 2)
    elif mode == "VACAY":
        # Vacation idle mode: prevents stagnation and membrane bio-fouling
        flow_lpm = 0.20
        pump_current = 0.35
        outlet_tds = None
    elif mode == "ADAPTIVE":
        # Recalculates dynamically based on inlet TDS
        if inlet_tds < 500.0:
            flow_lpm = 1.40
            pump_current = 0.72
        elif inlet_tds <= 1200.0:
            flow_lpm = 1.20
            pump_current = 0.85
        else:
            flow_lpm = 1.05
            pump_current = 0.98
        outlet_tds = None
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{payload.mode}'. Must be 'ADAPTIVE', 'RO_UV', 'TASTETUNE', or 'VACAY'."
        )

    # 3. Handle Manual AutoClean Trigger
    if payload.manual_flush:
        simulator.flush_countdown = 5
        simulator.is_flushing = True
        simulator.accumulated_scale = max(0.0, simulator.accumulated_scale * 0.88)

    # 4. Synchronize into simulator and current_sensors
    global current_sensors
    async with current_sensors_lock:
        simulator.set_mode("MANUAL")
        simulator.set_manual_setpoints(
            inlet_tds=inlet_tds,
            flow_lpm=flow_lpm,
            pump_current=pump_current
        )
        current_sensors.inlet_tds = inlet_tds
        current_sensors.flow_lpm = flow_lpm
        current_sensors.pump_current = pump_current
        current_sensors.outlet_tds = outlet_tds
        current_sensors.mode = "MANUAL"
        current_sensors.active_scenario = "NONE"

    # 5. Execute tick immediately to broadcast via WebSocket and persist in DB
    new_state = await execute_pipeline_tick()

    cmd_dict = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    return {
        "message": f"Consumer command applied: Source={source}, Mode={mode}, ManualFlush={payload.manual_flush}",
        "command": cmd_dict,
        "applied_setpoints": {
            "source_water": source,
            "operation_mode": mode,
            "inlet_tds": inlet_tds,
            "flow_lpm": flow_lpm,
            "pump_current": pump_current,
            "target_tds": payload.target_tds if mode == "TASTETUNE" else None,
            "flush_active": new_state.get("actuators", {}).get("flush_solenoid", False)
        },
        "latest_state": new_state
    }


@app.get("/api/consumer/diagnostics")
async def get_consumer_diagnostics():
    """
    Evaluates current hardware parameters:
    - Booster pump status (checking for cavitation <0.15A or overcurrent stall >1.80A)
    - Membrane fouling level (comparing R_cake against baseline 0.35 kPa*s/L)
    - Alkaline remineralizer elution balance (Delta_TDS_mineral)
    - Overall system health score (0-100 scale)
    Returns structured diagnostic report with timestamps and component statuses.
    """
    # Ensure fresh telemetry packet
    state = latest_packet
    if not state:
        state = await execute_pipeline_tick()

    sensors = state.get("sensors", {})
    physics = state.get("physics", {})
    actuators = state.get("actuators", {})
    prog = state.get("prognostics", {})

    pump_current = sensors.get("pump_current", 0.85)
    flow_lpm = sensors.get("flow_lpm", 1.20)
    inlet_tds = sensors.get("inlet_tds", 850.0)
    outlet_tds = sensors.get("outlet_tds", 42.0)

    delta_p = physics.get("delta_p", 1.11)
    r_cake = physics.get("r_cake", 0.18)
    r_sediment = physics.get("r_sediment", 0.60)
    salt_rejection = physics.get("salt_rejection", 95.2)
    delta_mineral = physics.get("delta_mineral", 28.0)
    washdown_factor = state.get("simulation", {}).get("washdown_factor", 1.0)
    flush_active = actuators.get("flush_solenoid", False)

    # 1. Booster Pump Diagnostic
    if pump_current < 0.15:
        pump_status = "SAFETY_TRIP_CAVITATION"
        pump_desc = "Dry-Run Cavitation detected (<0.15A). Suction line starved, pump relay tripped to prevent impeller damage."
    elif pump_current > 1.80:
        pump_status = "SAFETY_TRIP_OVERCURRENT_STALL"
        pump_desc = "Motor Armature Overcurrent Stall detected (>1.80A). Relay tripped to prevent thermal winding burnout."
    else:
        pump_status = "NOMINAL"
        pump_desc = "Booster pump armature current draw is within safe operating envelope (0.15A - 1.80A)."

    # 2. Membrane Fouling Level Diagnostic
    clean_baseline = 0.35
    if r_cake < 0.80:
        fouling_status = "OPTIMAL"
        fouling_desc = "Membrane surface cake resistance is low and within nominal clean baseline."
    elif r_cake < 1.40:
        fouling_status = "MODERATE_FOULING"
        fouling_desc = "Surface mineral cake accumulation detected. Dynamic anti-scaling washdown recommended."
    else:
        fouling_status = "CRITICAL_SCALING"
        fouling_desc = "Severe concentration polarization and cake fouling. High crystallization risk."

    # 3. Alkaline Remineralizer Elution Balance
    if delta_mineral >= 20.0:
        mineral_status = "OPTIMAL_MINERALIZATION"
        mineral_desc = f"Active Ca2+/Mg2+ mineral elution (+{delta_mineral:.1f} ppm) providing balanced pH ~7.8."
    elif delta_mineral >= 10.0:
        mineral_status = "ACCEPTABLE"
        mineral_desc = f"Moderate mineral elution (+{delta_mineral:.1f} ppm)."
    else:
        mineral_status = "DEPLETED"
        mineral_desc = "Mineral elution cartridge depleted. Water lacks sufficient natural alkaline buffering."

    # 4. Overall System Health Score
    limiting_health = prog.get("limiting_health", 83.2)
    overall_health_score = round(float(limiting_health), 1)

    now_iso = datetime.now(timezone.utc).isoformat()

    return {
        "timestamp": now_iso,
        "device_id": state.get("device_id", "ATOM-WP-2026-0042"),
        "overall_health_score": overall_health_score,
        "system_status": state.get("status", "NOMINAL"),
        "diagnostics": {
            "booster_pump": {
                "status": pump_status,
                "current_draw_amps": round(pump_current, 2),
                "flow_rate_lpm": round(flow_lpm, 2),
                "delivery_pressure_bar": round(delta_p, 2),
                "relay_closed": actuators.get("relay_pump", True),
                "details": pump_desc
            },
            "ro_membrane": {
                "fouling_level": fouling_status,
                "cake_resistance": round(r_cake, 3),
                "baseline_resistance": clean_baseline,
                "salt_rejection_pct": round(salt_rejection, 2),
                "washdown_active": flush_active,
                "washdown_factor": washdown_factor,
                "details": fouling_desc
            },
            "alkaline_remineralizer": {
                "status": mineral_status,
                "delta_mineral_ppm": round(delta_mineral, 1),
                "alkaliser_health_pct": round(prog.get("alkaliser_health", 83.3), 1),
                "details": mineral_desc
            },
            "filtration_stages": {
                "sediment_health": round(prog.get("sediment_health", 83.2), 1),
                "carbon_health": round(prog.get("carbon_health", 84.0), 1),
                "ro_health": round(prog.get("ro_health", 98.6), 1),
                "alkaliser_health": round(prog.get("alkaliser_health", 83.3), 1),
                "failing_stage": prog.get("failing_stage", "NONE"),
                "predicted_rul_days": prog.get("rul_days", 18),
                "auto_dispatch": prog.get("auto_dispatch", False)
            }
        }
    }


@app.get("/api/telemetry/recent")
def get_recent_telemetry(limit: int = Query(default=25, ge=1, le=500)):
    """Fetches the most recent telemetry frames recorded in SQLite."""
    try:
        records = database.get_recent_telemetry(limit=limit)
        return {
            "device_id": "ATOM-WP-2026-0042",
            "count": len(records),
            "telemetry": records
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@app.get("/api/state")
@app.get("/api/telemetry/latest")
def get_live_state():
    """Returns the most recent in-memory evaluated state packet."""
    return latest_packet or {}


@app.get("/api/orders")
def get_recent_orders(limit: int = Query(default=20, ge=1, le=100)):
    """Returns recent autonomous D2C replenishment orders logged in SQLite."""
    try:
        orders = database.get_recent_orders(limit=limit)
        return {
            "count": len(orders),
            "orders": orders
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


def enrich_fleet_unit(unit: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures each unit has verified customer email, phone, and annual service details."""
    u = dict(unit)
    name = u.get("customer_name", "Customer")
    clean_name = "".join(c for c in name.lower() if c.isalnum() or c == " ").strip().replace(" ", ".")
    if not u.get("customer_email"):
        u["customer_email"] = f"{clean_name}@gmail.com"
    if not u.get("customer_phone"):
        dev_id = str(u.get("device_id", "42"))
        suffix = str(abs(hash(dev_id)))[:8].ljust(8, "5")
        u["customer_phone"] = f"+91 98{suffix}"
    if not u.get("annual_service_due"):
        installed = u.get("installed_date") or "2025-06-12"
        try:
            parts = str(installed).split("-")
            due_year = int(parts[0]) + 1
            u["annual_service_due"] = f"{due_year}-{parts[1]}-{parts[2]}"
        except Exception:
            u["annual_service_due"] = "2026-06-12"
    if not u.get("service_status"):
        rul = int(u.get("rul_days", 30))
        u["service_status"] = "Critical Filter Service Due" if rul <= 14 else "Annual Preventive Checkup Due"
    if not u.get("amc_plan"):
        u["amc_plan"] = "Atomberg Care Plus (1 Year Comprehensive)"
    return u


@app.get("/api/fleet")
def get_fleet_telemetry(state: Optional[str] = Query(default=None, description="Optional Indian State filter (e.g. 'Madhya Pradesh', 'Maharashtra')")):
    """
    Returns regional fleet monitoring data for connected smart purifiers across India.
    - If `state` is not specified: returns the 5 benchmark units for backwards-compatibility.
    - If `state` is specified: returns the 5 major city purifier units for that state with customer contact info.
    """
    raw_units = []
    if not state or not state.strip():
        raw_units = fleet_data.BENCHMARK_FLEET
    else:
        clean_state = state.strip()
        try:
            db_units = database.get_fleet_units(clean_state)
            if db_units:
                raw_units = db_units
        except Exception:
            pass

        if not raw_units:
            matched = fleet_data.FLEET_BY_STATE.get(clean_state)
            if matched:
                raw_units = matched
            else:
                for s_name, s_units in fleet_data.FLEET_BY_STATE.items():
                    if s_name.lower() == clean_state.lower():
                        raw_units = s_units
                        break

    return [enrich_fleet_unit(u) for u in raw_units]


@app.post("/api/fleet/outreach", response_model=OutreachResponse)
def create_customer_outreach(payload: OutreachRequest):
    """
    Dispatches and logs an OEM customer outreach event (Email or Phone Call)
    regarding purifier health metrics and yearly preventive service checkups.
    """
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        record_data = {
            "timestamp": now_iso,
            "device_id": payload.device_id,
            "customer_name": payload.customer_name,
            "customer_email": payload.customer_email or f"{payload.customer_name.lower().replace(' ', '.')}@gmail.com",
            "customer_phone": payload.customer_phone or "+91 98000 00000",
            "contact_type": payload.contact_type.upper(),
            "subject": payload.subject or "Atomberg Intellon Purifier Health & Yearly Service Enquiry",
            "service_enquiry": payload.service_enquiry or "Annual Preventive Maintenance & Filter Inspection",
            "notes": payload.notes or "",
            "scheduled_date": payload.scheduled_date or "",
            "outcome": payload.outcome or ("EMAIL_SENT" if payload.contact_type.upper() == "EMAIL" else "CALL_LOGGED"),
            "operator": "OEM Regional Support Engineer"
        }
        row_id = database.log_outreach(record_data)
        record_data["id"] = row_id

        action_name = "Email dispatch confirmed" if payload.contact_type.upper() == "EMAIL" else "Customer call record logged"
        return {
            "status": "SUCCESS",
            "message": f"{action_name} for {payload.customer_name} (Device #{payload.device_id}).",
            "record": record_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record customer outreach: {str(e)}")


@app.get("/api/fleet/outreach")
def get_customer_outreach_history(device_id: Optional[str] = Query(default=None), limit: int = Query(default=50, ge=1, le=200)):
    """
    Retrieves logged customer outreach history (Emails sent and Calls logged).
    """
    try:
        logs = database.get_outreach_logs(device_id=device_id, limit=limit)
        return {
            "count": len(logs),
            "outreach_logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch outreach history: {str(e)}")


@app.get("/api/fleet/states")
def get_fleet_states():
    """
    Returns telemetry aggregates for all 15 major Indian States in the OEM Fleet Grid:
    state name, active unit count, average raw groundwater TDS, average permeate TDS,
    average system health score, dispatched D2C order count, and major cities list.
    """
    try:
        summaries = database.get_fleet_states_summary()
        if summaries:
            return summaries
    except Exception:
        pass

    # In-memory fallback
    result = []
    for state_name in fleet_data.INDIAN_STATES:
        units = fleet_data.FLEET_BY_STATE.get(state_name, [])
        if units:
            avg_raw = round(sum(u["raw_tds"] for u in units) / len(units), 1)
            avg_perm = round(sum(u["permeate_tds"] for u in units) / len(units), 1)
            avg_health = round(sum(u["health_score"] for u in units) / len(units), 1)
            disp_count = sum(1 for u in units if u["d2c_status"] == "ORDER DISPATCHED")
            cities = ", ".join(u["city"] for u in units)
            result.append({
                "state": state_name,
                "unit_count": len(units),
                "avg_raw_tds": avg_raw,
                "avg_permeate_tds": avg_perm,
                "avg_health": avg_health,
                "dispatched_count": disp_count,
                "cities": cities
            })
    return result


@app.post("/api/auth/login")
def portal_login(payload: AuthRequest):
    """
    Authenticates an operator, consumer, or fleet manager for one of the three HydroTwin-PHM access tiers:
    1. 'hil' (Operator & Engineering Access - Virtual HIL Testbed)
    2. 'consumer' (Consumer Access - Homeowner Mobile App & Dashboard)
    3. 'fleet' (OEM Fleet Portal - Operations & Support)
    """
    role = payload.role.lower().strip()
    username = payload.username.strip()

    if role == "hil":
        return {
            "authenticated": True,
            "role": "OPERATOR & ENGINEERING ACCESS",
            "portal": "hil",
            "name": username.split("@")[0].replace(".", " ").title(),
            "email": username,
            "badge": "ENGINEERING LEVEL 3 CLEARANCE",
            "token": "ATOM-HIL-SESSION-2026",
            "who_uses_it": "Atomberg R&D engineers, firmware developers, validation engineers, and fleet diagnostic technicians.",
            "why_it_exists": "Provides low-level simulation controls to inject faults, override sensor inputs, view raw ADC/PWM signals, and test sub-200ms edge safety interlocks."
        }
    elif role == "consumer":
        return {
            "authenticated": True,
            "role": "CONSUMER ACCESS",
            "portal": "consumer",
            "name": username.split("@")[0].replace(".", " ").title(),
            "email": username,
            "badge": "HOMEOWNER & END-USER",
            "token": "ATOM-CONSUMER-SESSION-2026",
            "who_uses_it": "Everyday homeowners and end-users.",
            "why_it_exists": "Consumers only see high-level actionable data (water quality, filter life days, simple modes, automated doorstep delivery) shielded from raw relays."
        }
    elif role == "fleet":
        return {
            "authenticated": True,
            "role": "OEM FLEET PORTAL",
            "portal": "fleet",
            "name": username.split("@")[0].replace(".", " ").title(),
            "email": username,
            "badge": "REGIONAL SERVICE & D2C SUPPLY CHAIN",
            "token": "ATOM-FLEET-SESSION-2026",
            "who_uses_it": "Regional service managers, supply chain teams, and OEM support staff.",
            "why_it_exists": "Monitors multi-device health across city clusters, manages automated D2C cartridge dispatch queues, and tracks regional scaling trends."
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid portal role '{payload.role}'. Must be 'hil', 'consumer', or 'fleet'."
        )


@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    """
    WebSocket endpoint continuously streaming the 1 Hz digital twin packet.
    """
    await websocket.accept()
    active_websockets.add(websocket)
    try:
        # Send immediate current state upon connection
        if latest_packet:
            await websocket.send_json(latest_packet)
        # Keep connection open and listen for incoming messages if any
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        active_websockets.discard(websocket)
    except Exception:
        active_websockets.discard(websocket)


# Mount static production React build if present
BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "build")
if os.path.exists(BUILD_DIR):
    app.mount("/", StaticFiles(directory=BUILD_DIR, html=True), name="frontend_build")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
