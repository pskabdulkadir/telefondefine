import { SensorData } from './sensors';
import { classifyAnomalies, type AIClassification } from './aiClassifier';

export type OrchestratorPhase = 'IDLE' | 'AUTO_CALIBRATION' | 'SCANNING_ACTIVE';

export type ScanExecutionMode = 'SINGLE_FEATURE' | 'ALL_IN_ONE_MASTER';
export type ActiveSingleFeature = 'LIDAR_OCR' | 'GPR_GEOMETRY' | 'METAL_SPECTRUM' | 'VOD_TOMOGRAPHY';

export interface CalibrationTelemetry {
  spectrumSweepCleanChannel: number; // e.g., 5.8 GHz, 433 MHz, or 2.4 GHz channel index
  dielektrikSoilMoisture: number; // Soil moisture percentage (e.g., 18.5%)
  gprWaveVelocity: number; // GPR wave velocity in soil (e.g., 0.12 m/ns)
  geomagneticNoiseBaseline: number; // Baseline microteslas (~48 uT)
  phaseProgress: number; // 0 to 100
}

export interface StreamData {
  sensorData: SensorData;
  aiClassification: AIClassification;
  timestamp: number;
}

type Subscriber = (data: StreamData) => void;
type PhaseSubscriber = (phase: OrchestratorPhase, calibration: CalibrationTelemetry) => void;

class SahaOrkestratoru {
  private static instance: SahaOrkestratoru | null = null;

  public phase: OrchestratorPhase = 'IDLE';
  public scanExecutionMode: ScanExecutionMode = 'ALL_IN_ONE_MASTER';
  public activeSingleFeature: ActiveSingleFeature = 'LIDAR_OCR';

  public soilType: 'clay' | 'sand' | 'wet_soil' | 'dry_rock' = 'clay';
  public spectralFilter: 'low' | 'standard' | 'differential' = 'standard';
  public voxelResolution: '64' | '128' | '256' = '128';

  public hardwareStatus = {
    lidar: 'IDLE',
    gpr: 'IDLE',
    magnetometer: 'IDLE',
    coslam: 'IDLE',
  };

  public calibration: CalibrationTelemetry = {
    spectrumSweepCleanChannel: 4,
    dielektrikSoilMoisture: 12.0,
    gprWaveVelocity: 0.15,
    geomagneticNoiseBaseline: 48.0,
    phaseProgress: 0,
  };

  private subscribers: Set<Subscriber> = new Set();
  private phaseSubscribers: Set<PhaseSubscriber> = new Set();
  private calibrationInterval: any = null;

  private constructor() {}

  public static getInstance(): SahaOrkestratoru {
    if (!SahaOrkestratoru.instance) {
      SahaOrkestratoru.instance = new SahaOrkestratoru();
    }
    return SahaOrkestratoru.instance;
  }

  /**
   * Starts the multi-stage 5-second AUTO_CALIBRATION phase.
   * After 5 seconds, transitions automatically to SCANNING_ACTIVE.
   */
  public triggerMasterTrigger(
    selectedMission: 'shallow_metal' | 'deep_cavity' | 'tunnel_mapping',
    baseMag: number,
    onComplete: () => void
  ) {
    if (this.phase !== 'IDLE') {
      this.cancelScan();
    }

    // Set hardware status based on active execution mode
    if (this.scanExecutionMode === 'ALL_IN_ONE_MASTER') {
      this.hardwareStatus = {
        lidar: 'STREAM',
        gpr: 'STREAM',
        magnetometer: 'STREAM',
        coslam: 'STREAM',
      };
    } else {
      this.hardwareStatus = {
        lidar: this.activeSingleFeature === 'LIDAR_OCR' ? 'ACTIVE' : 'IDLE',
        gpr: this.activeSingleFeature === 'GPR_GEOMETRY' ? 'ACTIVE' : 'IDLE',
        magnetometer: this.activeSingleFeature === 'METAL_SPECTRUM' ? 'ACTIVE' : 'IDLE',
        coslam: this.activeSingleFeature === 'VOD_TOMOGRAPHY' ? 'ACTIVE' : 'IDLE',
      };
    }

    this.phase = 'AUTO_CALIBRATION';
    this.calibration = {
      spectrumSweepCleanChannel: 1,
      dielektrikSoilMoisture: 5.0,
      gprWaveVelocity: 0.18,
      geomagneticNoiseBaseline: baseMag > 0 ? baseMag : 48.0,
      phaseProgress: 0,
    };
    this.notifyPhaseChange();

    const duration = 5000; // 5 seconds
    const intervalTime = 100;
    let elapsed = 0;

    this.calibrationInterval = setInterval(() => {
      elapsed += intervalTime;
      const progress = Math.min(100, (elapsed / duration) * 100);

      // Emulate dynamic calibration progression
      // Phase 1: Spectrum Sweep (0% - 35%)
      if (progress < 35) {
        this.calibration.spectrumSweepCleanChannel = Math.floor(Math.random() * 8) + 1;
      }
      // Phase 2: Dielectric Soil Estimation (35% - 70%)
      else if (progress < 70) {
        let baseMoisture = 12.4;
        let baseVelocity = 0.15;
        if (this.soilType === 'clay') {
          baseMoisture = 19.5;
          baseVelocity = 0.095;
        } else if (this.soilType === 'sand') {
          baseMoisture = 5.4;
          baseVelocity = 0.165;
        } else if (this.soilType === 'wet_soil') {
          baseMoisture = 34.2;
          baseVelocity = 0.058;
        } else if (this.soilType === 'dry_rock') {
          baseMoisture = 2.4;
          baseVelocity = 0.135;
        }
        
        // Dynamic convergence oscillation
        this.calibration.dielektrikSoilMoisture = parseFloat((baseMoisture + Math.sin(elapsed / 100) * 1.5).toFixed(2));
        this.calibration.gprWaveVelocity = parseFloat((baseVelocity + Math.cos(elapsed / 100) * 0.004).toFixed(4));
      }
      // Phase 3: Geomagnetic Zeroing (70% - 100%)
      else {
        this.calibration.geomagneticNoiseBaseline = parseFloat((baseMag > 0 ? baseMag : 48.0 + (Math.random() - 0.5) * 0.1).toFixed(4));
      }

      this.calibration.phaseProgress = progress;
      this.notifyPhaseChange();

      if (elapsed >= duration) {
        clearInterval(this.calibrationInterval);
        this.calibrationInterval = null;
        this.phase = 'SCANNING_ACTIVE';
        this.calibration.phaseProgress = 100;
        this.notifyPhaseChange();
        onComplete();
      }
    }, intervalTime);
  }

  public cancelScan() {
    if (this.calibrationInterval) {
      clearInterval(this.calibrationInterval);
      this.calibrationInterval = null;
    }
    this.phase = 'IDLE';
    this.hardwareStatus = {
      lidar: 'IDLE',
      gpr: 'IDLE',
      magnetometer: 'IDLE',
      coslam: 'IDLE',
    };
    this.calibration.phaseProgress = 0;
    this.notifyPhaseChange();
  }

  /**
   * Pipe raw sensor data stream into the orchestrator.
   * This is called continuously to feed AI Classifier and trigger real-time calculations,
   * keeping the telemetry active and synchronous regardless of active view.
   */
  public pushTelemetryStream(sensorData: SensorData, mission: 'shallow_metal' | 'deep_cavity' | 'tunnel_mapping') {
    // Generate AI classification in real-time
    const mag = sensorData.magnetic.total;
    const freq = sensorData.frequency || 0;
    const accel = sensorData.acceleration.total;

    const aiResult = classifyAnomalies(mag, freq, accel, mission);

    const streamData: StreamData = {
      sensorData,
      aiClassification: aiResult,
      timestamp: Date.now(),
    };

    // Broadcast to subscribers
    this.subscribers.forEach((sub) => sub(streamData));
  }

  public subscribe(sub: Subscriber) {
    this.subscribers.add(sub);
    return () => {
      this.subscribers.delete(sub);
    };
  }

  public subscribePhase(sub: PhaseSubscriber) {
    this.phaseSubscribers.add(sub);
    return () => {
      this.phaseSubscribers.delete(sub);
    };
  }

  private notifyPhaseChange() {
    this.phaseSubscribers.forEach((sub) => sub(this.phase, this.calibration));
  }
}

export const orchestrator = SahaOrkestratoru.getInstance();
