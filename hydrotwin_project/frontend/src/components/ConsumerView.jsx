import React, { useState, useEffect, useRef, useCallback } from 'react';
import PredictiveHealthIntelligence from './PredictiveHealthIntelligence';

const BACKEND_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

/**
 * ConsumerView: Interactive Atomberg Intellon Purifier Simulator
 * Designed for AtomQuest 2026 (Track 2: Water Purifier).
 * Styled in an elegant White and Olive palette matching the brand design language.
 * Clean, professional iconography (100% SVG vectors, zero cartoon emojis/images).
 */
function ConsumerView({ telemetry = null }) {
  // ---------------------------------------------------------------------------
  // Interactive Simulator Local States
  // ---------------------------------------------------------------------------
  const [selectedMode, setSelectedMode] = useState('ADAPTIVE');
  const [sourceWater, setSourceWater] = useState('BOREWELL');
  const [targetTds, setTargetTds] = useState(75);
  
  // Dynamic AutoClean Flush State
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushCountdown, setFlushCountdown] = useState(0);
  const [flushFeedback, setFlushFeedback] = useState('');

  // Diagnostic Scan Modal & State
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  // Status Notification Banner
  const [actionNotification, setActionNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);
  const flushTimerRef = useRef(null);
  const sliderDebounceRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Telemetry Metric Extraction with Safe Defaults
  // ---------------------------------------------------------------------------
  const inletTds = Number(telemetry?.sensors?.inlet_tds ?? telemetry?.inlet_tds ?? 850);
  const outletTds = Number(telemetry?.sensors?.outlet_tds ?? telemetry?.physics?.outlet_tds ?? telemetry?.outlet_tds ?? 42);
  const saltRejection = Number(telemetry?.physics?.salt_rejection ?? telemetry?.salt_rejection ?? 95.2).toFixed(1);

  // Sync flush state with backend telemetry if backend triggers it autonomously
  useEffect(() => {
    if (telemetry?.actuators?.flush_solenoid && !isFlushing) {
      setIsFlushing(true);
      setFlushFeedback('Autonomous Boundary Layer High-Shear Washdown Active');
    }
  }, [telemetry?.actuators?.flush_solenoid, isFlushing]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    };
  }, []);

  // Helper: Trigger visual toast notification
  const notify = (msg, type = 'info') => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setActionNotification({ message: msg, type });
    notificationTimeoutRef.current = setTimeout(() => {
      setActionNotification(null);
    }, 4500);
  };

  // ---------------------------------------------------------------------------
  // API Integration: /api/consumer/control
  // ---------------------------------------------------------------------------
  const sendConsumerCommand = useCallback(async (overrides = {}) => {
    const payload = {
      mode: overrides.mode !== undefined ? overrides.mode : selectedMode,
      target_tds: overrides.target_tds !== undefined ? Number(overrides.target_tds) : Number(targetTds),
      manual_flush: overrides.manual_flush !== undefined ? Boolean(overrides.manual_flush) : false,
      source_water: overrides.source_water !== undefined ? overrides.source_water : sourceWater
    };

    try {
      const response = await fetch(`${BACKEND_BASE}/api/consumer/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('[HydroTwin ConsumerView] API call fallback:', err.message);
      return {
        message: `Command simulated: ${payload.mode} (${payload.source_water})`,
        applied_setpoints: payload
      };
    }
  }, [selectedMode, sourceWater, targetTds]);

  // ---------------------------------------------------------------------------
  // Action 1: AutoClean Micro-Flush Trigger (5-second dynamic washdown)
  // ---------------------------------------------------------------------------
  const handleAutoCleanFlush = async () => {
    if (isFlushing) return;

    setIsFlushing(true);
    setFlushCountdown(5);
    setFlushFeedback('High-velocity crossflow shear initiated. Washing away cake resistance (-18%)...');
    notify('AutoClean Micro-Flush initiated: high-shear crossflow washdown running for 5 seconds.', 'success');

    await sendConsumerCommand({ manual_flush: true });

    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = setInterval(() => {
      setFlushCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(flushTimerRef.current);
          setIsFlushing(false);
          setFlushFeedback('Dynamic washdown completed. Nominal filtration recovered.');
          notify('AutoClean Complete: Membrane surface restored to optimal baseline.', 'success');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ---------------------------------------------------------------------------
  // Action 2: Run Comprehensive Diagnostics
  // ---------------------------------------------------------------------------
  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const response = await fetch(`${BACKEND_BASE}/api/consumer/diagnostics`);
      if (response.ok) {
        const report = await response.json();
        setDiagnosticReport(report);
      } else {
        throw new Error('Failed to fetch diagnostics');
      }
    } catch (err) {
      console.warn('[HydroTwin Diagnostics] Using simulated diagnostic response:', err.message);
      setDiagnosticReport({
        timestamp: new Date().toISOString(),
        device_id: 'ATOM-WP-2026-0042',
        overall_health_score: 91.5,
        system_status: 'NOMINAL',
        diagnostics: {
          booster_pump: {
            status: 'NOMINAL',
            current_draw_amps: 0.85,
            flow_rate_lpm: 1.20,
            delivery_pressure_bar: 1.11,
            relay_closed: true,
            details: 'Booster pump armature current draw is within safe operating envelope (0.15A - 1.80A).'
          },
          ro_membrane: {
            fouling_level: 'OPTIMAL',
            cake_resistance: 0.18,
            baseline_resistance: 0.35,
            salt_rejection_pct: Number(saltRejection),
            washdown_active: isFlushing,
            washdown_factor: isFlushing ? 0.82 : 1.0,
            details: 'Membrane surface cake resistance is low and within nominal clean baseline.'
          },
          alkaline_remineralizer: {
            status: 'OPTIMAL_MINERALIZATION',
            delta_mineral_ppm: 28.0,
            alkaliser_health_pct: 83.3,
            details: 'Active Ca2+/Mg2+ mineral elution (+28.0 ppm) providing balanced pH ~7.8.'
          }
        },
        prognostics: {
          sediment_health: 83.2,
          carbon_health: 84.0,
          ro_health: 98.6,
          alkaliser_health: 83.3,
          failing_stage: 'NONE',
          rul_days: 34,
          auto_dispatch: false
        }
      });
    } finally {
      setIsDiagnosing(false);
      setShowDiagnosticModal(true);
    }
  };

  // ---------------------------------------------------------------------------
  // Action 3: Mode Selection Handler
  // ---------------------------------------------------------------------------
  const handleModeChange = async (newMode) => {
    setSelectedMode(newMode);
    notify(`Mode updated to ${newMode}: Re-calculating multi-stage hydraulic balance...`, 'info');
    await sendConsumerCommand({ mode: newMode });
  };

  // ---------------------------------------------------------------------------
  // Action 4: Water Source Preset Selection Handler
  // ---------------------------------------------------------------------------
  const handleSourceChange = async (newSource) => {
    setSourceWater(newSource);
    const label = newSource === 'MUNICIPAL' ? 'Municipal Supply (320 ppm)'
      : newSource === 'BOREWELL' ? 'Borewell Groundwater (920 ppm)'
      : 'Hard Tanker Water (1550 ppm)';
    notify(`Tap Source set to ${label}. Recalibrating feed pressure & flux...`, 'info');
    await sendConsumerCommand({ source_water: newSource });
  };

  // ---------------------------------------------------------------------------
  // Action 5: TasteTune Slider Handler (debounced API sync)
  // ---------------------------------------------------------------------------
  const handleTasteTuneChange = (e) => {
    const val = Number(e.target.value);
    setTargetTds(val);

    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    sliderDebounceRef.current = setTimeout(() => {
      sendConsumerCommand({ mode: 'TASTETUNE', target_tds: val });
    }, 280);
  };

  // Taste profile flavor descriptors
  const getTasteProfile = (tds) => {
    if (tds < 60) {
      return {
        label: 'Crisp & Light',
        tag: 'Ultra-Pure Alpine',
        desc: 'Mountain glacier feel with ultra-low sodium, light mouthfeel, perfect for fine teas.',
        badgeColor: 'bg-[#EAEFE5] text-[#3E4D37] border-[#BACAB3]'
      };
    }
    if (tds <= 110) {
      return {
        label: 'Balanced & Sweet',
        tag: 'Optimal Hydration',
        desc: 'Naturally sweet and smooth palate with balanced calcium & magnesium electrolytes.',
        badgeColor: 'bg-[#E2EDE0] text-[#2A3525] border-[#9BB28E]'
      };
    }
    return {
      label: 'Rich Mineral Feel',
      tag: 'Alkaline Infused',
      desc: 'Enhanced mineral body, gentle alkalinity (pH ~8.0), rich in essential trace elements.',
      badgeColor: 'bg-[#FAF5EB] text-[#826947] border-[#DFD3BE]'
    };
  };

  const currentTaste = getTasteProfile(targetTds);

  return (
    <div id="consumer-view" className="max-w-5xl mx-auto space-y-7 animate-fadeIn pb-12">

      {/* Toast Notification Alert Banner */}
      {actionNotification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-subtle">
          <div className="bg-[#2A3525] text-white px-5 py-3.5 rounded-2xl shadow-xl border border-[#54684A] flex items-center space-x-3 text-sm">
            <svg className="w-5 h-5 text-[#B5D7A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-white/95">{actionNotification.message}</span>
            <button
              onClick={() => setActionNotification(null)}
              className="text-white/60 hover:text-white p-1 rounded-full transition-colors ml-2"
              title="Close notification"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: TOP LIVE STATUS BANNER */}
      <div className="bg-white border border-[#DCE4D6] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-[#EAEFE5]/60 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-[#EAEFE5] border border-[#BACAB3] flex items-center justify-center text-[#384828]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#2A3525] tracking-tight">
                Atomberg Intellon Water Purifier
              </h2>
            </div>
            <p className="text-xs text-[#6C7E66] flex flex-wrap items-center gap-2">
              <span>Device #ATOM-WP-2026-0042</span>
              <span>•</span>
              <span>Smart IoT Grid v2.4-HIL</span>
              <span>•</span>
              <span className="inline-flex items-center space-x-1 font-semibold text-[#3E4D37]">
                <span className="w-2 h-2 rounded-full bg-[#6C8360] animate-pulse"></span>
                <span>Live Connected</span>
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="autoclean-flush-btn"
              onClick={handleAutoCleanFlush}
              disabled={isFlushing}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center space-x-2 shadow-sm ${
                isFlushing
                  ? 'bg-[#6C8360] text-white ring-2 ring-[#849C77] animate-pulse cursor-wait'
                  : 'bg-[#EAEFE5] text-[#2A3525] hover:bg-[#DDE5D6] border border-[#BACAB3] active:scale-95'
              }`}
            >
              <svg className="w-4 h-4 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>
                {isFlushing ? `AutoCleaning... (${flushCountdown}s)` : 'AutoClean Flush'}
              </span>
            </button>

            <button
              id="run-diagnostics-btn"
              onClick={handleRunDiagnostics}
              disabled={isDiagnosing}
              className="px-4 py-2.5 rounded-full text-xs font-bold bg-[#384828] text-white hover:bg-[#2C3B1F] border border-[#1F2D19] transition-all duration-200 active:scale-95 flex items-center space-x-2 shadow-sm"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{isDiagnosing ? 'Scanning...' : 'Run Diagnostics'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Water Purity & TDS Contrast Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-[#FAFBF8] border border-[#DCE4D6] rounded-2xl p-4 sm:p-5 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EAEFE5] border border-[#BACAB3] flex items-center justify-center text-[#384828] shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6C7E66]">
                Membrane Rejection Purity
              </div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#2A3525]">
                  {saltRejection}%
                </span>
                <span className="text-xs font-bold text-[#54684A]">
                  TFC Efficiency
                </span>
              </div>
              <div className="text-[11px] text-[#6C7E66] mt-0.5">
                Blocks heavy metals, arsenic & fluorides
              </div>
            </div>
          </div>

          <div className="bg-[#FAFBF8] border border-[#DCE4D6] rounded-2xl p-4 sm:p-5 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF5EB] border border-[#DFD3BE] flex items-center justify-center text-[#826947] shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#826947]">
                Inlet Feed Tap TDS
              </div>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#2A3525]">
                  {Math.round(inletTds)}
                </span>
                <span className="text-xs font-bold text-[#6C7E66]">ppm</span>
              </div>
              <div className="text-[11px] text-[#6C7E66] mt-0.5">
                Source: {sourceWater} profile
              </div>
            </div>
          </div>

          <div className="bg-[#849C77] text-white border border-[#6E8562] rounded-2xl p-4 sm:p-5 flex items-center space-x-4 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="relative z-10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                Purified Permeate Output
              </div>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                  {Math.round(outletTds)}
                </span>
                <span className="text-xs font-bold text-white/80">ppm</span>
              </div>
              <div className="text-[11px] text-white/90 mt-0.5 font-medium">
                Alkaline Balanced (pH ~7.8)
              </div>
            </div>
          </div>
        </div>

        {isFlushing && (
          <div className="bg-[#EAEFE5] border border-[#BACAB3] p-4 rounded-2xl space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-xs font-bold text-[#2A3525]">
              <span className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6C8360] animate-ping"></span>
                <span>Active AutoClean Cycle: High-Velocity Flush Solenoid Energized</span>
              </span>
              <span className="font-mono text-[#3E4D37]">{flushCountdown}s remaining</span>
            </div>
            <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-[#BACAB3]">
              <div
                className="bg-[#6C8360] h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${((5 - flushCountdown) / 5) * 100}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-[#54684A]">
              {flushFeedback}
            </p>
          </div>
        )}
      </div>

      {/* SECTION 2: INTERACTIVE PURIFICATION MODE SELECTOR */}
      <div className="bg-white border border-[#DCE4D6] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3E9DE] gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#2A3525] flex items-center space-x-2">
              <svg className="w-5 h-5 text-[#384828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Intellon Smart Purification Modes</span>
            </h3>
            <p className="text-xs text-[#6C7E66] mt-0.5">
              Select an intelligent hydraulic operation mode to adapt motor torque, recovery ratio, and mineral infusion.
            </p>
          </div>
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#EAEFE5] text-[#3E4D37] border border-[#BACAB3] font-semibold self-start sm:self-center">
            Active: {selectedMode}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Mode 1: Adaptive Flow */}
          <div
            id="mode-adaptive-card"
            onClick={() => handleModeChange('ADAPTIVE')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              selectedMode === 'ADAPTIVE'
                ? 'bg-[#F2F6EF] border-[#6C8360] ring-2 ring-[#849C77] shadow-md shadow-[#849C77]/15'
                : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] hover:bg-white'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#EAEFE5] border border-[#BACAB3] flex items-center justify-center text-[#384828]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedMode === 'ADAPTIVE' ? 'bg-[#384828] text-white' : 'bg-[#EAEFE5] text-[#54684A]'
                }`}>
                  Smart Eco
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#2A3525]">Adaptive Flow</h4>
                <p className="text-xs text-[#6C7E66] mt-1 leading-relaxed">
                  Auto-adapts to changing tap TDS to optimize water recovery & minimize waste.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono font-semibold text-[#54684A] pt-2 border-t border-[#DCE4D6]/60">
              Q: 1.20-1.40 L/min | Auto-Tune
            </div>
          </div>

          {/* Mode 2: Full RO+UV */}
          <div
            id="mode-ro-uv-card"
            onClick={() => handleModeChange('RO_UV')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              selectedMode === 'RO_UV'
                ? 'bg-[#F2F6EF] border-[#6C8360] ring-2 ring-[#849C77] shadow-md shadow-[#849C77]/15'
                : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] hover:bg-white'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#EAEFE5] border border-[#BACAB3] flex items-center justify-center text-[#384828]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedMode === 'RO_UV' ? 'bg-[#384828] text-white' : 'bg-[#EAEFE5] text-[#54684A]'
                }`}>
                  Max Safety
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#2A3525]">Full RO+UV</h4>
                <p className="text-xs text-[#6C7E66] mt-1 leading-relaxed">
                  Maximum rejection barrier for heavy metals, high salinity borewell water & microbes.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono font-semibold text-[#54684A] pt-2 border-t border-[#DCE4D6]/60">
              Rejection: 95%+ | 0.95 A Head
            </div>
          </div>

          {/* Mode 3: TasteTune™ */}
          <div
            id="mode-tastetune-card"
            onClick={() => handleModeChange('TASTETUNE')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              selectedMode === 'TASTETUNE'
                ? 'bg-[#F2F6EF] border-[#6C8360] ring-2 ring-[#849C77] shadow-md shadow-[#849C77]/15'
                : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] hover:bg-white'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#EAEFE5] border border-[#BACAB3] flex items-center justify-center text-[#384828]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedMode === 'TASTETUNE' ? 'bg-[#384828] text-white' : 'bg-[#EAEFE5] text-[#54684A]'
                }`}>
                  Gourmet
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#2A3525]">TasteTune™</h4>
                <p className="text-xs text-[#6C7E66] mt-1 leading-relaxed">
                  Customizes taste by dialing preferred output mineral TDS to your exact palate.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono font-semibold text-[#54684A] pt-2 border-t border-[#DCE4D6]/60">
              Dial: 30 - 150 ppm TDS
            </div>
          </div>

          {/* Mode 4: VacayMode */}
          <div
            id="mode-vacay-card"
            onClick={() => handleModeChange('VACAY')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              selectedMode === 'VACAY'
                ? 'bg-[#F2F6EF] border-[#6C8360] ring-2 ring-[#849C77] shadow-md shadow-[#849C77]/15'
                : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] hover:bg-white'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#EAEFE5] border border-[#BACAB3] flex items-center justify-center text-[#384828]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedMode === 'VACAY' ? 'bg-[#384828] text-white' : 'bg-[#EAEFE5] text-[#54684A]'
                }`}>
                  Anti-Stagnant
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#2A3525]">VacayMode</h4>
                <p className="text-xs text-[#6C7E66] mt-1 leading-relaxed">
                  Low intermittent auto-cleansing when away to prevent stagnant odor and bio-film.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono font-semibold text-[#54684A] pt-2 border-t border-[#DCE4D6]/60">
              Idle: 0.20 L/min | 0.35 A Low
            </div>
          </div>
        </div>

        {/* TasteTune™ Interactive Slider */}
        {selectedMode === 'TASTETUNE' && (
          <div className="p-6 bg-[#FAFBF8] border border-[#BACAB3] rounded-2xl space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-[#2A3525]">
                    TasteTune™ Mineral Dial Selector
                  </h4>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${currentTaste.badgeColor}`}>
                    {currentTaste.label}
                  </span>
                </div>
                <p className="text-xs text-[#6C7E66] mt-1">
                  {currentTaste.desc}
                </p>
              </div>

              <div className="flex items-baseline space-x-1.5 bg-white px-4 py-2 rounded-xl border border-[#DCE4D6] shadow-sm self-start sm:self-center">
                <span className="text-2xl font-black font-mono text-[#2A3525]">
                  {targetTds}
                </span>
                <span className="text-xs font-bold text-[#6C7E66]">ppm target</span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                id="tastetune-slider"
                type="range"
                min="30"
                max="150"
                step="1"
                value={targetTds}
                onChange={handleTasteTuneChange}
                className="w-full h-2.5 bg-[#DCE4D6] rounded-lg appearance-none cursor-pointer accent-[#6C8360] focus:outline-none"
              />
              <div className="flex justify-between text-[11px] font-mono text-[#6C7E66]">
                <span>30 ppm (Ultra Crisp)</span>
                <span className="font-bold text-[#2A3525]">75 ppm (Balanced Mineral)</span>
                <span>150 ppm (Rich Mineral)</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs bg-white p-3 rounded-xl border border-[#DCE4D6]">
              <svg className="w-4 h-4 text-[#54684A] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[#3E4D37]">
                <strong>Taste Intelligence:</strong> Adjusting permeate mineral content regulates motor torque and post-carbon mineralization blend ratio dynamically.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: TAP WATER SOURCE SELECTOR */}
      <div className="bg-white border border-[#DCE4D6] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3E9DE] gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#2A3525] flex items-center space-x-2">
              <svg className="w-5 h-5 text-[#384828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span>Tap Water Source Environment</span>
            </h3>
            <p className="text-xs text-[#6C7E66] mt-0.5">
              Simulate feed water supplies to test how the purifier's pump and membrane handle variable mineral loads.
            </p>
          </div>
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#FAF5EB] text-[#826947] border border-[#DFD3BE] font-semibold self-start sm:self-center">
            Current: {sourceWater}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            id="source-municipal-btn"
            onClick={() => handleSourceChange('MUNICIPAL')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer space-y-3 ${
              sourceWater === 'MUNICIPAL'
                ? 'bg-[#F2F6EF] border-[#6C8360] ring-2 ring-[#849C77] shadow-sm'
                : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#DCE4D6] flex items-center justify-center text-[#384828]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-xs font-mono font-bold text-[#3E4D37] bg-white px-2.5 py-1 rounded-full border border-[#DCE4D6]">
                320 ppm TDS
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#2A3525]">Municipal Supply</h4>
              <p className="text-xs text-[#6C7E66] mt-1">
                Treated surface water with low dissolved hardness. Low stress on booster pump (0.72 A).
              </p>
            </div>
            <div className="text-[11px] font-mono text-[#54684A] font-semibold pt-1">
              Base Flow: 1.40 L/min
            </div>
          </div>

          <div
            id="source-borewell-btn"
            onClick={() => handleSourceChange('BOREWELL')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer space-y-3 ${
              sourceWater === 'BOREWELL'
                ? 'bg-[#F2F6EF] border-[#6C8360] ring-2 ring-[#849C77] shadow-sm'
                : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#DCE4D6] flex items-center justify-center text-[#384828]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l8-14 8 14H3z" />
                </svg>
              </div>
              <span className="text-xs font-mono font-bold text-[#3E4D37] bg-white px-2.5 py-1 rounded-full border border-[#DCE4D6]">
                920 ppm TDS
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#2A3525]">Borewell Groundwater</h4>
              <p className="text-xs text-[#6C7E66] mt-1">
                Sub-terranean deep aquifer water rich in calcium & magnesium carbonates. Normal load (0.85 A).
              </p>
            </div>
            <div className="text-[11px] font-mono text-[#54684A] font-semibold pt-1">
              Base Flow: 1.20 L/min
            </div>
          </div>

          <div
            id="source-tanker-btn"
            onClick={() => handleSourceChange('TANKER')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer space-y-3 ${
              sourceWater === 'TANKER'
                ? 'bg-[#F2F6EF] border-[#6C8360] ring-2 ring-[#849C77] shadow-sm'
                : 'bg-[#FAFBF8] border-[#DCE4D6] hover:border-[#BACAB3] hover:bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-[#FAF5EB] border border-[#DFD3BE] flex items-center justify-center text-[#826947]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" />
                </svg>
              </div>
              <span className="text-xs font-mono font-bold text-[#826947] bg-[#FAF5EB] px-2.5 py-1 rounded-full border border-[#DFD3BE]">
                1550 ppm TDS
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#2A3525]">Hard Tanker Water</h4>
              <p className="text-xs text-[#6C7E66] mt-1">
                Heavy dissolved salts with severe mineral scaling potential. High pump pressure (0.98 A).
              </p>
            </div>
            <div className="text-[11px] font-mono text-[#54684A] font-semibold pt-1">
              Base Flow: 1.05 L/min
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: PREDICTIVE HEALTH & STAGE MONITORING */}
      <div className="space-y-6">
        <PredictiveHealthIntelligence
          telemetry={telemetry}
          mode="consumer"
        />
      </div>

      {/* SECTION 4: DIAGNOSTIC SCAN REPORT MODAL */}
      {showDiagnosticModal && diagnosticReport && (
        <div className="fixed inset-0 z-50 bg-[#1F2D19]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-[#BACAB3] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-[#E3E9DE]">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl font-black text-[#2A3525]">
                    Intellon Hardware Diagnostic Report
                  </h3>
                </div>
                <p className="text-xs text-[#6C7E66] mt-1">
                  Device: {diagnosticReport.device_id || 'ATOM-WP-2026-0042'} | Timestamp: {new Date(diagnosticReport.timestamp).toLocaleTimeString()}
                </p>
              </div>

              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="w-8 h-8 rounded-full bg-[#EAEFE5] text-[#2A3525] hover:bg-[#DCE4D6] flex items-center justify-center transition-all"
                title="Close diagnostics"
              >
                <svg className="w-4 h-4 text-[#2A3525]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-[#FAFBF8] border border-[#BACAB3] p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6C7E66]">
                  Overall System Health Index
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-4xl font-black font-mono text-[#2A3525]">
                    {diagnosticReport.overall_health_score ?? 92.0}
                  </span>
                  <span className="text-sm font-bold text-[#54684A]">/ 100</span>
                </div>
                <p className="text-xs text-[#6C7E66] mt-0.5">
                  Status: <strong className="text-[#3E4D37]">{diagnosticReport.system_status || 'NOMINAL'}</strong>
                </p>
              </div>

              <div className="px-4 py-2 rounded-xl bg-[#EAEFE5] border border-[#BACAB3] text-center self-start sm:self-center">
                <div className="text-[10px] uppercase font-bold text-[#6C7E66]">Evaluation Result</div>
                <div className="text-sm font-bold text-[#2A3525] mt-0.5">
                  {diagnosticReport.overall_health_score >= 80 ? 'All Systems Nominal' : 'Maintenance Advised'}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {diagnosticReport.diagnostics?.booster_pump && (
                <div className="bg-[#FAFBF8] border border-[#DCE4D6] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#2A3525] uppercase tracking-wider flex items-center space-x-1.5">
                      <svg className="w-3.5 h-3.5 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Booster Pump Integrity</span>
                    </h4>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                      diagnosticReport.diagnostics.booster_pump.status === 'NOMINAL'
                        ? 'bg-[#EAEFE5] text-[#2A3525] border border-[#BACAB3]'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {diagnosticReport.diagnostics.booster_pump.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-[#E3E9DE]">
                    <div>
                      <span className="text-[#6C7E66] block text-[10px]">Current Draw:</span>
                      <strong className="text-[#2A3525]">{diagnosticReport.diagnostics.booster_pump.current_draw_amps} A</strong>
                    </div>
                    <div>
                      <span className="text-[#6C7E66] block text-[10px]">Flow Rate:</span>
                      <strong className="text-[#2A3525]">{diagnosticReport.diagnostics.booster_pump.flow_rate_lpm} L/min</strong>
                    </div>
                    <div>
                      <span className="text-[#6C7E66] block text-[10px]">Delivery Head:</span>
                      <strong className="text-[#2A3525]">{diagnosticReport.diagnostics.booster_pump.delivery_pressure_bar} bar</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#6C7E66] leading-relaxed">
                    {diagnosticReport.diagnostics.booster_pump.details}
                  </p>
                </div>
              )}

              {diagnosticReport.diagnostics?.ro_membrane && (
                <div className="bg-[#FAFBF8] border border-[#DCE4D6] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#2A3525] uppercase tracking-wider flex items-center space-x-1.5">
                      <svg className="w-3.5 h-3.5 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
                      </svg>
                      <span>RO Membrane Fouling & Scaling</span>
                    </h4>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EAEFE5] text-[#2A3525] border border-[#BACAB3]">
                      {diagnosticReport.diagnostics.ro_membrane.fouling_level}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-[#E3E9DE]">
                    <div>
                      <span className="text-[#6C7E66] block text-[10px]">Cake Res. R_cake:</span>
                      <strong className="text-[#2A3525]">{diagnosticReport.diagnostics.ro_membrane.cake_resistance} kPa·s/L</strong>
                    </div>
                    <div>
                      <span className="text-[#6C7E66] block text-[10px]">Salt Rejection:</span>
                      <strong className="text-[#2A3525]">{diagnosticReport.diagnostics.ro_membrane.salt_rejection_pct}%</strong>
                    </div>
                    <div>
                      <span className="text-[#6C7E66] block text-[10px]">Washdown State:</span>
                      <strong className="text-[#2A3525]">{diagnosticReport.diagnostics.ro_membrane.washdown_active ? 'Flushing' : 'Nominal'}</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#6C7E66] leading-relaxed">
                    {diagnosticReport.diagnostics.ro_membrane.details}
                  </p>
                </div>
              )}

              {diagnosticReport.diagnostics?.alkaline_remineralizer && (
                <div className="bg-[#FAFBF8] border border-[#DCE4D6] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#2A3525] uppercase tracking-wider flex items-center space-x-1.5">
                      <svg className="w-3.5 h-3.5 text-[#54684A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <span>Alkaline Remineralizer Balance</span>
                    </h4>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EAEFE5] text-[#2A3525] border border-[#BACAB3]">
                      {diagnosticReport.diagnostics.alkaline_remineralizer.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-[#E3E9DE]">
                    <div>
                      <span className="text-[#6C7E66] block text-[10px]">Mineral Elution:</span>
                      <strong className="text-[#2A3525]">+{diagnosticReport.diagnostics.alkaline_remineralizer.delta_mineral_ppm} ppm</strong>
                    </div>
                    <div>
                      <span className="text-[#6C7E66] block text-[10px]">Cartridge Health:</span>
                      <strong className="text-[#2A3525]">{diagnosticReport.diagnostics.alkaline_remineralizer.alkaliser_health_pct}%</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#6C7E66] leading-relaxed">
                    {diagnosticReport.diagnostics.alkaline_remineralizer.details}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E3E9DE]">
              <button
                onClick={handleRunDiagnostics}
                disabled={isDiagnosing}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#EAEFE5] text-[#2A3525] hover:bg-[#DCE4D6] border border-[#BACAB3] transition-all flex items-center space-x-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Re-scan Hardware</span>
              </button>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="px-5 py-2 rounded-full text-xs font-bold bg-[#384828] text-white hover:bg-[#2C3B1F] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ConsumerView;
