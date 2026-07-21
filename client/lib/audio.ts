import React, { useState, useEffect } from 'react';

export const useFrequencyAnalyzer = (isActive: boolean) => {
  const [frequency, setFrequency] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    let audioCtx: AudioContext;
    let analyzer: AnalyserNode;
    let animationFrame: number;

    const startAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // AudioContext may start in suspended state
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);

        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const update = () => {
          if (!analyzer) return;
          analyzer.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((v, i) => v + i) / bufferLength;
          setFrequency(Math.round(average));
          animationFrame = requestAnimationFrame(update);
        };
        update();
      } catch (err: any) {
        const errorMsg = err?.message || String(err);

        if (err?.name === 'NotAllowedError' || errorMsg.includes('Permission')) {
          console.error("❌ MİKROFON İZNİ REDDEDILDI - DevTools F12 konsolunda kontrol edin:", err);
        } else if (err?.name === 'NotFoundError' || errorMsg.includes('found')) {
          console.error("❌ MİKROFON CİHAZI BULUNAMADI:", err);
        } else {
          console.error("❌ SES DONANIM ERİŞİM HATASI:", err);
        }

        setFrequency(0);
      }
    };

    startAudio();

    return () => {
      if (audioCtx) audioCtx.close();
      cancelAnimationFrame(animationFrame);
    };
  }, [isActive]);

  return frequency;
};

class GeigerSynthesizer {
  private audioCtx: AudioContext | null = null;
  private intervalId: any = null;
  private isRunning: boolean = false;
  private currentDistance: number = 5.4;
  private isLocked: boolean = false;

  public start() {
    if (this.isRunning) return;
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isRunning = true;
      this.restartTimer();
    } catch (e) {
      console.warn("AudioContext setup failed:", e);
    }
  }

  public stop() {
    this.isRunning = false;
    this.isLocked = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
  }

  public update(distance: number, locked: boolean) {
    const prevLocked = this.isLocked;
    this.currentDistance = distance;
    this.isLocked = locked;

    if (!this.isRunning) {
      this.start();
    } else if (prevLocked !== locked) {
      this.restartTimer();
    }
  }

  private restartTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (!this.isRunning || !this.isLocked) return;

    const tick = () => {
      if (!this.isRunning || !this.isLocked) return;
      this.playClick();
      
      // Calculate interval dynamically based on current distance
      const normDist = Math.max(0.5, Math.min(8, this.currentDistance)); // 0.5m to 8m
      const freqHz = 10 + (1 - (normDist - 0.5) / 7.5) * 490; // 10Hz to 500Hz
      const intervalMs = 1000 / freqHz;

      this.intervalId = setTimeout(tick, intervalMs);
    };

    tick();
  }

  private playClick() {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {
      // Ignored
    }
  }
}

export const geigerSynth = new GeigerSynthesizer();
