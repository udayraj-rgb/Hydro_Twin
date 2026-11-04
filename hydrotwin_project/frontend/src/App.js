import React, { useState, useEffect, useRef, useCallback } from 'react';
import VirtualHILPanel from './components/VirtualHILPanel';
import TelemetryCharts from './components/TelemetryCharts';
import TerminalConsole from './components/TerminalConsole';
import ConsumerView from './components/ConsumerView';
import FleetPortal from './components/FleetPortal';
import ConsumerVideoShowcase from './components/ConsumerVideoShowcase';
import PortalAuthView from './components/auth/PortalAuthView';

const BACKEND_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
const BACKEND_WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/telemetry';
const BACKEND_API_URL = process.env.REACT_APP_API_URL || `${BACKEND_BASE}/api/update_sensors`;
const CLOCK_MODE_API_URL = `${BACKEND_BASE}/api/simulation/clock_mode`;

function App() {
  const [activeTab, setActiveTab] = useState('hil');
  const [telemetry, setTelemetry] = useState(null);
  const [connected, setConnected] = useState(false);
  const [sensorInputs, setSensorInputs] = useState({
    inlet_tds: 850,
    flow_lpm: 1.20,
    pump_current: 0.85,
    mode: 'AUTONOMOUS',
    active_scenario: 'NONE'
  });

  // Role-Based Authentication Sessions for each of the 3 portals (starts logged out by default)
  const [authSessions, setAuthSessions] = useState({
    hil: null,
    consumer: null,
    fleet: null
  });

  useEffect(() => {
    // Clear any previous session so all 3 portals always display their dedicated login screen on initial load
    try {
      localStorage.removeItem('hydrotwin_auth_sessions');
    } catch (e) {}
  }, []);

  const handleLoginSuccess = useCallback((portalKey, userProfile) => {
    setAuthSessions((prev) => ({
      ...prev,
      [portalKey]: userProfile
    }));
  }, []);

  const handleSignOut = useCallback((portalKey) => {
    setAuthSessions((prev) => ({
      ...prev,
      [portalKey]: null
    }));
  }, []);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Send updated sensor inputs or mode commands to backend via HTTP POST
  const updateSensors = useCallback(async (newInputs) => {
    const updated = { ...sensorInputs, ...newInputs };
    setSensorInputs(updated);

    // If clock_mode changed, dispatch to simulation clock mode endpoint
    if (newInputs.clock_mode) {
      fetch(CLOCK_MODE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clock_mode: newInputs.clock_mode })
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.latest_state) {
            setTelemetry(data.latest_state);
          }
        })
        .catch(() => {});
    }

    try {
      const response = await fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.latest_state) {
          setTelemetry(data.latest_state);
        }
      }
    } catch (err) {
      // Backend not yet running or network delay; local fallback handles real-time execution seamlessly
    }
  }, [sensorInputs]);

  // Establish and supervise native WebSocket connection to FastAPI backend
  useEffect(() => {
    let isMounted = true;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(BACKEND_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log('[HydroTwin-PHM] Connected to backend telemetry WebSocket.');
          setConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const packet = JSON.parse(event.data);
            setTelemetry(packet);

            const simMode = packet.simulation?.mode || 'AUTONOMOUS';
            if (simMode !== 'MANUAL' && packet.sensors) {
              setSensorInputs((prev) => ({
                ...prev,
                inlet_tds: packet.sensors.inlet_tds ?? prev.inlet_tds,
                flow_lpm: packet.sensors.flow_lpm ?? prev.flow_lpm,
                pump_current: packet.sensors.pump_current ?? prev.pump_current,
                mode: simMode,
                active_scenario: packet.simulation?.active_scenario ?? 'NONE'
              }));
            }
          } catch (e) {
            console.error('[HydroTwin-PHM] WebSocket JSON parse error:', e);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnected(false);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setConnected(false);
          ws.close();
        };
      } catch (err) {
        if (!isMounted) return;
        setConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Real-Time Local Physical Simulation Engine (Guarantees Live 1 Hz Data at all times)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (connected) return; // If server WebSocket is active, let server drive the stream

    let virtualSeconds = 7 * 3600 + 45 * 60; // Start at 07:45:00 AM (Morning Peak)
    let localSequence = 1000;
    let localScale = 0.0142;

    const interval = setInterval(() => {
      virtualSeconds = (virtualSeconds + 60) % 86400;
      localSequence += 1;
      const h = Math.floor(virtualSeconds / 3600);
      const m = Math.floor((virtualSeconds % 3600) / 60);
      const s = Math.floor(virtualSeconds % 60);
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      let curFlow = sensorInputs.flow_lpm;
      let curCurrent = sensorInputs.pump_current;
      let curTds = sensorInputs.inlet_tds;
      let phase = 'Morning Peak (Breakfast & Water Dispensing)';

      // In Autonomous Mode, evaluate diurnal cycle with physical Gaussian noise
      if (sensorInputs.mode === 'AUTONOMOUS' && sensorInputs.active_scenario === 'NONE') {
        if (h >= 6 && h < 9) {
          curFlow = 1.40;
          curCurrent = 0.92;
          curTds = 850 + 50;
          phase = 'Morning Peak (Breakfast & Water Dispensing)';
        } else if (h >= 12 && h < 14) {
          curFlow = 0.80;
          curCurrent = 0.78;
          curTds = 850;
          phase = 'Afternoon Low (Post-Lunch Hydration)';
        } else if (h >= 18 && h < 21) {
          curFlow = 1.30;
          curCurrent = 0.90;
          curTds = 875;
          phase = 'Evening Peak (Dinner Cooking & Storage Batch)';
        } else if (h >= 23 || h < 5) {
          curFlow = 0.00;
          curCurrent = 0.00;
          curTds = 830;
          phase = 'Night Standby (Quiescent Leak Integrity Test)';
        } else {
          curFlow = 0.35;
          curCurrent = 0.42;
          curTds = 855;
          phase = 'Day Standby (Intermittent Glass Dispense)';
        }

        // Add real-time Gaussian noise: +/- 2% flow, +/- 0.03 A current, +/- 3 ppm TDS
        if (curFlow > 0.05) {
          curFlow = parseFloat((curFlow * (1.0 + (Math.random() - 0.5) * 0.04)).toFixed(2));
          curCurrent = parseFloat(Math.max(0.05, curCurrent + (Math.random() - 0.5) * 0.06).toFixed(2));
          localScale += (curTds * curFlow) * 0.000035;
        }
        curTds = parseFloat((curTds + (Math.random() - 0.5) * 4.0).toFixed(1));

        setSensorInputs((prev) => ({
          ...prev,
          inlet_tds: curTds,
          flow_lpm: curFlow,
          pump_current: curCurrent
        }));
      }

      // Darcy-Hermia Multi-Stage Hydraulic Physics
      const deltaP = parseFloat(Math.max(0.2, (1.45 * curCurrent) - 0.12).toFixed(2));
      const deltaPi = parseFloat((1.12 * Math.max(0, curTds - 42.0) * 0.00075).toFixed(4));
      const cpIndex = parseFloat(((curTds / 1000.0) * (deltaP / Math.max(curFlow, 0.2))).toFixed(3));
      const isFlush = cpIndex > 1.25 || curTds > 1200.0;
      const washdown = isFlush ? 0.82 : 1.0;
      if (isFlush) localScale = Math.max(0, localScale * 0.88);

      const rSed = parseFloat(Math.max(0.1, (curCurrent / Math.max(curFlow, 0.05)) * 0.85).toFixed(2));
      const rCake = parseFloat(Math.max(0.1, (((deltaP - deltaPi) / (1.002 * Math.max(curFlow, 0.05))) - 0.35 + localScale) * washdown).toFixed(2));
      const rSedSlope = parseFloat(Math.max(0.001, (curCurrent / 0.85) * (0.85 / Math.max(curFlow, 0.05)) * 0.0085).toFixed(4));
      const rCakeSlope = parseFloat(Math.max(0.002, (curTds / 1000.0) * (Math.max(curFlow, 0.05) / 1.20) * 0.0142 * washdown).toFixed(4));
      const saltRej = parseFloat(((1.0 - (42.0 / Math.max(curTds, 1.0))) * 100.0).toFixed(2));

      // Deterministic Safety Interlocks (<200ms)
      const isCavitation = curCurrent < 0.15;
      const isStall = curCurrent > 1.80;
      const relayPump = !isCavitation && !isStall;
      const inletValve = true;

      let status = 'NOMINAL';
      if (isCavitation) status = 'SAFETY TRIP (<180ms): Dry-Run Cavitation Detected';
      else if (isStall) status = 'SAFETY TRIP (<160ms): Motor Armature Overcurrent Stall';
      else if (isFlush) status = 'FLUSH_ACTIVE: Anti-Scaling Dynamic Micro-Flush in progress';

      const sedHealth = parseFloat(Math.max(0, Math.min(100, 100.0 - (rSed * 28.0))).toFixed(1));
      const roHealth = parseFloat(Math.max(0, Math.min(100, (saltRej / 95.0) * 100.0 - (rCake * 14.0))).toFixed(1));
      const rulDays = Math.max(1, Math.round(Math.min(sedHealth, roHealth) * 0.42));

      setTelemetry({
        sequence_id: localSequence,
        device_id: 'ATOM-WP-2026-0042',
        timestamp: new Date().toISOString(),
        status: status,

        // Direct flat contract keys
        inlet_tds: curTds,
        outlet_tds: 42.0,
        flow_lpm: curFlow,
        pump_current: curCurrent,
        delta_p: deltaP,
        delta_pi: deltaPi,
        r_sediment: rSed,
        r_cake: rCake,
        r_sed_slope: rSedSlope,
        r_cake_slope: rCakeSlope,
        dr_dt: rCakeSlope,
        salt_rejection: saltRej,
        delta_mineral: 28.0,
        cp_index: cpIndex,
        flux: curFlow,

        sediment_health: sedHealth,
        ro_health: roHealth,
        carbon_health: 84.0,
        alkaliser_health: 93.3,
        limiting_health: Math.min(sedHealth, roHealth),
        rul_days: rulDays,
        auto_dispatch: rulDays <= 14,
        failing_stage: sedHealth < roHealth ? 'Pre-Sediment Filter' : 'RO Membrane',

        relay_pump: relayPump,
        inlet_valve: inletValve,
        flush_solenoid: isFlush,

        // Grouped schemas
        sensors: {
          inlet_tds: curTds,
          outlet_tds: 42.0,
          flow_lpm: curFlow,
          pump_current: curCurrent
        },
        actuators: {
          relay_pump: relayPump,
          inlet_valve: inletValve,
          flush_solenoid: isFlush
        },
        physics: {
          delta_p: deltaP,
          delta_pi: deltaPi,
          r_sediment: rSed,
          r_cake: rCake,
          r_sed_slope: rSedSlope,
          r_cake_slope: rCakeSlope,
          dr_dt: rCakeSlope,
          salt_rejection: saltRej,
          delta_mineral: 28.0,
          cp_index: cpIndex,
          flux: curFlow
        },
        prognostics: {
          sediment_health: sedHealth,
          ro_health: roHealth,
          carbon_health: 84.0,
          alkaliser_health: 93.3,
          limiting_health: Math.min(sedHealth, roHealth),
          rul_days: rulDays,
          auto_dispatch: rulDays <= 14,
          failing_stage: sedHealth < roHealth ? 'Pre-Sediment Filter' : 'RO Membrane'
        },
        simulation: {
          mode: sensorInputs.mode || 'AUTONOMOUS',
          active_scenario: sensorInputs.active_scenario || 'NONE',
          diurnal_time: timeStr,
          diurnal_phase: phase,
          diurnal_hour: h,
          diurnal_minute: m,
          accumulated_scale: parseFloat(localScale.toFixed(4)),
          washdown_factor: washdown,
          flush_countdown: isFlush ? 4 : 0,
          scenario_progress_pct: 0
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connected, sensorInputs.mode, sensorInputs.active_scenario, sensorInputs.flow_lpm, sensorInputs.pump_current, sensorInputs.inlet_tds]);

  return (
    <div className="min-h-screen bg-[#8FA385] p-2 sm:p-5 lg:p-7 flex flex-col font-sans selection:bg-[#384828] selection:text-white">
      {/* ----------------------------------------------------------------- */}
      {/* Outer Curved Canvas (Matching the reference aesthetic) */}
      {/* ----------------------------------------------------------------- */}
      <div className="max-w-[1400px] w-full mx-auto bg-[#FAFCF7] rounded-[24px] sm:rounded-[32px] shadow-2xl border border-white/70 overflow-hidden flex flex-col flex-1">
        
        {/* ----------------------------------------------------------------- */}
        {/* Navigation Header */}
        {/* ----------------------------------------------------------------- */}
        <header className="sticky top-0 z-50 bg-[#FAFCF7]/95 backdrop-blur border-b border-[#E1ECD9] px-6 sm:px-8 py-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            
            {/* Brand Logo & Context */}
            <div className="flex items-center space-x-4 sm:space-x-5">
              <div className="relative group cursor-pointer flex-shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-[#1F2D19] border-2 border-[#384828]/70 flex items-center justify-center shadow-xl shadow-[#1F2D19]/30 p-1.5 sm:p-2 overflow-hidden transition-all duration-300 group-hover:scale-105 group-hover:border-[#6C8360]">
                  <img
                    src={`${process.env.PUBLIC_URL}/assets/hydrotwin_emblem.png`}
                    alt="HydroTwin-PHM Official Logo"
                    className="w-full h-full object-contain filter drop-shadow-md"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#1F2D19] leading-none">
                  HydroTwin–PHM
                </h1>
                <a
                  href="https://atomberg.com/products/intellon-waterpurifier"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 pt-0.5 group cursor-pointer hover:opacity-90 transition-opacity"
                  title="Visit Atomberg Intellon Water Purifier Official Page"
                >
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#576C4D] group-hover:text-[#2A3525] transition-colors">
                    Powered by
                  </span>
                  <img
                    src={`${process.env.PUBLIC_URL}/assets/atomberg_logo.png`}
                    alt="Atomberg"
                    className="h-5 sm:h-6 w-auto object-contain transition-transform group-hover:scale-105"
                  />
                </a>
              </div>
            </div>

            {/* 3 Tab Navigation Buttons with Authentication Indicators */}
            <div className="flex items-center space-x-1.5 bg-[#EDF4EA] p-1.5 rounded-2xl border border-[#D5E4CC] self-start sm:self-center shadow-inner">
              <button
                onClick={() => setActiveTab('hil')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center space-x-2 ${
                  activeTab === 'hil'
                    ? 'bg-[#384828] text-white shadow-md shadow-[#384828]/30 font-bold'
                    : 'text-[#576C4D] hover:text-[#1F2D19] hover:bg-[#E2EEDC]'
                }`}
              >
                {authSessions.hil ? (
                  <span className="w-2 h-2 rounded-full bg-[#98D88E] shadow-xs" title="Engineering Session Active"></span>
                ) : (
                  <svg className="w-3 h-3 text-[#7B9272]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <span>Virtual HIL Testbed</span>
              </button>

              <button
                onClick={() => setActiveTab('consumer')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center space-x-2 ${
                  activeTab === 'consumer'
                    ? 'bg-[#384828] text-white shadow-md shadow-[#384828]/30 font-bold'
                    : 'text-[#576C4D] hover:text-[#1F2D19] hover:bg-[#E2EEDC]'
                }`}
              >
                {authSessions.consumer ? (
                  <span className="w-2 h-2 rounded-full bg-[#98D88E] shadow-xs" title="Consumer Account Connected"></span>
                ) : (
                  <svg className="w-3 h-3 text-[#7B9272]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <span>Consumer App</span>
              </button>

              <button
                onClick={() => setActiveTab('fleet')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center space-x-2 ${
                  activeTab === 'fleet'
                    ? 'bg-[#384828] text-white shadow-md shadow-[#384828]/30 font-bold'
                    : 'text-[#576C4D] hover:text-[#1F2D19] hover:bg-[#E2EEDC]'
                }`}
              >
                {authSessions.fleet ? (
                  <span className="w-2 h-2 rounded-full bg-[#98D88E] shadow-xs" title="OEM Fleet Operations Active"></span>
                ) : (
                  <svg className="w-3 h-3 text-[#7B9272]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <span>Fleet OEM Portal</span>
              </button>

              {authSessions[activeTab] && (
                <button
                  type="button"
                  onClick={() => handleSignOut(activeTab)}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-[#142010] hover:text-rose-700 border border-[#BACAB3] text-xs font-bold transition-all flex items-center space-x-1 shadow-2xs cursor-pointer ml-1"
                  title="Sign out of active portal session and view login screen"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ----------------------------------------------------------------- */}
        {/* Continuous Brand Video Showcase for Consumer Dashboard */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'consumer' && (
          <ConsumerVideoShowcase telemetry={telemetry} />
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Main Content Area: Protected by Role-Based Portal Authentication */}
        {/* ----------------------------------------------------------------- */}
        <main className="flex-1 w-full p-6 sm:p-8 space-y-6">
          {/* Check Authentication Gateway for the currently active tab */}
          {!authSessions[activeTab] ? (
            <PortalAuthView
              role={activeTab}
              onLoginSuccess={handleLoginSuccess}
              onSwitchPortal={(targetPortal) => setActiveTab(targetPortal)}
            />
          ) : (
            <div className="space-y-6 animate-fadeIn">
              {/* Authenticated Active Session Bar */}
              <div className="bg-white border border-[#DCE4D6] rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center space-x-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#1F2D19] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    {authSessions[activeTab].name ? authSessions[activeTab].name.charAt(0) : 'U'}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#1F2D19] flex flex-wrap items-center gap-2">
                      <span>Authenticated: {authSessions[activeTab].name}</span>
                      <span className="px-2 py-0.5 rounded bg-[#EAEFE5] text-[#384828] text-[10px] font-mono font-bold border border-[#BACAB3]">
                        {authSessions[activeTab].badge || authSessions[activeTab].designation || 'Verified User'}
                      </span>
                    </div>
                    <div className="text-xs text-[#1F2D19] font-medium flex flex-wrap items-center gap-1.5">
                      <span>{authSessions[activeTab].email}</span>
                      {authSessions[activeTab].location && (
                        <>
                          <span className="text-[#BACAB3]">•</span>
                          <span>{authSessions[activeTab].location}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto shrink-0">
                  <span className="text-xs text-[#1F2D19] font-mono font-semibold hidden md:inline">
                    Logged in at {authSessions[activeTab].loginTime || '10:00 AM'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSignOut(activeTab)}
                    className="px-3 py-1.5 rounded-xl bg-[#F4F6F0] hover:bg-rose-50 text-[#142010] hover:text-rose-700 border border-[#BACAB3] hover:border-rose-200 text-xs font-bold transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* Portal Content when Authenticated */}
              {activeTab === 'hil' && (
                <div id="hil-container" className="space-y-6">
                  {/* Component 1: ESP32 Edge Virtual HIL Control Panel */}
                  <VirtualHILPanel
                    sensorInputs={sensorInputs}
                    onUpdate={updateSensors}
                    telemetry={telemetry}
                  />

                  {/* Component 2: Real-time Darcy-Hermia Telemetry Line Charts */}
                  <TelemetryCharts telemetry={telemetry} />

                  {/* Component 3: Live SQLite & MQTT Terminal Console */}
                  <TerminalConsole telemetry={telemetry} />
                </div>
              )}

              {activeTab === 'consumer' && (
                <ConsumerView telemetry={telemetry} />
              )}

              {activeTab === 'fleet' && (
                <FleetPortal telemetry={telemetry} />
              )}
            </div>
          )}
        </main>

        {/* ----------------------------------------------------------------- */}
        {/* Corporate Product Brand Footer */}
        {/* ----------------------------------------------------------------- */}
        <footer className="mt-auto border-t border-[#E1ECD9] bg-[#F4F8F1] px-6 sm:px-10 py-6 sm:py-8">
          <div className="max-w-[1300px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Product Logo & Brand statement */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1F2D19] border border-[#384828]/60 p-2 shadow-md flex items-center justify-center shrink-0">
                <img
                  src={`${process.env.PUBLIC_URL}/assets/hydrotwin_emblem.png`}
                  alt="HydroTwin-PHM Official Logo"
                  className="w-full h-full object-contain filter drop-shadow"
                />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <span className="text-base font-black text-[#1F2D19] tracking-tight">HydroTwin–PHM</span>
                  <a
                    href="https://atomberg.com/products/intellon-waterpurifier"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 bg-white hover:bg-[#F4F6F0] px-2.5 py-0.5 rounded-full border border-[#BACAB3] shadow-xs transition-all cursor-pointer hover:scale-105"
                    title="Visit Atomberg Intellon Water Purifier Official Page"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#576C4D]">
                      Powered by
                    </span>
                    <img
                      src={`${process.env.PUBLIC_URL}/assets/atomberg_logo.png`}
                      alt="Atomberg"
                      className="h-3.5 w-auto object-contain"
                    />
                  </a>
                </div>
                <p className="text-xs text-[#576C4D] max-w-md">
                  Autonomous Digital Twin & Prognostic Health Management for Smart Water Purifiers. AtomQuest 2026 Innovation Challenge (Track 2).
                </p>
                <p className="text-[11px] text-[#7A8E70] font-mono">
                  Team Atomizers • School of Computing Science and Engineering (SCOPE), VIT Bhopal
                </p>
              </div>
            </div>

            {/* Right: Full Product Brand Badge */}
            <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
              <div className="relative group overflow-hidden rounded-2xl border border-[#BACAB3] shadow-sm bg-[#1F2D19] max-w-[220px]">
                <img
                  src={`${process.env.PUBLIC_URL}/assets/hydrotwin_logo_badge.png`}
                  alt="HydroTwin-PHM Powered by Atomberg"
                  className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <span className="text-xs text-[#1F2D19] font-mono font-bold">
                Hardware-in-the-Loop • Darcy-Hermia Decoupling Engine
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
