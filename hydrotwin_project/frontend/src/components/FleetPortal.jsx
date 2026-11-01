import React, { useState, useEffect } from 'react';

const FLEET_API_URL = 'http://localhost:8000/api/fleet';

const INITIAL_FLEET = [
  {
    device_id: 'ATOM-WP-2026-0042',
    customer_name: 'Rajesh Sharma',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    raw_tds: 850,
    permeate_tds: 42,
    primary_bottleneck: 'Activated Carbon Block',
    rul_days: 18,
    d2c_status: 'Standby',
    health_score: 94,
    status: 'NOMINAL'
  },
  {
    device_id: 'ATOM-WP-2026-0019',
    customer_name: 'Pooja Verma',
    city: 'Sehore',
    state: 'Madhya Pradesh',
    raw_tds: 1420,
    permeate_tds: 78,
    primary_bottleneck: 'Pre-Sediment Filter',
    rul_days: 11,
    d2c_status: 'ORDER DISPATCHED',
    health_score: 62,
    status: 'DEGRADED'
  },
  {
    device_id: 'ATOM-WP-2026-0103',
    customer_name: 'Amit Patel',
    city: 'Ahmedabad',
    state: 'Gujarat',
    raw_tds: 1680,
    permeate_tds: 92,
    primary_bottleneck: 'RO Membrane',
    rul_days: 7,
    d2c_status: 'ORDER DISPATCHED',
    health_score: 48,
    status: 'ACTION REQUIRED'
  },
  {
    device_id: 'ATOM-WP-2026-0077',
    customer_name: 'Vikram Rathore',
    city: 'Jaipur',
    state: 'Rajasthan',
    raw_tds: 1150,
    permeate_tds: 65,
    primary_bottleneck: 'RO Membrane',
    rul_days: 22,
    d2c_status: 'Standby',
    health_score: 81,
    status: 'NOMINAL'
  },
  {
    device_id: 'ATOM-WP-2026-0055',
    customer_name: 'Neha Joshi',
    city: 'Indore',
    state: 'Madhya Pradesh',
    raw_tds: 720,
    permeate_tds: 38,
    primary_bottleneck: 'Alkaliser Mineralizer',
    rul_days: 34,
    d2c_status: 'Standby',
    health_score: 96,
    status: 'NOMINAL'
  }
];

/**
 * FleetPortal: Atomberg OEM Fleet Monitoring & Regional Water Hardness Grid
 * Visualizes fleet-wide telemetry, dynamic flush metrics, D2C replenishment pipelines,
 * and live synchronization with active testbed unit.
 */
function FleetPortal({ telemetry = null }) {
  const [fleetData, setFleetData] = useState(INITIAL_FLEET);

  // Fetch fleet telemetry from FastAPI backend
  useEffect(() => {
    let isMounted = true;
    const fetchFleet = async () => {
      try {
        const resp = await fetch(FLEET_API_URL);
        if (resp.ok) {
          const data = await resp.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setFleetData(data);
          }
        }
      } catch (err) {
        // Fallback to local default fleet if backend is offline
      }
    };

    fetchFleet();
    const interval = setInterval(fetchFleet, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Merge live telemetry for the active unit ATOM-WP-2026-0042
  const activeFleet = fleetData.map((unit) => {
    if (unit.device_id === 'ATOM-WP-2026-0042' && telemetry) {
      const liveInletTds = telemetry.sensors?.inlet_tds ?? unit.raw_tds;
      const liveOutletTds = telemetry.sensors?.outlet_tds ?? unit.permeate_tds;
      const liveRul = telemetry.prognostics?.rul_days ?? unit.rul_days;
      const liveDispatch = telemetry.prognostics?.auto_dispatch
        ? 'ORDER DISPATCHED'
        : liveRul <= 14
        ? 'ORDER DISPATCHED'
        : 'Standby';
      const liveStatus = telemetry.status || unit.status;
      const liveBottleneck =
        telemetry.prognostics?.failing_stage === 'SEDIMENT'
          ? 'Pre-Sediment Filter'
          : 'RO Membrane Core';

      return {
        ...unit,
        raw_tds: liveInletTds,
        permeate_tds: liveOutletTds,
        rul_days: liveRul,
        d2c_status: liveDispatch,
        status: liveStatus,
        primary_bottleneck: liveBottleneck
      };
    }
    return unit;
  });

  return (
    <div id="fleet-portal" className="space-y-6 animate-fadeIn pb-8">
      {/* ----------------------------------------------------------------- */}
      {/* Top Fleet KPIs */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Total Connected Units</span>
            <span className="text-emerald-400 font-mono text-[11px] font-bold">99.4% Online</span>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">1,248</div>
          <div className="text-[11px] text-slate-400">Active MQTT virtual sockets in MP & Gujarat</div>
        </div>

        {/* KPI 2 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Dynamic Flushes (24h)</span>
            <span className="text-cyan-400 font-mono text-[11px] font-bold">+19% Life Preserved</span>
          </div>
          <div className="text-3xl font-black font-mono text-cyan-400 tracking-tight">418 <span className="text-sm font-medium text-slate-400">Cycles</span></div>
          <div className="text-[11px] text-slate-400">Predictive micro-flushes preventing crystallization</div>
        </div>

        {/* KPI 3 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">D2C Replacements</span>
            <span className="text-amber-400 font-mono text-[11px] font-bold">Autonomous</span>
          </div>
          <div className="text-3xl font-black font-mono text-amber-300 tracking-tight">37 <span className="text-sm font-medium text-slate-400">Orders</span></div>
          <div className="text-[11px] text-slate-400">Dispatched automatically before flow degradation</div>
        </div>

        {/* KPI 4 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Regional Feed Hardness</span>
            <span className="text-slate-400 font-mono text-[11px]">Grid Avg</span>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">940 <span className="text-sm font-medium text-slate-400">ppm</span></div>
          <div className="text-[11px] text-slate-400">Malwa / Narmada Valley high calcium basin</div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Fleet Diagnostics Table */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>🏢</span>
              <span>Regional Connected Purifier Diagnostics Grid</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live telemetry synchronization for benchmark fleet across Madhya Pradesh, Gujarat, and Rajasthan.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Auto-Sync: <span className="text-emerald-400 font-bold">ACTIVE</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Device ID</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Customer & Location</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Feed TDS</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Remaining RUL</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Primary Bottleneck</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Diagnostic Status</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">D2C Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {activeFleet.map((unit) => {
                const isCurrentHIL = unit.device_id === 'ATOM-WP-2026-0042';
                const isTrip = unit.status.includes('TRIP') || unit.status.includes('CRITICAL');
                const isDispatched = unit.d2c_status === 'ORDER DISPATCHED';

                return (
                  <tr
                    key={unit.device_id}
                    className={`transition-colors ${
                      isCurrentHIL
                        ? 'bg-cyan-950/20 hover:bg-cyan-950/30'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Device ID */}
                    <td className="py-3 px-3.5 font-semibold">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-cyan-300">{unit.device_id}</span>
                        {isCurrentHIL && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-900/80 text-cyan-300 text-[9px] uppercase font-bold border border-cyan-700 animate-pulse">
                            ACTIVE HIL
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer & Location */}
                    <td className="py-3 px-3.5 font-sans">
                      <div className="font-semibold text-slate-200">{unit.customer_name}</div>
                      <div className="text-[11px] text-slate-400">{unit.city}, {unit.state}</div>
                    </td>

                    {/* Feed TDS */}
                    <td className="py-3 px-3.5 text-slate-300">
                      <span className="font-bold">{unit.raw_tds}</span> ppm
                    </td>

                    {/* Remaining RUL */}
                    <td className="py-3 px-3.5">
                      <span className={`font-bold ${
                        unit.rul_days <= 10 ? 'text-rose-400' : unit.rul_days <= 14 ? 'text-amber-400' : 'text-slate-200'
                      }`}>
                        {unit.rul_days} Days
                      </span>
                    </td>

                    {/* Bottleneck Stage */}
                    <td className="py-3 px-3.5 text-slate-300 font-sans">
                      {unit.primary_bottleneck}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isTrip
                          ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                          : unit.status === 'DEGRADED' || unit.status === 'ACTION REQUIRED'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {unit.status}
                      </span>
                    </td>

                    {/* D2C Replenishment Action */}
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isDispatched
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {unit.d2c_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FleetPortal;
