"""
HydroTwin-PHM SQLite Telemetry & Order Database Module
AtomQuest 2026 - Track 2: Water Purifier
Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal
"""

import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Default path to SQLite database located in the backend folder
DB_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hydrotwin.db")


def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """
    Creates a thread-safe connection to the SQLite database with Row factory enabled
    and Write-Ahead Logging (WAL) for high concurrency.
    """
    path = db_path or DB_FILE_PATH
    conn = sqlite3.connect(path, check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    """
    Initializes the local SQLite database schema.
    Creates 'telemetry' and 'replenishment_orders' tables if they do not exist.
    """
    conn = get_db_connection(db_path)
    with conn:
        # Table 1: telemetry
        conn.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                device_id TEXT NOT NULL,
                inlet_tds REAL NOT NULL,
                outlet_tds REAL NOT NULL,
                flow_lpm REAL NOT NULL,
                pump_current REAL NOT NULL,
                delta_p REAL NOT NULL,
                r_sediment REAL NOT NULL,
                r_cake REAL NOT NULL,
                r_sed_slope REAL DEFAULT 0.0,
                r_cake_slope REAL DEFAULT 0.0,
                salt_rejection REAL NOT NULL,
                status TEXT NOT NULL
            );
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp DESC);
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_device ON telemetry(device_id);
        """)

        # Migration: Add r_sed_slope and r_cake_slope to existing databases if missing
        try:
            cursor = conn.execute("PRAGMA table_info(telemetry);")
            existing_cols = {row["name"] for row in cursor.fetchall()}
            if "r_sed_slope" not in existing_cols:
                conn.execute("ALTER TABLE telemetry ADD COLUMN r_sed_slope REAL DEFAULT 0.0;")
            if "r_cake_slope" not in existing_cols:
                conn.execute("ALTER TABLE telemetry ADD COLUMN r_cake_slope REAL DEFAULT 0.0;")
        except Exception:
            pass

        # Table 2: replenishment_orders
        conn.execute("""
            CREATE TABLE IF NOT EXISTS replenishment_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                device_id TEXT NOT NULL,
                customer_name TEXT NOT NULL,
                city TEXT NOT NULL,
                stage_failing TEXT NOT NULL,
                predicted_rul_days INTEGER NOT NULL,
                order_status TEXT NOT NULL
            );
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_orders_device ON replenishment_orders(device_id);
        """)

        # Table 3: fleet_units (15 Indian States, 5 Major Cities each)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS fleet_units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT UNIQUE NOT NULL,
                customer_name TEXT NOT NULL,
                city TEXT NOT NULL,
                location TEXT NOT NULL,
                state TEXT NOT NULL,
                raw_tds REAL NOT NULL,
                permeate_tds REAL NOT NULL,
                primary_bottleneck TEXT NOT NULL,
                rul_days INTEGER NOT NULL,
                d2c_status TEXT NOT NULL,
                health_score INTEGER NOT NULL,
                status TEXT NOT NULL,
                installed_date TEXT,
                daily_consumption_liters REAL
            );
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_fleet_state ON fleet_units(state);
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_fleet_city ON fleet_units(city);
        """)

        # Auto-seed fleet units if table is currently empty
        cursor = conn.execute("SELECT COUNT(*) FROM fleet_units;")
        count = cursor.fetchone()[0]
        if count == 0:
            try:
                import fleet_data
                for unit in fleet_data.FLEET_UNITS:
                    conn.execute("""
                        INSERT OR IGNORE INTO fleet_units (
                            device_id, customer_name, city, location, state,
                            raw_tds, permeate_tds, primary_bottleneck, rul_days,
                            d2c_status, health_score, status, installed_date, daily_consumption_liters
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """, (
                        unit["device_id"],
                        unit["customer_name"],
                        unit["city"],
                        unit["location"],
                        unit["state"],
                        float(unit["raw_tds"]),
                        float(unit["permeate_tds"]),
                        unit["primary_bottleneck"],
                        int(unit["rul_days"]),
                        unit["d2c_status"],
                        int(unit["health_score"]),
                        unit["status"],
                        unit.get("installed_date", "2025-06-01"),
                        float(unit.get("daily_consumption_liters", 20.0))
                    ))
            except Exception as e:
                # Fallback silently or log if fleet_data is not available in unit test sandbox
                pass
    conn.close()


def log_telemetry(data: Dict[str, Any], db_path: Optional[str] = None) -> int:
    """
    Logs an edge telemetry frame into the SQLite database.
    Accepts a dictionary containing telemetry keys and returns the inserted row ID.
    """
    timestamp = data.get("timestamp") or datetime.now(timezone.utc).isoformat()
    device_id = str(data.get("device_id", "ATOM-WP-2026-0042"))
    inlet_tds = float(data.get("inlet_tds", 0.0))
    outlet_tds = float(data.get("outlet_tds", 0.0))
    flow_lpm = float(data.get("flow_lpm", 0.0))
    pump_current = float(data.get("pump_current", 0.0))
    delta_p = float(data.get("delta_p", 0.0))
    r_sediment = float(data.get("r_sediment", 0.0))
    r_cake = float(data.get("r_cake", 0.0))
    r_sed_slope = float(data.get("r_sed_slope", 0.0))
    r_cake_slope = float(data.get("r_cake_slope", 0.0))
    salt_rejection = float(data.get("salt_rejection", 0.0))
    status = str(data.get("status", "NOMINAL"))

    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO telemetry (
                timestamp, device_id, inlet_tds, outlet_tds, flow_lpm,
                pump_current, delta_p, r_sediment, r_cake, r_sed_slope, r_cake_slope, salt_rejection, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                timestamp, device_id, inlet_tds, outlet_tds, flow_lpm,
                pump_current, delta_p, r_sediment, r_cake, r_sed_slope, r_cake_slope, salt_rejection, status
            )
        )
        row_id = cursor.lastrowid
    conn.close()
    return row_id


def log_order(
    device_id: str,
    customer_name: str,
    city: str,
    stage: str,
    rul_days: int,
    order_status: str = "ORDER DISPATCHED",
    timestamp: Optional[str] = None,
    db_path: Optional[str] = None
) -> int:
    """
    Logs an automated D2C replenishment order when a filtration stage approaches critical RUL wear.
    Returns the inserted order row ID.
    """
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO replenishment_orders (
                timestamp, device_id, customer_name, city,
                stage_failing, predicted_rul_days, order_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (ts, device_id, customer_name, city, stage, int(rul_days), order_status)
        )
        row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_recent_telemetry(
    limit: int = 25,
    device_id: Optional[str] = None,
    db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves up to `limit` most recent telemetry frames in chronological order.
    Returns a list of dictionaries with column names as keys.
    """
    conn = get_db_connection(db_path)
    if device_id:
        cursor = conn.execute(
            """
            SELECT * FROM telemetry
            WHERE device_id = ?
            ORDER BY id DESC
            LIMIT ?;
            """,
            (device_id, limit)
        )
    else:
        cursor = conn.execute(
            """
            SELECT * FROM telemetry
            ORDER BY id DESC
            LIMIT ?;
            """,
            (limit,)
        )
    rows = cursor.fetchall()
    conn.close()
    # Reverse to return in chronological sequence (oldest to newest among the recent slice)
    return [dict(row) for row in reversed(rows)]


def get_recent_orders(
    limit: int = 25,
    db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves up to `limit` most recent replenishment orders in reverse chronological order.
    """
    conn = get_db_connection(db_path)
    cursor = conn.execute(
        """
        SELECT * FROM replenishment_orders
        ORDER BY id DESC
        LIMIT ?;
        """,
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_fleet_units(
    state: Optional[str] = None,
    db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves fleet units from SQLite.
    If `state` is specified, filters by state name (case-insensitive).
    Returns list of dict records.
    """
    conn = get_db_connection(db_path)
    if state and state.strip():
        cursor = conn.execute(
            """
            SELECT * FROM fleet_units
            WHERE LOWER(state) = LOWER(?)
            ORDER BY id ASC;
            """,
            (state.strip(),)
        )
    else:
        cursor = conn.execute(
            """
            SELECT * FROM fleet_units
            ORDER BY id ASC;
            """
        )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_fleet_states_summary(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves aggregated summary statistics for each of the 15 Indian States:
    unit count, average groundwater TDS, average permeate TDS, average health score,
    and count of D2C orders dispatched.
    """
    conn = get_db_connection(db_path)
    cursor = conn.execute(
        """
        SELECT 
            state,
            COUNT(*) as unit_count,
            ROUND(AVG(raw_tds), 1) as avg_raw_tds,
            ROUND(AVG(permeate_tds), 1) as avg_permeate_tds,
            ROUND(AVG(health_score), 1) as avg_health,
            SUM(CASE WHEN d2c_status = 'ORDER DISPATCHED' THEN 1 ELSE 0 END) as dispatched_count,
            GROUP_CONCAT(city, ', ') as cities
        FROM fleet_units
        GROUP BY state
        ORDER BY state ASC;
        """
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


if __name__ == "__main__":
    # Self-test when executed directly
    print("[HydroTwin-PHM] Initializing SQLite database...")
    init_db()
    print("[HydroTwin-PHM] Logging sample telemetry frame...")
    sample_id = log_telemetry({
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
    })
    print(f"[HydroTwin-PHM] Telemetry recorded with ID: {sample_id}")

    sample_order_id = log_order(
        device_id="ATOM-WP-2026-0042",
        customer_name="Rajesh Sharma",
        city="Bhopal",
        stage="Activated Carbon Block",
        rul_days=11
    )
    print(f"[HydroTwin-PHM] Sample order recorded with ID: {sample_order_id}")

    recent = get_recent_telemetry(limit=5)
    print(f"[HydroTwin-PHM] Retrieved {len(recent)} recent frame(s):")
    for r in recent:
        print(f"  Frame #{r['id']} | {r['device_id']} | TDS: {r['inlet_tds']} -> {r['outlet_tds']} | Status: {r['status']}")
