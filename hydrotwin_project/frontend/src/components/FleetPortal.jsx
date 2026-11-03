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
 * Styled in an elegant White and Olive palette matching the brand reference image.
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
      {/* Top Fleet KPIs: 4 Signature Olive Category Tiles */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#7D9173] text-white p-5 rounded-2xl border border-[#6B7E62] shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-white/80 text-xs">
            <span className="font-semibold uppercase tracking-wider">Total Units</span>
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-white">99.4% Online</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">1,248</div>
          <div className="text-[11px] text-white/75">Active MQTT virtual telemetry sockets</div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#6D8163] text-white p-5 rounded-2xl border border-[#5C7053] shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-white/80 text-xs">
            <span className="font-semibold uppercase tracking-wider">Dynamic Flushes</span>
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-white">+19% Life</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">418 <span className="text-sm font-medium text-white/80">Cycles</span></div>
          <div className="text-[11px] text-white/75">Predictive micro-flushes preventing scaling</div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#869A7C] text-white p-5 rounded-2xl border border-[#74876B] shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-white/80 text-xs">
            <span className="font-semibold uppercase tracking-wider">D2C Dispatches</span>
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-white">Autonomous</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">37 <span className="text-sm font-medium text-white/80">Orders</span></div>
          <div className="text-[11px] text-white/75">Triggered automatically before threshold breach</div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#5D7053] text-white p-5 rounded-2xl border border-[#4C5E43] shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-white/80 text-xs">
            <span className="font-semibold uppercase tracking-wider">Grid Hardness</span>
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-white">Avg</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">940 <span className="text-sm font-medium text-white/80">ppm</span></div>
          <div className="text-[11px] text-white/75">Malwa / Narmada Valley high calcium basin</div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Fleet Diagnostics Table */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white border border-[#DCE4D6] rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[#E3E9DE] gap-2">
          <div>
            <h3 className="text-base font-bold text-[#2A3525] flex items-center space-x-2.5">
              <div className="w-6 h-6 rounded-lg bg-[#1F2D19] border border-[#384828]/60 flex items-center justify-center p-0.5 shadow-sm shrink-0 overflow-hidden">
                <img
                  src={`${process.env.PUBLIC_URL}/assets/hydrotwin_emblem.png`}
                  alt="HydroTwin Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span>Regional Connected Purifier Diagnostics Grid</span>
            </h3>
            <p className="text-xs text-[#6C7E66] mt-0.5">
              Live telemetry synchronization for benchmark fleet across Madhya Pradesh, Gujarat, and Rajasthan.
            </p>
          </div>
          <div className="text-xs font-mono text-[#54684A] bg-[#EAEFE5] px-2.5 py-1 rounded-lg border border-[#BACAB3]">
            Auto-Sync: <span className="text-[#2A3525] font-bold">ACTIVE (1 Hz)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F6F0] text-[#54684A] border-b border-[#DCE4D6]">
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
            <tbody className="divide-y divide-[#EAEFE5] font-mono">
              {activeFleet.map((unit) => {
                const isCurrentHIL = unit.device_id === 'ATOM-WP-2026-0042';
                const isTrip = unit.status.includes('TRIP') || unit.status.includes('CRITICAL');
                const isDispatched = unit.d2c_status === 'ORDER DISPATCHED';

                return (
                  <tr
                    key={unit.device_id}
                    className={`transition-colors ${
                      isCurrentHIL
                        ? 'bg-[#EAEFE5]/50 hover:bg-[#EAEFE5]/80'
                        : 'hover:bg-[#FAFBF8]'
                    }`}
                  >
                    {/* Device ID */}
                    <td className="py-3.5 px-3.5 font-semibold">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[#2A3525] font-bold">{unit.device_id}</span>
                        {isCurrentHIL && (
                          <span className="px-1.5 py-0.5 rounded bg-[#6C8360] text-white text-[9px] uppercase font-bold animate-pulse">
                            ACTIVE HIL
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer & Location */}
                    <td className="py-3.5 px-3.5 font-sans">
                      <div className="font-semibold text-[#2A3525]">{unit.customer_name}</div>
                      <div className="text-[11px] text-[#6C7E66]">{unit.city}, {unit.state}</div>
                    </td>

                    {/* Feed TDS */}
                    <td className="py-3.5 px-3.5 text-[#3E4D37]">
                      <span className="font-bold">{unit.raw_tds}</span> ppm
                    </td>

                    {/* Remaining RUL */}
                    <td className="py-3.5 px-3.5">
                      <span className={`font-bold ${
                        unit.rul_days <= 10 ? 'text-rose-700' : unit.rul_days <= 14 ? 'text-amber-700' : 'text-[#2A3525]'
                      }`}>
                        {unit.rul_days} Days
                      </span>
                    </td>

                    {/* Bottleneck Stage */}
                    <td className="py-3.5 px-3.5 text-[#3E4D37] font-sans">
                      {unit.primary_bottleneck}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isTrip
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                          : unit.status === 'DEGRADED' || unit.status === 'ACTION REQUIRED'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3]'
                      }`}>
                        {unit.status}
                      </span>
                    </td>

                    {/* D2C Replenishment Action */}
                    <td className="py-3.5 px-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isDispatched
                          ? 'bg-[#EAEFE5] text-[#2A3525] border border-[#6C8360] font-bold'
                          : 'bg-[#F4F6F0] text-[#788870] border border-[#DCE4D6]'
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
