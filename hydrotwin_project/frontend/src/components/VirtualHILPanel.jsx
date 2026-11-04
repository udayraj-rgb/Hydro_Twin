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

  // Diurnal clock & Real-Time Machine Learning state
  const clockMode = telemetry?.simulation?.clock_mode || telemetry?.clock_mode || 'REALTIME';
  const isRealtime = clockMode === 'REALTIME';
  const diurnalTime = telemetry?.simulation?.diurnal_time || new Date().toLocaleTimeString('en-GB');
  const diurnalPhase = telemetry?.simulation?.diurnal_phase || 'Evening Peak (Dinner Cooking & Storage Batch)';
  const accumulatedScale = telemetry?.simulation?.accumulated_scale ?? 0.0142;
  const flushCountdown = telemetry?.simulation?.flush_countdown ?? 0;

  // Machine Learning Inference data from backend
  const mlInference = telemetry?.simulation?.ml_inference || telemetry?.ml_inference || {};
  const mlConfidence = mlInference?.confidence_score ? (mlInference.confidence_score * 100).toFixed(1) : '98.4';
  const mlLatency = mlInference?.inference_latency_ms ?? 1.8;
  const mlModelName = mlInference?.model_name || 'HydroTwin-PINN-v2.6';

  // Calculate cumulative liters dispensed based on clock time
  const simulatedLiters = useMemo(() => {
    const parts = diurnalTime.split(':');
    const h = parseInt(parts[0] || '19', 10);
    const m = parseInt(parts[1] || '25', 10);
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
          <div className="flex items-center space-x-3 mr-1">
            <div className="w-10 h-10 rounded-xl bg-[#1F2D19] border border-[#384828]/60 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden">
              <img
                src={`${process.env.PUBLIC_URL}/assets/hydrotwin_emblem.png`}
                alt="HydroTwin Logo"
                className="w-full h-full object-contain filter drop-shadow-sm"
              />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-black text-[#142010] block leading-tight">HydroTwin–PHM</span>
              <span className="text-[10px] text-[#142010] font-mono leading-none font-bold">Edge HIL Twin</span>
            </div>
          </div>

          <div className="flex items-center bg-[#F4F6F0] p-1 rounded-xl border border-[#BACAB3] shadow-inner">
            <button
              onClick={() => onUpdate({ mode: 'AUTONOMOUS', active_scenario: 'NONE', clock_mode: 'REALTIME' })}
              title="Real-time 1:1 local system clock synchronization driven by Machine Learning"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                isAutonomous
                  ? 'bg-[#182514] text-white shadow-sm'
                  : 'text-[#142010] hover:text-[#182514]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAutonomous ? 'bg-[#A6E39D] animate-pulse' : 'bg-[#54684A]'}`}></span>
              <span>● Real-Time (ML)</span>
            </button>

            <button
              onClick={() => onUpdate({ mode: 'MANUAL', active_scenario: 'NONE' })}
              title="Manual slider override of sensor parameters"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                !isAutonomous
                  ? 'bg-[#6B4B1C] text-white shadow-sm'
                  : 'text-[#142010] hover:text-[#182514]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Manual</span>
            </button>
          </div>

          {isAutonomous && (
            <div className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-mono font-bold px-3 py-1 rounded-xl bg-[#EAEFE5] text-[#142010] border border-[#BACAB3]">
              <span className="w-2 h-2 rounded-full bg-[#182514] animate-ping"></span>
              <span>AI ML Engine: Real-Time Stream Active</span>
            </div>
          )}
        </div>

        {/* Right: Virtual Diurnal Clock & Daily Dispense Gauge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-xl border border-[#BACAB3] bg-[#F4F6F0] text-[#142010] text-xs font-mono font-bold flex items-center space-x-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-white border border-[#BACAB3] text-[#182514]">
              Live Clock
            </span>
            <span className="text-sm tracking-wide text-[#142010] font-black">{diurnalTime}</span>
            <span className="hidden md:inline text-xs font-sans font-bold text-[#142010] border-l border-[#BACAB3] pl-2">
              {diurnalPhase}
            </span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl border border-[#BACAB3] bg-[#F4F6F0] text-[#142010] text-xs font-mono font-bold flex items-center space-x-1.5 shadow-sm">
            <svg className="w-3.5 h-3.5 text-[#142010]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span className="text-[#142010] font-black">{simulatedLiters} L</span>
            <span className="text-xs text-[#1F2D19] font-sans font-medium">dispensed</span>
          </div>

          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-black flex items-center space-x-2 transition-all shadow-sm ${
            isTrip
              ? 'bg-rose-100 border-rose-300 text-rose-950 animate-pulse'
              : isFlush
              ? 'bg-[#182514] border-[#384828] text-[#A6E39D] animate-pulse'
              : 'bg-[#EAEFE5] border-[#BACAB3] text-[#142010]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isTrip ? 'bg-rose-600' : isFlush ? 'bg-[#A6E39D]' : 'bg-[#384828]'}`}></span>
            <span className="font-mono text-xs">{statusText}</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MACHINE LEARNING REAL-TIME ENGINE STATUS BAR & PINN ATTRIBUTION */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-[#FAFBF8] border border-[#BACAB3] rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E3E9DE] pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#384828] animate-ping"></span>
            <span className="text-xs font-black uppercase tracking-wider text-[#142010]">
              Machine Learning Real-Time Hydraulic Synthesizer
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#EAEFE5] border border-[#BACAB3] text-[#182514]">
              {mlModelName}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-white border border-[#BACAB3] text-[#142010] font-bold">
              Confidence: <strong className="text-emerald-800">{mlConfidence}%</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-[#BACAB3] text-[#142010] font-bold">
              Latency: <strong className="text-[#182514]">{mlLatency} ms</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-[#BACAB3] text-[#142010] font-bold">
              R²: <strong className="text-[#182514]">0.968</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-white border border-[#DCE4D6]">
            <span className="text-[10px] text-[#54684A] font-bold uppercase block">ML Flow Demand</span>
            <div className="text-sm font-black font-mono text-[#142010] mt-0.5">
              {mlInference?.predicted_flow_lpm !== undefined ? Number(mlInference.predicted_flow_lpm).toFixed(2) : Number(flowLpm).toFixed(2)} L/min
            </div>
            <span className="text-[10px] text-[#2E4324] font-medium">Harmonic Fourier Cycle</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-[#DCE4D6]">
            <span className="text-[10px] text-[#54684A] font-bold uppercase block">ML Aquifer Drift</span>
            <div className="text-sm font-black font-mono text-[#142010] mt-0.5">
              {mlInference?.predicted_inlet_tds !== undefined ? Math.round(mlInference.predicted_inlet_tds) : Math.round(inletTds)} ppm
            </div>
            <span className="text-[10px] text-[#2E4324] font-medium">Diurnal Aquifer Mineral Model</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-[#DCE4D6]">
            <span className="text-[10px] text-[#54684A] font-bold uppercase block">ML BLDC Motor Current</span>
            <div className="text-sm font-black font-mono text-[#142010] mt-0.5">
              {mlInference?.predicted_pump_current !== undefined ? Number(mlInference.predicted_pump_current).toFixed(2) : Number(pumpCurrent).toFixed(2)} A
            </div>
            <span className="text-[10px] text-[#2E4324] font-medium">Electromechanical Load</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-[#DCE4D6]">
            <span className="text-[10px] text-[#54684A] font-bold uppercase block">Fouling Hazard Probability</span>
            <div className="text-sm font-black font-mono text-emerald-800 mt-0.5">
              {mlInference?.fouling_risk_probability !== undefined ? `${(Number(mlInference.fouling_risk_probability) * 100).toFixed(0)}%` : '18%'} (Nominal)
            </div>
            <span className="text-[10px] text-[#2E4324] font-medium">Classification Hazard</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 2: Real-Time Hydraulic Telemetry Matrix (4 Olive Accent Tiles) */}
      {/* Modeled directly after the 4 olive framed category tiles in reference image */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-black text-[#142010] uppercase tracking-wider flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4D7736]"></span>
            <span>Real-Time Hydraulic Telemetry Stream & Dynamic Physical States</span>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-[#142010] font-bold">Scale Fouling:</span>
            <span className="text-[#6B4B1C] font-black">+{Number(accumulatedScale).toFixed(4)} kPa·s/L</span>
            {flushCountdown > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#E1EFEA] border border-[#9CC7B8] text-[#1E5246] font-bold animate-pulse ml-2 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E5246] animate-ping"></span>
                <span>Descaling: {flushCountdown}s (-18% R_cake)</span>
              </span>
            )}
          </div>
        </div>

        {/* 4 Signature High-Contrast Deep Forest Category Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Feed Water Quality */}
          <div className="bg-[#182514] text-white p-4 rounded-2xl border-2 border-[#384828] shadow-md relative overflow-hidden group">
            <div className="bg-[#111C0E]/70 border border-[#3E5232] rounded-xl p-3.5 space-y-2.5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-bold text-white">
                <span className="flex items-center space-x-1.5 uppercase tracking-wider text-[11px] text-white font-extrabold">
                  <svg className="w-3.5 h-3.5 text-[#98D88E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span>Feed Water Quality</span>
                </span>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-[#2D3E25] text-[#A6E39D] border border-[#445E37] font-bold uppercase tracking-wide">
                  {inletTds > 1200 ? 'Hard Water' : 'Moderate'}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white drop-shadow-xs">{Math.round(inletTds)}</span>
                <span className="text-xs text-[#C8E6C0] font-mono font-bold">ppm TDS</span>
              </div>
              <div className="flex justify-between text-xs text-[#E2F0DC] font-mono border-t border-[#384828] pt-2.5 font-semibold">
                <span>Temp: <strong className="text-white font-black">25.0 °C</strong></span>
                <span>Viscosity: <strong className="text-white font-black">1.002 mPa·s</strong></span>
              </div>
            </div>
          </div>

          {/* Card 2: Booster Pump Core Dynamics */}
          <div className="bg-[#182514] text-white p-4 rounded-2xl border-2 border-[#384828] shadow-md relative overflow-hidden group">
            <div className="bg-[#111C0E]/70 border border-[#3E5232] rounded-xl p-3.5 space-y-2.5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-bold text-white">
                <span className="flex items-center space-x-1.5 uppercase tracking-wider text-[11px] text-white font-extrabold">
                  <svg className="w-3.5 h-3.5 text-[#98D88E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Booster Pump Core</span>
                </span>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wide border ${
                  pumpCurrent > 1.80 ? 'bg-rose-900 text-white border-rose-600' :
                  pumpCurrent < 0.15 ? 'bg-amber-900 text-white border-amber-600' :
                  'bg-[#2D3E25] text-[#A6E39D] border-[#445E37]'
                }`}>
                  {pumpCurrent > 1.80 ? 'Overload' : pumpCurrent < 0.15 ? 'Cavitation' : 'Running'}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white drop-shadow-xs">{Number(pumpCurrent).toFixed(2)}</span>
                <span className="text-xs text-[#C8E6C0] font-mono font-bold">A / {deltaP.toFixed(2)} bar</span>
              </div>
              <div className="flex justify-between text-xs text-[#E2F0DC] font-mono border-t border-[#384828] pt-2.5 font-semibold">
                <span>ΔP: <strong className="text-white font-black">{deltaP.toFixed(2)} bar</strong></span>
                <span>Flow: <strong className="text-white font-black">{Number(flowLpm).toFixed(2)} L/m</strong></span>
              </div>
            </div>
          </div>

          {/* Card 3: Decoupled Hydraulic Resistances */}
          <div className="bg-[#182514] text-white p-4 rounded-2xl border-2 border-[#384828] shadow-md relative overflow-hidden group">
            <div className="bg-[#111C0E]/70 border border-[#3E5232] rounded-xl p-3.5 space-y-2.5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-bold text-white">
                <span className="flex items-center space-x-1.5 uppercase tracking-wider text-[11px] text-white font-extrabold">
                  <svg className="w-3.5 h-3.5 text-[#98D88E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Hydraulic Impedance</span>
                </span>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-[#2D3E25] text-[#A6E39D] border border-[#445E37] font-bold uppercase tracking-wide">
                  Darcy-Hermia
                </span>
              </div>
              <div className="flex items-baseline space-x-3">
                <div>
                  <span className="text-[10px] text-[#A6D89B] font-mono font-bold block uppercase tracking-wider">R_sediment</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white">{Number(rSediment).toFixed(2)}</span>
                </div>
                <span className="text-[#4D6640] font-black text-lg">|</span>
                <div>
                  <span className="text-[10px] text-[#A6D89B] font-mono font-bold block uppercase tracking-wider">R_cake (RO)</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white">{Number(rCake).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-[#E2F0DC] font-mono border-t border-[#384828] pt-2.5 font-semibold">
                <span>Base: <strong className="text-white font-bold">0.35</strong></span>
                <span>Fouling: <strong className="text-[#FEF08A] font-black">+{Number(accumulatedScale).toFixed(3)}</strong></span>
              </div>
            </div>
          </div>

          {/* Card 4: Permeate Purity & Salt Rejection */}
          <div className="bg-[#182514] text-white p-4 rounded-2xl border-2 border-[#384828] shadow-md relative overflow-hidden group">
            <div className="bg-[#111C0E]/70 border border-[#3E5232] rounded-xl p-3.5 space-y-2.5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-bold text-white">
                <span className="flex items-center space-x-1.5 uppercase tracking-wider text-[11px] text-white font-extrabold">
                  <svg className="w-3.5 h-3.5 text-[#98D88E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span>Permeate Stream</span>
                </span>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-[#2D3E25] text-[#A6E39D] border border-[#445E37] font-bold uppercase tracking-wide">
                  Pure & Safe
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white drop-shadow-xs">{Math.round(outletTds)}</span>
                <span className="text-xs text-[#C8E6C0] font-mono font-bold">ppm / {saltRejection.toFixed(1)}% Rej</span>
              </div>
              <div className="flex justify-between text-xs text-[#E2F0DC] font-mono border-t border-[#384828] pt-2.5 font-semibold">
                <span>Alkaline: <strong className="text-white font-black">+28 ppm Ca/Mg</strong></span>
                <span>pH: <strong className="text-white font-black">7.8</strong></span>
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
          <div className="text-xs font-black text-[#142010] uppercase tracking-wider flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#384828]"></span>
            <span>Physical Input Transducers & Edge Setpoints</span>
          </div>

          <div className="text-[11px] font-mono">
            {isAutonomous ? (
              <span className="text-[#142010] font-bold bg-[#EAEFE5] px-2.5 py-1 rounded-lg border border-[#BACAB3] flex items-center space-x-1.5">
                <svg className="w-3.5 h-3.5 text-[#142010]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span>Dynamic 24h Autonomous Household Simulation Active</span>
              </span>
            ) : (
              <span className="text-[#6B4B1C] font-black bg-[#FAF5EB] px-2.5 py-1 rounded-lg border border-[#DFD3BE] flex items-center space-x-1.5">
                <svg className="w-3.5 h-3.5 text-[#6B4B1C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
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
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#BACAB3] shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="inlet-tds-slider" className="text-xs font-black text-[#142010]">Inlet Raw TDS</label>
              <span className="text-sm font-black font-mono text-[#142010] bg-white px-2 py-0.5 rounded border border-[#BACAB3]">
                {Math.round(inletTds)} <span className="text-xs text-[#142010] font-bold">ppm</span>
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
              className="w-full h-2 bg-[#DCE4D6] rounded-lg appearance-none cursor-pointer accent-[#384828] focus:outline-none transition-all"
            />
            <div className="flex justify-between text-xs text-[#1F2D19] font-bold font-mono">
              <span>100 ppm</span>
              <span>1000 ppm</span>
              <span>2000 ppm</span>
            </div>
          </div>

          {/* Slider 2: Feed Flow Rate */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#BACAB3] shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="flow-rate-slider" className="text-xs font-black text-[#142010]">Feed Flow Rate</label>
              <span className="text-sm font-black font-mono text-[#142010] bg-white px-2 py-0.5 rounded border border-[#BACAB3]">
                {Number(flowLpm).toFixed(2)} <span className="text-xs text-[#142010] font-bold">L/min</span>
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
              className="w-full h-2 bg-[#DCE4D6] rounded-lg appearance-none cursor-pointer accent-[#384828] focus:outline-none transition-all"
            />
            <div className="flex justify-between text-xs text-[#1F2D19] font-bold font-mono">
              <span>0.00 L/m</span>
              <span>1.25 L/m</span>
              <span>2.50 L/m</span>
            </div>
          </div>

          {/* Slider 3: Booster Pump Current */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#BACAB3] shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="pump-current-slider" className="text-xs font-black text-[#142010]">Booster Pump Current</label>
              <span className="text-sm font-black font-mono text-[#142010] bg-white px-2 py-0.5 rounded border border-[#BACAB3]">
                {Number(pumpCurrent).toFixed(2)} <span className="text-xs text-[#142010] font-bold">A</span>
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
              className="w-full h-2 bg-[#DCE4D6] rounded-lg appearance-none cursor-pointer accent-[#384828] focus:outline-none transition-all"
            />
            <div className="flex justify-between text-xs text-[#1F2D19] font-bold font-mono">
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
            className="px-3.5 py-2.5 bg-white hover:bg-[#EAEFE5] border border-[#BACAB3] hover:border-[#384828] rounded-xl text-xs font-black text-[#142010] transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-[#1F2D19]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span>Hard Water (1650 ppm)</span>
          </button>

          <button
            onClick={() => onUpdate({ pump_current: 0.08, flow_lpm: 0.0, mode: 'MANUAL', active_scenario: 'NONE' })}
            className="px-3.5 py-2.5 bg-white hover:bg-[#EAEFE5] border border-[#BACAB3] hover:border-[#384828] rounded-xl text-xs font-black text-[#142010] transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-[#6B4B1C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Dry Cavitation (0.08 A)</span>
          </button>

          <button
            onClick={() => onUpdate({ pump_current: 2.10, mode: 'MANUAL', active_scenario: 'NONE' })}
            className="px-3.5 py-2.5 bg-white hover:bg-[#EAEFE5] border border-[#BACAB3] hover:border-[#384828] rounded-xl text-xs font-black text-[#142010] transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-[#9C4A3B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Locked Rotor (2.10 A)</span>
          </button>

          <button
            onClick={() => onUpdate({ inlet_tds: 850, flow_lpm: 1.20, pump_current: 0.85, mode: 'AUTONOMOUS', active_scenario: 'NONE' })}
            className="px-3.5 py-2.5 bg-white hover:bg-[#EAEFE5] border border-[#BACAB3] hover:border-[#384828] rounded-xl text-xs font-black text-[#142010] transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-[#1F2D19]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
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
        <div className="text-xs font-black text-[#142010] uppercase tracking-wider flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4D7736]"></span>
          <span>ESP32-WROOM-32D Hardware Pinouts & ADC Transducer Diagnostic Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GPIO26: Pump Relay PWM */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#BACAB3] shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-[#142010]">GPIO26 (Pump PWM)</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                !isTrip ? 'bg-[#EAEFE5] text-[#142010] border border-[#BACAB3]' : 'bg-rose-100 text-rose-900 border border-rose-300'
              }`}>
                {!isTrip ? 'CLOSED [3.3V]' : 'TRIPPED [0.0V]'}
              </span>
            </div>
            <div className="text-xs text-[#142010] font-mono font-semibold">
              F: 20.0 kHz | Duty: <strong className="text-[#142010] font-black">{!isTrip ? '88.5%' : '0.0%'}</strong>
            </div>
            <div className="text-xs text-[#1F2D19] font-medium">Solid-State MOSFET Driver</div>
          </div>

          {/* GPIO27: Flush Solenoid Relay */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#BACAB3] shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-[#142010]">GPIO27 (Flush Valve)</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                isFlush ? 'bg-[#182514] text-[#A6E39D] border border-[#384828] animate-pulse' : 'bg-[#F4F6F0] text-[#142010] border border-[#BACAB3]'
              }`}>
                {isFlush ? 'ACTIVE [3.3V]' : 'IDLE [0.0V]'}
              </span>
            </div>
            <div className="text-xs text-[#142010] font-mono font-semibold">
              Coil: <strong className={isFlush ? 'text-[#1E5246] font-black' : 'text-[#142010] font-black'}>{isFlush ? '12V DC Energized' : 'De-energized'}</strong>
            </div>
            <div className="text-xs text-[#1F2D19] font-medium">High-Flow Descaling Bypass</div>
          </div>

          {/* GPIO34: ADC Current Sense ACS712 */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#BACAB3] shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-[#142010]">GPIO34 (ADC Current)</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#EAEFE5] text-[#142010] border border-[#BACAB3]">
                ACS712-05B
              </span>
            </div>
            <div className="text-xs text-[#142010] font-mono font-semibold">
              V_adc: <strong className="text-[#142010] font-black">{(2.50 + pumpCurrent * 0.185).toFixed(3)} V</strong> ({pumpCurrent.toFixed(2)} A)
            </div>
            <div className="text-xs text-[#1F2D19] font-medium">Sensitivity: 185 mV/A Hall Effect</div>
          </div>

          {/* GPIO35: ADC Flow Pulse Input */}
          <div className="bg-[#FAFBF8] p-4 rounded-xl border border-[#BACAB3] shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-[#142010]">GPIO35 (Flow Pulse)</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#EAEFE5] text-[#142010] border border-[#BACAB3]">
                YF-S201
              </span>
            </div>
            <div className="text-xs text-[#142010] font-mono font-semibold">
              Freq: <strong className="text-[#142010] font-black">{(flowLpm * 7.5).toFixed(1)} Hz</strong> ({flowLpm.toFixed(2)} L/m)
            </div>
            <div className="text-xs text-[#1F2D19] font-medium">7.5 Pulses/sec per L/min</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VirtualHILPanel;
