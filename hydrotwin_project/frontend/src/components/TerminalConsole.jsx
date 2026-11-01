import React, { useState, useEffect, useRef } from 'react';

/**
 * TerminalConsole: Live MQTT & SQLite Ingestion Serial Emulator
 * Appends incoming telemetry frames with timestamps, device ID, resistances,
 * and status flags. Features auto-scroll, stream pause/resume, and buffer clearing.
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
      // Keep maximum 100 historical log lines to prevent DOM bloat
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* ----------------------------------------------------------------- */}
      {/* Terminal Header Bar */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Mac/Linux terminal dots */}
          <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          <span className="text-xs font-mono font-bold text-slate-300 ml-2">
            SQLite / MQTT Virtual Serial Console (/dev/ttyUSB0)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            {logs.length} packet(s)
          </span>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded transition-all ${
              isPaused
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>

          <button
            onClick={handleClear}
            className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Terminal Output Area */}
      {/* ----------------------------------------------------------------- */}
      <div
        ref={scrollRef}
        className="bg-black/95 p-4 font-mono text-xs text-emerald-400 h-48 sm:h-56 overflow-y-auto space-y-1 selection:bg-emerald-500 selection:text-black"
      >
        {logs.map((log, index) => {
          const isError = log.includes('TRIP') || log.includes('CRITICAL');
          const isFlush = log.includes('FLUSH');
          const isSys = log.includes('[SYSTEM]');

          let colorClass = 'text-emerald-400';
          if (isError) colorClass = 'text-rose-400 font-bold';
          else if (isFlush) colorClass = 'text-cyan-300 font-semibold';
          else if (isSys) colorClass = 'text-slate-400';

          return (
            <div key={index} className={`leading-relaxed break-all ${colorClass}`}>
              <span className="text-slate-600 mr-1.5 select-none">&gt;</span>
              {log}
            </div>
          );
        })}

        {/* Pulsing Command Prompt Cursor */}
        <div className="flex items-center text-emerald-500 pt-1">
          <span className="text-slate-600 mr-1.5">&gt;</span>
          <span className="w-2 h-4 bg-emerald-500 animate-pulse inline-block"></span>
        </div>
      </div>
    </div>
  );
}

export default TerminalConsole;
