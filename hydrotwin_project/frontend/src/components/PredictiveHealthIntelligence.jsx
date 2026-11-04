import React from 'react';

/**
 * PredictiveHealthIntelligence
 * 
 * Machine Learning Remaining Useful Life (RUL) & Prognostics Intelligence Center.
 * Supports mode-adaptive styling:
 * - 'consumer': Clean White & Olive brand theme matching Atomberg design language.
 * - 'hil' / 'fleet': High-contrast dark instrument styling for embedded engineering.
 * 100% SVG iconography (zero cartoon emojis/images).
 * 
 * Props:
 * - telemetry: Real-time digital twin telemetry packet from WebSocket
 * - mode: 'hil' | 'consumer' | 'fleet' (Defaults to 'hil')
 */
function PredictiveHealthIntelligence({ telemetry = null, mode = 'hil' }) {
  const isConsumer = mode === 'consumer';

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
    <div
      className={
        isConsumer
          ? 'bg-white border border-[#DCE4D6] rounded-3xl p-6 sm:p-7 shadow-sm space-y-6'
          : 'bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-6 relative overflow-hidden'
      }
    >
      {/* ----------------------------------------------------------------- */}
      {/* Header with RUL Counter Badge */}
      {/* ----------------------------------------------------------------- */}
      <div
        className={`flex flex-col lg:flex-row lg:items-center justify-between pb-5 gap-4 ${
          isConsumer ? 'border-b border-[#E3E9DE]' : 'border-b border-slate-800'
        }`}
      >
        {/* Left: Model Tag & Title */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-base font-black tracking-tight flex items-center space-x-2 ${
                isConsumer ? 'text-[#142010]' : 'text-white'
              }`}
            >
              <svg className={`w-4 h-4 ${isConsumer ? 'text-[#384828]' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Predictive Health & Remaining Useful Life (PHM)</span>
            </h3>
            <span
              className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                isConsumer
                  ? 'bg-[#EAEFE5] text-[#142010] border-[#BACAB3]'
                  : 'bg-cyan-950 text-cyan-300 border-cyan-800/80'
              }`}
            >
              Weibull + XGBoost Survival Regressor (±5 Day Precision)
            </span>
          </div>
          <p className={`text-xs ${isConsumer ? 'text-[#1F2D19] font-medium' : 'text-slate-400'}`}>
            Coupled machine learning survival analysis trained on multi-stage hydraulic degradation trajectories.
          </p>
        </div>

        {/* Right: Prominent RUL Counter Badge */}
        <div
          className={`flex items-center space-x-3 px-4 py-2 rounded-xl border shadow-inner self-start lg:self-center ${
            isConsumer
              ? 'bg-[#FAFBF8] border-[#BACAB3]'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="text-right">
            <div
              className={`text-[10px] font-mono uppercase tracking-wider font-black ${
                isConsumer ? 'text-[#142010]' : 'text-slate-400'
              }`}
            >
              Forecasted Window
            </div>
            <div
              className={`text-xs font-mono font-bold ${
                isConsumer ? 'text-[#142010]' : 'text-emerald-400'
              }`}
            >
              Est. Swap: {formattedProjectedDate}
            </div>
          </div>
          <div className={`h-8 w-px ${isConsumer ? 'bg-[#BACAB3]' : 'bg-slate-800'}`}></div>
          <div className="flex items-baseline space-x-1.5">
            <span
              className={`text-3xl font-black font-mono tracking-tight ${
                isConsumer ? 'text-[#142010]' : 'text-white'
              }`}
            >
              {rulDays}
            </span>
            <span
              className={`text-xs font-black font-mono ${
                isConsumer ? 'text-[#142010]' : 'text-cyan-400'
              }`}
            >
              DAYS RUL
            </span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Automated D2C Replenishment Logistics Alert Banner */}
      {/* ----------------------------------------------------------------- */}
      {autoDispatch || rulDays <= 14 ? (
        <div
          className={`p-4 sm:p-5 rounded-2xl border space-y-3 animate-pulse-subtle ${
            isConsumer
              ? 'bg-[#EAEFE5] border-[#BACAB3] shadow-sm'
              : 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/70 border-emerald-600/70 shadow-xl shadow-emerald-950/40'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md ${
                  isConsumer
                    ? 'bg-white border border-[#BACAB3] text-[#2A3525]'
                    : 'bg-emerald-900/90 border border-emerald-500/60 shadow-emerald-950/50'
                }`}
              >
                <svg className="w-5 h-5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4
                    className={`text-sm font-bold tracking-wide ${
                      isConsumer ? 'text-[#2A3525]' : 'text-emerald-300'
                    }`}
                  >
                    Automated Doorstep Replenishment Active
                  </h4>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      isConsumer
                        ? 'bg-[#384828] text-white border-[#1F2D19]'
                        : 'bg-emerald-900 text-emerald-200 border-emerald-600'
                    }`}
                  >
                    Auto-Dispatch Triggered
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${isConsumer ? 'text-[#1F2D19] font-medium' : 'text-slate-300'}`}>
                  {isConsumer
                    ? 'Custom replacement cartridge dispatched via Atomberg D2C Logistics. Delivery in 3 business days.'
                    : `ERP Reorder Triggered for Device #ATOM-WP-2026-0042. Consignment hub: Central Logistics Hub (Bottleneck: ${failingStage}).`}
                </p>
              </div>
            </div>

            <div
              className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border shrink-0 self-start sm:self-center ${
                isConsumer
                  ? 'bg-white text-[#142010] border-[#BACAB3]'
                  : 'text-emerald-300 bg-emerald-950/80 border-emerald-700/80'
              }`}
            >
              Target: 3 Business Days
            </div>
          </div>

          {/* Logistics Progress Pipeline */}
          <div
            className={`p-3 rounded-xl border space-y-1.5 ${
              isConsumer
                ? 'bg-white border-[#BACAB3]'
                : 'bg-slate-950/90 border-emerald-900/50'
            }`}
          >
            <div
              className={`flex justify-between text-xs font-mono ${
                isConsumer ? 'text-[#142010] font-bold' : 'text-emerald-400'
              }`}
            >
              <span>1. AI Wear Trigger (RUL ≤ 14d)</span>
              <span className={`font-black ${isConsumer ? 'text-[#142010]' : 'text-emerald-300'}`}>
                2. Dispatched (In Transit)
              </span>
              <span className={isConsumer ? 'text-[#142010] font-bold' : 'text-slate-500'}>
                3. Doorstep Delivery
              </span>
            </div>
            <div
              className={`w-full h-2 rounded-full overflow-hidden border ${
                isConsumer
                  ? 'bg-[#EAEFE5] border-[#BACAB3]'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isConsumer
                    ? 'bg-[#182514] w-2/3'
                    : 'bg-gradient-to-r from-teal-500 to-emerald-400 w-2/3'
                }`}
              ></div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            isConsumer
              ? 'bg-[#FAFBF8] border-[#BACAB3] text-[#142010]'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg ${
                isConsumer
                  ? 'bg-white border-[#BACAB3] text-[#142010] shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <svg className="w-4 h-4 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div
                className={`text-xs font-black ${
                  isConsumer ? 'text-[#142010]' : 'text-slate-300'
                }`}
              >
                Replenishment Logistics on Standby
              </div>
              <div className={`text-xs ${isConsumer ? 'text-[#1F2D19] font-medium' : 'text-slate-400'}`}>
                All 4 filtration stages operating safely within nominal degradation boundaries. Automated doorstep delivery initiates automatically when RUL reaches ≤ 14 days.
              </div>
            </div>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded border shrink-0 hidden sm:inline ${
              isConsumer
                ? 'bg-[#EAEFE5] text-[#142010] border-[#BACAB3]'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            Status: Standby
          </span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4-Card Multi-Stage Degradation Grid */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${
              isConsumer ? 'text-[#142010]' : 'text-slate-400'
            }`}
          >
            <svg className="w-3.5 h-3.5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Multi-Stage Hydraulic Degradation Matrix</span>
          </span>
          <span className={`text-[10px] font-mono ${isConsumer ? 'text-[#142010] font-bold' : 'text-slate-400'}`}>
            Continuous Darcy-Hermia Estimators
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Pre-Filter Suction Choke */}
          <div
            className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
              isConsumer
                ? 'bg-[#FAFBF8] border-[#DCE4D6] shadow-sm'
                : 'bg-slate-950 border-slate-800 shadow-md'
            }`}
          >
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span
                  className={`font-black flex items-center space-x-1.5 ${
                    isConsumer ? 'text-[#142010]' : 'text-slate-300'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span>Pre-Filter Choke</span>
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    sedimentLoadPct > 75
                      ? 'bg-rose-100 text-rose-900 border border-rose-300'
                      : sedimentLoadPct > 40
                      ? 'bg-amber-100 text-amber-950 border border-amber-300'
                      : isConsumer
                      ? 'bg-[#EAEFE5] text-[#142010] border border-[#BACAB3]'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {sedimentLoadPct > 75 ? 'Critical' : sedimentLoadPct > 40 ? 'Loaded' : 'Nominal'}
                </span>
              </div>
              <p className={`text-xs ${isConsumer ? 'text-[#1F2D19] font-medium' : 'text-slate-400'}`}>
                Suction vacuum head resistance (silt & rust capture).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span
                  className={`text-xl font-black tracking-tight ${
                    isConsumer ? 'text-[#142010]' : 'text-white'
                  }`}
                >
                  {rSediment.toFixed(2)}
                </span>
                <span className={`text-xs ${isConsumer ? 'text-[#142010] font-bold' : 'text-slate-400'}`}>
                  kPa·s/L (Limit: 1.80)
                </span>
              </div>
              <div
                className={`w-full h-2 rounded-full overflow-hidden border ${
                  isConsumer
                    ? 'bg-[#EAEFE5] border-[#DCE4D6]'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sedimentLoadPct > 75
                      ? 'bg-rose-500'
                      : sedimentLoadPct > 40
                      ? 'bg-amber-500'
                      : isConsumer
                      ? 'bg-[#384828]'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${sedimentLoadPct}%` }}
                />
              </div>
              <div
                className={`flex justify-between text-xs font-mono font-bold pt-0.5 ${
                  isConsumer ? 'text-[#1F2D19]' : 'text-slate-500'
                }`}
              >
                <span>0.35 Clean</span>
                <span>{Math.round(sedimentLoadPct)}% Load</span>
                <span>1.80 Choke</span>
              </div>
            </div>
          </div>

          {/* Card 2: Membrane Cake Scaling */}
          <div
            className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
              isConsumer
                ? 'bg-[#FAFBF8] border-[#BACAB3] shadow-sm'
                : 'bg-slate-950 border-slate-800 shadow-md'
            }`}
          >
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span
                  className={`font-black flex items-center space-x-1.5 ${
                    isConsumer ? 'text-[#142010]' : 'text-slate-300'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
                  </svg>
                  <span>Membrane Cake Scaling</span>
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    cakeLoadPct > 70
                      ? 'bg-rose-100 text-rose-900 border border-rose-300'
                      : cakeLoadPct > 40
                      ? 'bg-amber-100 text-amber-950 border border-amber-300'
                      : isConsumer
                      ? 'bg-[#EAEFE5] text-[#142010] border border-[#BACAB3]'
                      : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}
                >
                  {cakeLoadPct > 70 ? 'Fouled' : cakeLoadPct > 40 ? 'Scaling' : 'Clean'}
                </span>
              </div>
              <p className={`text-xs ${isConsumer ? 'text-[#1F2D19] font-medium' : 'text-slate-400'}`}>
                Boundary layer colloidal deposition on TFC surface.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span
                  className={`text-xl font-black tracking-tight ${
                    isConsumer ? 'text-[#142010]' : 'text-cyan-400'
                  }`}
                >
                  {rCake.toFixed(2)}
                </span>
                <span className={`text-xs ${isConsumer ? 'text-[#142010] font-bold' : 'text-slate-400'}`}>
                  kPa·s/L (Limit: 1.40)
                </span>
              </div>
              <div
                className={`w-full h-2 rounded-full overflow-hidden border ${
                  isConsumer
                    ? 'bg-[#EAEFE5] border-[#DCE4D6]'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cakeLoadPct > 70
                      ? 'bg-rose-500'
                      : cakeLoadPct > 40
                      ? 'bg-amber-500'
                      : isConsumer
                      ? 'bg-[#384828]'
                      : 'bg-cyan-500'
                  }`}
                  style={{ width: `${cakeLoadPct}%` }}
                />
              </div>
              <div
                className={`flex justify-between text-xs font-mono font-bold pt-0.5 ${
                  isConsumer ? 'text-[#1F2D19]' : 'text-slate-500'
                }`}
              >
                <span>0.05 Clean</span>
                <span>{Math.round(cakeLoadPct)}% Scaled</span>
                <span>1.40 Limit</span>
              </div>
            </div>
          </div>

          {/* Card 3: Osmotic Salt Barrier */}
          <div
            className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
              isConsumer
                ? 'bg-[#FAFBF8] border-[#BACAB3] shadow-sm'
                : 'bg-slate-950 border-slate-800 shadow-md'
            }`}
          >
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span
                  className={`font-black flex items-center space-x-1.5 ${
                    isConsumer ? 'text-[#142010]' : 'text-slate-300'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span>Osmotic Salt Barrier</span>
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    saltRejection >= 95.0
                      ? isConsumer
                        ? 'bg-[#EAEFE5] text-[#142010] border border-[#BACAB3]'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : saltRejection >= 90.0
                      ? 'bg-amber-100 text-amber-950 border border-amber-300'
                      : 'bg-rose-100 text-rose-900 border border-rose-300 animate-pulse'
                  }`}
                >
                  {saltRejection >= 95.0 ? 'Optimal' : saltRejection >= 90.0 ? 'Permeable' : 'Breach'}
                </span>
              </div>
              <p className={`text-xs ${isConsumer ? 'text-[#1F2D19] font-medium' : 'text-slate-400'}`}>
                Mineral & heavy salt cross-flow rejection ratio (η).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span
                  className={`text-xl font-black tracking-tight ${
                    isConsumer ? 'text-[#142010]' : 'text-emerald-400'
                  }`}
                >
                  {saltRejection.toFixed(1)}%
                </span>
                <span className={`text-xs ${isConsumer ? 'text-[#142010] font-bold' : 'text-slate-400'}`}>
                  {Math.round(inletTds)} → {Math.round(outletTds)} ppm
                </span>
              </div>
              <div
                className={`w-full h-2 rounded-full overflow-hidden border ${
                  isConsumer
                    ? 'bg-[#EAEFE5] border-[#DCE4D6]'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    saltRejection >= 95.0
                      ? isConsumer
                        ? 'bg-[#384828]'
                        : 'bg-emerald-500'
                      : saltRejection >= 90.0
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${rejectionPct}%` }}
                />
              </div>
              <div
                className={`flex justify-between text-xs font-mono font-bold pt-0.5 ${
                  isConsumer ? 'text-[#1F2D19]' : 'text-slate-500'
                }`}
              >
                <span>90% Cutoff</span>
                <span>Target ≥ 95%</span>
                <span>100% Ideal</span>
              </div>
            </div>
          </div>

          {/* Card 4: Fouling Rate Slope (dR/dt) */}
          <div
            className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between ${
              isConsumer
                ? 'bg-[#FAFBF8] border-[#BACAB3] shadow-sm'
                : 'bg-slate-950 border-slate-800 shadow-md'
            }`}
          >
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span
                  className={`font-black flex items-center space-x-1.5 ${
                    isConsumer ? 'text-[#142010]' : 'text-slate-300'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span>Fouling Rate (dR/dt)</span>
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    isConsumer
                      ? 'bg-[#EAEFE5] text-[#142010] border border-[#BACAB3]'
                      : 'bg-purple-950 text-purple-300 border border-purple-800'
                  }`}
                >
                  Hermia Slope
                </span>
              </div>
              <p className={`text-xs ${isConsumer ? 'text-[#1F2D19] font-medium' : 'text-slate-400'}`}>
                Hermia cake pore-blocking acceleration per operating hour.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs font-mono">
                <span
                  className={`text-xl font-black tracking-tight ${
                    isConsumer ? 'text-[#142010]' : 'text-purple-400'
                  }`}
                >
                  +{drDt.toFixed(4)}
                </span>
                <span className={`text-xs ${isConsumer ? 'text-[#142010] font-bold' : 'text-slate-400'}`}>
                  kPa·s/(L·h)
                </span>
              </div>
              <div
                className={`w-full h-2 rounded-full overflow-hidden border ${
                  isConsumer
                    ? 'bg-[#EAEFE5] border-[#DCE4D6]'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isConsumer
                      ? 'bg-[#384828]'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                  }`}
                  style={{ width: `${slopeLoadPct}%` }}
                />
              </div>
              <div
                className={`flex justify-between text-xs font-mono font-bold pt-0.5 ${
                  isConsumer ? 'text-[#1F2D19]' : 'text-slate-500'
                }`}
              >
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
