import React from 'react';

/**
 * ConsumerView: Intuitive D2C Consumer Mobile Application Interface
 * Styled in an elegant White and Olive palette matching the brand reference image.
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
      <div className="bg-white border border-[#DCE4D6] rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
        
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#E3E9DE] gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl">💧</span>
              <h2 className="text-lg font-bold text-[#2A3525] tracking-tight">Atomberg Home Purifier #0042</h2>
            </div>
            <p className="text-xs text-[#6C7E66] mt-0.5">
              Syncing with Bhopal Smart City Water Grid | Firmware v2.4-HIL
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center px-3.5 py-1.5 rounded-full bg-[#EAEFE5] border border-[#BACAB3] text-[#3E4D37] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#6C8360] animate-pulse"></span>
            <span>Pure & Safe Drinking Water</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Prominent RUL Countdown Card: Olive Hero Banner */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-[#849C77] text-white p-6 sm:p-7 rounded-2xl border border-[#6E8562] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80 font-mono">
                Remaining Useful Life Forecast
              </span>
              <div className="flex items-baseline space-x-2.5 mt-1.5">
                <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                  {rulDays}
                </span>
                <span className="text-base font-bold text-white/90">
                  Safe Drinking Days Left
                </span>
              </div>
              <p className="text-xs text-white/80 mt-1 font-mono">
                (±5 Day Accuracy | Projected Maintenance: {formattedDate})
              </p>
            </div>

            {/* Circular Mini Dial / TDS Stat */}
            <div className="bg-white/20 backdrop-blur p-4 rounded-xl border border-white/25 text-center flex-shrink-0">
              <div className="text-[10px] text-white/80 uppercase tracking-wider font-semibold">Filtered Purity</div>
              <div className="text-2xl font-bold font-mono text-white mt-0.5">{outletTds} <span className="text-xs text-white/70 font-normal">ppm</span></div>
              <div className="text-[10px] text-white/90 font-medium mt-0.5">Alkaline Balanced (pH 7.8)</div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Doorstep Replenishment Banner (State-Driven) */}
        {/* ----------------------------------------------------------------- */}
        {autoDispatch ? (
          <div className="p-4 rounded-2xl bg-[#EAEFE5] border border-[#BACAB3] shadow-sm space-y-3 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#BACAB3] flex items-center justify-center text-xl shadow-inner">
                📦
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#2A3525]">
                  Automated Doorstep Replenishment Active
                </h3>
                <p className="text-xs text-[#54684A]">
                  Cartridge en route via Atomberg D2C Logistics (Estimated Delivery in 3 days). Zero manual intervention required.
                </p>
              </div>
            </div>

            {/* Tracking Progress Bar */}
            <div className="bg-white p-3 rounded-xl border border-[#BACAB3]/60 space-y-2">
              <div className="flex justify-between text-[11px] font-mono text-[#3E4D37]">
                <span>1. Predictive Trigger (OK)</span>
                <span className="font-bold text-[#2A3525]">2. Dispatched (In Transit)</span>
                <span className="text-[#788870]">3. Delivery</span>
              </div>
              <div className="w-full bg-[#EAEFE5] h-2 rounded-full overflow-hidden">
                <div className="bg-[#6C8360] h-full rounded-full w-2/3"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-[#FAFBF8] border border-[#DCE4D6] flex items-center space-x-3.5 text-[#54684A]">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#DCE4D6] flex items-center justify-center text-lg text-[#54684A] shadow-sm">
              🛡️
            </div>
            <div>
              <div className="text-xs font-semibold text-[#2A3525]">D2C Auto-Replenishment on Standby</div>
              <div className="text-[11px] text-[#6C7E66]">
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
            <span className="text-xs font-bold text-[#54684A] uppercase tracking-wider flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#849C77]"></span>
              <span>4-Stage Decoupled Filter Health</span>
            </span>
            <span className="text-[11px] text-[#54684A] font-mono bg-[#EAEFE5] px-2.5 py-0.5 rounded border border-[#BACAB3]">
              Physics-Informed Real-Time
            </span>
          </div>

          <div className="space-y-3">
            {/* Stage 1: Pre-Sediment Filter */}
            <div className="p-4 bg-[#FAFBF8] rounded-xl border border-[#DCE4D6] shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-[#FAF5EB] text-[#826947] border border-[#DFD3BE] flex items-center justify-center font-bold text-[10px]">
                    1
                  </span>
                  <span className="font-bold text-[#2A3525]">Stage 1: Pre-Sediment Filter</span>
                </div>
                <span className="font-mono font-bold text-[#2A3525]">{sedimentHealth}%</span>
              </div>
              <div className="w-full bg-[#EAEFE5] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-[#849C77]"
                  style={{ width: `${sedimentHealth}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-[#6C7E66]">
                Captures suspended micro-particulates, silt, rust & sand. Prevents abrasive wear on the booster pump.
              </p>
            </div>

            {/* Stage 2: Activated Carbon Block */}
            <div className="p-4 bg-[#FAFBF8] rounded-xl border border-[#DCE4D6] shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-[#FAF5EB] text-[#826947] border border-[#DFD3BE] flex items-center justify-center font-bold text-[10px]">
                    2
                  </span>
                  <span className="font-bold text-[#2A3525]">Stage 2: Activated Carbon Block</span>
                </div>
                <span className="font-mono font-bold text-[#2A3525]">{carbonHealth}%</span>
              </div>
              <div className="w-full bg-[#EAEFE5] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-[#849C77]"
                  style={{ width: `${carbonHealth}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-[#6C7E66]">
                Adsorbs volatile organic compounds (VOCs), residual chlorine, pesticides & eliminates unpleasant odors.
              </p>
            </div>

            {/* Stage 3: RO Membrane Core */}
            <div className="p-4 bg-[#FAFBF8] rounded-xl border border-[#DCE4D6] shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3] flex items-center justify-center font-bold text-[10px]">
                    3
                  </span>
                  <span className="font-bold text-[#2A3525]">Stage 3: RO Membrane Core</span>
                </div>
                <div className="font-mono text-xs">
                  <span className="text-[#2A3525] font-bold">{roHealth}%</span>
                  <span className="text-[#6C7E66] ml-1.5">({saltRejection}% Salt Rejection)</span>
                </div>
              </div>
              <div className="w-full bg-[#EAEFE5] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-[#6C8360]"
                  style={{ width: `${roHealth}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-[#6C7E66]">
                0.0001-micron thin-film composite eliminating heavy metals, arsenic, lead, fluorides & microbiological pathogens.
              </p>
            </div>

            {/* Stage 4: Alkaline Post-Mineralizer */}
            <div className="p-4 bg-[#FAFBF8] rounded-xl border border-[#DCE4D6] shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3] flex items-center justify-center font-bold text-[10px]">
                    4
                  </span>
                  <span className="font-bold text-[#2A3525]">Stage 4: Alkaline Post-Mineralizer</span>
                </div>
                <span className="font-mono font-bold text-[#2A3525]">{alkaliserHealth}%</span>
              </div>
              <div className="w-full bg-[#EAEFE5] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-[#6C8360]"
                  style={{ width: `${alkaliserHealth}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-[#6C7E66]">
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
