import React, { useState, useEffect, useRef, useCallback } from 'react';
import VirtualHILPanel from './components/VirtualHILPanel';
import TelemetryCharts from './components/TelemetryCharts';
import TerminalConsole from './components/TerminalConsole';
import ConsumerView from './components/ConsumerView';
import FleetPortal from './components/FleetPortal';

const BACKEND_WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/telemetry';
const BACKEND_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/update_sensors';

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

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Send updated sensor inputs or mode commands to backend via HTTP POST
  const updateSensors = useCallback(async (newInputs) => {
    const updated = { ...sensorInputs, ...newInputs };
    setSensorInputs(updated);

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

      const rSed = parseFloat(Math.max(0.1, (curCurrent / Math.max(curFlow, 0.1)) * 0.85).toFixed(2));
      const rCake = parseFloat(Math.max(0.1, (((deltaP - deltaPi) / (1.002 * Math.max(curFlow, 0.05))) - 0.35 + localScale) * washdown).toFixed(2));
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
      const rulDays = Math.max(1, Math.round(Math.min(sedHealth, roHealth) * 0.45));

      setTelemetry({
        sequence_id: localSequence,
        device_id: 'ATOM-WP-2026-0042',
        timestamp: new Date().toISOString(),
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
        },
        status: status
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connected, sensorInputs.mode, sensorInputs.active_scenario, sensorInputs.flow_lpm, sensorInputs.pump_current, sensorInputs.inlet_tds]);

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#2A3525] flex flex-col font-sans">
      {/* ----------------------------------------------------------------- */}
      {/* Top Editorial Bar */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-[#849C77] text-white text-[11px] font-medium tracking-widest text-center py-1.5 px-4 uppercase border-b border-[#738A66]">
        AtomQuest 2026 • Track 2: Smart Water Purifier • Autonomous Digital Twin & PHM
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Navigation Header */}
      {/* ----------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[#E3E8DF] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Brand & Team Context */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#849C77] border border-[#6E8562] flex items-center justify-center shadow-md shadow-[#849C77]/25 text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#2A3525]">HydroTwin-PHM</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3]">
                  Virtual HIL Twin
                </span>
                <span className="inline-flex items-center space-x-1.5 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#EAEFE5] text-[#2A3525] border border-[#849C77]/50">
                  <span className="w-2 h-2 rounded-full bg-[#6C8360] animate-pulse"></span>
                  <span>Live Stream Active</span>
                </span>
              </div>
              <p className="text-xs text-[#6C7E66] font-medium mt-0.5">
                Team Atomizers • School of Computing Science and Engineering (SCOPE), VIT Bhopal
              </p>
            </div>
          </div>

          {/* 3 Tab Navigation Buttons */}
          <div className="flex items-center space-x-1.5 bg-[#F4F6F0] p-1.5 rounded-xl border border-[#DCE4D6] self-start lg:self-center shadow-inner">
            <button
              onClick={() => setActiveTab('hil')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === 'hil'
                  ? 'bg-[#6C8360] text-white shadow-sm shadow-[#6C8360]/30 font-bold'
                  : 'text-[#54684A] hover:text-[#2A3525] hover:bg-[#EAEFE5]'
              }`}
            >
              <span>🛠️</span>
              <span>Virtual HIL Testbed</span>
            </button>

            <button
              onClick={() => setActiveTab('consumer')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === 'consumer'
                  ? 'bg-[#6C8360] text-white shadow-sm shadow-[#6C8360]/30 font-bold'
                  : 'text-[#54684A] hover:text-[#2A3525] hover:bg-[#EAEFE5]'
              }`}
            >
              <span>📱</span>
              <span>Consumer App</span>
            </button>

            <button
              onClick={() => setActiveTab('fleet')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === 'fleet'
                  ? 'bg-[#6C8360] text-white shadow-sm shadow-[#6C8360]/30 font-bold'
                  : 'text-[#54684A] hover:text-[#2A3525] hover:bg-[#EAEFE5]'
              }`}
            >
              <span>🏢</span>
              <span>Fleet OEM Portal</span>
            </button>
          </div>

          {/* Live Stream Status Pill */}
          <div className="flex items-center space-x-3 self-end lg:self-center">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-[#DCE4D6] bg-white text-[#3E4D37] text-xs font-semibold shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[#849C77]"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#6C8360]"></span>
              </span>
              <span>{connected ? 'FastAPI Backend (1 Hz)' : 'Browser Physics Engine (1 Hz)'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Main Content Area */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {activeTab === 'hil' && (
          <div id="hil-container" className="space-y-6 animate-fadeIn">
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
      </main>
    </div>
  );
}

export default App;
