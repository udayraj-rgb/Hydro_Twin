import React from 'react';

/**
 * PredictiveHealthIntelligence
 * 
 * Machine Learning Remaining Useful Life (RUL) & Prognostics Intelligence Center.
 * Features:
 * 1. RUL counter badge with Weibull + XGBoost Survival Regressor tag
 * 2. Automated D2C Replenishment Logistics Alert (State & Mode-Adaptive)
 * 3. 4-Card Multi-Stage Degradation Grid with dynamic physical loading progress bars:
 *    - Pre-Filter Suction Choke (R_sediment vacuum load)
 *    - Membrane Cake Scaling (R_cake boundary layer deposition)
 *    - Osmotic Salt Barrier (Salt rejection η %)
 *    - Fouling Rate Slope (Hermia cake-blocking dR/dt acceleration)
 * 
 * Props:
 * - telemetry: Real-time digital twin telemetry packet from WebSocket
 * - mode: 'hil' | 'consumer' | 'fleet' (Defaults to 'hil')
 */
function PredictiveHealthIntelligence({ telemetry = null, mode = 'hil' }) {
  // ---------------------------------------------------------------------------
  // Prognostics & Physical Telemetry Extraction with Industrial Fallbacks
  // ---------------------------------------------------------------------------
  const rulDays = Number(telemetry?.prognostics?.rul_days ?? telemetry?.rul_days ?? 34);
  const autoDispatch = Boolean(telemetry?.prognostics?.auto_dispatch ?? telemetry?.auto_dispatch ?? (rulDays <= 14));
  const failingStage = telemetry?.prognostics?.failing_stage || (rulDays <= 14 ? 'RO' : 'NONE');

  const rSediment = Number(telemetry?.physics?.r_sediment ?? telemetry?.r_sediment ?? 0.60);
  const rCake = Number(telemetry?.physics?.r_cake ?? telemetry?.r_cake ?? 0.18);
  const saltRejection = Number(telemetry?.physics?.salt_rejection ?? telemetry?.salt_rejection ?? 95.2);
  const drDt = Number(telemetry?.physics?.dr_dt ?? 0.0142);

  const inletTds = Number(telemetry?.sensors?.inlet_tds ?? telemetry?.inlet_tds ?? 850);
  const outletTds = Number(telemetry?.sensors?.outlet_tds ?? telemetry?.physics?.outlet_tds ?? telemetry?.outlet_tds ?? 42);

  // Projected replacement calendar date
  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + rulDays);
  const formattedProjectedDate = projectedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // ---------------------------------------------------------------------------
  // Dynamic Mathematical Loading Calculations for Progress Bars
  // ---------------------------------------------------------------------------
  // 1. Sediment Choke Load: Clean base 0.35 to Choke limit 1.80 kPa·s/L
  const sedimentLoadPct = Math.min(Math.max(((rSediment - 0.35) / (1.80 - 0.35)) * 100, 0), 100);

  // 2. Membrane Cake Deposition: Clean base 0.05 to Critical scale 1.40 kPa·s/L
  const cakeLoadPct = Math.min(Math.max(((rCake - 0.05) / (1.40 - 0.05)) * 100, 0), 100);

  // 3. Salt Rejection Efficiency: Target 95%, Critical breach < 90%
  const rejectionPct = Math.min(Math.max(saltRejection, 0), 100);

  // 4. Fouling Acceleration Slope: Nominal 0.005 to Extreme 0.035 kPa·s/(L·h)
  const slopeLoadPct = Math.min(Math.max((drDt / 0.0350) * 100, 0), 100);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-6 relative overflow-hidden">
      
      {/* ----------------------------------------------------------------- */}
      {/* Header with RUL Counter Badge */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-800 gap-4">
        
        {/* Left: Model Tag & Title */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <span className="text-emerald-400">🧠</span>
              <span>Predictive Health & Remaining Useful Life (PHM)</span>
            </h3>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/80">
              Weibull + XGBoost Survival Regressor (±5 Day Precision)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Coupled machine learning survival analysis trained on multi-stage hydraulic degradation trajectories.
          </p>
        </div>

        {/* Right: Prominent RUL Counter Badge */}
        <div className="flex items-center space-x-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 shadow-inner self-start lg:self-center">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Forecasted Window
            </div>
            <div className="text-xs font-mono text-emerald-400 font-bold">
              Est. Swap: {formattedProjectedDate}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-black font-mono tracking-tight text-white">
              {rulDays}
            </span>
            <span className="text-xs font-bold text-cyan-400 font-mono">
              DAYS RUL
            </span>
          </div>
        </div>

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Automated D2C Replenishment Logistics Alert Banner */}
      {/* ----------------------------------------------------------------- */}
      {autoDispatch || rulDays <= 14 ? (
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/70 border border-emerald-600/70 shadow-xl shadow-emerald-950/40 space-y-3 animate-pulse-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-900/90 border border-emerald-500/60 flex items-center justify-center text-xl shadow-md shadow-emerald-950/50">
                📦
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-emerald-300 tracking-wide">
                    Automated Doorstep Replenishment Active
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-200 border border-emerald-600">
                    Auto-Dispatch Triggered
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {mode === 'consumer'
                    ? 'Custom replacement cartridge dispatched via Atomberg D2C Logistics. Delivery in 3 business days.'
                    : `ERP Reorder Triggered for Device #ATOM-WP-2026-0042. Consignment hub: Central Logistics Hub (Bottleneck: ${failingStage}).`}
                </p>
              </div>
            </div>

            <div className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-700/80 shrink-0 self-start sm:self-center">
              Target: 3 Business Days
            </div>
          </div>

          {/* Logistics Progress Pipeline */}
          <div className="bg-slate-950/90 p-3 rounded-lg border border-emerald-900/50 space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-emerald-400">
              <span>1. AI Wear Trigger (RUL ≤ 14d)</span>
              <span className="font-bold text-emerald-300">2. Dispatched (In Transit)</span>
              <span className="text-slate-500">3. Doorstep Delivery</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full w-2/3 transition-all duration-1000"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 text-slate-400">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg text-slate-400">
              🛡️
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-300">
                Replenishment Logistics on Standby
              </div>
              <div className="text-[11px] text-slate-400">
                All 4 filtration stages operating safely within nominal degradation boundaries. Automated doorstep delivery initiates automatically when RUL reaches ≤ 14 days.
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0 hidden sm:inline">
            Status: Standby
          </span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4-Card Multi-Stage Degradation Grid */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <span>📊</span>
            <span>Multi-Stage Hydraulic Degradation Matrix</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Continuous Darcy-Hermia Estimators
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Pre-Filter Suction Choke */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-md space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                  <span>🚰</span>
                  <span>Pre-Filter Choke</span>
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  sedimentLoadPct > 75 ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                  sedimentLoadPct > 40 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  {sedimentLoadPct > 75 ? 'Critical' : sedimentLoadPct > 40 ? 'Loaded' : 'Nominal'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Suction vacuum head resistance (silt & rust capture).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span className="text-xl font-bold text-white tracking-tight">{rSediment.toFixed(2)}</span>
                <span className="text-[11px] text-slate-400">kPa·s/L (Limit: 1.80)</span>
              </div>
              {/* Dynamic Loading Progress Bar */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sedimentLoadPct > 75 ? 'bg-rose-500' : sedimentLoadPct > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${sedimentLoadPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>0.35 Clean</span>
                <span>{Math.round(sedimentLoadPct)}% Load</span>
                <span>1.80 Choke</span>
              </div>
            </div>
          </div>

          {/* Card 2: Membrane Cake Scaling */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-md space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                  <span>🌀</span>
                  <span>Membrane Cake Scaling</span>
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  cakeLoadPct > 70 ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                  cakeLoadPct > 40 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-cyan-950 text-cyan-300 border border-cyan-800'
                }`}>
                  {cakeLoadPct > 70 ? 'Fouled' : cakeLoadPct > 40 ? 'Scaling' : 'Clean'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Boundary layer colloidal deposition on TFC surface.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span className="text-xl font-bold text-cyan-400 tracking-tight">{rCake.toFixed(2)}</span>
                <span className="text-[11px] text-slate-400">kPa·s/L (Limit: 1.40)</span>
              </div>
              {/* Dynamic Scaling Progress Bar */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cakeLoadPct > 70 ? 'bg-rose-500' : cakeLoadPct > 40 ? 'bg-amber-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${cakeLoadPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>0.05 Clean</span>
                <span>{Math.round(cakeLoadPct)}% Scaled</span>
                <span>1.40 Limit</span>
              </div>
            </div>
          </div>

          {/* Card 3: Osmotic Salt Barrier */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-md space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                  <span>💧</span>
                  <span>Osmotic Salt Barrier</span>
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  saltRejection >= 95.0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  saltRejection >= 90.0 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                }`}>
                  {saltRejection >= 95.0 ? 'Optimal' : saltRejection >= 90.0 ? 'Permeable' : 'Breach'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Mineral & heavy salt cross-flow rejection ratio (η).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span className="text-xl font-bold text-emerald-400 tracking-tight">{saltRejection.toFixed(1)}%</span>
                <span className="text-[11px] text-slate-400">{Math.round(inletTds)} → {Math.round(outletTds)} ppm</span>
              </div>
              {/* Rejection Progress Bar */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    saltRejection >= 95.0 ? 'bg-emerald-500' : saltRejection >= 90.0 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${rejectionPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>90% Cutoff</span>
                <span>Target ≥ 95%</span>
                <span>100% Ideal</span>
              </div>
            </div>
          </div>

          {/* Card 4: Fouling Rate Slope (dR/dt) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-md space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                  <span>📈</span>
                  <span>Fouling Rate (dR/dt)</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  Hermia Slope
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Hermia cake pore-blocking acceleration per operating hour.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span className="text-xl font-bold text-purple-400 tracking-tight">+{drDt.toFixed(4)}</span>
                <span className="text-[11px] text-slate-400">kPa·s/(L·h)</span>
              </div>
              {/* Slope Acceleration Progress Bar */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${slopeLoadPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>0.0000 Base</span>
                <span>Acceleration</span>
                <span>0.0350 Max</span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

export default PredictiveHealthIntelligence;
