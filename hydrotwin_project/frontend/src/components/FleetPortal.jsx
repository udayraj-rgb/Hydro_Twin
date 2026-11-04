import React, { useState, useEffect, useMemo } from 'react';
import {
  INDIAN_STATES,
  FLEET_BY_STATE,
  STATE_METADATA,
  getUnitsByState
} from '../data/fleetData';

const FLEET_API_URL = 'http://localhost:8000/api/fleet';

// Quick-select favorite states for rapid operator switching
const POPULAR_STATES = [
  'Madhya Pradesh',
  'Maharashtra',
  'Gujarat',
  'Karnataka',
  'Tamil Nadu',
  'Rajasthan',
  'Delhi (NCR)',
  'Uttar Pradesh',
  'West Bengal',
  'Kerala'
];

/**
 * FleetPortal: Atomberg National OEM Fleet Diagnostics & 15-State Hydrology Grid
 * AtomQuest 2026 - Track 2: Water Purifier
 * Team Atomizers | SCOPE, VIT Bhopal
 */
function FleetPortal({ telemetry = null }) {
  const [selectedState, setSelectedState] = useState('Madhya Pradesh');
  const [fleetData, setFleetData] = useState(() => getUnitsByState('Madhya Pradesh'));
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [dispatchedOverrides, setDispatchedOverrides] = useState({});
  const [washdownActiveDevices, setWashdownActiveDevices] = useState({});

  // Fetch state fleet telemetry from FastAPI backend with automatic fallback to bundled data
  useEffect(() => {
    let isMounted = true;
    const fetchFleetForState = async () => {
      try {
        const resp = await fetch(`${FLEET_API_URL}?state=${encodeURIComponent(selectedState)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setFleetData(data);
            return;
          }
        }
      } catch (err) {
        // Backend offline or running standalone static; fallback to bundled state data
      }
      if (isMounted) {
        setFleetData(getUnitsByState(selectedState));
      }
    };

    fetchFleetForState();
    const interval = setInterval(fetchFleetForState, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedState]);

  // Synchronize live HIL telemetry if the active unit (ATOM-WP-2026-0042) is present in the list
  const activeFleet = useMemo(() => {
    return fleetData.map((unit) => {
      let currentUnit = { ...unit };

      // Apply operator simulation overrides if triggered
      if (dispatchedOverrides[unit.device_id]) {
        currentUnit.d2c_status = 'ORDER DISPATCHED';
        currentUnit.rul_days = Math.min(currentUnit.rul_days, 11);
      }

      if (washdownActiveDevices[unit.device_id]) {
        currentUnit.status = 'DYNAMIC FLUSH ACTIVE';
      }

      // If this is the active hardware digital twin in Madhya Pradesh (Bhopal)
      if (unit.device_id === 'ATOM-WP-2026-0042' && telemetry) {
        const liveInletTds = telemetry.sensors?.inlet_tds ?? unit.raw_tds;
        const liveOutletTds = telemetry.sensors?.outlet_tds ?? unit.permeate_tds;
        const liveRul = telemetry.prognostics?.rul_days ?? unit.rul_days;
        const liveDispatch = telemetry.prognostics?.auto_dispatch
          ? 'ORDER DISPATCHED'
          : liveRul <= 14
          ? 'ORDER DISPATCHED'
          : currentUnit.d2c_status;
        const liveStatus = telemetry.status || currentUnit.status;
        const liveBottleneck =
          telemetry.prognostics?.failing_stage === 'SEDIMENT'
            ? 'Pre-Sediment Filter'
            : telemetry.prognostics?.failing_stage === 'CARBON'
            ? 'Activated Carbon Block'
            : 'TFC RO Membrane Core';

        currentUnit = {
          ...currentUnit,
          raw_tds: liveInletTds,
          permeate_tds: liveOutletTds,
          rul_days: liveRul,
          d2c_status: liveDispatch,
          status: liveStatus,
          primary_bottleneck: liveBottleneck,
          health_score: telemetry.prognostics?.limiting_health
            ? Math.round(telemetry.prognostics.limiting_health)
            : unit.health_score
        };
      }
      return currentUnit;
    });
  }, [fleetData, telemetry, dispatchedOverrides, washdownActiveDevices]);

  // Filtered cities based on search bar
  const displayedUnits = useMemo(() => {
    if (!searchFilter.trim()) return activeFleet;
    const query = searchFilter.toLowerCase().trim();
    return activeFleet.filter(
      (u) =>
        u.city.toLowerCase().includes(query) ||
        u.customer_name.toLowerCase().includes(query) ||
        u.device_id.toLowerCase().includes(query) ||
        (u.location && u.location.toLowerCase().includes(query)) ||
        u.primary_bottleneck.toLowerCase().includes(query)
    );
  }, [activeFleet, searchFilter]);

  // Dynamic KPI calculations for the selected state
  const stateKpis = useMemo(() => {
    const totalUnits = activeFleet.length;
    if (totalUnits === 0) {
      return { avgRaw: 850, avgPerm: 45, rejection: 94.7, dispatched: 0, avgHealth: 90 };
    }
    const sumRaw = activeFleet.reduce((acc, u) => acc + (u.raw_tds || 0), 0);
    const sumPerm = activeFleet.reduce((acc, u) => acc + (u.permeate_tds || 0), 0);
    const sumHealth = activeFleet.reduce((acc, u) => acc + (u.health_score || 0), 0);
    const dispatchedCount = activeFleet.filter((u) => u.d2c_status === 'ORDER DISPATCHED').length;

    const avgRaw = Math.round(sumRaw / totalUnits);
    const avgPerm = Math.round(sumPerm / totalUnits);
    const avgHealth = Math.round(sumHealth / totalUnits);
    const rejection = avgRaw > 0 ? (((avgRaw - avgPerm) / avgRaw) * 100).toFixed(1) : '95.0';

    return {
      avgRaw,
      avgPerm,
      rejection,
      dispatched: dispatchedCount,
      avgHealth
    };
  }, [activeFleet]);

  // Active state metadata
  const currentMetadata = STATE_METADATA[selectedState] || {
    basin: 'Regional Groundwater Basin',
    aquifer: 'Mineralized Sub-surface Aquifer',
    zone: 'India'
  };

  // Handler for simulated D2C dispatch
  const handleSimulateDispatch = (deviceId) => {
    setDispatchedOverrides((prev) => ({ ...prev, [deviceId]: true }));
    if (selectedUnit && selectedUnit.device_id === deviceId) {
      setSelectedUnit((prev) => ({
        ...prev,
        d2c_status: 'ORDER DISPATCHED',
        rul_days: Math.min(prev.rul_days, 11)
      }));
    }
  };

  // Handler for simulated dynamic washdown
  const handleSimulateWashdown = (deviceId) => {
    setWashdownActiveDevices((prev) => ({ ...prev, [deviceId]: true }));
    setTimeout(() => {
      setWashdownActiveDevices((prev) => {
        const copy = { ...prev };
        delete copy[deviceId];
        return copy;
      });
    }, 4000);
  };

  return (
    <div id="fleet-portal" className="space-y-6 animate-fadeIn pb-8">
      {/* ----------------------------------------------------------------- */}
      {/* Header Banner & Regional State Selector */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white border border-[#DCE4D6] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E3E9DE]">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#54684A] uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#6C8360] animate-pulse"></span>
              <span>National Connected OEM Telemetry Grid</span>
              <span className="text-[#889A80]">•</span>
              <span>15 Major Indian States</span>
              <span className="text-[#889A80]">•</span>
              <span>75 Connected Cities</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1F2D19] tracking-tight flex items-center space-x-3">
              <span>Regional Groundwater Hydrology & Fleet Diagnostics</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#6C7E66]">
              Real-time Darcy-Hermia physical fouling tracking across Indian geological aquifers with automated D2C doorstep cartridge replenishment.
            </p>
          </div>

          {/* State Dropdown Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center space-x-2 bg-[#F4F6F0] border border-[#BACAB3] rounded-xl px-3.5 py-2 shadow-xs">
              <svg className="w-4 h-4 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <label htmlFor="state-select" className="text-xs font-bold text-[#384828] uppercase tracking-wider">
                Select State:
              </label>
              <select
                id="state-select"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-transparent text-sm font-bold text-[#1F2D19] focus:outline-none cursor-pointer pr-2"
              >
                {INDIAN_STATES.map((stateName) => {
                  const meta = STATE_METADATA[stateName] || {};
                  return (
                    <option key={stateName} value={stateName} className="text-[#1F2D19] font-medium">
                      {stateName} ({meta.zone || 'Zone'}) — 5 Major Cities
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Quick-Select Popular State Pills */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#6C7E66]">
            Fast Switch Region ({INDIAN_STATES.length} States Monitored):
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_STATES.map((stateName) => {
              const isSelected = stateName === selectedState;
              return (
                <button
                  key={stateName}
                  type="button"
                  onClick={() => setSelectedState(stateName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center space-x-1.5 border shadow-2xs ${
                    isSelected
                      ? 'bg-[#1F2D19] text-white border-[#1F2D19] shadow-sm font-bold'
                      : 'bg-[#F4F6F0] text-[#384828] border-[#DCE4D6] hover:bg-[#EAEFE5] hover:border-[#BACAB3]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#98D88E]' : 'bg-[#7A8E72]'}`}></span>
                  <span>{stateName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Geological Basin Information Banner */}
        <div className="bg-[#F8FAF5] border border-[#E3E9DE] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#EAEFE5] border border-[#BACAB3] text-[#384828] flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-[#1F2D19] flex items-center space-x-2">
                <span>{selectedState} Regional Groundwater Profile</span>
                <span className="px-2 py-0.5 rounded bg-[#EAEFE5] text-[#384828] font-mono text-[10px] font-bold">
                  {currentMetadata.zone} Zone
                </span>
              </div>
              <div className="text-[#54684A] mt-0.5">
                <span className="font-semibold text-[#2A3525]">Basin:</span> {currentMetadata.basin}
                <span className="mx-1.5 text-[#BACAB3]">|</span>
                <span className="font-semibold text-[#2A3525]">Aquifer Characteristics:</span> {currentMetadata.aquifer}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-start md:self-auto shrink-0">
            <span className="text-[11px] text-[#6C7E66]">5 Major Cities Monitored</span>
            <span className="px-2 py-1 rounded bg-[#EAEFE5] text-[#2A3525] font-mono font-bold text-xs border border-[#BACAB3]">
              Active IoT Feed
            </span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Top Fleet KPIs: 4 Signature Olive Category Tiles (Dynamic) */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#7D9173] text-white p-5 rounded-2xl border border-[#6B7E62] shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-white/80 text-xs">
            <span className="font-semibold uppercase tracking-wider">{selectedState} Units</span>
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-white">100% Online</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">
            5 <span className="text-base font-medium text-white/80">Cities</span>
          </div>
          <div className="text-[11px] text-white/75">1,248 telemetry sockets across 15 States</div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#6D8163] text-white p-5 rounded-2xl border border-[#5C7053] shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-white/80 text-xs">
            <span className="font-semibold uppercase tracking-wider">Avg Feed Groundwater</span>
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-white">Inlet</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">
            {stateKpis.avgRaw} <span className="text-sm font-medium text-white/80">ppm TDS</span>
          </div>
          <div className="text-[11px] text-white/75">
            {stateKpis.avgRaw > 1200 ? 'High Hardness Basin' : stateKpis.avgRaw > 600 ? 'Moderate Mineralization' : 'Soft Water Baseline'}
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#869A7C] text-white p-5 rounded-2xl border border-[#74876B] shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-white/80 text-xs">
            <span className="font-semibold uppercase tracking-wider">Salt Rejection & Purity</span>
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-white">Darcy-Hermia</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">
            {stateKpis.rejection}% <span className="text-sm font-medium text-white/80">({stateKpis.avgPerm} ppm)</span>
          </div>
          <div className="text-[11px] text-white/75">Avg Permeate across {selectedState}</div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#5D7053] text-white p-5 rounded-2xl border border-[#4C5E43] shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-white/80 text-xs">
            <span className="font-semibold uppercase tracking-wider">D2C Dispatches</span>
            <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-white">Doorstep</span>
          </div>
          <div className="text-3xl font-black font-mono tracking-tight text-white">
            {stateKpis.dispatched} <span className="text-sm font-medium text-white/80">Active</span>
          </div>
          <div className="text-[11px] text-white/75">
            {stateKpis.dispatched > 0 ? 'Autonomous doorstep couriers in transit' : 'All stage RULs above threshold'}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5 Major Cities Diagnostics Table */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white border border-[#DCE4D6] rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[#E3E9DE] gap-3">
          <div>
            <h3 className="text-base font-bold text-[#2A3525] flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1F2D19] border border-[#384828]/60 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden">
                <img
                  src={`${process.env.PUBLIC_URL}/assets/hydrotwin_emblem.png`}
                  alt="HydroTwin Logo"
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
              </div>
              <span>{selectedState}: 5 Major Connected Purifiers</span>
            </h3>
            <p className="text-xs text-[#6C7E66] mt-0.5">
              Detailed household telemetry, Darcy-Hermia physical bottleneck stage, and proactive D2C replenishment status.
            </p>
          </div>

          {/* Table Search & Quick Filter */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search city, customer, serial..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-56 sm:w-64 pl-8 pr-3 py-1.5 text-xs bg-[#F4F6F0] border border-[#BACAB3] rounded-xl text-[#1F2D19] placeholder-[#889A80] focus:outline-none focus:ring-1 focus:ring-[#384828]"
              />
              <svg className="w-3.5 h-3.5 text-[#6C7E66] absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="text-xs font-mono text-[#54684A] bg-[#EAEFE5] px-2.5 py-1.5 rounded-xl border border-[#BACAB3] shrink-0">
              Auto-Sync: <span className="text-[#2A3525] font-bold">1 Hz</span>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F6F0] text-[#54684A] border-b border-[#DCE4D6]">
              <tr>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Device ID</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">City & Locality</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Customer Name</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Feed TDS</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Permeate</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">RUL (Days)</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Bottleneck Filter</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">Health</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider">D2C Action</th>
                <th className="py-3 px-3.5 font-bold uppercase tracking-wider text-right">Forensics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEFE5] font-mono">
              {displayedUnits.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-[#6C7E66] font-sans">
                    No connected units matching "{searchFilter}" in {selectedState}.
                  </td>
                </tr>
              ) : (
                displayedUnits.map((unit) => {
                  const isCurrentHIL = unit.device_id === 'ATOM-WP-2026-0042';
                  const isTrip = unit.status.includes('TRIP') || unit.status.includes('CRITICAL');
                  const isDegraded = unit.status === 'DEGRADED' || unit.status === 'ACTION REQUIRED';
                  const isDispatched = unit.d2c_status === 'ORDER DISPATCHED';
                  const isSelected = selectedUnit && selectedUnit.device_id === unit.device_id;

                  return (
                    <tr
                      key={unit.device_id}
                      onClick={() => setSelectedUnit(unit)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#EAEFE5] border-l-4 border-l-[#384828]'
                          : isCurrentHIL
                          ? 'bg-[#EAEFE5]/40 hover:bg-[#EAEFE5]/70'
                          : 'hover:bg-[#FAFBF8]'
                      }`}
                    >
                      {/* Device ID */}
                      <td className="py-3.5 px-3.5 font-semibold">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[#2A3525] font-bold">{unit.device_id}</span>
                          {isCurrentHIL && (
                            <span className="px-1.5 py-0.5 rounded bg-[#6C8360] text-white text-[9px] uppercase font-bold animate-pulse font-sans">
                              ACTIVE HIL
                            </span>
                          )}
                        </div>
                      </td>

                      {/* City & Locality */}
                      <td className="py-3.5 px-3.5 font-sans">
                        <div className="font-bold text-[#1F2D19]">{unit.city}</div>
                        <div className="text-[11px] text-[#6C7E66] truncate max-w-[150px]">
                          {unit.location || `${unit.city} Central`}
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td className="py-3.5 px-3.5 font-sans">
                        <div className="font-semibold text-[#2A3525]">{unit.customer_name}</div>
                        <div className="text-[10px] text-[#889A80]">
                          {unit.daily_consumption_liters || 20} L/day avg
                        </div>
                      </td>

                      {/* Feed TDS */}
                      <td className="py-3.5 px-3.5 text-[#3E4D37]">
                        <span className="font-bold">{unit.raw_tds}</span> <span className="text-[10px] text-[#6C7E66]">ppm</span>
                      </td>

                      {/* Permeate TDS */}
                      <td className="py-3.5 px-3.5 text-[#2A3525]">
                        <span className="font-bold">{unit.permeate_tds}</span> <span className="text-[10px] text-[#6C7E66]">ppm</span>
                      </td>

                      {/* Remaining RUL */}
                      <td className="py-3.5 px-3.5">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            unit.rul_days <= 7
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : unit.rul_days <= 14
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-[#EAEFE5] text-[#2A3525]'
                          }`}
                        >
                          {unit.rul_days} Days
                        </span>
                      </td>

                      {/* Bottleneck Stage */}
                      <td className="py-3.5 px-3.5 text-[#3E4D37] font-sans">
                        <div className="truncate max-w-[140px] text-[11px]">{unit.primary_bottleneck}</div>
                      </td>

                      {/* Health Score */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center space-x-1.5">
                          <div className="w-10 bg-[#EAEFE5] rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                unit.health_score < 60
                                  ? 'bg-rose-600'
                                  : unit.health_score < 80
                                  ? 'bg-amber-500'
                                  : 'bg-[#54684A]'
                              }`}
                              style={{ width: `${Math.min(100, unit.health_score)}%` }}
                            ></div>
                          </div>
                          <span className="text-[11px] font-bold text-[#2A3525]">{unit.health_score}%</span>
                        </div>
                      </td>

                      {/* D2C Action */}
                      <td className="py-3.5 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isDispatched
                              ? 'bg-[#384828] text-white border border-[#1F2D19]'
                              : 'bg-[#F4F6F0] text-[#788870] border border-[#DCE4D6]'
                          }`}
                        >
                          {unit.d2c_status}
                        </span>
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3.5 px-3.5 text-right font-sans">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUnit(unit);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#EAEFE5] hover:bg-[#384828] text-[#384828] hover:text-white border border-[#BACAB3] text-[11px] font-bold transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Purifier Unit Detail / Forensics Modal */}
      {/* ----------------------------------------------------------------- */}
      {selectedUnit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setSelectedUnit(null)}
        >
          <div
            className="bg-white border border-[#BACAB3] rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E3E9DE]">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold bg-[#EAEFE5] text-[#2A3525] px-2.5 py-0.5 rounded border border-[#BACAB3]">
                    {selectedUnit.device_id}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#384828] text-white">
                    {selectedUnit.state}
                  </span>
                  {selectedUnit.device_id === 'ATOM-WP-2026-0042' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#6C8360] text-white animate-pulse">
                      ACTIVE HIL TESTBED
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-[#1F2D19]">
                  {selectedUnit.customer_name} • {selectedUnit.city}
                </h3>
                <p className="text-xs text-[#6C7E66]">
                  {selectedUnit.location || selectedUnit.city}, {selectedUnit.state}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="w-8 h-8 rounded-xl bg-[#F4F6F0] hover:bg-[#EAEFE5] text-[#54684A] flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#F8FAF5] p-3 rounded-xl border border-[#E3E9DE]">
                <div className="text-[#6C7E66] text-[10px] uppercase font-bold">Feed TDS</div>
                <div className="text-xl font-bold font-mono text-[#1F2D19]">{selectedUnit.raw_tds} ppm</div>
                <div className="text-[10px] text-[#54684A]">Groundwater Profile</div>
              </div>

              <div className="bg-[#F8FAF5] p-3 rounded-xl border border-[#E3E9DE]">
                <div className="text-[#6C7E66] text-[10px] uppercase font-bold">Permeate TDS</div>
                <div className="text-xl font-bold font-mono text-[#1F2D19]">{selectedUnit.permeate_tds} ppm</div>
                <div className="text-[10px] text-[#54684A]">
                  {(100 - (selectedUnit.permeate_tds / selectedUnit.raw_tds) * 100).toFixed(1)}% Rejection
                </div>
              </div>

              <div className="bg-[#F8FAF5] p-3 rounded-xl border border-[#E3E9DE]">
                <div className="text-[#6C7E66] text-[10px] uppercase font-bold">Predicted RUL</div>
                <div className={`text-xl font-bold font-mono ${
                  selectedUnit.rul_days <= 10 ? 'text-rose-700' : 'text-[#1F2D19]'
                }`}>
                  {selectedUnit.rul_days} Days
                </div>
                <div className="text-[10px] text-[#54684A]">Darcy-Hermia Life</div>
              </div>

              <div className="bg-[#F8FAF5] p-3 rounded-xl border border-[#E3E9DE]">
                <div className="text-[#6C7E66] text-[10px] uppercase font-bold">Health Score</div>
                <div className="text-xl font-bold font-mono text-[#1F2D19]">{selectedUnit.health_score}%</div>
                <div className="text-[10px] text-[#54684A]">Weibull Degradation</div>
              </div>
            </div>

            {/* Filtration Stages Diagnostic & Bottleneck */}
            <div className="bg-[#F4F6F0] p-4 rounded-xl border border-[#DCE4D6] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1F2D19] uppercase tracking-wider text-[11px]">
                  Physical Stage Fouling Assessment
                </span>
                <span className="px-2 py-0.5 rounded bg-[#EAEFE5] text-[#384828] font-bold text-[10px]">
                  Primary Bottleneck: {selectedUnit.primary_bottleneck}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white p-2.5 rounded-lg border border-[#E3E9DE]">
                  <div className="font-bold text-[#2A3525]">Stage 1: Pre-Sediment Filter</div>
                  <div className="text-[#6C7E66] mt-0.5">Captures coarse silt & sand particulates (&gt;5 micron).</div>
                  <div className="font-mono text-[#384828] font-semibold mt-1">
                    Status: {selectedUnit.primary_bottleneck.includes('Sediment') ? 'Active Flow Resistance (High Cake)' : 'Nominal Porosity'}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#E3E9DE]">
                  <div className="font-bold text-[#2A3525]">Stage 2: Activated Carbon Block</div>
                  <div className="text-[#6C7E66] mt-0.5">Adsorbs free chlorine, trihalomethanes, organic VOCs.</div>
                  <div className="font-mono text-[#384828] font-semibold mt-1">
                    Status: {selectedUnit.primary_bottleneck.includes('Carbon') ? 'Adsorption Capacity &lt; 20%' : 'Optimal Chemical Bed'}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#E3E9DE]">
                  <div className="font-bold text-[#2A3525]">Stage 3: TFC RO Membrane Core</div>
                  <div className="text-[#6C7E66] mt-0.5">Polyamide spiral-wound core blocking heavy metals & arsenic.</div>
                  <div className="font-mono text-[#384828] font-semibold mt-1">
                    Status: {selectedUnit.primary_bottleneck.includes('RO') ? 'Mineral Cake Resistance High' : 'Flux Nominal (Clean)'}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#E3E9DE]">
                  <div className="font-bold text-[#2A3525]">Stage 4: Alkaline Remineralizer</div>
                  <div className="text-[#6C7E66] mt-0.5">Bioglass and calcite ceramic beads infusing natural minerals.</div>
                  <div className="font-mono text-[#384828] font-semibold mt-1">
                    Status: {selectedUnit.primary_bottleneck.includes('Alkal') ? 'Elution Depleted &lt; 15 ppm' : 'Active Mineral Buffer (pH ~7.8)'}
                  </div>
                </div>
              </div>
            </div>

            {/* D2C Automated Doorstep Replenishment Tracker */}
            <div className="bg-white p-4 rounded-xl border border-[#BACAB3] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1F2D19] flex items-center space-x-1.5">
                  <svg className="w-4 h-4 text-[#384828]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span>Autonomous D2C Replenishment Logistics</span>
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedUnit.d2c_status === 'ORDER DISPATCHED'
                    ? 'bg-[#384828] text-white'
                    : 'bg-[#EAEFE5] text-[#54684A]'
                }`}>
                  {selectedUnit.d2c_status}
                </span>
              </div>

              {selectedUnit.d2c_status === 'ORDER DISPATCHED' ? (
                <div className="bg-[#F8FAF5] p-3 rounded-lg border border-[#DCE4D6] space-y-1.5">
                  <div className="flex justify-between items-center text-[#2A3525] font-semibold">
                    <span>Doorstep Waybill:</span>
                    <span className="font-mono text-[11px] text-[#384828] font-bold">
                      BLUEDART-AT-2026-{selectedUnit.device_id.split('-').pop()}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6C7E66]">
                    Cartridge replacement triggered proactively ({selectedUnit.rul_days} days RUL remaining) to eliminate consumer downtime.
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-[#6C7E66]">
                  Cartridge operating within healthy bounds. Autonomous dispatch trigger armed at RUL ≤ 14 days.
                </div>
              )}
            </div>

            {/* Operator Simulation Control Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSimulateWashdown(selectedUnit.device_id)}
                  className="px-3.5 py-2 rounded-xl bg-[#F4F6F0] hover:bg-[#EAEFE5] text-[#384828] border border-[#BACAB3] text-xs font-bold transition-all shadow-2xs"
                >
                  Trigger Micro-Flush (-18% Cake)
                </button>
                {selectedUnit.d2c_status !== 'ORDER DISPATCHED' && (
                  <button
                    type="button"
                    onClick={() => handleSimulateDispatch(selectedUnit.device_id)}
                    className="px-3.5 py-2 rounded-xl bg-[#384828] hover:bg-[#1F2D19] text-white text-xs font-bold transition-all shadow-sm"
                  >
                    Dispatch D2C Cartridge
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#EAEFE5] hover:bg-[#BACAB3] text-[#1F2D19] font-bold text-xs transition-colors"
              >
                Close Forensics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FleetPortal;
