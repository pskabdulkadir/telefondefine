export interface VisualAnalysis {
  edgeDensity: number;
  brightnessVariancy: number;
  motionDelta: number;
}

export class VisualProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private lastImageData: Uint8ClampedArray | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 160; // Low res for performance
    this.canvas.height = 120;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  public analyzeFrame(video: HTMLVideoElement): VisualAnalysis {
    if (!this.ctx || video.readyState < 2) {
      return { edgeDensity: 0, brightnessVariancy: 0, motionDelta: 0 };
    }

    this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
    const frame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = frame.data;
    
    let edgePixels = 0;
    let totalBrightness = 0;
    let motionPixels = 0;

    // Fast Grey-scale & Edge Detection (Sobel-like logic)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = (r + g + b) / 3;
      
      totalBrightness += avg;

      // Motion Detection compared to last frame
      if (this.lastImageData) {
        const diff = Math.abs(avg - this.lastImageData[i / 4]);
        if (diff > 30) motionPixels++;
      }

      // Edge detection (Horizontal jump)
      if (i + 4 < data.length) {
        const nextR = data[i + 4];
        const nextG = data[i + 5];
        const nextB = data[i + 6];
        const nextAvg = (nextR + nextG + nextB) / 3;
        
        if (Math.abs(avg - nextAvg) > 25) {
          edgePixels++;
        }
      }
    }

    // Update last frame buffer (grayscale only)
    const grayBuffer = new Uint8ClampedArray(this.canvas.width * this.canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      grayBuffer[i / 4] = (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    this.lastImageData = grayBuffer;

    const pixelCount = this.canvas.width * this.canvas.height;
    
    return {
      edgeDensity: (edgePixels / pixelCount) * 100,
      brightnessVariancy: (totalBrightness / pixelCount),
      motionDelta: (motionPixels / pixelCount) * 100
    };
  }
}
