import React from 'react';

/**
 * ConsumerView: Intuitive D2C Consumer Mobile Application Interface
 * Displays Safe Drinking Water status, RUL countdown, automated D2C cartridge delivery tracking,
 * and 4-stage filter health breakdown.
 */
function ConsumerView({ telemetry = null }) {
  // Extract prognostic and physical telemetry with safe defaults
  const rulDays = telemetry?.prognostics?.rul_days ?? telemetry?.rul_days ?? 34;
  const autoDispatch = telemetry?.prognostics?.auto_dispatch ?? telemetry?.auto_dispatch ?? false;
  const sedimentHealth = telemetry?.prognostics?.sediment_health ?? telemetry?.sediment_health ?? 83.2;
  const carbonHealth = telemetry?.prognostics?.carbon_health ?? telemetry?.carbon_health ?? 84.0;
  const roHealth = telemetry?.prognostics?.ro_health ?? telemetry?.ro_health ?? 98.6;
  const alkaliserHealth = telemetry?.prognostics?.alkaliser_health ?? telemetry?.alkaliser_health ?? 83.3;
  const saltRejection = telemetry?.physics?.salt_rejection ?? telemetry?.salt_rejection ?? 95.1;
  const outletTds = telemetry?.sensors?.outlet_tds ?? telemetry?.outlet_tds ?? 42;

  // Compute projected replacement date
  const replacementDate = new Date();
  replacementDate.setDate(replacementDate.getDate() + rulDays);
  const formattedDate = replacementDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div id="consumer-view" className="max-w-2xl mx-auto space-y-6 animate-fadeIn pb-8">
      {/* ----------------------------------------------------------------- */}
      {/* Mobile-Style Purifier Chassis Card */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl">💧</span>
              <h2 className="text-lg font-bold text-white tracking-tight">Atomberg Home Purifier #0042</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Syncing with Bhopal Smart City Water Grid | Firmware v2.4-HIL
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Pure & Safe Drinking Water</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Prominent RUL Countdown Card */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 p-6 rounded-2xl border border-cyan-800/50 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
                Remaining Useful Life Forecast
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight">
                  {rulDays}
                </span>
                <span className="text-base font-bold text-slate-300">
                  Safe Drinking Days Left
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                (±5 Day Accuracy | Projected Maintenance: {formattedDate})
              </p>
            </div>

            {/* Circular Mini Dial / TDS Stat */}
            <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 text-center flex-shrink-0">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Filtered Purity</div>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">{outletTds} <span className="text-xs text-slate-500 font-normal">ppm</span></div>
              <div className="text-[10px] text-emerald-400 font-medium mt-0.5">Alkaline Balanced (pH 7.8)</div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Doorstep Replenishment Banner (State-Driven) */}
        {/* ----------------------------------------------------------------- */}
        {autoDispatch ? (
          <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-700/80 shadow-lg shadow-emerald-950/50 space-y-3 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-900/80 border border-emerald-600/60 flex items-center justify-center text-xl">
                📦
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-300">
                  Automated Doorstep Replenishment Active
                </h3>
                <p className="text-xs text-emerald-200/90">
                  Cartridge en route via Atomberg D2C Logistics (Estimated Delivery in 3 days). Zero manual intervention required.
                </p>
              </div>
            </div>

            {/* Tracking Progress Bar */}
            <div className="bg-emerald-900/40 p-3 rounded-xl border border-emerald-800/60 space-y-2">
              <div className="flex justify-between text-[11px] font-mono text-emerald-300">
                <span>1. Predictive Trigger (OK)</span>
                <span className="font-bold">2. Dispatched (In Transit)</span>
                <span className="text-emerald-500/70">3. Delivery</span>
              </div>
              <div className="w-full bg-emerald-950 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full w-2/3"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center space-x-3.5 text-slate-400">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg text-slate-400">
              🛡️
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-300">D2C Auto-Replenishment on Standby</div>
              <div className="text-[11px] text-slate-400">
                All 4 filtration stages operating within nominal parameters. Automated dispatch initiates automatically when RUL reaches ≤ 14 days.
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* 4 Stage Health Cards with Progress Bars */}
        {/* ----------------------------------------------------------------- */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span>🔬</span>
              <span>4-Stage Decoupled Filter Health</span>
            </span>
            <span className="text-[11px] text-cyan-400 font-mono">Physics-Informed Real-Time</span>
          </div>

          <div className="space-y-3">
            {/* Stage 1: Pre-Sediment Filter */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/90 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center justify-center font-bold text-[10px]">
                    1
                  </span>
                  <span className="font-bold text-slate-200">Stage 1: Pre-Sediment Filter</span>
                </div>
                <span className="font-mono font-bold text-cyan-400">{sedimentHealth}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sedimentHealth > 60 ? 'bg-cyan-500' : sedimentHealth > 30 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${sedimentHealth}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400">
                Captures suspended micro-particulates, silt, rust & sand. Prevents abrasive wear on the booster pump.
              </p>
            </div>

            {/* Stage 2: Activated Carbon Block */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/90 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-blue-950/80 text-blue-400 border border-blue-800/60 flex items-center justify-center font-bold text-[10px]">
                    2
                  </span>
                  <span className="font-bold text-slate-200">Stage 2: Activated Carbon Block</span>
                </div>
                <span className="font-mono font-bold text-cyan-400">{carbonHealth}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    carbonHealth > 60 ? 'bg-cyan-500' : carbonHealth > 30 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${carbonHealth}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400">
                Adsorbs volatile organic compounds (VOCs), residual chlorine, pesticides & eliminates unpleasant odors.
              </p>
            </div>

            {/* Stage 3: RO Membrane Core */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/90 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 flex items-center justify-center font-bold text-[10px]">
                    3
                  </span>
                  <span className="font-bold text-slate-200">Stage 3: RO Membrane Core</span>
                </div>
                <div className="font-mono text-xs">
                  <span className="text-cyan-400 font-bold">{roHealth}%</span>
                  <span className="text-slate-500 ml-1.5">({saltRejection}% Salt Rejection)</span>
                </div>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    roHealth > 60 ? 'bg-cyan-500' : roHealth > 30 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${roHealth}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400">
                0.0001-micron thin-film composite eliminating heavy metals, arsenic, lead, fluorides & microbiological pathogens.
              </p>
            </div>

            {/* Stage 4: Alkaline Post-Mineralizer */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/90 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center justify-center font-bold text-[10px]">
                    4
                  </span>
                  <span className="font-bold text-slate-200">Stage 4: Alkaline Post-Mineralizer</span>
                </div>
                <span className="font-mono font-bold text-cyan-400">{alkaliserHealth}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    alkaliserHealth > 60 ? 'bg-cyan-500' : alkaliserHealth > 30 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${alkaliserHealth}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400">
                Enriches pure water with essential calcium & magnesium ions, adjusts natural pH balance, and optimizes refreshing taste.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConsumerView;
