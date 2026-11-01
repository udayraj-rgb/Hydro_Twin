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
    salt_rejection = float(data.get("salt_rejection", 0.0))
    status = str(data.get("status", "NOMINAL"))

    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO telemetry (
                timestamp, device_id, inlet_tds, outlet_tds, flow_lpm,
                pump_current, delta_p, r_sediment, r_cake, salt_rejection, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                timestamp, device_id, inlet_tds, outlet_tds, flow_lpm,
                pump_current, delta_p, r_sediment, r_cake, salt_rejection, status
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
