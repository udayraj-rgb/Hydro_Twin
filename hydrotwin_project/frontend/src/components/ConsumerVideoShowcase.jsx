import React, { useRef, useEffect, useState } from 'react';

/**
 * ConsumerVideoShowcase
 * 
 * Continuous Ambient Video Showcase Banner for Atomberg Intellon Water Purifier.
 * Plays smoothly and continuously with an interactive Mute / Unmute audio toggle,
 * styled in the signature White & Olive professional brand aesthetic.
 */
function ConsumerVideoShowcase({ telemetry = null }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Start muted to comply with browser autoplay requirements
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const playVideo = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[HydroTwin Video] Autoplay delayed, retrying muted:', err);
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
        video.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Guarantee continuous playback: if paused or ended, restart immediately
  const handlePause = (e) => {
    e.target.play().catch(() => {});
  };

  const handleEnded = (e) => {
    e.target.currentTime = 0;
    e.target.play().catch(() => {});
  };

  // Toggle Mute / Unmute sound
  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      // Ensure playback is active when unmuting
      videoRef.current.play().catch(() => {});
    }
  };

  const videoSrc = `${process.env.PUBLIC_URL}/atomberg_showcase.mp4`;

  return (
    <section className="px-6 sm:px-10 pt-6 pb-6 border-b border-[#E1ECD9] bg-gradient-to-b from-[#FAFCF7] via-[#F4F9F0] to-[#FAFCF7] animate-fadeIn">
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Top Tagline Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#6C8360]"></span>
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
          
          {/* Native HTML5 Continuous Video */}
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
          <div className="absolute top-4 left-4 sm:top-5 sm:left-6 z-20 flex items-center space-x-2.5 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#DCE4D6] shadow-md pointer-events-auto">
            <div className="w-7 h-7 rounded-full bg-[#1F2D19] overflow-hidden flex items-center justify-center border border-[#384828]/50 shrink-0 shadow-sm p-0.5">
              <img
                src={`${process.env.PUBLIC_URL}/assets/hydrotwin_emblem.png`}
                alt="HydroTwin Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xs font-black text-[#2A3525]">HydroTwin–PHM</span>
            <span className="text-gray-300">•</span>
            <a
              href="https://atomberg.com/products/intellon-waterpurifier"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
              title="Visit Atomberg Intellon Water Purifier Official Page"
            >
              <img
                src={`${process.env.PUBLIC_URL}/assets/atomberg_logo.png`}
                alt="Atomberg"
                className="h-3.5 w-auto object-contain hover:scale-105 transition-transform"
              />
            </a>
          </div>

          {/* Top-Right Controls: Mute/Unmute Button & Purity Metric */}
          <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-20 flex items-center space-x-2.5 pointer-events-auto">
            
            {/* Interactive Audio Mute / Unmute Button */}
            <button
              id="video-mute-toggle-btn"
              type="button"
              onClick={toggleMute}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/95 hover:bg-white text-[#142010] border border-[#BACAB3] shadow-md backdrop-blur-md transition-all duration-200 active:scale-95 text-xs font-black cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? (
                <>
                  <svg className="w-4 h-4 text-[#1F2D19]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                  <span>Unmute Audio</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-[#4E7A3D] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <span>Mute Audio</span>
                </>
              )}
            </button>
          </div>

          {/* Subtle Bottom Gradient Scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none"></div>

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
          </div>

        </div>

      </div>
    </section>
  );
}

export default ConsumerVideoShowcase;
