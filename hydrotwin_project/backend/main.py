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
from edge_interlocks import DeterministicEdgeInterlocks
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


class SensorUpdateResponse(BaseModel):
    message: str
    current_sensors: SensorInput
    latest_state: Dict[str, Any]


# Global shared instances
simulator = AutonomousEnvironmentSimulator(
    base_tds=850.0,
    initial_time_seconds=7 * 3600 + 15 * 60,  # 07:15:00 AM (Morning Peak)
    time_acceleration=60.0                     # 1 real second = 1 virtual minute
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

    # 2. Evaluate Dynamic Anti-Scaling Flush requirement
    inferred_delta_p = max(0.2, (1.45 * pump_current) - 0.12)
    prelim_cp = (inlet_tds / 1000.0) * (inferred_delta_p / max(flow_lpm, 0.2))

    flush_solenoid = bool(sim_flush or prelim_cp > 1.25 or inlet_tds > 1200.0)
    washdown_factor = 0.82 if flush_solenoid else sim_washdown

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
            "salt_rejection": phys["salt_rejection"],
            "status": status
        })
    except Exception as e:
        print(f"[HydroTwin-PHM] Telemetry logging error: {e}")

    # 8. Build Consolidated Digital Twin Packet
    latest_packet = {
        "sequence_id": packet_sequence_id,
        "device_id": "ATOM-WP-2026-0042",
        "timestamp": now_iso,
        "sensors": {
            "inlet_tds": inlet_tds,
            "outlet_tds": actual_outlet_tds,
            "flow_lpm": flow_lpm,
            "pump_current": pump_current
        },
        "actuators": {
            "relay_pump": relay_pump,
            "inlet_valve": inlet_valve,
            "flush_solenoid": flush_solenoid
        },
        "physics": {
            "delta_p": phys["delta_p"],
            "delta_pi": phys["delta_pi"],
            "r_sediment": phys["r_sediment"],
            "r_cake": phys["r_cake"],
            "salt_rejection": phys["salt_rejection"],
            "delta_mineral": phys["delta_mineral"],
            "cp_index": phys["cp_index"],
            "flux": phys["flux"]
        },
        "prognostics": {
            "sediment_health": prog["sediment_health"],
            "ro_health": prog["ro_health"],
            "carbon_health": prog["carbon_health"],
            "alkaliser_health": prog["alkaliser_health"],
            "limiting_health": prog["limiting_health"],
            "rul_days": prog["rul_days"],
            "auto_dispatch": prog["auto_dispatch"],
            "failing_stage": prog["failing_stage"]
        },
        "simulation": {
            "mode": sim_state["mode"],
            "active_scenario": sim_state["active_scenario"],
            "diurnal_time": sim_state["time_str"],
            "diurnal_phase": sim_state["phase"],
            "diurnal_hour": sim_state["hour"],
            "diurnal_minute": sim_state["minute"],
            "accumulated_scale": round(accumulated_scale, 4),
            "washdown_factor": washdown_factor,
            "flush_countdown": sim_state["flush_countdown"],
            "scenario_progress_pct": sim_state.get("scenario_progress_pct", 0)
        },
        "status": status
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


@app.get("/api/fleet")
def get_fleet_telemetry():
    """
    Returns regional fleet monitoring data for 5 connected purifiers across
    Madhya Pradesh, Gujarat, and Rajasthan.
    """
    return [
        {
            "device_id": "ATOM-WP-2026-0042",
            "customer_name": "Rajesh Sharma",
            "city": "Bhopal",
            "state": "Madhya Pradesh",
            "raw_tds": 850,
            "permeate_tds": 42,
            "primary_bottleneck": "Activated Carbon Block",
            "rul_days": 18,
            "d2c_status": "Standby",
            "health_score": 94,
            "status": "NOMINAL"
        },
        {
            "device_id": "ATOM-WP-2026-0019",
            "customer_name": "Pooja Verma",
            "city": "Sehore",
            "state": "Madhya Pradesh",
            "raw_tds": 1420,
            "permeate_tds": 78,
            "primary_bottleneck": "Pre-Sediment Filter",
            "rul_days": 11,
            "d2c_status": "ORDER DISPATCHED",
            "health_score": 62,
            "status": "DEGRADED"
        },
        {
            "device_id": "ATOM-WP-2026-0103",
            "customer_name": "Amit Patel",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "raw_tds": 1680,
            "permeate_tds": 92,
            "primary_bottleneck": "RO Membrane",
            "rul_days": 7,
            "d2c_status": "ORDER DISPATCHED",
            "health_score": 48,
            "status": "ACTION REQUIRED"
        },
        {
            "device_id": "ATOM-WP-2026-0077",
            "customer_name": "Vikram Rathore",
            "city": "Jaipur",
            "state": "Rajasthan",
            "raw_tds": 1150,
            "permeate_tds": 65,
            "primary_bottleneck": "RO Membrane",
            "rul_days": 22,
            "d2c_status": "Standby",
            "health_score": 81,
            "status": "NOMINAL"
        },
        {
            "device_id": "ATOM-WP-2026-0055",
            "customer_name": "Neha Joshi",
            "city": "Indore",
            "state": "Madhya Pradesh",
            "raw_tds": 720,
            "permeate_tds": 38,
            "primary_bottleneck": "Alkaliser Mineralizer",
            "rul_days": 34,
            "d2c_status": "Standby",
            "health_score": 96,
            "status": "NOMINAL"
        }
    ]


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
