import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MAX_POINTS = 15;

/**
 * TelemetryCharts: Visualizes real-time Darcy-Hermia multi-stage hydraulic decoupling.
 * Rolling 15-point historical window tracking:
 * - Pre-Sediment Vacuum Resistance (R_sediment - Amber)
 * - RO Surface Cake Layer Resistance (R_cake - Cyan)
 */
function TelemetryCharts({ telemetry = null }) {
  // Initialize rolling window buffers
  const [history, setHistory] = useState(() => {
    const initialLabels = Array.from({ length: MAX_POINTS }, (_, i) => `T-${MAX_POINTS - 1 - i}s`);
    const initialSed = Array(MAX_POINTS).fill(0.60);
    const initialCake = Array(MAX_POINTS).fill(0.10);
    return {
      labels: initialLabels,
      rSed: initialSed,
      rCake: initialCake
    };
  });

  const lastSeqRef = useRef(null);

  // Ingest incoming telemetry packets
  useEffect(() => {
    if (!telemetry) return;

    // Prevent duplicate entries if same sequence arrives
    const seq = telemetry.sequence_id ?? telemetry.timestamp ?? Math.random();
    if (seq === lastSeqRef.current) return;
    lastSeqRef.current = seq;

    const currentRsed = telemetry.physics?.r_sediment ?? telemetry.r_sediment ?? 0.60;
    const currentRcake = telemetry.physics?.r_cake ?? telemetry.r_cake ?? 0.10;

    setHistory((prev) => {
      const nextLabels = [...prev.labels.slice(1), 'T-0s'];
      // Re-index labels from T-14s down to T-0s
      const reindexedLabels = nextLabels.map((_, idx) => `T-${MAX_POINTS - 1 - idx}s`);
      const nextSed = [...prev.rSed.slice(1), currentRsed];
      const nextCake = [...prev.rCake.slice(1), currentRcake];

      return {
        labels: reindexedLabels,
        rSed: nextSed,
        rCake: nextCake
      };
    });
  }, [telemetry]);

  const chartData = {
    labels: history.labels,
    datasets: [
      {
        label: 'Pre-Sediment Vacuum Resistance (R_sediment)',
        data: history.rSed,
        borderColor: '#f59e0b', // Amber-500
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: '#f59e0b',
        tension: 0.35,
        fill: true
      },
      {
        label: 'RO Surface Cake Layer Resistance (R_cake)',
        data: history.rCake,
        borderColor: '#06b6d4', // Cyan-500
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: '#06b6d4',
        tension: 0.35,
        fill: true
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1', // Slate-300
          font: {
            size: 11,
            weight: '600',
            family: 'ui-sans-serif, system-ui, sans-serif'
          },
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true
      }
    },
    scales: {
      x: {
        grid: {
          color: '#1e293b', // Slate-800
          drawBorder: false
        },
        ticks: {
          color: '#64748b', // Slate-500
          font: {
            size: 10,
            family: 'ui-monospace, SFMono-Regular, monospace'
          }
        }
      },
      y: {
        grid: {
          color: '#1e293b',
          drawBorder: false
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 10,
            family: 'ui-monospace, SFMono-Regular, monospace'
          },
          callback: (value) => `${value} kPa·s/L`
        },
        title: {
          display: true,
          text: 'Hydraulic Resistance (kPa·s/L)',
          color: '#64748b',
          font: {
            size: 11,
            weight: 'bold'
          }
        },
        min: 0.0,
        suggestedMax: 2.5
      }
    }
  };

  const currentSed = history.rSed[history.rSed.length - 1];
  const currentCake = history.rCake[history.rCake.length - 1];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
      {/* Header and Live Readout Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span className="text-amber-400">📈</span>
            <span>Darcy-Hermia Multi-Stage Hydraulic Decoupling Engine</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Rolling 15-second decoupling curves isolating pre-sediment clogging vs. RO cake nucleation.
          </p>
        </div>

        {/* Instantaneous KPI Readouts */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          <div className="px-3 py-1 bg-amber-950/60 border border-amber-800/80 rounded-lg text-amber-300">
            <span className="text-[10px] text-amber-400/80 uppercase mr-1">R_sed:</span>
            <span className="font-bold">{Number(currentSed).toFixed(2)}</span>
          </div>

          <div className="px-3 py-1 bg-cyan-950/60 border border-cyan-800/80 rounded-lg text-cyan-300">
            <span className="text-[10px] text-cyan-400/80 uppercase mr-1">R_cake:</span>
            <span className="font-bold">{Number(currentCake).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

export default TelemetryCharts;
