import React, { useState } from 'react';

/**
 * InteractivePurifierIllustration
 * 
 * Hardware-in-the-Loop Visual Filtration Schematic & Component Diagnostic Lens.
 * Renders the 5 core purification stages in serial hydraulic order with interactive selection,
 * fluidic coupling flow lines, and a mode-adaptive diagnostic drawer.
 * 
 * Props:
 * - telemetry: Real-time digital twin telemetry packet from WebSocket / local physics engine
 * - onSelectStage: (stageId) => void callback on stage selection
 * - selectedStage: Controlled active stage id ('sediment' | 'carbon' | 'pump' | 'ro' | 'alkaline')
 * - mode: 'hil' | 'consumer' | 'fleet' (Defaults to 'hil')
 */
function InteractivePurifierIllustration({
  telemetry = null,
  onSelectStage = null,
  selectedStage = undefined,
  mode = 'hil'
}) {
  // Uncontrolled fallback if selectedStage is not provided
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
  const inletTds = Number(telemetry?.sensors?.inlet_tds ?? telemetry?.inlet_tds ?? 850);
  const outletTds = Number(telemetry?.sensors?.outlet_tds ?? telemetry?.physics?.outlet_tds ?? telemetry?.outlet_tds ?? 42);
  const flowLpm = Number(telemetry?.sensors?.flow_lpm ?? telemetry?.flow_lpm ?? 1.20);
  const pumpCurrent = Number(telemetry?.sensors?.pump_current ?? telemetry?.pump_current ?? 0.85);

  const deltaP = Number(telemetry?.physics?.delta_p ?? (1.45 * pumpCurrent - 0.12)).toFixed(2);
  const rSediment = Number(telemetry?.physics?.r_sediment ?? telemetry?.r_sediment ?? 0.60);
  const rCake = Number(telemetry?.physics?.r_cake ?? telemetry?.r_cake ?? 0.18);
  const saltRejection = Number(telemetry?.physics?.salt_rejection ?? telemetry?.salt_rejection ?? 95.2).toFixed(1);
  const drDt = Number(telemetry?.physics?.dr_dt ?? 0.0142);

  const sedimentHealth = Number(telemetry?.prognostics?.sediment_health ?? telemetry?.sediment_health ?? 83.2).toFixed(1);
  const carbonHealth = Number(telemetry?.prognostics?.carbon_health ?? telemetry?.carbon_health ?? 84.0).toFixed(1);
  const roHealth = Number(telemetry?.prognostics?.ro_health ?? telemetry?.ro_health ?? 98.6).toFixed(1);
  const alkaliserHealth = Number(telemetry?.prognostics?.alkaliser_health ?? telemetry?.alkaliser_health ?? 83.3).toFixed(1);

  // Pump relay & interlock status
  const relayPump = telemetry?.actuators?.relay_pump ?? (pumpCurrent >= 0.15 && pumpCurrent <= 1.80);
  const isPumpRunning = relayPump && pumpCurrent >= 0.15 && pumpCurrent <= 1.80;
  const pumpStatusText = isPumpRunning ? 'RUNNING' : 'CUTOFF';

  // ---------------------------------------------------------------------------
  // 5 Purification Stages Specification
  // ---------------------------------------------------------------------------
  const stages = [
    {
      id: 'sediment',
      stepNumber: 1,
      name: 'Pre-Sediment Stage',
      subtitle: 'PP Spun Melt-Blown (5 Micron)',
      icon: '🚰',
      badge: `${sedimentHealth}% Health`,
      badgeColor: Number(sedimentHealth) > 60 ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800' : 'text-amber-400 bg-amber-950/80 border-amber-800',
      keyMetricLabel: 'R_sediment',
      keyMetricValue: `${rSediment.toFixed(2)} kPa·s/L`,
      statusIndicator: rSediment < 1.0 ? 'Nominal Suction' : rSediment < 1.5 ? 'Moderate Loading' : 'Choked Vacuum',
      statusColor: rSediment < 1.0 ? 'text-emerald-400' : rSediment < 1.5 ? 'text-amber-400' : 'text-rose-400',
      description: 'PP spun cartridge capturing suspended solids, silt, and rust before pump intake.',
      technicalPurpose: 'Darcy Depth Filtration. Intercepts suspended particulates > 5 μm (silica sand, colloidal clay, ferric rust) to protect the downstream booster pump diaphragm from abrasive wear.',
      consumerPurpose: 'First defense barrier! Traps visible mud, sand, and pipe rust so they never reach your pump or drinking glass.',
      engineeringEquation: 'ΔP_sediment = R_sediment · μ · Q  |  R_sed = 0.35 + (Total_Solid_Mass / A_filter)',
      currentStress: `Flow Rate: ${flowLpm.toFixed(2)} L/min | Vacuum Head Loss: ${(rSediment * 1.002 * flowLpm).toFixed(2)} kPa`,
      maintenance: 'Replace PP spun candle when R_sediment exceeds 1.80 kPa·s/L or every 6 months under standard municipal feeds.'
    },
    {
      id: 'carbon',
      stepNumber: 2,
      name: 'Activated Carbon Block',
      subtitle: 'Acid-Washed Coconut Shell (1100 IV)',
      icon: '⬛',
      badge: `${carbonHealth}% Capacity`,
      badgeColor: Number(carbonHealth) > 50 ? 'text-cyan-400 bg-cyan-950/80 border-cyan-800' : 'text-amber-400 bg-amber-950/80 border-amber-800',
      keyMetricLabel: 'Adsorption Capacity',
      keyMetricValue: `${carbonHealth}% Left`,
      statusIndicator: Number(carbonHealth) > 50 ? 'Adsorption Optimal' : 'Exhaustion Warning',
      statusColor: Number(carbonHealth) > 50 ? 'text-cyan-400' : 'text-amber-400',
      description: 'High-iodine carbon adsorbing chlorine, organics, and unpleasant tastes.',
      technicalPurpose: 'Catalytic Macropore Adsorption. Dechlorinates feed water (residual Cl2 reduction > 98%) to eliminate oxidative degradation and chain scission of downstream polyamide RO membranes.',
      consumerPurpose: 'Removes foul chemical tastes, bad odors, chlorine, and toxic pesticide residues for refreshing, natural taste.',
      engineeringEquation: 'Freundlich Isotherm: q_e = K_f · C_e^(1/n)  |  Cumulative Vol = ∫ Q(t) dt',
      currentStress: `Chlorine Reduction Index: 99.2% | Iodine Value: 1100 mg/g | Bed Volume: 6,000 L`,
      maintenance: 'Pre-emptive swap recommended at 8,000 liters or when consumer odor index exceeds sensory detection threshold.'
    },
    {
      id: 'pump',
      stepNumber: 3,
      name: 'BLDC Booster Pump',
      subtitle: '24V FOC Diaphragm Actuator',
      icon: '⚡',
      badge: pumpStatusText,
      badgeColor: isPumpRunning ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800' : 'text-rose-400 bg-rose-950/80 border-rose-800 animate-pulse',
      keyMetricLabel: 'Armature / Pressure',
      keyMetricValue: `${pumpCurrent.toFixed(2)} A / ${deltaP} bar`,
      statusIndicator: isPumpRunning ? 'Continuous Pumping' : 'Interlock Tripped',
      statusColor: isPumpRunning ? 'text-emerald-400' : 'text-rose-400',
      description: 'Variable-speed diaphragm pump delivering required trans-membrane pressure.',
      technicalPurpose: 'Positive Displacement Hydraulic Booster. Elevates fluid feed pressure above osmotic threshold (ΔP > Δπ) to drive cross-flow permeation across the spiral-wound membrane.',
      consumerPurpose: 'The silent powerhouse pump that creates optimal water pressure to force pure water molecules through the filter membrane.',
      engineeringEquation: 'V_arm = I_a · R_a + K_e · ω  |  Hydraulic Power: P_h = ΔP · Q  |  Cutoff < 180ms',
      currentStress: `Current Draw: ${pumpCurrent.toFixed(2)} A (Normal: 0.65-1.20 A) | Delivery Head: ${deltaP} bar | Speed: 2800 RPM`,
      maintenance: 'Firmware-governed auto-trip on dry cavitation (Ia < 0.15 A) or mechanical rotor stall (Ia > 1.80 A). Inspect valve heads if ΔP drops.'
    },
    {
      id: 'ro',
      stepNumber: 4,
      name: 'TFC RO Membrane Core',
      subtitle: 'Polyamide Spiral-Wound (0.0001 μm)',
      icon: '🌀',
      badge: `${roHealth}% Health`,
      badgeColor: Number(roHealth) > 70 ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800' : 'text-rose-400 bg-rose-950/80 border-rose-800',
      keyMetricLabel: 'R_cake / Rejection',
      keyMetricValue: `${rCake.toFixed(2)} kPa·s/L | ${saltRejection}%`,
      statusIndicator: rCake < 0.5 ? 'Membrane Clean' : rCake < 1.0 ? 'Surface Scaling' : 'Fouling Critical',
      statusColor: rCake < 0.5 ? 'text-emerald-400' : rCake < 1.0 ? 'text-amber-400' : 'text-rose-400',
      description: 'Polyamide spiral-wound membrane rejecting dissolved heavy minerals and micro-salts.',
      technicalPurpose: 'Semi-Permeable Cross-Flow Nano-Filtration. Rejects multivalent heavy metal ions (As³⁺, Pb²⁺, Cd²⁺), fluorides, microplastics, and bacterial endotoxins via size exclusion and charge repulsion.',
      consumerPurpose: 'The core purification engine! Blocks dissolved chemical salts, heavy metals, arsenic, bacteria, and viruses with microscopic precision.',
      engineeringEquation: 'J_v = (ΔP - Δπ) / [μ · (R_m + R_cake)]  |  Hermia Cake Drift: dR_cake/dt = K_c · C_b · J_v²',
      currentStress: `Salt Rejection (η): ${saltRejection}% | Inlet TDS: ${Math.round(inletTds)} ppm → Outlet: ${Math.round(outletTds)} ppm | dR/dt: +${drDt.toFixed(4)}/h`,
      maintenance: 'Dynamic anti-scaling flush cycles active. Replace spiral cartridge when salt rejection breaches < 90% or R_cake exceeds 1.40 kPa·s/L.'
    },
    {
      id: 'alkaline',
      stepNumber: 5,
      name: 'Alkaline Remineralizer',
      subtitle: 'Bioglass & Calcite Ceramic Core',
      icon: '🧪',
      badge: `${alkaliserHealth}% Elution`,
      badgeColor: 'text-teal-300 bg-teal-950/80 border-teal-800',
      keyMetricLabel: 'Mineral Infusion',
      keyMetricValue: '+28 ppm Ca/Mg (pH 7.8)',
      statusIndicator: 'Active Bioglass Elution',
      statusColor: 'text-teal-300',
      description: 'Bioglass mineral ceramic beads restoring essential Ca2+, Mg2+, and pH balance.',
      technicalPurpose: 'Controlled Dissolution Post-Mineralizer. Neutralizes acidic permeate (elevating pH from 6.2 to 7.6-8.2) while eluting bioavailable Ca²⁺, Mg²⁺, and mineral trace electrolytes.',
      consumerPurpose: 'Adds back natural, healthy calcium and magnesium minerals that natural filtration removes, enhancing hydration and refreshing taste.',
      engineeringEquation: 'Mineral Elution: ΔTDS = k_diss · (A_beads / Q)  |  Target Permeate pH: 7.4 - 8.2',
      currentStress: `Final Permeate TDS: ${Math.round(outletTds)} ppm | Alkaline Shift: +28 ppm | Negative ORP Antioxidant Profile`,
      maintenance: 'Replace ceramic cartridge after 12 months or when mineralized TDS elevation drops below +15 ppm.'
    }
  ];

  const selectedStageData = stages.find((s) => s.id === activeStage) || stages[3];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-6 relative overflow-hidden">
      
      {/* ----------------------------------------------------------------- */}
      {/* Header Bar */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 text-lg shadow-inner">
            🔬
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Interactive Serial Filtration Schematic
              </h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                5-Stage Decoupled Flow
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any stage to inspect real-time fluidic stress metrics, physics equations, and edge diagnostics.
            </p>
          </div>
        </div>

        {/* Mode Tag */}
        <div className="flex items-center space-x-2 self-start sm:self-center">
          <span className="text-xs text-slate-400 font-mono">Profile:</span>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400 uppercase">
            {mode === 'consumer' ? '📱 Consumer Safe' : mode === 'fleet' ? '🏢 Fleet OEM Grid' : '🛠️ Virtual HIL Hardware'}
          </span>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5-Stage Serial Schematic Card Row */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {stages.map((stage) => {
            const isSelected = activeStage === stage.id;

            return (
              <div
                key={stage.id}
                onClick={() => handleStageClick(stage.id)}
                className={`relative rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 border ${
                  isSelected
                    ? 'bg-slate-950 border-cyan-400 ring-2 ring-cyan-400/80 shadow-xl shadow-cyan-500/20 scale-[1.02]'
                    : 'bg-slate-950/80 hover:bg-slate-950 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Stage Header */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-5 h-5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-slate-300 flex items-center justify-center">
                      {stage.stepNumber}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${stage.badgeColor}`}>
                      {stage.badge}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-xl">{stage.icon}</span>
                    <div className="leading-tight">
                      <div className="text-xs font-bold text-white">{stage.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{stage.subtitle}</div>
                    </div>
                  </div>
                </div>

                {/* Key Real-Time Telemetry Readout */}
                <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                    <span>{stage.keyMetricLabel}</span>
                  </div>
                  <div className="text-xs font-bold font-mono text-cyan-300">
                    {stage.keyMetricValue}
                  </div>
                  <div className={`text-[10px] font-semibold flex items-center space-x-1 ${stage.statusColor}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    <span>{stage.statusIndicator}</span>
                  </div>
                </div>

                {/* Bottom Click Hint */}
                <div className="text-center pt-1 border-t border-slate-800/60">
                  <span className={`text-[10px] font-mono font-semibold ${isSelected ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {isSelected ? '● Selected Stage' : '○ Click to Inspect'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Diagnostic Lens Expanded Drawer */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-slate-950 border border-cyan-800/60 rounded-xl p-5 shadow-2xl relative overflow-hidden transition-all">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-4 relative z-10">
          {/* Drawer Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="flex items-center space-x-2.5">
              <span className="text-2xl">{selectedStageData.icon}</span>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-white tracking-wide">
                    Diagnostic Lens: {selectedStageData.name}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Stage {selectedStageData.stepNumber} of 5
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {selectedStageData.subtitle}
                </div>
              </div>
            </div>

            <div className="text-xs font-mono text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-center">
              Active Status: <span className={selectedStageData.statusColor}>{selectedStageData.statusIndicator}</span>
            </div>
          </div>

          {/* Mode-Adaptive Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Box 1: Functional Purpose & Fluidic Role */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <span>🎯</span>
                <span>{mode === 'consumer' ? 'What This Filter Does' : 'Fluidic Decoupling Role'}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {mode === 'consumer' ? selectedStageData.consumerPurpose : selectedStageData.technicalPurpose}
              </p>
              <div className="text-[11px] text-cyan-400 font-mono pt-1">
                {selectedStageData.description}
              </div>
            </div>

            {/* Box 2: Real-time Fluidic Stress & Dynamics */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <span>⚡</span>
                <span>Current Operating Stress</span>
              </div>
              <div className="text-xs font-mono text-cyan-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                {selectedStageData.currentStress}
              </div>
              {mode !== 'consumer' && (
                <div className="text-[10px] font-mono text-slate-400 pt-1">
                  Transducer: <span className="text-slate-200">{selectedStageData.keyMetricLabel}</span> = <span className="text-amber-400 font-bold">{selectedStageData.keyMetricValue}</span>
                </div>
              )}
            </div>

            {/* Box 3: Physics Equation or Consumer Health */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <span>{mode === 'consumer' ? '🛡️' : '📐'}</span>
                <span>{mode === 'consumer' ? 'Safe Health Guideline' : 'Governing Physics Equation'}</span>
              </div>
              
              {mode === 'consumer' ? (
                <div className="text-xs text-emerald-300 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-900/60 leading-relaxed">
                  {selectedStageData.maintenance}
                </div>
              ) : (
                <div className="text-[11px] font-mono text-amber-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  {selectedStageData.engineeringEquation}
                </div>
              )}

              <div className="text-[11px] text-slate-400">
                Maintenance: <span className="text-slate-300">{selectedStageData.maintenance}</span>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}

export default InteractivePurifierIllustration;
