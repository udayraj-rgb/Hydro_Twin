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
        <div className="text-xs font-black text-[#142010] uppercase tracking-wider flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4D7736]"></span>
          <span>Formula-Driven Actuator Indicators (Deterministic Physical Decoupling)</span>
        </div>
        <span className="text-xs font-mono font-bold text-[#142010] bg-[#EAEFE5] px-2.5 py-0.5 rounded border border-[#BACAB3]">
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
              : 'bg-[#FAFBF8] border-[#BACAB3] hover:border-[#384828] shadow-sm'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-black text-[#142010] flex items-center space-x-1.5">
              <span>Booster Pump Relay</span>
              <span className="text-[10px] font-mono text-[#142010] font-bold">GPIO26</span>
            </div>
            <div className={`text-xs font-mono font-black ${isPumpTripped ? 'text-rose-800' : 'text-[#142010]'}`}>
              {pumpLabel}
            </div>
            <div className="text-xs text-[#1F2D19] font-mono font-semibold">
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
            <div
              className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 p-3.5 bg-[#182514] text-white border-2 border-[#384828] rounded-2xl shadow-2xl text-xs font-mono space-y-2 pointer-events-none drop-shadow-2xl"
              style={{ backgroundColor: '#182514', opacity: 1 }}
            >
              <div className="font-black text-white border-b border-[#384828] pb-1.5 flex items-center justify-between">
                <span>Booster Pump Relay Logic</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2D3E25] text-[#A6E39D] border border-[#445E37] font-bold">
                  GPIO26
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Armature Current (Ia):</span>
                  <span className="font-black text-white font-mono">{Ia.toFixed(2)} A</span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Flow Rate (Q):</span>
                  <span className="font-black text-white font-mono">{Q.toFixed(2)} L/min</span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Thermal Load Ratio:</span>
                  <span className="font-black text-[#A6E39D] font-mono">{Math.round(loadRatio * 100)}% (0.15A - 1.80A)</span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Overcurrent Trip:</span>
                  {isOvercurrent ? (
                    <span className="text-rose-400 font-black animate-pulse font-mono">TRIP (&gt;1.80A)</span>
                  ) : (
                    <span className="text-[#A6E39D] font-bold font-mono">Nominal</span>
                  )}
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Cavitation Trip:</span>
                  {isCavitation ? (
                    <span className="text-amber-400 font-black animate-pulse font-mono">TRIP (&lt;0.15A)</span>
                  ) : (
                    <span className="text-[#A6E39D] font-bold font-mono">Nominal</span>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-[#C8E6C0] font-mono pt-1.5 border-t border-[#384828] bg-[#111C0E]/80 px-2.5 py-1.5 rounded-lg">
                Formula: Load = clamp((Ia - 0.15) / 1.65, 0, 1) | Trip &lt; 180ms
              </div>
              {/* Downward Caret */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#384828]"></div>
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
              : 'bg-[#FAFBF8] border-[#BACAB3] hover:border-[#384828] shadow-sm'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-black text-[#142010] flex items-center space-x-1.5">
              <span>Anti-Scaling Flush</span>
              <span className="text-[10px] font-mono text-[#142010] font-bold">GPIO27</span>
            </div>
            <div className={`text-xs font-mono font-black ${isFlushActive ? 'text-[#1E5246]' : 'text-[#142010]'}`}>
              {flushLabel}
            </div>
            <div className="text-xs text-[#1F2D19] font-mono font-semibold">
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
            <div
              className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 p-3.5 bg-[#182514] text-white border-2 border-[#384828] rounded-2xl shadow-2xl text-xs font-mono space-y-2 pointer-events-none drop-shadow-2xl"
              style={{ backgroundColor: '#182514', opacity: 1 }}
            >
              <div className="font-black text-white border-b border-[#384828] pb-1.5 flex items-center justify-between">
                <span>Concentration Polarization (CP)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2D3E25] text-[#A6E39D] border border-[#445E37] font-bold">
                  GPIO27
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Inlet Feed TDS:</span>
                  <span className="font-black text-white font-mono">{inletTds.toFixed(1)} ppm</span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Inferred Head Loss (ΔP):</span>
                  <span className="font-black text-white font-mono">{deltaP.toFixed(2)} bar</span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>CP Index:</span>
                  <span className={`font-black font-mono ${isFlushActive ? 'text-[#72DEC2]' : 'text-[#A6E39D]'}`}>
                    {cpIndex.toFixed(3)} (Limit: 1.25)
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Flush Solenoid Duty:</span>
                  <span className="font-black text-[#A6E39D] font-mono">{(flushIntensity * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-[10px] text-[#C8E6C0] font-mono pt-1.5 border-t border-[#384828] bg-[#111C0E]/80 px-2.5 py-1.5 rounded-lg">
                Formula: CP = (TDS/1000) * (ΔP / max(Q, 0.2)) | -18% R_cake washdown
              </div>
              {/* Downward Caret */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#384828]"></div>
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
              : 'bg-[#FAFBF8] border-[#BACAB3] hover:border-[#384828] shadow-sm'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-black text-[#142010] flex items-center space-x-1.5">
              <span>Feed Inlet Valve</span>
              <span className="text-[10px] font-mono text-[#142010] font-bold">GPIO27</span>
            </div>
            <div className={`text-xs font-mono font-black ${isBreached ? 'text-rose-800' : 'text-[#142010]'}`}>
              {valveLabel}
            </div>
            <div className="text-xs text-[#1F2D19] font-mono font-semibold">
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
            <div
              className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 p-3.5 bg-[#182514] text-white border-2 border-[#384828] rounded-2xl shadow-2xl text-xs font-mono space-y-2 pointer-events-none drop-shadow-2xl"
              style={{ backgroundColor: '#182514', opacity: 1 }}
            >
              <div className="font-black text-white border-b border-[#384828] pb-1.5 flex items-center justify-between">
                <span>Membrane Integrity & Salt Rejection</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2D3E25] text-[#A6E39D] border border-[#445E37] font-bold">
                  GPIO27
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Feed Groundwater TDS:</span>
                  <span className="font-black text-white font-mono">{Math.round(inletTds)} ppm</span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Purified Permeate TDS:</span>
                  <span className="font-black text-white font-mono">{Math.round(outletTds)} ppm</span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Salt Rejection (η):</span>
                  <span className="font-black text-[#A6E39D] font-mono">{eta.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center text-[#E2F0DC]">
                  <span>Safety Interlock:</span>
                  {isBreached ? (
                    <span className="text-rose-400 font-black animate-pulse font-mono">CRITICAL BREACH</span>
                  ) : (
                    <span className="text-[#A6E39D] font-bold font-mono">Integrity Verified</span>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-[#C8E6C0] font-mono pt-1.5 border-t border-[#384828] bg-[#111C0E]/80 px-2.5 py-1.5 rounded-lg">
                Formula: η = (1 - Out/In)*100% | Trip: Out &ge; 0.50*In (In &gt; 200)
              </div>
              {/* Downward Caret */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#384828]"></div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default HardwareActuatorLeds;
