"use client";

import { useEffect, useRef, useCallback } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface EnergyCurvePoint {
  hour: number;
  hour_label: string;
  energy: number;
}

interface UPlotEnergyChartProps {
  data: EnergyCurvePoint[];
  peakHour?: string;
  peakEnergy?: number;
  height?: number;
  className?: string;
}

export default function UPlotEnergyChart({
  data,
  peakHour,
  peakEnergy,
  height = 160,
  className = "",
}: UPlotEnergyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  const createChart = useCallback(() => {
    if (!containerRef.current || data.length === 0) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    // Prepare data for uPlot: [x-values, y-values]
    const timestamps = data.map((d) => d.hour);
    const energies = data.map((d) => d.energy);

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth,
      height,
      ms: 1,
      series: [
        {
          label: "Hour",
          value: (_u, v) => (v === null ? "-" : `${v}:00`),
        },
        {
          label: "Energy",
          stroke: "#5b4fc4",
          width: 2,
          fill: "rgba(91, 79, 196, 0.1)",
          points: {
            show: false,
          },
          value: (_u, v) => (v === null ? "-" : `${Math.round(v)}%`),
        },
      ],
      axes: [
        {
          stroke: "#857F75",
          grid: {
            stroke: "#1c1c2e",
            width: 0.5,
          },
          ticks: {
            stroke: "#1c1c2e",
            width: 0.5,
          },
          font: "10px",
          size: 20,
          splits: data.map((d) => d.hour),
          values: (_u: uPlot, v: number[]) => v.map((val) => {
            const point = data.find((d) => d.hour === val);
            return point ? point.hour_label : `${val}:00`;
          }),
        },
        {
          stroke: "#857F75",
          grid: {
            stroke: "#1c1c2e",
            width: 0.5,
          },
          ticks: {
            stroke: "#1c1c2e",
            width: 0.5,
          },
          font: "10px",
          size: 30,
          values: (_u: uPlot, v: number[]) => v.map((val) => `${Math.round(val)}%`),
        },
      ],
      scales: {
        x: {
          time: false,
        },
      },
      cursor: {
        points: {
          fill: "#5b4fc4",
          stroke: "#fff",
          width: 1,
          size: 6,
        },
      },
      legend: {
        show: false,
      },
      padding: [10, 10, 10, 10],
    };

    chartRef.current = new uPlot(opts, [timestamps, energies], containerRef.current);
  }, [data, height]);

  useEffect(() => {
    createChart();

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.setSize({
          width: containerRef.current.clientWidth,
          height,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [createChart, height]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full" />
      {peakHour != null && peakEnergy != null && (
        <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/20">
          <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
          <span className="text-xs text-[#F2EFE9]/80">
            Peak: {peakHour} ({Math.round(peakEnergy)} energy)
          </span>
        </div>
      )}
    </div>
  );
}
