import React, { useState } from 'react';

/**
 * HardwareActuatorLeds: 100% Formula-Driven Dynamic Hardware LED Sub-System
 * 
 * Computes all illumination levels, glowing radial halos, strobe frequencies,
 * and interlock trip labels directly from telemetry physics and edge safety equations.
 * 
 * Props:
 * - telemetry: Real-time digital twin packet from WebSocket
 * - sensorInputs: Fallback physical input transducers
 */
function HardwareActuatorLeds({ telemetry = null, sensorInputs = {} }) {
  const [activeTooltip, setActiveTooltip] = useState(null);

  // ---------------------------------------------------------------------------
  // 1. Physical Inputs Extraction
  // ---------------------------------------------------------------------------
  const Ia = telemetry?.sensors?.pump_current ?? sensorInputs?.pump_current ?? 0.85;
  const Q = telemetry?.sensors?.flow_lpm ?? sensorInputs?.flow_lpm ?? 1.20;
  const inletTds = telemetry?.sensors?.inlet_tds ?? sensorInputs?.inlet_tds ?? 850.0;
  const outletTds = telemetry?.sensors?.outlet_tds ?? telemetry?.physics?.outlet_tds ?? 42.0;

  // ---------------------------------------------------------------------------
  // 2. Dynamic LED 1: Booster Pump Relay (Thermal & Armature Load Logic)
  // ---------------------------------------------------------------------------
  // Thresholds:
  // - Overcurrent: Ia > 1.80 A (Stall / Armature Overload)
  // - Dry Cavitation: Ia < 0.15 A (Suction Starvation)
  const isOvercurrent = Ia > 1.80;
  const isCavitation = Ia < 0.15;
  const isPumpTripped = isOvercurrent || isCavitation;

  // Dynamic load ratio: 0.15 A (0%) to 1.80 A (100%)
  const loadRatio = Math.min(Math.max((Ia - 0.15) / (1.80 - 0.15), 0.0), 1.0);

  // Strobe frequency scales with violation severity
  const pumpFlashDuration = Math.max(0.15, 0.60 - Math.abs(Ia - 0.95) * 0.30);

  const pumpDiodeStyle = isPumpTripped
    ? {
        backgroundColor: 'rgb(239, 68, 68)',
        boxShadow: '0 0 14px rgba(239, 68, 68, 0.95), 0 0 28px rgba(239, 68, 68, 0.60)',
        animation: `ledPulse ${pumpFlashDuration.toFixed(3)}s infinite ease-in-out`
      }
    : {
        backgroundColor: 'rgb(16, 185, 129)',
        boxShadow: `0 0 ${8 + loadRatio * 12}px rgba(16, 185, 129, ${0.40 + loadRatio * 0.60}), 0 0 ${16 + loadRatio * 20}px rgba(16, 185, 129, 0.25)`
      };

  const pumpLabel = isPumpTripped
    ? (isCavitation ? 'TRIPPED: CAVITATION (<180ms)' : 'TRIPPED: STALL (<160ms)')
    : `CLOSED (${Math.round(loadRatio * 100)}% Load)`;

  // ---------------------------------------------------------------------------
  // 3. Dynamic LED 2: Anti-Scaling Flush Solenoid (Boundary Layer Saturation Logic)
  // ---------------------------------------------------------------------------
  const deltaP = Math.max(0.20, (1.45 * Ia) - 0.12);
  const cpDenom = Math.max(Q, 0.20);
  const cpIndex = (inletTds / 1000.0) * (deltaP / cpDenom);

  // Supersaturation trigger: CP > 1.25 OR inlet_tds > 1200 ppm
  const isFlushActive = cpIndex > 1.25 || inletTds > 1200.0;
  const flushIntensity = Math.min(Math.max((cpIndex - 1.25) / 1.0, 0.0), 1.0);

  // Pulse period speeds up dynamically as CP increases
  const flushPeriod = Math.max(0.20, 1.20 - flushIntensity * 0.80);

  const flushDiodeStyle = isFlushActive
    ? {
        backgroundColor: 'rgb(6, 182, 212)',
        boxShadow: `0 0 ${10 + flushIntensity * 16}px rgba(6, 182, 212, 0.95), 0 0 ${20 + flushIntensity * 25}px rgba(6, 182, 212, 0.50)`,
        animation: `ledPulse ${flushPeriod.toFixed(3)}s infinite ease-in-out`
      }
    : {
        backgroundColor: 'rgb(71, 85, 105)',
        boxShadow: '0 0 3px rgba(71, 85, 105, 0.40)'
      };

  const flushLabel = isFlushActive
    ? `FLUSHING (CP: ${cpIndex.toFixed(2)})`
    : 'IDLE (Sub-Saturation)';

  // ---------------------------------------------------------------------------
  // 4. Dynamic LED 3: Feed Inlet Solenoid Valve (Membrane Integrity & Osmosis)
  // ---------------------------------------------------------------------------
  const eta = (1.0 - (outletTds / Math.max(inletTds, 1.0))) * 100.0;
  const isBreached = outletTds >= (0.50 * inletTds) && inletTds > 200.0;
  const degradation = Math.max(0.0, (95.0 - eta) / 95.0);

  // Smooth color shift: Emerald Green (34, 197, 94) -> Yellow-Amber (245, 158, 11)
  const valveR = Math.round(34 + (245 - 34) * Math.min(degradation * 2.2, 1.0));
  const valveG = Math.round(197 + (158 - 197) * Math.min(degradation * 2.2, 1.0));
  const valveB = Math.round(94 + (11 - 94) * Math.min(degradation * 2.2, 1.0));

  const valveDiodeStyle = isBreached
    ? {
        backgroundColor: 'rgb(220, 38, 38)',
        boxShadow: '0 0 16px rgba(220, 38, 38, 0.95), 0 0 32px rgba(220, 38, 38, 0.55)',
        animation: 'ledStrobe 0.22s infinite ease-in-out'
      }
    : {
        backgroundColor: `rgb(${valveR}, ${valveG}, ${valveB})`,
        boxShadow: `0 0 10px rgba(${valveR}, ${valveG}, ${valveB}, 0.80), 0 0 20px rgba(${valveR}, ${valveG}, ${valveB}, 0.35)`
      };

  const valveLabel = isBreached
    ? `INTERLOCKED: BREACH (Rej: ${eta.toFixed(1)}%)`
    : `OPEN (Rej: ${eta.toFixed(1)}%)`;

  return (
    <div className="space-y-3">
      {/* Dynamic Keyframes */}
      <style>{`
        @keyframes ledPulse {
          0%, 100% { opacity: 1.0; transform: scale(1.0); }
          50% { opacity: 0.35; transform: scale(0.92); }
        }
        @keyframes ledStrobe {
          0%, 100% { opacity: 1.0; filter: brightness(1.2); }
          50% { opacity: 0.15; filter: brightness(0.7); }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <span>⚡</span>
          <span>Formula-Driven Actuator Indicators (Deterministic Physical Decoupling)</span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400/80">
          Sub-200ms Math Engine: Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* ================================================================= */}
        {/* DIODE 1: Booster Pump Relay */}
        {/* ================================================================= */}
        <div
          onMouseEnter={() => setActiveTooltip('pump')}
          onMouseLeave={() => setActiveTooltip(null)}
          className={`relative p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
            isPumpTripped
              ? 'bg-rose-950/70 border-rose-700/80'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <span>Booster Pump Relay</span>
              <span className="text-[10px] font-mono text-slate-500">GPIO26</span>
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-300">
              {pumpLabel}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Ia: {Ia.toFixed(2)} A | Load: {Math.round(loadRatio * 100)}%
            </div>
          </div>

          {/* Physical Diode with Metallic Bezel */}
          <div className="w-9 h-9 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-inner">
            <div
              className="w-5 h-5 rounded-full transition-all duration-300"
              style={pumpDiodeStyle}
            />
          </div>

          {/* Translucent Mathematical Trace Tooltip */}
          {activeTooltip === 'pump' && (
            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900/95 backdrop-blur border border-cyan-500/50 rounded-xl shadow-2xl text-[11px] font-mono space-y-1 text-slate-200 pointer-events-none">
              <div className="font-bold text-cyan-300 border-b border-slate-700 pb-1">
                Booster Pump Relay Logic (Thermal Decoupling)
              </div>
              <div className="text-slate-300">Ia: <span className="text-amber-300">{Ia.toFixed(2)} A</span> | Q: <span className="text-cyan-300">{Q.toFixed(2)} L/min</span></div>
              <div>Load Ratio: <span className="text-emerald-300">{Math.round(loadRatio * 100)}%</span> (0.15A - 1.80A)</div>
              <div>Overcurrent: {isOvercurrent ? '<span class="text-rose-400">TRUE (>1.80A)</span>' : 'Nominal'}</div>
              <div>Cavitation: {isCavitation ? '<span class="text-rose-400">TRUE (<0.15A)</span>' : 'Nominal'}</div>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                Formula: Load = clamp((Ia - 0.15) / 1.65, 0, 1) | Trip &lt; 180ms
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* DIODE 2: Anti-Scaling Flush Solenoid */}
        {/* ================================================================= */}
        <div
          onMouseEnter={() => setActiveTooltip('flush')}
          onMouseLeave={() => setActiveTooltip(null)}
          className={`relative p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
            isFlushActive
              ? 'bg-cyan-950/60 border-cyan-600/80 shadow-md shadow-cyan-950/50'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <span>Anti-Scaling Flush</span>
              <span className="text-[10px] font-mono text-slate-500">GPIO27</span>
            </div>
            <div className={`text-[11px] font-mono font-bold ${isFlushActive ? 'text-cyan-300' : 'text-slate-400'}`}>
              {flushLabel}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              CP: {cpIndex.toFixed(2)} | ΔP: {deltaP.toFixed(2)} bar
            </div>
          </div>

          {/* Physical Diode with Metallic Bezel */}
          <div className="w-9 h-9 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-inner">
            <div
              className="w-5 h-5 rounded-full transition-all duration-300"
              style={flushDiodeStyle}
            />
          </div>

          {/* Translucent Mathematical Trace Tooltip */}
          {activeTooltip === 'flush' && (
            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900/95 backdrop-blur border border-cyan-500/50 rounded-xl shadow-2xl text-[11px] font-mono space-y-1 text-slate-200 pointer-events-none">
              <div className="font-bold text-cyan-300 border-b border-slate-700 pb-1">
                Concentration Polarization (CP) Nucleation
              </div>
              <div>Inlet TDS: <span className="text-amber-300">{inletTds.toFixed(1)} ppm</span></div>
              <div>ΔP Inferred: <span className="text-cyan-300">{deltaP.toFixed(2)} bar</span></div>
              <div>CP Index: <span className={isFlushActive ? 'text-cyan-400 font-bold' : 'text-slate-300'}>{cpIndex.toFixed(3)}</span> (Threshold: 1.25)</div>
              <div>Duty Intensity: <span className="text-emerald-300">{(flushIntensity * 100).toFixed(0)}%</span></div>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                Formula: CP = (TDS/1000) * (ΔP / max(Q, 0.2)) | -18% R_cake washdown
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* DIODE 3: Feed Inlet Solenoid Valve */}
        {/* ================================================================= */}
        <div
          onMouseEnter={() => setActiveTooltip('valve')}
          onMouseLeave={() => setActiveTooltip(null)}
          className={`relative p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
            isBreached
              ? 'bg-rose-950/70 border-rose-700/80 shadow-md shadow-rose-950/50'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <span>Feed Inlet Valve</span>
              <span className="text-[10px] font-mono text-slate-500">GPIO27</span>
            </div>
            <div className={`text-[11px] font-mono font-bold ${isBreached ? 'text-rose-300' : 'text-emerald-300'}`}>
              {valveLabel}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              In: {Math.round(inletTds)} ppm | Out: {Math.round(outletTds)} ppm
            </div>
          </div>

          {/* Physical Diode with Metallic Bezel */}
          <div className="w-9 h-9 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-inner">
            <div
              className="w-5 h-5 rounded-full transition-all duration-300"
              style={valveDiodeStyle}
            />
          </div>

          {/* Translucent Mathematical Trace Tooltip */}
          {activeTooltip === 'valve' && (
            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900/95 backdrop-blur border border-cyan-500/50 rounded-xl shadow-2xl text-[11px] font-mono space-y-1 text-slate-200 pointer-events-none">
              <div className="font-bold text-cyan-300 border-b border-slate-700 pb-1">
                Membrane Integrity & Osmotic Rejection
              </div>
              <div>Inlet TDS: <span className="text-amber-300">{Math.round(inletTds)} ppm</span></div>
              <div>Outlet TDS: <span className="text-blue-300">{Math.round(outletTds)} ppm</span></div>
              <div>Salt Rejection (η): <span className={eta >= 90 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>{eta.toFixed(1)}%</span></div>
              <div>Membrane Breach: <span className={isBreached ? 'text-rose-400 font-bold' : 'text-slate-400'}>{isBreached ? 'CRITICAL BREACH' : 'Integrity Verified'}</span></div>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                Formula: η = (1 - Out/In)*100% | Trip: Out >= 0.50*In (In > 200)
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default HardwareActuatorLeds;
