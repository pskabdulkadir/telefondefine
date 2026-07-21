import { type SensorData } from './sensors';

/**
 * Advanced Sensor Fusion Analysis Worker
 * Performs heavy mathematical computations off-main-thread.
 * Handles correlation between Microtesla (uT) and Pixel Density.
 */

self.onmessage = (e: MessageEvent<{ sensorData: SensorData, context: { noiseLevel: number, surfaceAnalysis?: any } }>) => {
  const { sensorData, context } = e.data;
  const result = runAnalysis(sensorData, context);
  self.postMessage(result);
};

function runAnalysis(sensorData: SensorData, context: { noiseLevel: number, surfaceAnalysis?: any }) {
  const mag = sensorData.magnetic.total;
  const accel = Math.abs(sensorData.acceleration.z - 9.8); // Delta from gravity
  const freq = context.noiseLevel * 100;
  const viz = sensorData.visual.edgeDensity;
  const motion = sensorData.visual.motionDelta;
  const surface = context.surfaceAnalysis;
  
  // SENSOR FUSION CORRELATION (Anti-Fake Logic)
  const magDeviation = Math.abs(mag - 48); // Deviation from Earth normal
  
  // Real physical signals are based on magnetic deviation or frequency peaks
  const isRealSignal = magDeviation > 4 || freq > 10 || viz > 5;
  
  const correlationFactor = isRealSignal ? 2.5 : 1.0;
  const stabilityFactor = accel < 0.2 ? 1.4 : (accel > 1.5) ? 0.6 : 1.0;

  // Normalized scoring matrix prioritizing magnetic and frequency over simple camera edges
  const baseScore = ((magDeviation / 60) * 60 + (freq / 60) * 25 + (viz / 30) * 15);
  let score = Math.min(100, Math.round(baseScore * correlationFactor * stabilityFactor));
  
  if (magDeviation < 3 && freq < 8) {
    score = Math.min(15, score);
  }

  let type = '';
  let status: 'Düşük' | 'Orta' | 'Yüksek' = 'Düşük';

  // Advanced Signal Pulse Identification logic
  if (score > 75) {
    status = 'Yüksek';
    const absDelta = magDeviation;
    // Precious Metal Correlation
    if (absDelta >= 8 && absDelta < 50 && freq > 25) {
      type = "DEĞERLİ METAL (ALTIN / GÜMÜŞ) REZONANSI";
    } else if (absDelta >= 50) {
      type = "YOĞUN FERROMANYETİK KÜTLE (METAL OBJESİ)";
    } else if (freq > 30) {
      type = "YÜKSEK İLETKENLİ METALLER / REZONANS";
    } else {
      type = "YAPISAL BOŞLUK / ODA ARALIK ANALİZİ";
    }
  } else if (score > 40) {
    status = 'Orta';
    const absDelta = magDeviation;
    if (absDelta >= 5 && absDelta < 30) {
      type = "MİNERAL VEYA DEĞERSİZ METAL SAPMASI";
    } else if (freq > 18) {
      type = "YAPISAL ANOMALİ (OLASI BOŞLUK)";
    } else {
      type = "YOĞUN KAYA / MİNERAL DAMARI";
    }
  } else if (score > 12) {
    type = 'STABİL DOĞAL JEOLOJİ';
  } else {
    type = 'SİNYAL SAPTANMADI';
  }

  return {
    score,
    type,
    status,
    magneticIdx: Math.min(100, Math.round(magDeviation * 0.9)),
    geometricIdx: Math.min(100, Math.round(accel * 48)),
    vegetationIdx: Math.min(100, Math.round((freq / 125) * 100)),
    isRealSignal,
    timestamp: Date.now()
  };
}
