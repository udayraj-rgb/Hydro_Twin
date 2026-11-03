import React, { useState, useEffect, useRef, useCallback } from 'react';
import PredictiveHealthIntelligence from './PredictiveHealthIntelligence';
import InteractivePurifierIllustration from './InteractivePurifierIllustration';

const BACKEND_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

/**
 * ConsumerView: Cinematic Atomberg Intellon Purifier Dashboard & Simulator
 * Features an ambient background showcase video, real-time floating telemetry HUD,
 * 4-mode purifier controller, diagnostics modal, and embedded predictive intelligence.
 */
function ConsumerView({ telemetry = null }) {
  // ---------------------------------------------------------------------------
  // Video & Ambient Playback States
  // ---------------------------------------------------------------------------
  const videoRef = useRef(null);
  const cinemaVideoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showCinemaModal, setShowCinemaModal] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

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
  const rulDays = Number(telemetry?.prognostics?.rul_days ?? telemetry?.rul_days ?? 18);

  // Projected replacement calendar date
  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + rulDays);
  const formattedProjectedDate = projectedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

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
  // Ambient Video Controls
  // ---------------------------------------------------------------------------
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
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
    setFlushFeedback('High-velocity crossflow shear initiated. Reducing cake resistance (-18%)...');
    notify('🌊 AutoClean Micro-Flush active: dynamic washdown cycle running for 5s', 'success');

    await sendConsumerCommand({ manual_flush: true });

    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = setInterval(() => {
      setFlushCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(flushTimerRef.current);
          setIsFlushing(false);
          setFlushFeedback('Dynamic washdown completed. Normal filtration restored.');
          notify('✨ AutoClean Complete: Membrane cake layer cleared.', 'success');
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
        overall_health_score: 93.4,
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
          rul_days: rulDays,
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
        tag: 'Ultra-Pure Mountain Crisp',
        desc: 'Mountain glacier feel with ultra-low sodium, light mouthfeel, perfect for specialty teas.',
        badgeColor: 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
      };
    }
    if (tds <= 110) {
      return {
        label: 'Balanced & Sweet',
        tag: 'Optimal Daily Hydration',
        desc: 'Naturally sweet and smooth palate with balanced calcium & magnesium electrolytes.',
        badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
      };
    }
    return {
      label: 'Rich Mineral Feel',
      tag: 'Alkaline Electrolyte Infusion',
      desc: 'Enhanced mineral body, gentle alkalinity (pH ~8.0), rich in essential trace elements.',
      badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800'
    };
  };

  const currentTaste = getTasteProfile(targetTds);

  return (
    <div id="consumer-view" className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16 text-slate-100">

      {/* ----------------------------------------------------------------- */}
      {/* Toast Notification Alert Banner */}
      {/* ----------------------------------------------------------------- */}
      {actionNotification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-subtle">
          <div className="bg-slate-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-cyan-500/40 backdrop-blur-md flex items-center space-x-3 text-sm">
            <span className="text-lg">💧</span>
            <span className="font-medium text-slate-100">{actionNotification.message}</span>
            <button
              onClick={() => setActionNotification(null)}
              className="text-slate-400 hover:text-white text-xs ml-2 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 1: CINEMATIC AMBIENT VIDEO HERO BANNER                    */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-950 shadow-2xl min-h-[460px] sm:min-h-[500px] lg:min-h-[540px] flex items-center">
        
        {/* Background Atmospheric Video with Graceful Fallback */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          <video
            ref={videoRef}
            src="/assets/atomberg_purifier_showcase.mp4"
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
            className={`object-cover w-full h-full transition-opacity duration-1000 ${
              videoLoaded ? 'opacity-85 scale-100' : 'opacity-40 scale-105 blur-sm'
            }`}
          />
        </div>

        {/* Multi-Layered Cinematic Vignette & Edge Blend (Zero Harsh Borders) */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-slate-950/80 pointer-events-none z-10" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-slate-950/20 to-slate-950 pointer-events-none z-10" />

        {/* Top-Right Ambient Playback Controls */}
        <div className="absolute top-5 right-5 z-30 flex items-center space-x-2.5">
          {/* Play / Pause Toggle Button */}
          <button
            onClick={togglePlay}
            className="p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800/90 backdrop-blur-md border border-white/10 text-white shadow-lg transition-all active:scale-95 group"
            title={isPlaying ? 'Pause Ambient Showcase' : 'Play Ambient Showcase'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 fill-current text-slate-300 group-hover:text-cyan-400" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current text-slate-300 group-hover:text-emerald-400" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Mute / Unmute Toggle Button */}
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800/90 backdrop-blur-md border border-white/10 text-white shadow-lg transition-all active:scale-95 group"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <svg className="w-4 h-4 fill-current text-slate-300 group-hover:text-cyan-400" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current text-emerald-400" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          {/* Cinema View / Expand Modal Button */}
          <button
            onClick={() => setShowCinemaModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-full bg-cyan-950/80 hover:bg-cyan-900/90 backdrop-blur-md border border-cyan-500/40 text-cyan-200 text-xs font-semibold shadow-lg transition-all active:scale-95"
            title="Expand to Full Cinema View"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
            <span className="hidden sm:inline">Cinema View</span>
          </button>
        </div>

        {/* --------------------------------------------------------------- */}
        {/* Floating Telemetry & Control HUD (Rendered Over the Video)     */}
        {/* --------------------------------------------------------------- */}
        <div className="relative z-20 w-full p-6 sm:p-10 lg:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          
          {/* Left Overlay: Brand Badge, Title & Real-time Metrics Chip */}
          <div className="max-w-xl space-y-4">
            
            {/* Glowing Pulse Badge */}
            <div className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-lg shadow-emerald-950/40">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Atomberg Intellon Connected Ecosystem</span>
              <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-2 font-mono">v2.4-HIL</span>
            </div>

            {/* Heading */}
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-md">
                Pure & Mineral-Balanced Water
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-lg drop-shadow">
                Real-time physics-informed purification dynamically harmonizing BLDC booster motor torque, crossflow recovery flux, and alkaline mineral remineralization.
              </p>
            </div>

            {/* Real-time Metrics Chip Floating Over Water Stream */}
            <div className="inline-flex flex-wrap items-center gap-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 p-3 sm:p-4 rounded-2xl shadow-xl">
              
              {/* Tap TDS */}
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-600/40 flex items-center justify-center text-xs">
                  🚰
                </span>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-wider">Tap Feed</span>
                  <span className="text-sm font-bold font-mono text-amber-300">{Math.round(inletTds)} ppm</span>
                </div>
              </div>

              {/* Directional Flow Arrow */}
              <div className="text-cyan-400 font-bold text-sm px-1 animate-pulse">
                ➔
              </div>

              {/* Pure Output TDS */}
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-600/40 flex items-center justify-center text-xs">
                  ✨
                </span>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-wider">Pure Permeate</span>
                  <span className="text-sm font-bold font-mono text-emerald-300">{Math.round(outletTds)} ppm</span>
                </div>
              </div>

              {/* Salt Rejection Ratio */}
              <div className="border-l border-slate-700 pl-3">
                <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-wider">Salt Rejection (η)</span>
                <span className="text-sm font-bold font-mono text-cyan-300">{saltRejection}%</span>
              </div>

            </div>

          </div>

          {/* Right Overlay: Quick Actions Pill & Safe Drinking Days Card */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-4 self-start lg:self-center">
            
            {/* Real-Time Safe Drinking Days Countdown Card */}
            <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-2 min-w-[240px]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                Predictive Membrane Lifespan
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                  {rulDays}
                </span>
                <span className="text-sm font-bold text-cyan-400 font-mono">
                  Days Remaining
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                (±5 Day Accuracy | Est: {formattedProjectedDate})
              </p>
            </div>

            {/* Quick-action Glassmorphism Pill Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* ✨ AutoClean Micro-Flush */}
              <button
                id="hero-autoclean-btn"
                onClick={handleAutoCleanFlush}
                disabled={isFlushing}
                className={`flex-1 sm:flex-none px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg backdrop-blur-md ${
                  isFlushing
                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-400 animate-pulse cursor-wait'
                    : 'bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-500/40 text-cyan-200 active:scale-95 hover:shadow-cyan-500/20'
                }`}
              >
                <span>{isFlushing ? '🌊' : '✨'}</span>
                <span>{isFlushing ? `Flushing (${flushCountdown}s)` : 'AutoClean Flush'}</span>
              </button>

              {/* 🩺 Run System Diagnostics */}
              <button
                id="hero-diagnostics-btn"
                onClick={handleRunDiagnostics}
                disabled={isDiagnosing}
                className="flex-1 sm:flex-none px-4 py-3 rounded-2xl text-xs font-bold bg-slate-900/80 hover:bg-slate-800/90 border border-emerald-500/40 text-emerald-300 transition-all duration-200 active:scale-95 shadow-lg backdrop-blur-md hover:shadow-emerald-500/20 flex items-center justify-center space-x-2"
              >
                <span>{isDiagnosing ? '⏳' : '🩺'}</span>
                <span>{isDiagnosing ? 'Scanning...' : 'Run Diagnostics'}</span>
              </button>
            </div>

          </div>

        </div>

        {/* Dynamic Flush Progress Bar Banner (Triggered during AutoClean) */}
        {isFlushing && (
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-cyan-950/90 border-t border-cyan-500/40 backdrop-blur-md px-6 py-2.5 flex items-center justify-between text-xs text-cyan-200">
            <span className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span className="font-semibold">{flushFeedback}</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold">{flushCountdown}s remaining</span>
          </div>
        )}

      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 2: 4-MODE INTELLON PURIFIER CONTROLLER                     */}
      {/* ----------------------------------------------------------------- */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>⚙️</span>
              <span>Intellon Smart Purification Modes</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select an intelligent hydraulic operation mode to adapt motor torque, recovery ratio, and mineral infusion.
            </p>
          </div>
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold self-start sm:self-center">
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
                ? 'bg-slate-800/90 border-cyan-400 ring-2 ring-cyan-400/80 shadow-lg shadow-cyan-950/50'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🌿</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedMode === 'ADAPTIVE' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  Smart Eco
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Adaptive Flow</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Auto-adapts to changing tap TDS to optimize water recovery & minimize waste.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono font-semibold text-cyan-300 pt-2 border-t border-slate-800">
              Q: 1.20-1.40 L/min | Auto-Tune
            </div>
          </div>

          {/* Mode 2: Full RO+UV */}
          <div
            id="mode-ro-uv-card"
            onClick={() => handleModeChange('RO_UV')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              selectedMode === 'RO_UV'
                ? 'bg-slate-800/90 border-cyan-400 ring-2 ring-cyan-400/80 shadow-lg shadow-cyan-950/50'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🛡️</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedMode === 'RO_UV' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  Max Safety
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Full RO+UV</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Maximum rejection barrier for heavy metals, high salinity borewell water & microbes.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono font-semibold text-cyan-300 pt-2 border-t border-slate-800">
              Rejection: 95%+ | 0.95 A Head
            </div>
          </div>

          {/* Mode 3: TasteTune™ */}
          <div
            id="mode-tastetune-card"
            onClick={() => handleModeChange('TASTETUNE')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              selectedMode === 'TASTETUNE'
                ? 'bg-slate-800/90 border-cyan-400 ring-2 ring-cyan-400/80 shadow-lg shadow-cyan-950/50'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🎯</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedMode === 'TASTETUNE' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  Gourmet
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">TasteTune™</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Customizes taste by dialing preferred output mineral TDS to your exact palate.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono font-semibold text-cyan-300 pt-2 border-t border-slate-800">
              Dial: 30 - 150 ppm TDS
            </div>
          </div>

          {/* Mode 4: VacayMode */}
          <div
            id="mode-vacay-card"
            onClick={() => handleModeChange('VACAY')}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              selectedMode === 'VACAY'
                ? 'bg-slate-800/90 border-cyan-400 ring-2 ring-cyan-400/80 shadow-lg shadow-cyan-950/50'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">✈️</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedMode === 'VACAY' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  Anti-Stagnant
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">VacayMode</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Low intermittent auto-cleansing when away to prevent stagnant odor and bio-film.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono font-semibold text-cyan-300 pt-2 border-t border-slate-800">
              Idle: 0.20 L/min | 0.35 A Low
            </div>
          </div>

        </div>

        {/* ----------------------------------------------------------------- */}
        {/* TasteTune™ Interactive Slider (Renders when TASTETUNE is active)   */}
        {/* ----------------------------------------------------------------- */}
        {selectedMode === 'TASTETUNE' && (
          <div className="p-6 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-5 animate-fadeIn">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-sm font-bold text-white">
                    TasteTune™ Mineral Dial Selector
                  </h3>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${currentTaste.badgeColor}`}>
                    {currentTaste.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {currentTaste.desc}
                </p>
              </div>

              {/* Readout Badge */}
              <div className="flex items-baseline space-x-1.5 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 shadow-sm self-start sm:self-center">
                <span className="text-2xl font-black font-mono text-cyan-300">
                  {targetTds}
                </span>
                <span className="text-xs font-bold text-slate-400">ppm target</span>
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
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>30 ppm (Ultra Crisp)</span>
                <span className="font-bold text-white">75 ppm (Balanced Mineral)</span>
                <span>150 ppm (Rich Mineral)</span>
              </div>
            </div>

            {/* Profile Guidance Callout */}
            <div className="flex items-center space-x-3 text-xs bg-slate-900/70 p-3 rounded-xl border border-slate-800">
              <span className="text-lg">💡</span>
              <span className="text-slate-300">
                <strong>Taste Intelligence:</strong> Adjusting permeate mineral content regulates motor torque and post-carbon mineralization blend ratio dynamically.
              </span>
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Tap Water Source Selector Presets                                 */}
        {/* ----------------------------------------------------------------- */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span>🚰</span>
              <span>Tap Water Source Presets</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Current: <strong className="text-cyan-300">{sourceWater}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => handleSourceChange('MUNICIPAL')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                sourceWater === 'MUNICIPAL'
                  ? 'bg-slate-800/90 border-cyan-400 ring-1 ring-cyan-400 text-white'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">🏛️ Municipal Supply</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300">320 ppm</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Treated river water, low pump stress (0.72 A).</p>
            </button>

            <button
              onClick={() => handleSourceChange('BOREWELL')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                sourceWater === 'BOREWELL'
                  ? 'bg-slate-800/90 border-cyan-400 ring-1 ring-cyan-400 text-white'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">🏞️ Borewell Groundwater</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300">920 ppm</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Deep aquifer mineral hardness (0.85 A).</p>
            </button>

            <button
              onClick={() => handleSourceChange('TANKER')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                sourceWater === 'TANKER'
                  ? 'bg-slate-800/90 border-cyan-400 ring-1 ring-cyan-400 text-white'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">🚚 Hard Tanker Water</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-amber-300">1550 ppm</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Severe scaling risk, high head (0.98 A).</p>
            </button>
          </div>
        </div>

      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 3: PREDICTIVE HEALTH INTELLIGENCE & RUL DEGRADATION PANEL  */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <PredictiveHealthIntelligence
          telemetry={telemetry}
          mode="hil"
        />
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 4: INTERACTIVE PURIFIER TECHNICAL ILLUSTRATION            */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <InteractivePurifierIllustration
          telemetry={telemetry}
          mode="hil"
        />
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* DIAGNOSTIC SCAN REPORT MODAL                                      */}
      {/* ----------------------------------------------------------------- */}
      {showDiagnosticModal && diagnosticReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🩺</span>
                  <h3 className="text-xl font-black text-white">
                    Intellon Hardware Diagnostic Report
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Device: {diagnosticReport.device_id || 'ATOM-WP-2026-0042'} | Timestamp: {new Date(diagnosticReport.timestamp).toLocaleTimeString()}
                </p>
              </div>

              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold text-sm transition-all"
              >
                ✕
              </button>
            </div>

            {/* Overall System Health Scorecard */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Overall System Health Index
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-4xl font-black font-mono text-cyan-400">
                    {diagnosticReport.overall_health_score ?? 92.0}
                  </span>
                  <span className="text-sm font-bold text-slate-400">/ 100</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Status: <strong className="text-emerald-400">{diagnosticReport.system_status || 'NOMINAL'}</strong>
                </p>
              </div>

              <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-center self-start sm:self-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Evaluation Result</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {diagnosticReport.overall_health_score >= 80 ? '✅ All Systems Nominal' : '⚠️ Maintenance Advised'}
                </div>
              </div>
            </div>

            {/* Diagnostic Categories */}
            <div className="space-y-4">
              
              {/* Category 1: Booster Pump Integrity */}
              {diagnosticReport.diagnostics?.booster_pump && (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>⚡</span>
                      <span>Booster Pump Integrity</span>
                    </h4>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                      diagnosticReport.diagnostics.booster_pump.status === 'NOMINAL'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {diagnosticReport.diagnostics.booster_pump.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Current Draw:</span>
                      <strong className="text-white">{diagnosticReport.diagnostics.booster_pump.current_draw_amps} A</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Flow Rate:</span>
                      <strong className="text-white">{diagnosticReport.diagnostics.booster_pump.flow_rate_lpm} L/min</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Delivery Head:</span>
                      <strong className="text-white">{diagnosticReport.diagnostics.booster_pump.delivery_pressure_bar} bar</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {diagnosticReport.diagnostics.booster_pump.details}
                  </p>
                </div>
              )}

              {/* Category 2: RO Membrane Core & Fouling */}
              {diagnosticReport.diagnostics?.ro_membrane && (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>🌀</span>
                      <span>RO Membrane Fouling & Scaling</span>
                    </h4>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {diagnosticReport.diagnostics.ro_membrane.fouling_level}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Cake Res. R_cake:</span>
                      <strong className="text-white">{diagnosticReport.diagnostics.ro_membrane.cake_resistance} kPa·s/L</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Salt Rejection:</span>
                      <strong className="text-white">{diagnosticReport.diagnostics.ro_membrane.salt_rejection_pct}%</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Washdown State:</span>
                      <strong className="text-white">{diagnosticReport.diagnostics.ro_membrane.washdown_active ? 'Flushing' : 'Nominal'}</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {diagnosticReport.diagnostics.ro_membrane.details}
                  </p>
                </div>
              )}

              {/* Category 3: Alkaline Remineralizer */}
              {diagnosticReport.diagnostics?.alkaline_remineralizer && (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>🌱</span>
                      <span>Alkaline Remineralizer Balance</span>
                    </h4>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {diagnosticReport.diagnostics.alkaline_remineralizer.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Mineral Elution:</span>
                      <strong className="text-white">+{diagnosticReport.diagnostics.alkaline_remineralizer.delta_mineral_ppm} ppm</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Cartridge Health:</span>
                      <strong className="text-white">{diagnosticReport.diagnostics.alkaline_remineralizer.alkaliser_health_pct}%</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {diagnosticReport.diagnostics.alkaline_remineralizer.details}
                  </p>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={handleRunDiagnostics}
                disabled={isDiagnosing}
                className="px-4 py-2 rounded-full text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600 transition-all"
              >
                🔄 Re-scan Hardware
              </button>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="px-5 py-2 rounded-full text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-500 transition-all"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* CINEMA VIEW / EXPAND MODAL OVERLAY                                */}
      {/* ----------------------------------------------------------------- */}
      {showCinemaModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-8 animate-fadeIn">
          
          {/* Cinema Header */}
          <div className="w-full max-w-5xl flex items-center justify-between pb-4 text-white">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping"></span>
              <h2 className="text-lg font-bold tracking-tight">
                Atomberg Intellon Purifier • 4K Cinematic Showcase
              </h2>
            </div>
            <button
              onClick={() => setShowCinemaModal(false)}
              className="px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all"
            >
              ✕ Close Cinema
            </button>
          </div>

          {/* High-Resolution Video Player */}
          <div className="w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative">
            <video
              ref={cinemaVideoRef}
              src="/assets/atomberg_purifier_showcase.mp4"
              autoPlay
              controls
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          <div className="w-full max-w-5xl pt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Atmospheric Product Render • High-Fidelity Audio Active</span>
            <span className="font-mono">HydroTwin-PHM Industrial Digital Twin v2.4</span>
          </div>

        </div>
      )}

    </div>
  );
}

export default ConsumerView;
