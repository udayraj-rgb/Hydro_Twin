import React, { useState, useMemo } from 'react';
import HardwareActuatorLeds from './HardwareActuatorLeds';
import InteractivePurifierIllustration from './InteractivePurifierIllustration';

/**
 * VirtualHILPanel: Interactive Hardware-in-the-Loop Testbed & ESP32 Chassis
 * 
 * Features:
 * 1. Top: Autonomous Mode Switch ("AUTONOMOUS ACTIVE" vs "MANUAL OVERRIDE") & Virtual 24h Diurnal Clock
 * 2. Below Clock: Formula-driven LED diodes for Booster Pump Relay, Dynamic Anti-Scaling Flush Solenoid, and Inlet Valve
 * 3. Below LEDs: InteractivePurifierIllustration with 5-stage serial schematic and clickable Diagnostic Lens
 * 4. Below Illustration: Interactive physical sliders for Inlet TDS, Permeate Flow Rate, and Booster Pump Current
 * 5. Bottom: Automated stress-test scenario buttons and FreeRTOS deterministic firmware status banner
 * 
 * Props:
 * - sensorInputs: { inlet_tds, flow_lpm, pump_current, mode, active_scenario }
 * - onUpdate: (newInputs) => void
 * - telemetry: Real-time digital twin telemetry packet from WebSocket
 */
function VirtualHILPanel({ sensorInputs = {}, onUpdate = () => {}, telemetry = null }) {
  // State: selected stage for InteractivePurifierIllustration (default: 'ro')
  const [selectedStage, setSelectedStage] = useState('ro');

  // Physical inputs with safe defaults
  const inletTds = Number(sensorInputs.inlet_tds ?? telemetry?.sensors?.inlet_tds ?? 850);
  const flowLpm = Number(sensorInputs.flow_lpm ?? telemetry?.sensors?.flow_lpm ?? 1.20);
  const pumpCurrent = Number(sensorInputs.pump_current ?? telemetry?.sensors?.pump_current ?? 0.85);

  // Active simulation mode
  const simMode = telemetry?.simulation?.mode || sensorInputs.mode || 'AUTONOMOUS';
  const isAutonomous = simMode === 'AUTONOMOUS';

  // Status & Telemetry
  const statusText = telemetry?.status ?? 'NOMINAL';
  const isTrip = statusText.includes('SAFETY TRIP') || statusText.includes('CRITICAL');
  const isFlush = statusText.includes('FLUSH') || telemetry?.actuators?.flush_solenoid;

  // Diurnal clock state
  const diurnalTime = telemetry?.simulation?.diurnal_time || '07:45:00';
  const diurnalPhase = telemetry?.simulation?.diurnal_phase || 'Morning Peak (Breakfast & Water Dispensing)';
  const accumulatedScale = Number(telemetry?.simulation?.accumulated_scale ?? 0.0142);
  const flushCountdown = Number(telemetry?.simulation?.flush_countdown ?? 0);

  // Calculate cumulative liters dispensed based on virtual clock time
  const simulatedLiters = useMemo(() => {
    const parts = diurnalTime.split(':');
    const h = parseInt(parts[0] || '7', 10);
    const m = parseInt(parts[1] || '45', 10);
    const minuteOfDay = h * 60 + m;

    if (minuteOfDay < 360) return (0.2 + (minuteOfDay / 360) * 0.3).toFixed(1);
    if (minuteOfDay < 540) return (0.5 + ((minuteOfDay - 360) / 180) * 14.5).toFixed(1);
    if (minuteOfDay < 720) return (15.0 + ((minuteOfDay - 540) / 180) * 3.5).toFixed(1);
    if (minuteOfDay < 840) return (18.5 + ((minuteOfDay - 720) / 120) * 6.5).toFixed(1);
    if (minuteOfDay < 1080) return (25.0 + ((minuteOfDay - 840) / 240) * 4.2).toFixed(1);
    if (minuteOfDay < 1260) return (29.2 + ((minuteOfDay - 1080) / 180) * 12.8).toFixed(1);
    return (42.0 + ((minuteOfDay - 1260) / 180) * 1.5).toFixed(1);
  }, [diurnalTime]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl space-y-7 relative overflow-hidden">
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP: Autonomous Mode Switch & Virtual 24h Diurnal Clock */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-800 gap-4">
        
        {/* Left: Mode Toggle Switch ("AUTONOMOUS ACTIVE" vs "MANUAL OVERRIDE") */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              onClick={() => onUpdate({ mode: 'AUTONOMOUS', active_scenario: 'NONE' })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                isAutonomous
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAutonomous ? 'bg-white animate-pulse' : 'bg-slate-500'}`}></span>
              <span>🟢 AUTONOMOUS ACTIVE</span>
            </button>

            <button
              onClick={() => onUpdate({ mode: 'MANUAL', active_scenario: 'NONE' })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                !isAutonomous
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🛠️ MANUAL OVERRIDE</span>
            </button>
          </div>

          {isAutonomous ? (
            <div className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-3 py-1 rounded-xl bg-emerald-950/70 text-emerald-300 border border-emerald-800/80">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Self-Driving Simulation: Indian Domestic Cycle</span>
            </div>
          ) : (
            <div className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-3 py-1 rounded-xl bg-amber-950/70 text-amber-300 border border-amber-800/80">
              <span>⚠️ Manual Calibration: Drag sliders or trigger stress runs</span>
            </div>
          )}
        </div>

        {/* Right: Virtual 24h Diurnal Clock & Daily Dispense Widget */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-xl border border-cyan-800/80 bg-cyan-950/40 text-cyan-300 text-xs font-mono font-bold flex items-center space-x-2 shadow-sm">
            <span>🕒</span>
            <span className="text-sm tracking-wide text-cyan-200">{diurnalTime}</span>
            <span className="hidden md:inline text-[11px] font-sans font-normal text-cyan-400/90 border-l border-cyan-800/70 pl-2">
              {diurnalPhase}
            </span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl border border-blue-800/80 bg-blue-950/40 text-blue-300 text-xs font-mono font-bold flex items-center space-x-1.5 shadow-sm">
            <span>💧</span>
            <span>{simulatedLiters} L</span>
            <span className="text-[10px] text-blue-400/70 font-sans font-normal">dispensed</span>
          </div>

          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition-all shadow-md ${
            isTrip
              ? 'bg-rose-950/90 border-rose-800 text-rose-300 animate-pulse'
              : isFlush
              ? 'bg-amber-950/90 border-amber-800 text-amber-300 animate-pulse'
              : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
          }`}>
            <span className="text-sm">{isTrip ? '🛑' : isFlush ? '🌀' : '⚡'}</span>
            <span className="font-mono text-xs">{statusText}</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. BELOW CLOCK: Formula-Driven Dynamic Hardware LED Diodes */}
      {/* ----------------------------------------------------------------- */}
      <HardwareActuatorLeds
        telemetry={telemetry}
        sensorInputs={sensorInputs}
      />

      {/* ----------------------------------------------------------------- */}
      {/* 3. BELOW LEDS: Interactive Technical Purifier Illustration */}
      {/* ----------------------------------------------------------------- */}
      <InteractivePurifierIllustration
        telemetry={telemetry}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
        mode="hil"
      />

      {/* ----------------------------------------------------------------- */}
      {/* 4. BELOW ILLUSTRATION: Interactive Physical Sliders */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <span>🎛️</span>
            <span>Physical Input Transducers (Virtual Sensor Potentiometers)</span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {isAutonomous ? (
              <span className="text-emerald-400 font-semibold">
                🤖 Sliders dynamically animated by 24h Autonomous Household Cycle
              </span>
            ) : (
              <span className="text-amber-400 font-semibold">
                🛠️ Manual Override Mode: Drag sliders to inject physical setpoints
              </span>
            )}
          </div>
        </div>

        {/* 3 Physical Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Slider 1: Inlet Feed TDS (100 - 2000 ppm) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="inlet-tds-slider" className="text-xs font-semibold text-slate-300">
                Inlet Feed TDS
              </label>
              <span className="text-sm font-bold font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {Math.round(inletTds)} <span className="text-[10px] text-slate-500 font-normal">ppm</span>
              </span>
            </div>
            <input
              id="inlet-tds-slider"
              type="range"
              min="100"
              max="2000"
              step="10"
              value={inletTds}
              onChange={(e) => {
                onUpdate({ inlet_tds: parseFloat(e.target.value), mode: 'MANUAL', active_scenario: 'NONE' });
              }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none transition-all duration-300"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>100 ppm</span>
              <span>1000 ppm</span>
              <span>2000 ppm</span>
            </div>
          </div>

          {/* Slider 2: Permeate Flow Rate (0.0 - 2.5 L/min) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="flow-rate-slider" className="text-xs font-semibold text-slate-300">
                Permeate Flow Rate
              </label>
              <span className="text-sm font-bold font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {flowLpm.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">L/min</span>
              </span>
            </div>
            <input
              id="flow-rate-slider"
              type="range"
              min="0.0"
              max="2.5"
              step="0.05"
              value={flowLpm}
              onChange={(e) => {
                onUpdate({ flow_lpm: parseFloat(e.target.value), mode: 'MANUAL', active_scenario: 'NONE' });
              }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none transition-all duration-300"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.00 L/m</span>
              <span>1.25 L/m</span>
              <span>2.50 L/m</span>
            </div>
          </div>

          {/* Slider 3: Booster Pump Motor Current (0.0 - 2.5 A) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="pump-current-slider" className="text-xs font-semibold text-slate-300">
                Booster Pump Motor Current
              </label>
              <span className="text-sm font-bold font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {pumpCurrent.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">A</span>
              </span>
            </div>
            <input
              id="pump-current-slider"
              type="range"
              min="0.0"
              max="2.5"
              step="0.05"
              value={pumpCurrent}
              onChange={(e) => {
                onUpdate({ pump_current: parseFloat(e.target.value), mode: 'MANUAL', active_scenario: 'NONE' });
              }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none transition-all duration-300"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span className="text-amber-400">0.08 A (Cavitation)</span>
              <span>0.85 A</span>
              <span className="text-rose-400">2.10 A (Stall)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. BOTTOM: Automated Stress-Test Buttons & FreeRTOS Status Banner */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <span>⚡</span>
          <span>Automated Stress-Test Scenarios & Edge Fault Injection</span>
        </div>

        {/* 4 Stress-Test Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onUpdate({ inlet_tds: 1650, mode: 'MANUAL', active_scenario: 'HARDNESS_SPIKE' })}
            className="px-4 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-amber-300 transition-all flex items-center justify-center space-x-2 shadow-sm group"
          >
            <span>🌊</span>
            <span>Hardness Spike (1650 ppm)</span>
          </button>

          <button
            onClick={() => onUpdate({ pump_current: 0.08, flow_lpm: 0.0, mode: 'MANUAL', active_scenario: 'CAVITATION' })}
            className="px-4 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-rose-300 transition-all flex items-center justify-center space-x-2 shadow-sm group"
          >
            <span>⚡</span>
            <span>Cavitation Cutoff (0.08 A)</span>
          </button>

          <button
            onClick={() => onUpdate({ pump_current: 2.15, flow_lpm: 0.05, mode: 'MANUAL', active_scenario: 'STALL' })}
            className="px-4 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-rose-300 transition-all flex items-center justify-center space-x-2 shadow-sm group"
          >
            <span>🛑</span>
            <span>Motor Jam Stall (2.15 A)</span>
          </button>

          <button
            onClick={() => onUpdate({ inlet_tds: 850, flow_lpm: 1.20, pump_current: 0.85, mode: 'AUTONOMOUS', active_scenario: 'NONE' })}
            className="px-4 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-xl text-xs font-bold text-slate-200 hover:text-emerald-300 transition-all flex items-center justify-center space-x-2 shadow-sm group"
          >
            <span>🔄</span>
            <span>Resume Auto Cycle</span>
          </button>
        </div>

        {/* FreeRTOS Deterministic Firmware Status Banner */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-800/80 gap-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                FreeRTOS v10.4 Deterministic Firmware Interlock Banner
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Deterministic Jitter: <strong className="text-cyan-400">&lt; 2.4 ms</strong> | Edge Deadline: <strong className="text-emerald-400">&lt; 200 ms</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            {/* Field 1: Active Interlock Rule Status */}
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">Interlock Status</div>
              <div className={`font-bold text-xs truncate ${isTrip ? 'text-rose-400' : 'text-emerald-400'}`}>
                {statusText}
              </div>
            </div>

            {/* Field 2: FreeRTOS Task Scheduling */}
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">Active Task Sched</div>
              <div className="text-cyan-300 text-xs">
                SafetyInterlockTask (Prio 4)
              </div>
            </div>

            {/* Field 3: Relay Actuation States */}
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">GPIO Relay Bus</div>
              <div className="text-slate-200 text-xs">
                GPIO26: <span className={!isTrip ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{!isTrip ? 'CLOSED' : 'TRIP'}</span> | GPIO27: <span className={isFlush ? 'text-cyan-400 font-bold' : 'text-slate-400'}>{isFlush ? 'FLUSH' : 'IDLE'}</span>
              </div>
            </div>

            {/* Field 4: Transmembrane Pressure ΔP */}
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">Trans-Membrane ΔP</div>
              <div className="text-amber-300 font-bold text-xs">
                {(1.45 * pumpCurrent - 0.12).toFixed(2)} bar ({(pumpCurrent * 1.45 * 100).toFixed(0)} kPa)
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default VirtualHILPanel;
