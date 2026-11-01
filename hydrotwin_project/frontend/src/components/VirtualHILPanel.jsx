import React, { useMemo } from 'react';
import HardwareActuatorLeds from './HardwareActuatorLeds';

/**
 * VirtualHILPanel: Interactive Hardware-in-the-Loop Testbed & ESP32 Chassis
 * Features:
 * 1. Autonomous 24h Cycle Mode vs. Manual Override Mode Switcher
 * 2. Virtual Diurnal Clock & Cumulative Daily Liters Dispensed Tracker
 * 3. Real-Time Hydraulic Telemetry Matrix (Clean High-Density Monitoring Cards)
 * 4. Formula-Driven Hardware Actuator LEDs (Cavitation, Stalls, CP Flush, Osmotic Rejection)
 * 5. Physical Transducer Sliders with Real-Time Values & Quick Fault Injection Toolbar
 * 6. ESP32 Hardware Pinouts & ADC Transducer Diagnostic Telemetry
 */
function VirtualHILPanel({ sensorInputs = {}, onUpdate = () => {}, telemetry = null }) {
  // Extract inputs
  const inletTds = sensorInputs.inlet_tds ?? 850;
  const flowLpm = sensorInputs.flow_lpm ?? 1.20;
  const pumpCurrent = sensorInputs.pump_current ?? 0.85;

  // Active simulation mode
  const simMode = telemetry?.simulation?.mode || sensorInputs.mode || 'AUTONOMOUS';
  const isAutonomous = simMode === 'AUTONOMOUS';

  // Actuators & Physics metrics from live telemetry
  const deltaP = telemetry?.physics?.delta_p ?? Number((1.45 * pumpCurrent - 0.12).toFixed(2));
  const rSediment = telemetry?.physics?.r_sediment ?? 0.60;
  const rCake = telemetry?.physics?.r_cake ?? 1.12;
  const saltRejection = telemetry?.physics?.salt_rejection ?? 95.2;
  const outletTds = telemetry?.sensors?.outlet_tds ?? telemetry?.physics?.outlet_tds ?? 42.0;
  const statusText = telemetry?.status ?? 'NOMINAL';

  const isTrip = statusText.includes('SAFETY TRIP') || statusText.includes('CRITICAL');
  const isFlush = statusText.includes('FLUSH') || telemetry?.actuators?.flush_solenoid;

  // Diurnal clock state
  const diurnalTime = telemetry?.simulation?.diurnal_time || '07:45:00';
  const diurnalPhase = telemetry?.simulation?.diurnal_phase || 'Morning Peak (Breakfast & Water Dispensing)';
  const accumulatedScale = telemetry?.simulation?.accumulated_scale ?? 0.0142;
  const flushCountdown = telemetry?.simulation?.flush_countdown ?? 0;

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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
      
      {/* ----------------------------------------------------------------- */}
      {/* SECTION 1: Top Mode Selector & Diurnal Clock Banner */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-800 gap-4">
        
        {/* Left: Mode Toggle Switch & Indicator */}
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
              <span>🟢 Autonomous 24h Cycle</span>
            </button>

            <button
              onClick={() => onUpdate({ mode: 'MANUAL', active_scenario: 'NONE' })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                !isAutonomous
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🛠️ Manual Override</span>
            </button>
          </div>

          {isAutonomous && (
            <div className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-3 py-1 rounded-xl bg-emerald-950/70 text-emerald-300 border border-emerald-800/80">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Self-Driving Simulation: Household Cycle Active</span>
            </div>
          )}
        </div>

        {/* Right: Virtual Diurnal Clock & Daily Dispense Gauge */}
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
      {/* SECTION 2: Real-Time Hydraulic Telemetry Matrix (Clean High-Density Monitor) */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <span>📊</span>
            <span>Real-Time Hydraulic Telemetry Stream & Dynamic Physical States</span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <span className="text-slate-400">Scale Fouling:</span>
            <span className="text-amber-400 font-bold">+{Number(accumulatedScale).toFixed(4)} kPa·s/L</span>
            {flushCountdown > 0 && (
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold animate-pulse ml-2">
                🌀 Descaling: {flushCountdown}s (-18% R_cake)
              </span>
            )}
          </div>
        </div>

        {/* 4 Clean High-Density Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Water Inflow & Hardness */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-md space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
              <span className="flex items-center space-x-1">
                <span>🚰</span>
                <span>Feed Water Quality</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400">
                {inletTds > 1200 ? 'Severe Hardness' : inletTds > 600 ? 'Hard Water' : 'Moderate'}
              </span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">{Math.round(inletTds)}</span>
              <span className="text-xs text-slate-400 font-mono">ppm TDS</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
              <span>Temp: <strong className="text-slate-300">25.0 °C</strong></span>
              <span>Viscosity μ: <strong className="text-slate-300">1.002 mPa·s</strong></span>
            </div>
          </div>

          {/* Card 2: Booster Pump Core Dynamics */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-md space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
              <span className="flex items-center space-x-1">
                <span>⚡</span>
                <span>Booster Pump Core</span>
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                pumpCurrent > 1.80 ? 'bg-rose-950 border-rose-800 text-rose-300 animate-pulse' :
                pumpCurrent < 0.15 ? 'bg-amber-950 border-amber-800 text-amber-300' :
                'bg-emerald-950 border-emerald-800 text-emerald-300'
              }`}>
                {pumpCurrent > 1.80 ? 'Overload Stall' : pumpCurrent < 0.15 ? 'Cavitation' : 'Running'}
              </span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-cyan-400 tracking-tight">{Number(pumpCurrent).toFixed(2)}</span>
              <span className="text-xs text-slate-400 font-mono">A / {deltaP.toFixed(2)} bar</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
              <span>ΔP Inferred: <strong className="text-cyan-300">{deltaP.toFixed(2)} bar</strong></span>
              <span>Flow: <strong className="text-cyan-300">{Number(flowLpm).toFixed(2)} L/m</strong></span>
            </div>
          </div>

          {/* Card 3: Decoupled Hydraulic Resistances */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-md space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
              <span className="flex items-center space-x-1">
                <span>🔬</span>
                <span>Hydraulic Impedance</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                Darcy-Hermia
              </span>
            </div>
            <div className="flex items-baseline space-x-3">
              <div>
                <span className="text-xs text-slate-500 font-mono block">R_sediment</span>
                <span className="text-lg font-bold font-mono text-amber-400">{Number(rSediment).toFixed(2)}</span>
              </div>
              <span className="text-slate-600">|</span>
              <div>
                <span className="text-xs text-slate-500 font-mono block">R_cake (RO)</span>
                <span className="text-lg font-bold font-mono text-cyan-400">{Number(rCake).toFixed(2)}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 flex justify-between">
              <span>Clean Base: 0.35</span>
              <span>Fouling Drift: <strong className="text-amber-400">+{Number(accumulatedScale).toFixed(3)}</strong></span>
            </div>
          </div>

          {/* Card 4: Permeate Purity & Salt Rejection */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-md space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
              <span className="flex items-center space-x-1">
                <span>💧</span>
                <span>Permeate Pure Stream</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                Safe & Mineralized
              </span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">{Math.round(outletTds)}</span>
              <span className="text-xs text-slate-400 font-mono">ppm / {saltRejection.toFixed(1)}% Rej</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
              <span>Alkaline Elution: <strong className="text-emerald-300">+28 ppm Ca/Mg</strong></span>
            </div>
          </div>

        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 3: Formula-Driven Hardware Actuator LEDs Sub-System */}
      {/* ----------------------------------------------------------------- */}
      <HardwareActuatorLeds telemetry={telemetry} sensorInputs={sensorInputs} />

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 4: Physical Input Transducers (Virtual Sensors) */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <span>🎛️</span>
            <span>Physical Input Transducers & Manual Stress Controls</span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {isAutonomous ? (
              <span className="text-emerald-400 font-semibold">
                🤖 Sliders dynamically animated by 24h Autonomous Household Cycle
              </span>
            ) : (
              <span className="text-amber-400 font-semibold">
                🛠️ Manual Override Active: Drag sliders or click triggers to test edge limits
              </span>
            )}
          </div>
        </div>

        {/* 3 Physical Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Slider 1: Inlet Feed TDS */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="inlet-tds-slider" className="text-xs font-semibold text-slate-300">Inlet Raw TDS</label>
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

          {/* Slider 2: Feed Flow Rate */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="flow-rate-slider" className="text-xs font-semibold text-slate-300">Feed Flow Rate</label>
              <span className="text-sm font-bold font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {Number(flowLpm).toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">L/min</span>
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

          {/* Slider 3: Booster Pump Current */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="pump-current-slider" className="text-xs font-semibold text-slate-300">Booster Pump Current</label>
              <span className="text-sm font-bold font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {Number(pumpCurrent).toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">A</span>
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
              <span>0.08 A (Cavitation)</span>
              <span>0.85 A</span>
              <span>2.10 A (Stall)</span>
            </div>
          </div>
        </div>

        {/* Compact Quick Fault Injection & Stress Toolbar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <button
            onClick={() => onUpdate({ inlet_tds: 1650, mode: 'MANUAL', active_scenario: 'NONE' })}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-600/50 rounded-xl text-xs font-semibold text-slate-300 hover:text-amber-300 transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <span>🌊</span>
            <span>Hard Water (1650 ppm)</span>
          </button>

          <button
            onClick={() => onUpdate({ pump_current: 0.08, flow_lpm: 0.0, mode: 'MANUAL', active_scenario: 'NONE' })}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-600/50 rounded-xl text-xs font-semibold text-slate-300 hover:text-rose-300 transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <span>⚡</span>
            <span>Dry Cavitation (0.08 A)</span>
          </button>

          <button
            onClick={() => onUpdate({ pump_current: 2.10, mode: 'MANUAL', active_scenario: 'NONE' })}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-600/50 rounded-xl text-xs font-semibold text-slate-300 hover:text-rose-300 transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <span>🛑</span>
            <span>Locked Rotor (2.10 A)</span>
          </button>

          <button
            onClick={() => onUpdate({ inlet_tds: 850, flow_lpm: 1.20, pump_current: 0.85, mode: 'AUTONOMOUS', active_scenario: 'NONE' })}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-600/50 rounded-xl text-xs font-semibold text-slate-300 hover:text-emerald-300 transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <span>🔄</span>
            <span>Reset Nominal</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 5: Hardware Pinouts & Virtual Telemetry Diagnostic Sub-panel */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3 pt-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <span>⚡</span>
          <span>ESP32-WROOM-32D Hardware Pinouts & ADC Transducer Diagnostic Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GPIO26: Pump Relay PWM */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">GPIO26 (Pump PWM)</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                !isTrip ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {!isTrip ? 'CLOSED [3.3V]' : 'TRIPPED [0.0V]'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              F: 20.0 kHz | Duty: <strong className="text-cyan-400">{!isTrip ? '88.5%' : '0.0%'}</strong>
            </div>
            <div className="text-[10px] text-slate-500">Solid-State MOSFET Driver</div>
          </div>

          {/* GPIO27: Flush Solenoid Relay */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">GPIO27 (Flush Valve)</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                isFlush ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}>
                {isFlush ? 'ACTIVE [3.3V]' : 'IDLE [0.0V]'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Coil: <strong className={isFlush ? 'text-cyan-400' : 'text-slate-400'}>{isFlush ? '12V DC Energized' : 'De-energized'}</strong>
            </div>
            <div className="text-[10px] text-slate-500">High-Flow Descaling Bypass</div>
          </div>

          {/* GPIO34: ADC Current Sense ACS712 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">GPIO34 (ADC Current)</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                ACS712-05B
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              V_adc: <strong className="text-blue-400">{(2.50 + pumpCurrent * 0.185).toFixed(3)} V</strong> ({pumpCurrent.toFixed(2)} A)
            </div>
            <div className="text-[10px] text-slate-500">Sensitivity: 185 mV/A Hall Effect</div>
          </div>

          {/* GPIO35: ADC Flow Pulse Input */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">GPIO35 (Flow Pulse)</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                YF-S201
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Freq: <strong className="text-teal-400">{(flowLpm * 7.5).toFixed(1)} Hz</strong> ({flowLpm.toFixed(2)} L/m)
            </div>
            <div className="text-[10px] text-slate-500">7.5 Pulses/sec per L/min</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VirtualHILPanel;
