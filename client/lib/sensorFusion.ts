import { useState, useEffect, useRef } from 'react';
import { type SensorData } from './sensors';

/**
 * SensorFusion Manager
 * Integrates hardware data with background Web Worker analysis.
 * Ensures zero fake data by directly mapping API outputs.
 */

export interface AnalysisResult {
  score: number;
  type: string;
  status: 'Düşük' | 'Orta' | 'Yüksek';
  magneticIdx: number;
  geometricIdx: number;
  vegetationIdx: number;
  isRealSignal: boolean;
  timestamp: number;
}

export const useSensorFusion = (sensorData: SensorData, noiseLevel: number, surfaceAnalysis?: any) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Web Worker using Vite-friendly URL
    workerRef.current = new Worker(new URL('./sensorWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<AnalysisResult>) => {
      setAnalysis(e.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (workerRef.current && sensorData) {
      // Offload heavy processing to the worker
      workerRef.current.postMessage({
        sensorData,
        context: { noiseLevel, surfaceAnalysis }
      });
    }
  }, [sensorData, noiseLevel, surfaceAnalysis]);

  return analysis;
};
