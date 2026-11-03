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
 * - Pre-Sediment Vacuum Resistance (R_sediment - Earthy Amber/Bronze)
 * - RO Surface Cake Layer Resistance (R_cake - Dusty Olive)
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
        borderColor: '#9E7836', // Warm Earthy Bronze / Amber
        backgroundColor: 'rgba(158, 120, 54, 0.08)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: '#9E7836',
        tension: 0.35,
        fill: true
      },
      {
        label: 'RO Surface Cake Layer Resistance (R_cake)',
        data: history.rCake,
        borderColor: '#6C8360', // Core Dusty Olive
        backgroundColor: 'rgba(108, 131, 96, 0.12)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: '#6C8360',
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
          color: '#2A3525',
          font: {
            size: 11,
            weight: '600',
            family: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'
          },
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        titleColor: '#2A3525',
        bodyColor: '#54684A',
        borderColor: '#BACAB3',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true
      }
    },
    scales: {
      x: {
        grid: {
          color: '#EAEFE5',
          drawBorder: false
        },
        ticks: {
          color: '#788870',
          font: {
            size: 10,
            family: 'ui-monospace, SFMono-Regular, monospace'
          }
        }
      },
      y: {
        grid: {
          color: '#EAEFE5',
          drawBorder: false
        },
        ticks: {
          color: '#788870',
          font: {
            size: 10,
            family: 'ui-monospace, SFMono-Regular, monospace'
          },
          callback: (value) => `${value} kPa·s/L`
        },
        title: {
          display: true,
          text: 'Hydraulic Resistance (kPa·s/L)',
          color: '#54684A',
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
    <div className="bg-white border border-[#DCE4D6] rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
      {/* Header and Live Readout Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[#E3E9DE] gap-3">
        <div>
          <h3 className="text-base font-bold text-[#2A3525] flex items-center space-x-2">
            <svg className="w-4 h-4 text-[#849C77]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>Darcy-Hermia Multi-Stage Hydraulic Decoupling Engine</span>
          </h3>
          <p className="text-xs text-[#6C7E66] mt-0.5">
            Rolling 15-second decoupling curves isolating pre-sediment clogging vs. RO cake nucleation.
          </p>
        </div>

        {/* Instantaneous KPI Readouts */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          <div className="px-3 py-1 bg-[#FAF5EB] border border-[#DFD3BE] rounded-lg text-[#826947]">
            <span className="text-[10px] text-[#826947]/80 uppercase mr-1">R_sed:</span>
            <span className="font-bold">{Number(currentSed).toFixed(2)}</span>
          </div>

          <div className="px-3 py-1 bg-[#EAEFE5] border border-[#BACAB3] rounded-lg text-[#3E4D37]">
            <span className="text-[10px] text-[#54684A] uppercase mr-1">R_cake:</span>
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
