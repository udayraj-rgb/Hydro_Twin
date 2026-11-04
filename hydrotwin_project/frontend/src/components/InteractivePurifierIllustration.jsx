import React, { useState } from 'react';

/**
 * InteractivePurifierIllustration
 * 
 * Hardware-in-the-Loop Visual Filtration Schematic & Component Diagnostic Lens.
 * Renders the 5 core purification stages in serial hydraulic order with interactive selection,
 * fluidic coupling flow indicators, and physical Darcy-Hermia telemetry inspection.
 * 
 * Palette: Atomberg Corporate White & Olive (#FAFCF7, #182514, #384828, #BACAB3, #A6E39D).
 * 
 * Props:
 * - telemetry: Real-time digital twin telemetry packet from WebSocket or local physics engine
 * - sensorInputs: Active sensor setpoints
 * - onUpdate: Callback to update setpoints
 * - onSelectStage: (stageId) => void callback on stage selection
 * - selectedStage: Controlled active stage id ('sediment' | 'carbon' | 'pump' | 'ro' | 'alkaline')
 */
function InteractivePurifierIllustration({
  telemetry = null,
  sensorInputs = {},
  onUpdate = null,
  onSelectStage = null,
  selectedStage = undefined
}) {
  const [internalSelectedStage, setInternalSelectedStage] = useState('ro');
  const activeStage = selectedStage !== undefined ? selectedStage : internalSelectedStage;

  const handleStageClick = (stageId) => {
    if (onSelectStage) {
      onSelectStage(stageId);
    }
    setInternalSelectedStage(stageId);
  };

  // ---------------------------------------------------------------------------
  // Telemetry Metric Extraction with Safe Industrial Fallbacks
  // ---------------------------------------------------------------------------
  const inletTds = Number(telemetry?.sensors?.inlet_tds ?? telemetry?.inlet_tds ?? sensorInputs?.inlet_tds ?? 850);
  const outletTds = Number(telemetry?.sensors?.outlet_tds ?? telemetry?.physics?.outlet_tds ?? telemetry?.outlet_tds ?? 42);
  const flowLpm = Number(telemetry?.sensors?.flow_lpm ?? telemetry?.flow_lpm ?? sensorInputs?.flow_lpm ?? 1.20);
  const pumpCurrent = Number(telemetry?.sensors?.pump_current ?? telemetry?.pump_current ?? sensorInputs?.pump_current ?? 0.85);

  const deltaP = Number(telemetry?.physics?.delta_p ?? telemetry?.delta_p ?? 1.11);
  const rSediment = Number(telemetry?.physics?.r_sediment ?? telemetry?.r_sediment ?? 0.60);
  const rCake = Number(telemetry?.physics?.r_cake ?? telemetry?.r_cake ?? 0.18);
  const saltRejection = Number(telemetry?.physics?.salt_rejection ?? telemetry?.salt_rejection ?? 95.2);
  const deltaMineral = Number(telemetry?.physics?.delta_mineral ?? telemetry?.delta_mineral ?? 28.0);
  const cpIndex = Number(telemetry?.physics?.cp_index ?? telemetry?.cp_index ?? 0.78);

  const sedimentHealth = Number(telemetry?.prognostics?.sediment_health ?? telemetry?.sediment_health ?? 83.2);
  const carbonHealth = Number(telemetry?.prognostics?.carbon_health ?? telemetry?.carbon_health ?? 84.0);
  const roHealth = Number(telemetry?.prognostics?.ro_health ?? telemetry?.ro_health ?? 98.6);
  const alkaliserHealth = Number(telemetry?.prognostics?.alkaliser_health ?? telemetry?.alkaliser_health ?? 93.3);

  const isCavitation = pumpCurrent < 0.15;
  const isStall = pumpCurrent > 1.80;
  const isPumpTripped = isCavitation || isStall;
  const isFlush = Boolean(telemetry?.actuators?.flush_solenoid ?? telemetry?.flush_solenoid ?? (cpIndex > 1.25));

  // ---------------------------------------------------------------------------
  // Stage Definitions
  // ---------------------------------------------------------------------------
  const stages = [
    {
      id: 'sediment',
      step: '01',
      name: 'Pre-Sediment Filter',
      role: 'Particulate Interception',
      metric: `${rSediment.toFixed(2)} kPa·s/L`,
      metricLabel: 'Vacuum Resistance (R_sed)',
      health: sedimentHealth,
      status: rSediment > 1.50 ? 'CHOKED' : rSediment > 1.00 ? 'RESTRICTED' : 'OPTIMAL',
      accentColor: rSediment > 1.50 ? '#E11D48' : '#384828'
    },
    {
      id: 'carbon',
      step: '02',
      name: 'Carbon Adsorption Block',
      role: 'Chlorine & VOC Scavenger',
      metric: '99.4% Dechlor',
      metricLabel: 'Adsorption Capacity',
      health: carbonHealth,
      status: carbonHealth < 30 ? 'DEPLETED' : 'ACTIVE',
      accentColor: '#384828'
    },
    {
      id: 'pump',
      step: '03',
      name: 'BLDC Booster Pump Core',
      role: 'Hydraulic Head Delivery',
      metric: `${pumpCurrent.toFixed(2)} A | ${deltaP.toFixed(2)} bar`,
      metricLabel: 'Ia & Delivery Pressure',
      health: isPumpTripped ? 0 : 96.5,
      status: isCavitation ? 'CAVITATION' : isStall ? 'OVERCURRENT' : 'NOMINAL',
      accentColor: isPumpTripped ? '#E11D48' : '#2D5A1E'
    },
    {
      id: 'ro',
      step: '04',
      name: 'RO Membrane Module',
      role: 'Osmotic Desalination',
      metric: `${saltRejection.toFixed(1)}% Rej`,
      metricLabel: `R_cake: ${rCake.toFixed(2)} | CP: ${cpIndex.toFixed(2)}`,
      health: roHealth,
      status: isFlush ? 'FLUSHING' : roHealth < 50 ? 'SCALED' : 'OPTIMAL',
      accentColor: isFlush ? '#0D9488' : '#182514'
    },
    {
      id: 'alkaline',
      step: '05',
      name: 'Alkaline Remineralizer',
      role: 'Active Mineral Infusion',
      metric: `+${deltaMineral.toFixed(0)} ppm Ca/Mg`,
      metricLabel: `Outlet: ${Math.round(outletTds)} ppm (pH ~7.8)`,
      health: alkaliserHealth,
      status: deltaMineral < 10 ? 'DEPLETED' : 'BALANCED',
      accentColor: '#2D5A1E'
    }
  ];

  const currentStageData = stages.find((s) => s.id === activeStage) || stages[3];

  return (
    <div className="bg-white border border-[#DCE4D6] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[#E3E9DE] gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2 text-xs font-black text-[#142010] uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-[#384828]"></span>
            <span>Interactive Visual Hydraulic Purification Schematic</span>
            <span className="text-[#BACAB3]">•</span>
            <span className="font-mono text-[#384828] text-[11px]">Darcy-Hermia Fluidics</span>
          </div>
          <p className="text-xs text-[#1F2D19] font-medium">
            Click any hydraulic stage below to inspect internal transport impedance, local trans-membrane gradient, and wear dynamics.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-[#EAEFE5] text-[#142010] font-mono text-xs font-bold border border-[#BACAB3] flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${flowLpm > 0.05 ? 'bg-[#2D5A1E] animate-pulse' : 'bg-slate-400'}`}></span>
            <span>Fluid Stream: {flowLpm.toFixed(2)} L/min</span>
          </span>
        </div>
      </div>

      {/* 5 Serial Hydraulic Stages Flow Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
        {stages.map((stg, idx) => {
          const isSelected = activeStage === stg.id;
          return (
            <button
              key={stg.id}
              type="button"
              onClick={() => handleStageClick(stg.id)}
              className={`p-3.5 rounded-xl text-left transition-all duration-200 border cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                isSelected
                  ? 'bg-[#182514] text-white border-[#182514] shadow-md ring-2 ring-[#384828]'
                  : 'bg-[#FAFBF8] hover:bg-[#F4F6F0] text-[#142010] border-[#BACAB3] shadow-2xs hover:border-[#384828]'
              }`}
            >
              {/* Stage Step Indicator */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-[#2D3E25] text-[#A6E39D]' : 'bg-[#EAEFE5] text-[#384828]'
                  }`}
                >
                  STAGE {stg.step}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    stg.status === 'CHOKED' || stg.status === 'CAVITATION' || stg.status === 'OVERCURRENT'
                      ? 'bg-rose-500 animate-pulse'
                      : stg.status === 'FLUSHING'
                      ? 'bg-teal-400 animate-pulse'
                      : 'bg-[#A6E39D]'
                  }`}
                ></span>
              </div>

              {/* Title & Role */}
              <div className="space-y-0.5">
                <div className={`font-black text-xs tracking-tight line-clamp-1 ${isSelected ? 'text-white' : 'text-[#142010]'}`}>
                  {stg.name}
                </div>
                <div className={`text-[10px] font-medium line-clamp-1 ${isSelected ? 'text-[#C8E6C0]' : 'text-[#1F2D19]'}`}>
                  {stg.role}
                </div>
              </div>

              {/* Metric & Health Bar */}
              <div className="space-y-1.5 pt-1 border-t border-current/15">
                <div className="flex items-baseline justify-between text-[11px] font-mono">
                  <span className={`font-black ${isSelected ? 'text-[#A6E39D]' : 'text-[#142010]'}`}>
                    {stg.metric}
                  </span>
                  <span className={`text-[9px] font-bold ${isSelected ? 'text-white/80' : 'text-[#1F2D19]'}`}>
                    {stg.health.toFixed(0)}%
                  </span>
                </div>

                <div className="w-full bg-current/20 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      stg.health < 40 ? 'bg-rose-500' : isSelected ? 'bg-[#A6E39D]' : 'bg-[#384828]'
                    }`}
                    style={{ width: `${Math.min(Math.max(stg.health, 5), 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Connector Arrow on larger displays (except last) */}
              {idx < 4 && (
                <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <div className="w-4 h-4 rounded-full bg-white border border-[#BACAB3] flex items-center justify-center text-[#384828] text-[9px] font-black shadow-xs">
                    ›
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Stage Forensic Lens Detail Drawer */}
      <div className="bg-[#182514] text-white border-2 border-[#384828] rounded-xl p-4 sm:p-5 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#384828] gap-2">
          <div className="flex items-center space-x-2.5">
            <span className="px-2 py-0.5 rounded bg-[#2D3E25] text-[#A6E39D] font-mono text-xs font-bold border border-[#445E37]">
              STAGE {currentStageData.step} ACTIVE INSPECTION
            </span>
            <span className="font-black text-sm text-white tracking-tight">
              {currentStageData.name} ({currentStageData.role})
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-[#C8E6C0]">
            Operational State: <strong className="text-white">{currentStageData.status}</strong>
          </span>
        </div>

        {/* 4 Diagnostic Parameters for Active Stage */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[#111C0E]/70 p-3 rounded-lg border border-[#3E5232] space-y-1">
            <div className="text-[10px] text-[#C8E6C0] font-semibold uppercase">Physical Primary Reading</div>
            <div className="text-base font-black text-white">{currentStageData.metric}</div>
            <div className="text-[10px] text-white/70 font-sans">{currentStageData.metricLabel}</div>
          </div>

          <div className="bg-[#111C0E]/70 p-3 rounded-lg border border-[#3E5232] space-y-1">
            <div className="text-[10px] text-[#C8E6C0] font-semibold uppercase">Hydraulic Loading Flux</div>
            <div className="text-base font-black text-white">{flowLpm.toFixed(2)} L/min</div>
            <div className="text-[10px] text-white/70 font-sans">Permeate Delivery Velocity</div>
          </div>

          <div className="bg-[#111C0E]/70 p-3 rounded-lg border border-[#3E5232] space-y-1">
            <div className="text-[10px] text-[#C8E6C0] font-semibold uppercase">Stage Health Score</div>
            <div className="text-base font-black text-[#A6E39D]">{currentStageData.health.toFixed(1)}%</div>
            <div className="text-[10px] text-white/70 font-sans">Remaining Useful Life Bound</div>
          </div>

          <div className="bg-[#111C0E]/70 p-3 rounded-lg border border-[#3E5232] space-y-1">
            <div className="text-[10px] text-[#C8E6C0] font-semibold uppercase">Fluid TDS Interface</div>
            <div className="text-base font-black text-white">
              {activeStage === 'sediment' ? `${Math.round(inletTds)} ppm (Raw)` : `${Math.round(outletTds)} ppm (Perm)`}
            </div>
            <div className="text-[10px] text-white/70 font-sans">Solute Concentration</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractivePurifierIllustration;
