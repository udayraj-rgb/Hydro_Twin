import React, { useMemo } from 'react';
import HardwareActuatorLeds from './HardwareActuatorLeds';

/**
 * VirtualHILPanel: Interactive Hardware-in-the-Loop Testbed & ESP32 Chassis
 * Styled in an elegant White and Olive palette matching the brand reference image.
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
    <div className="bg-white border border-[#DCE4D6] rounded-2xl p-6 sm:p-7 shadow-sm space-y-7 relative overflow-hidden">
      
      {/* ----------------------------------------------------------------- */}
      {/* SECTION 1: Top Mode Selector & Diurnal Clock Banner */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-[#E3E9DE] gap-4">
        
        {/* Left: Mode Toggle Switch & Indicator */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#F4F6F0] p-1 rounded-xl border border-[#DCE4D6] shadow-inner">
            <button
              onClick={() => onUpdate({ mode: 'AUTONOMOUS', active_scenario: 'NONE' })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                isAutonomous
                  ? 'bg-[#6C8360] text-white shadow-sm shadow-[#6C8360]/25'
                  : 'text-[#54684A] hover:text-[#2A3525]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAutonomous ? 'bg-white animate-pulse' : 'bg-[#9DB395]'}`}></span>
              <span>Autonomous 24h Cycle</span>
            </button>

            <button
              onClick={() => onUpdate({ mode: 'MANUAL', active_scenario: 'NONE' })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                !isAutonomous
                  ? 'bg-[#826947] text-white shadow-sm shadow-[#826947]/25'
                  : 'text-[#54684A] hover:text-[#2A3525]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Manual Override</span>
            </button>
          </div>

          {isAutonomous && (
            <div className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-3 py-1 rounded-xl bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3]">
              <span className="w-2 h-2 rounded-full bg-[#6C8360] animate-ping"></span>
              <span>Self-Driving Simulation: Household Cycle Active</span>
            </div>
          )}
        </div>

        {/* Right: Virtual Diurnal Clock & Daily Dispense Gauge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-xl border border-[#DCE4D6] bg-[#F4F6F0] text-[#3E4D37] text-xs font-mono font-bold flex items-center space-x-2 shadow-sm">
            <svg className="w-3.5 h-3.5 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm tracking-wide text-[#2A3525]">{diurnalTime}</span>
            <span className="hidden md:inline text-[11px] font-sans font-medium text-[#54684A] border-l border-[#DCE4D6] pl-2">
              {diurnalPhase}
            </span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl border border-[#DCE4D6] bg-[#F4F6F0] text-[#3E4D37] text-xs font-mono font-bold flex items-center space-x-1.5 shadow-sm">
            <svg className="w-3.5 h-3.5 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span className="text-[#2A3525]">{simulatedLiters} L</span>
            <span className="text-[10px] text-[#6C7E66] font-sans font-normal">dispensed</span>
          </div>

          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition-all shadow-sm ${
            isTrip
              ? 'bg-rose-50 border-rose-300 text-rose-800 animate-pulse'
              : isFlush
              ? 'bg-[#E1EFEA] border-[#9CC7B8] text-[#1E5246] animate-pulse'
              : 'bg-[#EAEFE5] border-[#BACAB3] text-[#3E4D37]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isTrip ? 'bg-rose-600' : isFlush ? 'bg-teal-600' : 'bg-[#6C8360]'}`}></span>
            <span className="font-mono text-xs">{statusText}</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 2: Real-Time Hydraulic Telemetry Matrix (4 Olive Accent Tiles) */}
      {/* Modeled directly after the 4 olive framed category tiles in reference image */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-[#54684A] uppercase tracking-wider flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#849C77]"></span>
            <span>Real-Time Hydraulic Telemetry Stream & Dynamic Physical States</span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <span className="text-[#6C7E66]">Scale Fouling:</span>
            <span className="text-[#826947] font-bold">+{Number(accumulatedScale).toFixed(4)} kPa·s/L</span>
            {flushCountdown > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#E1EFEA] border border-[#9CC7B8] text-[#1E5246] font-bold animate-pulse ml-2 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E5246] animate-ping"></span>
                <span>Descaling: {flushCountdown}s (-18% R_cake)</span>
              </span>
            )}
          </div>
        </div>

        {/* 4 Signature Olive Category Tiles with Fine Inner Framing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Feed Water Quality */}
          <div className="bg-[#7D9173] text-white p-4 rounded-xl border border-[#6B7E62] shadow-sm relative overflow-hidden group">
            <div className="border border-white/25 rounded-lg p-3 space-y-2.5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs text-white/90 font-medium">
                <span className="flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span>Feed Water Quality</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/20 text-white font-semibold">
                  {inletTds > 1200 ? 'Hard Water' : 'Moderate'}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white">{Math.round(inletTds)}</span>
                <span className="text-xs text-white/80 font-mono">ppm TDS</span>
              </div>
              <div className="flex justify-between text-[11px] text-white/75 font-mono border-t border-white/20 pt-2">
                <span>Temp: <strong>25.0 °C</strong></span>
                <span>Viscosity: <strong>1.002 mPa·s</strong></span>
              </div>
            </div>
          </div>

          {/* Card 2: Booster Pump Core Dynamics */}
          <div className="bg-[#6D8163] text-white p-4 rounded-xl border border-[#5C7053] shadow-sm relative overflow-hidden group">
            <div className="border border-white/25 rounded-lg p-3 space-y-2.5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs text-white/90 font-medium">
                <span className="flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Booster Pump Core</span>
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  pumpCurrent > 1.80 ? 'bg-rose-900/80 text-rose-100' :
                  pumpCurrent < 0.15 ? 'bg-amber-900/80 text-amber-100' :
                  'bg-white/20 text-white'
                }`}>
                  {pumpCurrent > 1.80 ? 'Overload' : pumpCurrent < 0.15 ? 'Cavitation' : 'Running'}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white">{Number(pumpCurrent).toFixed(2)}</span>
                <span className="text-xs text-white/80 font-mono">A / {deltaP.toFixed(2)} bar</span>
              </div>
              <div className="flex justify-between text-[11px] text-white/75 font-mono border-t border-white/20 pt-2">
                <span>ΔP: <strong>{deltaP.toFixed(2)} bar</strong></span>
                <span>Flow: <strong>{Number(flowLpm).toFixed(2)} L/m</strong></span>
              </div>
            </div>
          </div>

          {/* Card 3: Decoupled Hydraulic Resistances */}
          <div className="bg-[#869A7C] text-white p-4 rounded-xl border border-[#74876B] shadow-sm relative overflow-hidden group">
            <div className="border border-white/25 rounded-lg p-3 space-y-2.5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs text-white/90 font-medium">
                <span className="flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Hydraulic Impedance</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/20 text-white font-semibold">
                  Darcy-Hermia
                </span>
              </div>
              <div className="flex items-baseline space-x-3">
                <div>
                  <span className="text-[10px] text-white/80 font-mono block">R_sediment</span>
                  <span className="text-xl font-bold font-mono text-white">{Number(rSediment).toFixed(2)}</span>
                </div>
                <span className="text-white/40">|</span>
                <div>
                  <span className="text-[10px] text-white/80 font-mono block">R_cake (RO)</span>
                  <span className="text-xl font-bold font-mono text-white">{Number(rCake).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-white/75 font-mono border-t border-white/20 pt-2">
                <span>Base: 0.35</span>
                <span>Fouling: <strong>+{Number(accumulatedScale).toFixed(3)}</strong></span>
              </div>
            </div>
          </div>

          {/* Card 4: Permeate Purity & Salt Rejection */}
          <div className="bg-[#5D7053] text-white p-4 rounded-xl border border-[#4C5E43] shadow-sm relative overflow-hidden group">
            <div className="border border-white/25 rounded-lg p-3 space-y-2.5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs text-white/90 font-medium">
                <span className="flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span>Permeate Stream</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/20 text-white font-semibold">
                  Pure & Safe
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white">{Math.round(outletTds)}</span>
                <span className="text-xs text-white/80 font-mono">ppm / {saltRejection.toFixed(1)}% Rej</span>
              </div>
              <div className="flex justify-between text-[11px] text-white/75 font-mono border-t border-white/20 pt-2">
                <span>Alkaline: <strong>+28 ppm Ca/Mg</strong></span>
                <span>pH: <strong>7.8</strong></span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 3: Formula-Driven Hardware Actuator LEDs Sub-System */}
      {/* ----------------------------------------------------------------- */}
      <HardwareActuatorLeds telemetry={telemetry} sensorInputs={sensorInputs} />

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 4: Physical Input Transducers & Manual Stress Controls */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-[#54684A] uppercase tracking-wider flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#849C77]"></span>
            <span>Physical Input Transducers & Edge Setpoints</span>
          </div>

          <div className="text-[11px] font-mono">
            {isAutonomous ? (
              <span className="text-[#54684A] font-semibold bg-[#EAEFE5] px-2.5 py-1 rounded-lg border border-[#BACAB3] flex items-center space-x-1.5">
                <svg className="w-3.5 h-3.5 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span>Dynamic 24h Autonomous Household Simulation Active</span>
              </span>
            ) : (
              <span className="text-[#826947] font-semibold bg-[#F9F5EB] px-2.5 py-1 rounded-lg border border-[#DFD3BE] flex items-center space-x-1.5">
                <svg className="w-3.5 h-3.5 text-[#826947]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Manual Override Mode: Drag sliders or trigger edge presets</span>
              </span>
            )}
          </div>
        </div>

        {/* 3 Physical Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Slider 1: Inlet Feed TDS */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#DCE4D6] shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="inlet-tds-slider" className="text-xs font-semibold text-[#2A3525]">Inlet Raw TDS</label>
              <span className="text-sm font-bold font-mono text-[#2A3525] bg-white px-2 py-0.5 rounded border border-[#DCE4D6]">
                {Math.round(inletTds)} <span className="text-[10px] text-[#788870] font-normal">ppm</span>
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
              className="w-full h-2 bg-[#DCE4D6] rounded-lg appearance-none cursor-pointer accent-[#6C8360] focus:outline-none transition-all"
            />
            <div className="flex justify-between text-[10px] text-[#788870] font-mono">
              <span>100 ppm</span>
              <span>1000 ppm</span>
              <span>2000 ppm</span>
            </div>
          </div>

          {/* Slider 2: Feed Flow Rate */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#DCE4D6] shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="flow-rate-slider" className="text-xs font-semibold text-[#2A3525]">Feed Flow Rate</label>
              <span className="text-sm font-bold font-mono text-[#2A3525] bg-white px-2 py-0.5 rounded border border-[#DCE4D6]">
                {Number(flowLpm).toFixed(2)} <span className="text-[10px] text-[#788870] font-normal">L/min</span>
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
              className="w-full h-2 bg-[#DCE4D6] rounded-lg appearance-none cursor-pointer accent-[#6C8360] focus:outline-none transition-all"
            />
            <div className="flex justify-between text-[10px] text-[#788870] font-mono">
              <span>0.00 L/m</span>
              <span>1.25 L/m</span>
              <span>2.50 L/m</span>
            </div>
          </div>

          {/* Slider 3: Booster Pump Current */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#DCE4D6] shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="pump-current-slider" className="text-xs font-semibold text-[#2A3525]">Booster Pump Current</label>
              <span className="text-sm font-bold font-mono text-[#2A3525] bg-white px-2 py-0.5 rounded border border-[#DCE4D6]">
                {Number(pumpCurrent).toFixed(2)} <span className="text-[10px] text-[#788870] font-normal">A</span>
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
              className="w-full h-2 bg-[#DCE4D6] rounded-lg appearance-none cursor-pointer accent-[#6C8360] focus:outline-none transition-all"
            />
            <div className="flex justify-between text-[10px] text-[#788870] font-mono">
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
            className="px-3.5 py-2.5 bg-white hover:bg-[#EAEFE5] border border-[#DCE4D6] hover:border-[#849C77] rounded-xl text-xs font-semibold text-[#3E4D37] transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span>Hard Water (1650 ppm)</span>
          </button>

          <button
            onClick={() => onUpdate({ pump_current: 0.08, flow_lpm: 0.0, mode: 'MANUAL', active_scenario: 'NONE' })}
            className="px-3.5 py-2.5 bg-white hover:bg-[#EAEFE5] border border-[#DCE4D6] hover:border-[#849C77] rounded-xl text-xs font-semibold text-[#3E4D37] transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-[#826947]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Dry Cavitation (0.08 A)</span>
          </button>

          <button
            onClick={() => onUpdate({ pump_current: 2.10, mode: 'MANUAL', active_scenario: 'NONE' })}
            className="px-3.5 py-2.5 bg-white hover:bg-[#EAEFE5] border border-[#DCE4D6] hover:border-[#849C77] rounded-xl text-xs font-semibold text-[#3E4D37] transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-[#9C4A3B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Locked Rotor (2.10 A)</span>
          </button>

          <button
            onClick={() => onUpdate({ inlet_tds: 850, flow_lpm: 1.20, pump_current: 0.85, mode: 'AUTONOMOUS', active_scenario: 'NONE' })}
            className="px-3.5 py-2.5 bg-white hover:bg-[#EAEFE5] border border-[#DCE4D6] hover:border-[#849C77] rounded-xl text-xs font-semibold text-[#3E4D37] transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Reset Nominal</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 5: Hardware Pinouts & Virtual Telemetry Diagnostic Sub-panel */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3 pt-2">
        <div className="text-xs font-bold text-[#54684A] uppercase tracking-wider flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#849C77]"></span>
          <span>ESP32-WROOM-32D Hardware Pinouts & ADC Transducer Diagnostic Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GPIO26: Pump Relay PWM */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#DCE4D6] shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#2A3525]">GPIO26 (Pump PWM)</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                !isTrip ? 'bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3]' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {!isTrip ? 'CLOSED [3.3V]' : 'TRIPPED [0.0V]'}
              </span>
            </div>
            <div className="text-[11px] text-[#54684A] font-mono">
              F: 20.0 kHz | Duty: <strong className="text-[#2A3525]">{!isTrip ? '88.5%' : '0.0%'}</strong>
            </div>
            <div className="text-[10px] text-[#788870]">Solid-State MOSFET Driver</div>
          </div>

          {/* GPIO27: Flush Solenoid Relay */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#DCE4D6] shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#2A3525]">GPIO27 (Flush Valve)</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                isFlush ? 'bg-[#E1EFEA] text-[#1E5246] border border-[#9CC7B8] animate-pulse' : 'bg-[#F4F6F0] text-[#788870] border border-[#DCE4D6]'
              }`}>
                {isFlush ? 'ACTIVE [3.3V]' : 'IDLE [0.0V]'}
              </span>
            </div>
            <div className="text-[11px] text-[#54684A] font-mono">
              Coil: <strong className={isFlush ? 'text-[#1E5246]' : 'text-[#788870]'}>{isFlush ? '12V DC Energized' : 'De-energized'}</strong>
            </div>
            <div className="text-[10px] text-[#788870]">High-Flow Descaling Bypass</div>
          </div>

          {/* GPIO34: ADC Current Sense ACS712 */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#DCE4D6] shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#2A3525]">GPIO34 (ADC Current)</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3]">
                ACS712-05B
              </span>
            </div>
            <div className="text-[11px] text-[#54684A] font-mono">
              V_adc: <strong className="text-[#2A3525]">{(2.50 + pumpCurrent * 0.185).toFixed(3)} V</strong> ({pumpCurrent.toFixed(2)} A)
            </div>
            <div className="text-[10px] text-[#788870]">Sensitivity: 185 mV/A Hall Effect</div>
          </div>

          {/* GPIO35: ADC Flow Pulse Input */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#DCE4D6] shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#2A3525]">GPIO35 (Flow Pulse)</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3]">
                YF-S201
              </span>
            </div>
            <div className="text-[11px] text-[#54684A] font-mono">
              Freq: <strong className="text-[#2A3525]">{(flowLpm * 7.5).toFixed(1)} Hz</strong> ({flowLpm.toFixed(2)} L/m)
            </div>
            <div className="text-[10px] text-[#788870]">7.5 Pulses/sec per L/min</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VirtualHILPanel;
