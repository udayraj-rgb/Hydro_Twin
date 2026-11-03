import React, { useRef, useEffect } from 'react';

/**
 * ConsumerVideoShowcase
 * 
 * Continuous Ambient Video Showcase Banner for Atomberg Intellon Water Purifier.
 * Designed to play 100% continuously without pausing, stopping, or audio,
 * providing a premium, professional brand look directly above the Consumer Dashboard.
 */
function ConsumerVideoShowcase({ telemetry = null }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Strict browser autoplay policy configuration (must be muted)
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const playVideo = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[HydroTwin Video] Autoplay retry:', err);
          setTimeout(() => {
            if (video) {
              video.muted = true;
              video.play().catch(() => {});
            }
          }, 300);
        });
      }
    };

    playVideo();

    // Ensure playback resumes if user switches tabs and returns
    const handleVisibilityChange = () => {
      if (!document.hidden && video) {
        video.muted = true;
        video.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Safety interlocks: if paused or ended, restart immediately to ensure continuous loop
  const handlePause = (e) => {
    e.target.muted = true;
    e.target.play().catch(() => {});
  };

  const handleEnded = (e) => {
    e.target.currentTime = 0;
    e.target.muted = true;
    e.target.play().catch(() => {});
  };

  const outletTds = Math.round(
    telemetry?.sensors?.outlet_tds ?? telemetry?.physics?.outlet_tds ?? 42
  );
  const rejection = Number(
    telemetry?.physics?.salt_rejection ?? telemetry?.salt_rejection ?? 95.2
  ).toFixed(1);

  const videoSrc = `${process.env.PUBLIC_URL}/atomberg_showcase.mp4`;

  return (
    <section className="px-6 sm:px-10 pt-6 pb-6 border-b border-[#E1ECD9] bg-gradient-to-b from-[#FAFCF7] via-[#F4F9F0] to-[#FAFCF7] animate-fadeIn">
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Top Tagline Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-[#96BF48] font-black text-sm tracking-widest">▶▶</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#576C4D]">
              Atomberg Intellon Flagship Showcase
            </span>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center px-3 py-1 rounded-full bg-[#EAEFE5] border border-[#BACAB3] text-[#3E4D37] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#6C8360] animate-pulse"></span>
            <span>Continuous Ambient Product Stream</span>
          </div>
        </div>

        {/* Cinematic Video Showcase Frame */}
        <div className="relative w-full rounded-3xl overflow-hidden border border-[#DCE4D6] shadow-md bg-[#1F2D19] aspect-[16/9] md:aspect-[21/9] max-h-[520px]">
          
          {/* Native HTML5 Continuous Video (Muted, AutoPlay, Loop, Inline) */}
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            disableRemotePlayback
            preload="auto"
            onPause={handlePause}
            onEnded={handleEnded}
            className="w-full h-full object-cover select-none pointer-events-none"
          />

          {/* Top-Left Floating Brand Pill */}
          <div className="absolute top-4 left-4 sm:top-5 sm:left-6 z-10 flex items-center space-x-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#DCE4D6] shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6C8360] animate-ping"></span>
            <span className="text-xs font-black text-[#2A3525]">Atomberg Intellon</span>
            <span className="text-[10px] text-[#54684A] font-semibold hidden sm:inline">
              Smart IoT Water Purifier
            </span>
          </div>

          {/* Top-Right Floating Live Metric Pill */}
          <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-10 flex items-center space-x-2 bg-[#2A3525]/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-white shadow-md font-mono text-xs">
            <span className="text-sm">💎</span>
            <span className="font-bold">{rejection}%</span>
            <span className="text-[10px] text-white/75 font-sans">Pure Permeate</span>
          </div>

          {/* Subtle Bottom Gradient Scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent pointer-events-none"></div>

          {/* Bottom Floating Info Scrim on the Video */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-white pointer-events-none">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#B5D7A9] font-mono">
                Hardware Engineering & Modern Aesthetics
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">
                Pure Water, Intelligently Delivered.
              </h2>
              <p className="text-xs text-white/85 max-w-lg leading-relaxed drop-shadow hidden md:block">
                Brushless DC booster pump technology with real-time Darcy-Hermia physical telemetry and adaptive mineral infusion.
              </p>
            </div>

            <div className="flex items-center space-x-3 self-start sm:self-end bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/30 text-white shadow-lg shrink-0">
              <div className="text-2xl">🚰</div>
              <div>
                <div className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Filtered Purity</div>
                <div className="text-base font-black font-mono leading-tight">{outletTds} ppm • pH ~7.8</div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

export default ConsumerVideoShowcase;
