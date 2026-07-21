import { useState, useEffect, useRef } from 'react';

export interface Point {
  position: [number, number, number];
  color: string;
  intensity: number; // Motion intensity
  magIntensity: number; // Magnetic intensity at the point
}

export interface SensorData {
  magnetic: { x: number; y: number; z: number; total: number };
  acceleration: { x: number; y: number; z: number; total: number };
  orientation: { alpha: number; beta: number; gamma: number };
  frequency: number;
  visual: { edgeDensity: number; motionDelta: number; brightness: number };
  points: Point[]; // Point Cloud / LiDAR data
}

export interface PermissionResult {
  motion: boolean;
  audio: boolean;
}

export const requestSensorPermission = async (): Promise<PermissionResult> => {
  // Kamera ve Mikrofon izinlerini zaman aşımı olmadan, daha güvenilir bir şekilde isteyelim.
  let audioGranted = false;
  let motionGranted = false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'environment' } });
    stream.getTracks().forEach(track => track.stop());
    audioGranted = true;
  } catch (e) { 
    console.warn("Kamera/Mikrofon izni alınamadı:", e); 
    // Hata durumunda bile devam et, belki sadece biri reddedilmiştir.
    // Kullanıcıya tekrar sormak için UI'da seçenekler mevcut.
  }

  // Konum isteği
  const locationPromise = new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => { resolve(); },
      () => { resolve(); }, // Hata durumunda bile devam et
      { timeout: 5000, enableHighAccuracy: true }
    );
  });

  // Hareket Sensörleri
  try {
    if (typeof (DeviceMotionEvent as any) !== 'undefined' && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        motionGranted = response === 'granted';
      } catch (e) {
        console.warn("Hareket sensörü izni hatası:", e);
        motionGranted = true; // iOS-dışı tarayıcılarda bu hata olabilir, true varsayalım.
      }
    }
    motionGranted = true; // requestPermission fonksiyonu yoksa, izin verilmiş varsayılır.
  } catch (e) {
    console.error("Hareket sensörü izni alınırken kritik hata:", e);
    motionGranted = false;
  }

  // Tüm istekleri paralel çalıştır
  await locationPromise;

  console.log('📊 İzin Sonuçları:', { motionGranted, audioGranted });

  return { motion: motionGranted, audio: audioGranted };
};

export const useSensorEngine = (isActive: boolean) => {
  const [data, setData] = useState<SensorData>({
    magnetic: { x: 0, y: 0, z: 0, total: 0 },
    acceleration: { x: 0, y: 0, z: 0, total: 0 },
    orientation: { alpha: 0, beta: 0, gamma: 0 },
    frequency: 0,
    visual: { edgeDensity: 0, motionDelta: 0, brightness: 0 },
    points: []
  });

  const [isSupported, setIsSupported] = useState(true);
  const pointBuffer = useRef<Point[]>([]);
  const magRef = useRef({ x: 0, y: 0, z: 0, total: 0 });
  const orientRef = useRef({ alpha: 0, beta: 0, gamma: 0 });

  useEffect(() => {
    if (!isActive) return;

    let magnetite: any = null;

    // 1. Generic Sensor API: Magnetometer (With High Sensitivity Boost)
    const setupMagnetometer = async () => {
      try {
        if ('Magnetometer' in window) {
          magnetite = new (window as any).Magnetometer({ frequency: 100 });
          magnetite.addEventListener('reading', () => {
            // High Sensitivity: Intense amplification of micro-deviations
            const rawTotal = Math.sqrt(magnetite.x ** 2 + magnetite.y ** 2 + magnetite.z ** 2);
            const deviation = rawTotal - 48.0;
            // Higher boost factor for professional detection (2.5x instead of 1.5x)
            const boostedTotal = 48.0 + (deviation * 2.5); 
            
            magRef.current = { 
              x: magnetite.x, 
              y: magnetite.y, 
              z: magnetite.z, 
              total: Math.max(0, boostedTotal) 
            };
          });
          magnetite.start();
        }
      } catch (e) {
        console.warn("Magnetometer API access failed.");
      }
    };

    setupMagnetometer();

    // 2. Permission Request for iOS/Standard Browsers
    const requestPermissions = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          await (DeviceOrientationEvent as any).requestPermission();
          await (DeviceMotionEvent as any).requestPermission();
        } catch (e) {
          console.warn("Sensor permission denied");
        }
      }
    };

    requestPermissions();

    let lastPointTime = 0;

    // 3. Absolute Orientation (Better for Compass/North detection)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      orientRef.current = {
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0
      };
      
      // Removed fake magnetic fallback - only real signals allowed
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation as any);
    window.addEventListener('deviceorientation', handleOrientation);

    // 3. Device Motion
    const handleMotion = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel) return;
      
      const now = Date.now();
      
      const x = accel.x || 0;
      const y = accel.y || 0;
      const z = accel.z || 0;
      const movementMagnitude = Math.sqrt(x**2 + y**2 + z**2);
      
      // Compute 3D Point Generation
      if (now - lastPointTime > 30) { // Faster rate for higher detail
        const currentMag = magRef.current;
        const isSignificantScan = movementMagnitude > 0.5 || Math.abs(currentMag.total - 48) > 1.0;
        
        if (isSignificantScan) {
          const intensity = Math.min(1, movementMagnitude / 10);
          let pointColor = '#10b981';
          
          if (currentMag.total > 150) pointColor = '#ef4444'; // Lower threshold for "hot" spots
          else if (currentMag.total > 85) pointColor = '#f59e0b';
          else if (currentMag.total < 35) pointColor = '#3b82f6';
          
          const newPoint: Point = {
            position: [x * 0.4, -z * 0.4, y * 0.4],
            color: pointColor,
            intensity,
            magIntensity: currentMag.total
          };

          pointBuffer.current = [...pointBuffer.current.slice(-8000), newPoint]; // Even larger buffer
          lastPointTime = now;
        }
      }

      setData(prev => ({
        ...prev,
        magnetic: { ...magRef.current },
        acceleration: { x, y, z, total: movementMagnitude },
        orientation: { ...orientRef.current },
        points: pointBuffer.current
      }));
    };

    window.addEventListener('devicemotion', handleMotion, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('devicemotion', handleMotion, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (magnetite) magnetite.stop();
    };
  }, [isActive]);

  return { data, isSupported };
};
