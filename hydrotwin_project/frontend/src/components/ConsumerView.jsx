import React, { useState, useEffect, useRef, useCallback } from 'react';
import PredictiveHealthIntelligence from './PredictiveHealthIntelligence';
import InteractivePurifierIllustration from './InteractivePurifierIllustration';

const BACKEND_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

/**
 * ConsumerView: Interactive Atomberg Intellon Purifier Simulator
 * Designed for AtomQuest 2026 (Track 2: Water Purifier).
 * Styled in an elegant White and Olive palette matching the brand reference image.
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
  const isFlushActive = Boolean(telemetry?.actuators?.flush_solenoid ?? isFlushing);

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
      // Graceful fallback for offline / mock testing
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
    notify('🌊 AutoClean Micro-Flush initiated: high-shear crossflow washdown running for 5 seconds.', 'success');

    // Send command to backend
    await sendConsumerCommand({ manual_flush: true });

    // 5-second dynamic countdown
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = setInterval(() => {
      setFlushCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(flushTimerRef.current);
          setIsFlushing(false);
          setFlushFeedback('Dynamic washdown completed. Nominal filtration recovered.');
          notify('✨ AutoClean Complete: Membrane surface restored to optimal baseline.', 'success');
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
      // Fallback structured diagnostic report
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
  // Action 5: TasteTune Slider Handler (with debounced API sync)
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

      {/* ----------------------------------------------------------------- */}
      {/* Toast Notification Alert Banner */}
      {/* ----------------------------------------------------------------- */}
      {actionNotification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-subtle">
          <div className="bg-[#2A3525] text-white px-5 py-3.5 rounded-2xl shadow-xl border border-[#54684A] flex items-center space-x-3 text-sm">
            <span className="text-lg">💧</span>
            <span className="font-medium text-white/95">{actionNotification.message}</span>
            <button
              onClick={() => setActionNotification(null)}
              className="text-white/60 hover:text-white text-xs ml-2 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 1: TOP LIVE STATUS BANNER */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white border border-[#DCE4D6] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-[#EAEFE5]/60 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          {/* Header & Identity */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="w-8 h-8 rounded-full bg-[#EAEFE5] border border-[#BACAB3] flex items-center justify-center text-lg">
                🌿
              </span>
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

          {/* Action Buttons: AutoClean Flush & Run Diagnostics */}
          <div className="flex flex-wrap items-center gap-3">
            {/* ✨ AutoClean Flush Button */}
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
              <span>{isFlushing ? '🌊' : '✨'}</span>
              <span>
                {isFlushing ? `AutoCleaning... (${flushCountdown}s)` : 'AutoClean Flush'}
              </span>
            </button>

            {/* 🩺 Run Diagnostics Button */}
            <button
              id="run-diagnostics-btn"
              onClick={handleRunDiagnostics}
              disabled={isDiagnosing}
              className="px-4 py-2.5 rounded-full text-xs font-bold bg-[#384828] text-white hover:bg-[#2C3B1F] border border-[#1F2D19] transition-all duration-200 active:scale-95 flex items-center space-x-2 shadow-sm"
            >
              <span>{isDiagnosing ? '⏳' : '🩺'}</span>
              <span>{isDiagnosing ? 'Scanning...' : 'Run Diagnostics'}</span>
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Dynamic Water Purity & TDS Contrast Gauge */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          
          {/* Tile 1: Salt Rejection Purity Score */}
          <div className="bg-[#FAFBF8] border border-[#DCE4D6] rounded-2xl p-4 sm:p-5 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EAEFE5] border border-[#BACAB3] flex items-center justify-center text-2xl shrink-0">
              💎
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

          {/* Tile 2: Inlet Tap TDS */}
          <div className="bg-[#FAFBF8] border border-[#DCE4D6] rounded-2xl p-4 sm:p-5 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF5EB] border border-[#DFD3BE] flex items-center justify-center text-2xl shrink-0">
              🚰
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

          {/* Tile 3: Purified Drinkable Output TDS */}
          <div className="bg-[#849C77] text-white border border-[#6E8562] rounded-2xl p-4 sm:p-5 flex items-center space-x-4 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl shrink-0">
              ✨
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

        {/* Dynamic Flush Progress Indicator (Visible when AutoClean is Active) */}
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

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 2: INTERACTIVE PURIFICATION MODE SELECTOR */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white border border-[#DCE4D6] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3E9DE] gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#2A3525] flex items-center space-x-2">
              <span>⚙️</span>
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

        {/* 4 Interactive Mode Cards Grid */}
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
                <span className="text-2xl">🌿</span>
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
                <span className="text-2xl">🛡️</span>
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
                <span className="text-2xl">🎯</span>
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
                <span className="text-2xl">✈️</span>
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

        {/* ----------------------------------------------------------------- */}
        {/* TasteTune™ Interactive Slider (Renders when TASTETUNE is active) */}
        {/* ----------------------------------------------------------------- */}
        {selectedMode === 'TASTETUNE' && (
          <div className="p-6 bg-[#FAFBF8] border border-[#BACAB3] rounded-2xl space-y-5 animate-fadeIn">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🎯</span>
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

              {/* Readout Badge */}
              <div className="flex items-baseline space-x-1.5 bg-white px-4 py-2 rounded-xl border border-[#DCE4D6] shadow-sm self-start sm:self-center">
                <span className="text-2xl font-black font-mono text-[#2A3525]">
                  {targetTds}
                </span>
                <span className="text-xs font-bold text-[#6C7E66]">ppm target</span>
              </div>
            </div>

            {/* Range Slider */}
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

            {/* Profile Guidance Callout */}
            <div className="flex items-center space-x-3 text-xs bg-white p-3 rounded-xl border border-[#DCE4D6]">
              <span className="text-lg">💡</span>
              <span className="text-[#3E4D37]">
                <strong>Taste Intelligence:</strong> Adjusting permeate mineral content regulates motor torque and post-carbon mineralization blend ratio dynamically.
              </span>
            </div>

          </div>
        )}

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 3: TAP WATER SOURCE SELECTOR */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-white border border-[#DCE4D6] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3E9DE] gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#2A3525] flex items-center space-x-2">
              <span>🚰</span>
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

        {/* 3 Source Presets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Preset 1: Municipal Supply */}
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
              <span className="text-2xl">🏛️</span>
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

          {/* Preset 2: Borewell Groundwater */}
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
              <span className="text-2xl">🏞️</span>
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

          {/* Preset 3: Hard Tanker Water */}
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
              <span className="text-2xl">🚚</span>
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

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 5: PREDICTIVE HEALTH & STAGE MONITORING EMBEDS */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-6">
        
        {/* ML Prognostics & RUL Card */}
        <PredictiveHealthIntelligence
          telemetry={telemetry}
          mode="consumer"
        />

        {/* 5-Stage Interactive Purifier Illustration */}
        <InteractivePurifierIllustration
          telemetry={telemetry}
          mode="consumer"
        />

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 4: DIAGNOSTIC SCAN REPORT MODAL */}
      {/* ----------------------------------------------------------------- */}
      {showDiagnosticModal && diagnosticReport && (
        <div className="fixed inset-0 z-50 bg-[#1F2D19]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          
          <div className="bg-white border border-[#BACAB3] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E3E9DE]">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🩺</span>
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
                className="w-8 h-8 rounded-full bg-[#EAEFE5] text-[#2A3525] hover:bg-[#DCE4D6] flex items-center justify-center font-bold text-sm transition-all"
              >
                ✕
              </button>
            </div>

            {/* Overall System Health Scorecard */}
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
                  {diagnosticReport.overall_health_score >= 80 ? '✅ All Systems Nominal' : '⚠️ Maintenance Advised'}
                </div>
              </div>
            </div>

            {/* Diagnostic Categories */}
            <div className="space-y-4">
              
              {/* Category 1: Booster Pump Integrity */}
              {diagnosticReport.diagnostics?.booster_pump && (
                <div className="bg-[#FAFBF8] border border-[#DCE4D6] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#2A3525] uppercase tracking-wider flex items-center space-x-1.5">
                      <span>⚡</span>
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

              {/* Category 2: RO Membrane Core & Fouling Level */}
              {diagnosticReport.diagnostics?.ro_membrane && (
                <div className="bg-[#FAFBF8] border border-[#DCE4D6] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#2A3525] uppercase tracking-wider flex items-center space-x-1.5">
                      <span>🌀</span>
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

              {/* Category 3: Alkaline Remineralizer */}
              {diagnosticReport.diagnostics?.alkaline_remineralizer && (
                <div className="bg-[#FAFBF8] border border-[#DCE4D6] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#2A3525] uppercase tracking-wider flex items-center space-x-1.5">
                      <span>🌱</span>
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

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E3E9DE]">
              <button
                onClick={handleRunDiagnostics}
                disabled={isDiagnosing}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#EAEFE5] text-[#2A3525] hover:bg-[#DCE4D6] border border-[#BACAB3] transition-all"
              >
                🔄 Re-scan Hardware
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
