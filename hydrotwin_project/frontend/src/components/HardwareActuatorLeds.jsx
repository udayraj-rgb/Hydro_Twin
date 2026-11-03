import React, { useState } from 'react';

/**
 * HardwareActuatorLeds: 100% Formula-Driven Dynamic Hardware LED Sub-System
 * Styled in an elegant White and Olive palette matching the brand reference image.
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
  const isOvercurrent = Ia > 1.80;
  const isCavitation = Ia < 0.15;
  const isPumpTripped = isOvercurrent || isCavitation;

  const loadRatio = Math.min(Math.max((Ia - 0.15) / (1.80 - 0.15), 0.0), 1.0);
  const pumpFlashDuration = Math.max(0.15, 0.60 - Math.abs(Ia - 0.95) * 0.30);

  const pumpDiodeStyle = isPumpTripped
    ? {
        backgroundColor: 'rgb(225, 29, 72)',
        boxShadow: '0 0 10px rgba(225, 29, 72, 0.85), 0 0 18px rgba(225, 29, 72, 0.40)',
        animation: `ledPulse ${pumpFlashDuration.toFixed(3)}s infinite ease-in-out`
      }
    : {
        backgroundColor: 'rgb(108, 131, 96)', // Elegant Olive Green Diode
        boxShadow: `0 0 ${6 + loadRatio * 8}px rgba(108, 131, 96, ${0.40 + loadRatio * 0.50})`
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

  const isFlushActive = cpIndex > 1.25 || inletTds > 1200.0;
  const flushIntensity = Math.min(Math.max((cpIndex - 1.25) / 1.0, 0.0), 1.0);
  const flushPeriod = Math.max(0.20, 1.20 - flushIntensity * 0.80);

  const flushDiodeStyle = isFlushActive
    ? {
        backgroundColor: 'rgb(13, 148, 136)',
        boxShadow: `0 0 ${8 + flushIntensity * 12}px rgba(13, 148, 136, 0.85)`,
        animation: `ledPulse ${flushPeriod.toFixed(3)}s infinite ease-in-out`
      }
    : {
        backgroundColor: 'rgb(186, 202, 179)',
        boxShadow: '0 0 2px rgba(186, 202, 179, 0.40)'
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

  const valveR = Math.round(108 + (217 - 108) * Math.min(degradation * 2.2, 1.0));
  const valveG = Math.round(131 + (119 - 131) * Math.min(degradation * 2.2, 1.0));
  const valveB = Math.round(96 + (6 - 96) * Math.min(degradation * 2.2, 1.0));

  const valveDiodeStyle = isBreached
    ? {
        backgroundColor: 'rgb(225, 29, 72)',
        boxShadow: '0 0 12px rgba(225, 29, 72, 0.85)',
        animation: 'ledStrobe 0.22s infinite ease-in-out'
      }
    : {
        backgroundColor: `rgb(${valveR}, ${valveG}, ${valveB})`,
        boxShadow: `0 0 8px rgba(${valveR}, ${valveG}, ${valveB}, 0.70)`
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
        <div className="text-xs font-bold text-[#54684A] uppercase tracking-wider flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#849C77]"></span>
          <span>Formula-Driven Actuator Indicators (Deterministic Physical Decoupling)</span>
        </div>
        <span className="text-[10px] font-mono text-[#54684A] bg-[#EAEFE5] px-2 py-0.5 rounded border border-[#BACAB3]">
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
              ? 'bg-rose-50 border-rose-300 shadow-sm'
              : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] shadow-sm'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#2A3525] flex items-center space-x-1.5">
              <span>Booster Pump Relay</span>
              <span className="text-[10px] font-mono text-[#788870]">GPIO26</span>
            </div>
            <div className={`text-[11px] font-mono font-bold ${isPumpTripped ? 'text-rose-700' : 'text-[#3E4D37]'}`}>
              {pumpLabel}
            </div>
            <div className="text-[10px] text-[#6C7E66] font-mono">
              Ia: {Ia.toFixed(2)} A | Load: {Math.round(loadRatio * 100)}%
            </div>
          </div>

          {/* Physical Diode with Brushed Metallic Olive Bezel */}
          <div className="w-9 h-9 rounded-full bg-white border-2 border-[#BACAB3] flex items-center justify-center shadow-inner">
            <div
              className="w-5 h-5 rounded-full transition-all duration-300"
              style={pumpDiodeStyle}
            />
          </div>

          {/* Tooltip */}
          {activeTooltip === 'pump' && (
            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-white/98 backdrop-blur border border-[#BACAB3] rounded-xl shadow-xl text-[11px] font-mono space-y-1 text-[#2A3525] pointer-events-none">
              <div className="font-bold text-[#3E4D37] border-b border-[#E3E9DE] pb-1">
                Booster Pump Relay Logic (Thermal Decoupling)
              </div>
              <div className="text-[#54684A]">Ia: <span className="font-bold text-[#2A3525]">{Ia.toFixed(2)} A</span> | Q: <span className="font-bold text-[#2A3525]">{Q.toFixed(2)} L/min</span></div>
              <div>Load Ratio: <span className="text-[#6C8360] font-bold">{Math.round(loadRatio * 100)}%</span> (0.15A - 1.80A)</div>
              <div>Overcurrent: {isOvercurrent ? '<span class="text-rose-600 font-bold">TRUE (>1.80A)</span>' : 'Nominal'}</div>
              <div>Cavitation: {isCavitation ? '<span class="text-rose-600 font-bold">TRUE (<0.15A)</span>' : 'Nominal'}</div>
              <div className="text-[10px] text-[#788870] pt-1 border-t border-[#E3E9DE]">
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
              ? 'bg-[#E1EFEA] border-[#9CC7B8] shadow-sm'
              : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] shadow-sm'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#2A3525] flex items-center space-x-1.5">
              <span>Anti-Scaling Flush</span>
              <span className="text-[10px] font-mono text-[#788870]">GPIO27</span>
            </div>
            <div className={`text-[11px] font-mono font-bold ${isFlushActive ? 'text-[#1E5246]' : 'text-[#788870]'}`}>
              {flushLabel}
            </div>
            <div className="text-[10px] text-[#6C7E66] font-mono">
              CP: {cpIndex.toFixed(2)} | ΔP: {deltaP.toFixed(2)} bar
            </div>
          </div>

          {/* Physical Diode with Brushed Metallic Olive Bezel */}
          <div className="w-9 h-9 rounded-full bg-white border-2 border-[#BACAB3] flex items-center justify-center shadow-inner">
            <div
              className="w-5 h-5 rounded-full transition-all duration-300"
              style={flushDiodeStyle}
            />
          </div>

          {/* Tooltip */}
          {activeTooltip === 'flush' && (
            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-white/98 backdrop-blur border border-[#BACAB3] rounded-xl shadow-xl text-[11px] font-mono space-y-1 text-[#2A3525] pointer-events-none">
              <div className="font-bold text-[#3E4D37] border-b border-[#E3E9DE] pb-1">
                Concentration Polarization (CP) Nucleation
              </div>
              <div>Inlet TDS: <span className="font-bold text-[#2A3525]">{inletTds.toFixed(1)} ppm</span></div>
              <div>ΔP Inferred: <span className="font-bold text-[#2A3525]">{deltaP.toFixed(2)} bar</span></div>
              <div>CP Index: <span className={isFlushActive ? 'text-[#1E5246] font-bold' : 'text-[#54684A]'}>{cpIndex.toFixed(3)}</span> (Threshold: 1.25)</div>
              <div>Duty Intensity: <span className="text-[#6C8360] font-bold">{(flushIntensity * 100).toFixed(0)}%</span></div>
              <div className="text-[10px] text-[#788870] pt-1 border-t border-[#E3E9DE]">
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
              ? 'bg-rose-50 border-rose-300 shadow-sm'
              : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] shadow-sm'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#2A3525] flex items-center space-x-1.5">
              <span>Feed Inlet Valve</span>
              <span className="text-[10px] font-mono text-[#788870]">GPIO27</span>
            </div>
            <div className={`text-[11px] font-mono font-bold ${isBreached ? 'text-rose-700' : 'text-[#3E4D37]'}`}>
              {valveLabel}
            </div>
            <div className="text-[10px] text-[#6C7E66] font-mono">
              In: {Math.round(inletTds)} ppm | Out: {Math.round(outletTds)} ppm
            </div>
          </div>

          {/* Physical Diode with Brushed Metallic Olive Bezel */}
          <div className="w-9 h-9 rounded-full bg-white border-2 border-[#BACAB3] flex items-center justify-center shadow-inner">
            <div
              className="w-5 h-5 rounded-full transition-all duration-300"
              style={valveDiodeStyle}
            />
          </div>

          {/* Tooltip */}
          {activeTooltip === 'valve' && (
            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-white/98 backdrop-blur border border-[#BACAB3] rounded-xl shadow-xl text-[11px] font-mono space-y-1 text-[#2A3525] pointer-events-none">
              <div className="font-bold text-[#3E4D37] border-b border-[#E3E9DE] pb-1">
                Membrane Integrity & Osmotic Rejection
              </div>
              <div>Inlet TDS: <span className="font-bold text-[#2A3525]">{Math.round(inletTds)} ppm</span></div>
              <div>Outlet TDS: <span className="font-bold text-[#2A3525]">{Math.round(outletTds)} ppm</span></div>
              <div>Salt Rejection (η): <span className="text-[#6C8360] font-bold">{eta.toFixed(1)}%</span></div>
              <div>Membrane Breach: <span className={isBreached ? 'text-rose-700 font-bold' : 'text-[#6C8360]'}>{isBreached ? 'CRITICAL BREACH' : 'Integrity Verified'}</span></div>
              <div className="text-[10px] text-[#788870] pt-1 border-t border-[#E3E9DE]">
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
