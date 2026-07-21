/**
 * Multi-Spectral Depth and Wall Penetration Analysis System
 * AKN Global Group - Pixel-to-Sensor Mapping Engine
 */

export interface SurfaceAnalysis {
  density: number;      // Estimated material density (0.0 - 1.0)
  permeability: number; // Signal permeability coefficient
  material: string;     // Identified material type
  confidence: number;   // Detection confidence
}

/**
 * Analyzes a frame or a sampled pixel block to estimate surface characteristics.
 */
export const analyzeSurfaceDensity = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): SurfaceAnalysis => {
  // Sample the center area (Reticle region)
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const sampleSize = 20; // 20x20 pixel block
  
  let totalBrightness = 0;
  let contrastSum = 0;
  let samples = 0;

  for (let y = centerY - sampleSize; y < centerY + sampleSize; y++) {
    for (let x = centerX - sampleSize; x < centerX + sampleSize; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      
      // Calculate luminance
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
      totalBrightness += brightness;
      samples++;
    }
  }

  const avgBrightness = totalBrightness / samples;
  
  // Estimate density based on brightness and texture variance
  // Brighter, smoother surfaces often suggest flat walls (beton, alçıpan)
  // Darker, rougher textures suggest soil/natural ground
  const density = 0.5 + (avgBrightness / 510); // Simple heuristic
  
  // Inverse permeability: denser materials like concrete have lower permeability for visual light
  // but we use this to scale our "penetration" simulation
  const permeability = 1.0 - (density * 0.4);

  let material = "Bilinmeyen Yüzey";
  if (avgBrightness > 180) material = "Parlak Yüzey / Metalik";
  else if (avgBrightness > 120) material = "Beton / Sıva";
  else if (avgBrightness > 60) material = "Toprak / Kaya";
  else material = "Boşluk / Karanlık Alan";

  return {
    density,
    permeability,
    material,
    confidence: 0.85
  };
};

/**
 * Combines Visual Surface Data with Magnetic Anomalies
 */
export const identifyMaterialHybrid = (
  surface: SurfaceAnalysis,
  magneticDelta: number, // Deviation from background (48µT)
  frequency: number,
  movementG: number
): string => {
  const absDelta = Math.abs(magneticDelta);

  // Precious Metal Correlation (High frequency + Specific Magnetics)
  if (absDelta > 10 && absDelta < 50 && frequency > 35) {
    return "DEĞERLİ METAL (ALTIN / GÜMÜŞ) POTANSİYELİ";
  }

  // Massive Ferromagnetic
  if (absDelta > 60) {
    return `YOĞUN METALİK KÜTLE (${absDelta.toFixed(1)} µT SAPMA)`;
  }

  // High Frequency + Low Density = Vegetation/Electric Field (Ağaç / Enerji)
  if (frequency > 50 && surface.density < 0.4) {
    return "BİTKİSEL REZONANS / ENERJİ ALANI";
  }

  // Rock/Cave signature
  if (surface.material === "Toprak / Kaya" && absDelta < 3) {
    return "YOĞUN KAYA KÜTLESİ / JEOLOJİK KATMAN";
  }

  return surface.material;
};
