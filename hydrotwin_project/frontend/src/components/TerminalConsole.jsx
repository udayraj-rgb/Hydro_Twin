import React, { useState, useEffect, useRef } from 'react';

/**
 * TerminalConsole: Live MQTT & SQLite Ingestion Serial Emulator
 * Appends incoming telemetry frames with timestamps, device ID, resistances,
 * and status flags in an authentic deep forest olive terminal.
 */
function TerminalConsole({ telemetry = null }) {
  const [logs, setLogs] = useState(() => [
    `[${new Date().toISOString()}] [SYSTEM] HydroTwin-PHM Virtual Serial Bus initialized (115200 baud).`,
    `[${new Date().toISOString()}] [SYSTEM] Listening for 1 Hz edge telemetry packets...`
  ]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef(null);
  const lastPacketRef = useRef(null);

  // Ingest incoming telemetry packets
  useEffect(() => {
    if (!telemetry || isPaused) return;

    const seq = telemetry.sequence_id ?? telemetry.timestamp ?? Math.random();
    if (seq === lastPacketRef.current) return;
    lastPacketRef.current = seq;

    const ts = telemetry.timestamp || new Date().toISOString();
    const devId = telemetry.device_id || 'ATOM-WP-2026-0042';
    const inTds = telemetry.sensors?.inlet_tds ?? telemetry.inlet_tds ?? 850;
    const outTds = telemetry.sensors?.outlet_tds ?? telemetry.outlet_tds ?? 42;
    const flow = Number(telemetry.sensors?.flow_lpm ?? telemetry.flow_lpm ?? 1.20).toFixed(2);
    const curr = Number(telemetry.sensors?.pump_current ?? telemetry.pump_current ?? 0.85).toFixed(2);
    const rSed = Number(telemetry.physics?.r_sediment ?? telemetry.r_sediment ?? 0.60).toFixed(2);
    const rCake = Number(telemetry.physics?.r_cake ?? telemetry.r_cake ?? 0.10).toFixed(2);
    const status = telemetry.status || 'NOMINAL';

    const logLine = `[${ts}] [DEV:${devId}] TDS:${inTds}->${outTds}ppm | ${flow}L/m | ${curr}A | R_sed:${rSed} | R_cake:${rCake} | [${status}]`;

    setLogs((prev) => {
      const next = [...prev, logLine];
      return next.length > 100 ? next.slice(-100) : next;
    });
  }, [telemetry, isPaused]);

  // Auto-scroll to bottom on new log entry
  useEffect(() => {
    if (scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const handleClear = () => {
    setLogs([`[${new Date().toISOString()}] [SYSTEM] Terminal buffer cleared by operator.`]);
  };

  return (
    <div className="bg-white border border-[#DCE4D6] rounded-2xl overflow-hidden shadow-sm">
      {/* ----------------------------------------------------------------- */}
      {/* Terminal Header Bar */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-[#F4F6F0] px-4 py-2.5 border-b border-[#DCE4D6] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-md bg-[#1F2D19] border border-[#384828]/60 flex items-center justify-center p-0.5 shadow-sm shrink-0 overflow-hidden">
            <img
              src={`${process.env.PUBLIC_URL}/assets/hydrotwin_emblem.png`}
              alt="HydroTwin Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xs font-mono font-black text-[#142010] ml-1">
            SQLite / MQTT Virtual Serial Console (/dev/ttyUSB0)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono font-bold text-[#1F2D19] hidden sm:inline">
            {logs.length} packet(s)
          </span>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all border ${
              isPaused
                ? 'bg-[#FAF5EB] text-[#6B4B1C] border-[#DFD3BE]'
                : 'bg-white text-[#142010] border-[#BACAB3] hover:bg-[#EAEFE5]'
            }`}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>

          <button
            onClick={handleClear}
            className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg bg-white hover:bg-[#EAEFE5] border border-[#BACAB3] text-[#142010] transition-all"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Terminal Output Area: Deep Forest Night Olive */}
      {/* ----------------------------------------------------------------- */}
      <div
        ref={scrollRef}
        className="bg-[#1C2419] p-4 font-mono text-xs text-[#B8D7B0] h-48 overflow-y-auto space-y-1 selection:bg-[#6C8360] selection:text-white"
      >
        {logs.map((log, index) => {
          const isError = log.includes('TRIP') || log.includes('CRITICAL');
          const isFlush = log.includes('FLUSH');

          return (
            <div
              key={index}
              className={`leading-relaxed whitespace-pre-wrap font-mono ${
                isError
                  ? 'text-rose-400 font-bold bg-rose-950/40 px-1 py-0.5 rounded'
                  : isFlush
                  ? 'text-teal-300 font-semibold'
                  : 'text-[#B8D7B0]'
              }`}
            >
              {log}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TerminalConsole;
