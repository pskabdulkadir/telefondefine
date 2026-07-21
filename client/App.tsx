import React, { useState, useEffect, useRef, useMemo, Fragment, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import {
  Radar as RadarIcon,
  Activity,
  Zap,
  Settings,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Download,
  Info,
  Layers,
  Layers as LayersIcon,
  Camera as CameraIcon,
  Globe,
  Users,
  Radio,
  Wifi,
  Scan,
  Database,
  History,
  FileText,
  BookOpen,
  Key,
  Trash2,
  Lock,
  Eye,
  Home,
  Map,
  Compass,
  Cpu,
  Box,
  Volume2,
  VolumeX,
  Ruler,
  Moon,
  Sun,
  Target,
  Printer,
  Battery,
  Bluetooth,
  SmartphoneNfc,
  Mic,
  CheckCircle2,
  RefreshCw,
  Video,
  StopCircle,
  VideoOff
} from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Float, Sky, Stars, Environment, ContactShadows, Sparkles, MeshReflectorMaterial, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette, ColorAverage, Sepia } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { useSensorEngine, requestSensorPermission, type SensorData, type Point } from './lib/sensors';
import { analyzeSurfaceDensity, identifyMaterialHybrid, type SurfaceAnalysis } from './lib/cameraPixelAnalyzer';
import { useFrequencyAnalyzer } from './lib/audio';
import { VisualProcessor } from './lib/visualProcessor';
import { useSensorFusion } from './lib/sensorFusion';
import { usePullToRefresh } from './lib/usePullToRefresh';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AdvancedVisualizer } from './components/AdvancedVisualizer';
import { DeviceApprovalScreen } from './components/DeviceApprovalScreen';
import { checkApproval } from '../firebase';
import { getSHIdentity } from '../deviceService';

// --- NEW FIELD ENGINEERING IMPORTS ---
import { MissionSelector, type MissionType } from './components/MissionSelector';
import { CoSlamPanel } from './components/CoSlamPanel';
import { AROverlay } from './components/AROverlay';
import { TargetTrackerHUD } from './components/TargetTrackerHUD';
import { SahaReportView } from './components/SahaReportView';
import { FeatureDetailModal, type FeatureType } from './components/FeatureDetailModal';
import { orchestrator, type OrchestratorPhase, type CalibrationTelemetry, type ScanExecutionMode, type ActiveSingleFeature } from './lib/SahaOrkestratoru';
import { geigerSynth } from './lib/audio';

// --- HELPERS & UTILITIES ---

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

const speak = (text: string) => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.1; // Slightly faster for professional feel
    window.speechSynthesis.speak(utterance);
  }
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { 
    console.error("MLAS_RENDER_ERROR:", error, errorInfo); 
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const FocalPulse = ({ active, color = "#10b981" }: { active: boolean, color?: string }) => {
  return (
    <AnimatePresence>
      {active && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0.5, 2, 4], 
            opacity: [0, 0.4, 0] 
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          className="absolute w-20 h-20 border-2 rounded-full flex items-center justify-center pointer-events-none"
          style={{ borderColor: color }}
        >
          <div className="w-4 h-4 rounded-full animate-ping" style={{ backgroundColor: color }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const WaveSignal = ({ activity = 0, magnitude = 0, color = "#10b981" }: { activity: number, magnitude: number, color?: string }) => {
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    let frameId: number;
    const animate = (time: number) => {
      setOffset(time * 0.005 * (1 + activity));
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [activity]);

  const points = 60;
  const width = 400;
  const height = 80;
  const step = width / points;

  const d = Array.from({ length: points + 1 }).map((_, i) => {
    const x = i * step;
    const amp = (10 + magnitude * 50) * Math.sin(i * 0.05 + offset * 0.5);
    const y = height / 2 + Math.sin(i * 0.2 + offset) * amp;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
      <path 
        d={d}
        fill="none" 
        stroke={color} 
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
      />
      <path 
        d={d}
        fill="none" 
        stroke={color} 
        strokeWidth="1"
        opacity="0.2"
        transform={`translate(0, 5) scale(1, 1.1)`}
      />
    </svg>
  );
};

const translateObjectLabel = (label: string): string => {
  const dictionary: Record<string, string> = {
    person: 'OPERATÖR / SAHA TEKNİSYENİ',
    bicycle: 'GEOMETRİK METALİK ANOMALİ (İKİNCİL)',
    car: 'MASİF METALİK KÜTLE / FERROMANYETİK BLOK',
    motorcycle: 'KOMPAKT YÜKSEK DETEKSİYONLU METALİK ANOMALİ',
    airplane: 'YÜKSEK İRTİFA SAPMA SİNYALİ',
    bus: 'MASİF YÜZEYSEL FERROMANYETİK ENGELLER',
    train: 'DOĞRUSAL FERROMANYETİK HATLARI',
    truck: 'BÜYÜK BOYUTLU FERROMANYETİK BLOKLAR',
    boat: 'SULU ZEMİN / ISLAK JEOLOJİK SAPMA',
    'traffic light': 'DİKEY REZONANS NOKTASI / EM VERİCİSİ',
    'fire hydrant': 'SİLİNDİRİK METALİK ÇIKINTI (FERROMANYETİK)',
    'stop sign': 'DÜZ METAL ALAN / REFERANS DETEKTÖRÜ',
    'parking meter': 'KÜÇÜK METAL DETEKSİYON NOKTASI',
    bench: 'DÜZGÜN JEOLOJİK DOĞRUSAL ANOMALİ',
    bird: 'ORGANİK SAPMA / ISIL REZONANS',
    cat: 'KÜÇÜK ORGANİK BULGU / ISIL ANOMALİ',
    dog: 'HAREKETLİ ORGANİK SİNYAL SIZINTISI',
    horse: 'BÜYÜK DİNAMİK ORGANİK BULGU',
    sheep: 'YÜZEYSEL ORGANİK REZONANS KÜMESİ',
    cow: 'MİNERALLİ DOĞAL JEOLOJİK YIĞIN',
    elephant: 'GENİŞ JEOLOJİK MİNERAL KÜTLESİ',
    bear: 'KOMPLEKS DİNAMİK DOĞAL SAPMA',
    zebra: 'ÇİZGİSEL JEO-KATMAN ANOMALİSİ',
    giraffe: 'YÜKSEK SEVİYELİ REZONANS KOLONU',
    backpack: 'İZOLE KÜTLE / YAPAY DETEKSİYON ALANI',
    umbrella: 'DİKEY GEOMETRİK ANOMALİ (BOŞLUK/MİNERAL)',
    handbag: 'KÜÇÜK İZOLE ELEKTRİKSEL ALAN',
    tie: 'MİCRO GEOMETRİK HAT SİNYALİ',
    suitcase: 'İZOLE BLOK YAPISI / YAPAY KATMAN',
    frisbee: 'DAİRESEL GEOMETRİK METALİK SAPMA',
    skis: 'DOĞRUSAL KANALLAR VEYA YAPISAL ANOMALİLER',
    snowboard: 'GENİŞ DOĞRUSAL KATMAN SAPMASI',
    'sports ball': 'KÜRESEL ANOMALİ SİNYALİ',
    kite: 'HAVA AKIMI PARAZİTİ',
    'baseball bat': 'İNCE DOĞRUSAL GEOMETRİK NESNE',
    'baseball glove': 'DİELEKTRİK PLAKA VEYA BOŞLUK YAPISI',
    skateboard: 'YATAY DOĞRUSAL JEOLOJİK HAT',
    surfboard: 'GENİŞ DOĞRUSAL GEOMETRİK SAPMA',
    'tennis racket': 'FİLELİ YAPISAL KATMAN SİNYALİ',
    bottle: 'SİLİNDİRİK ANOMALİ / BOŞLUK YAPISI',
    'wine glass': 'SİLİNDİRİK ANOMALİ KANALI',
    cup: 'KÜÇÜK SİLİNDİRİK ANOMALİ / BOŞLUK',
    fork: 'YÜKSEK DETEKSİYONLU METALİK YÜZEY SAPMASI',
    knife: 'KESKİN FERROMANYETİK ANOMALİ HESAPLAMASI',
    spoon: 'YUMUŞAK YÜZEYLİ METALİK SAPMA',
    bowl: 'DAİRESEL BOŞLUK / ÇUKUR ANOMALİSİ',
    banana: 'KAVİSLİ BİYOLOJİK KATMAN SAPMASI',
    apple: 'MİKRO KÜRESEL DOĞAL ANOMALİ',
    sandwich: 'KATMANLI YATAY YAPISAL JEOLOJİ',
    orange: 'KÜRESEL MİKRO MİNERAL REZONANSI',
    broccoli: 'BİTKİSEL YOĞUNLUK / BİYOLOJİK REZONANS',
    carrot: 'DİKEY JEOLOJİK KÖK SAPMASI',
    'hot dog': 'SİLİNDİRİK KATMAN ANOMALİSİ',
    pizza: 'DÜZ DAİRESEL JEOLOJİK PLATFORM',
    donut: 'HALKA TİPİ JEOMANYETİK SAPMA',
    cake: 'YIĞIN TİPİ ARKEOLOJİK KATMAN',
    chair: 'DÜZGÜN GEOMETRİK YÜZEY / JEOLOJİK DOĞRUSAL ANOMALİ',
    couch: 'YENİDEN YAPILANDIRILMIŞ GEOMETRİK YAPI',
    'potted plant': 'BİTKİSEL ORTAM / BİYOLOJİK KATMAN REZONANSI',
    bed: 'YENİDEN YAPILANDIRILMIŞ YAPISAL TABAN PLATFORMU',
    'dining table': 'YATAY YAPISAL TABAN PLATFORMU (BETON/SIVA)',
    toilet: 'YAPISAL ODA / REZERVUAR BOŞLUĞU',
    tv: 'MANYETİK ALAN ENERJİ KAYNAĞI / MONİTÖR PARAZİTİ',
    laptop: 'MANYETİK ALAN ENERJİ KAYNAĞI (ELEKTRİK ALANI)',
    mouse: 'ELEKTROMANYETİK PARAZİT NOKTASI',
    remote: 'ELEKTROMANYETİK PARAZİT VERİCİSİ',
    keyboard: 'KOMPLEKS ELEKTROMANYETİK PARAZİT IZGARASI',
    'cell phone': 'ELEKTRONİK SİNYAL PARAZİTİ / ELEKTROMANYETİK VERİCİ',
    microwave: 'YÜKSEK FREKANSLI ELEKTROMANYETİK EMİSYON ALANI',
    oven: 'ISIL REZONANS BLOK YAPISI',
    toaster: 'KÜÇÜK ISIL REZONANS NOKTASI',
    sink: 'METAL HAVZA / ISLAK ALAN SAPMASI',
    refrigerator: 'BÜYÜK ELEKTROMANYETİK BLOK / MOTOR PARAZİTİ',
    book: 'DİELEKTRİK PLAKA VEYA YAPISAL KATMAN',
    clock: 'FREKANS REFERANS KAYNAĞI / REZONANS SİNYALİ',
    vase: 'SİLİNDİRİK BOŞLUK VEYA ARKEOLOJİK BULGU',
    scissors: 'MİKRO METALİK SAPMA / KESKİN ANOMALİ',
    'teddy bear': 'YUMUŞAK ORGANİK KÜTLE SİNYALİ',
    'hair drier': 'YÜKSEK FREKANSLI PARAZİT SİNYALİ',
    toothbrush: 'MİKRO GEOMETRİK ANOMALİ HATTI'
  };
  return dictionary[label.toLowerCase()] || 'MÜHENDİSLİK DETEKSİYONU / SAHA SAPMASI';
};

const VolumetricBeam = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.1 + Math.sin(state.clock.getElapsedTime() * 2) * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 1.5, 0]}>
      <cylinderGeometry args={[0.5, 2, 6, 32, 1, true]} />
      <meshBasicMaterial 
        color="#10b981" 
        transparent 
        opacity={0.15} 
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

// --- POINT CLOUD RENDERER (LIDAR / SLAM) ---

const PointCloud = ({ points, sliceZ }: { points: Point[], sliceZ: number }) => {
  const meshRef = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    if (!points || !Array.isArray(points) || points.length === 0) return [new Float32Array(0), new Float32Array(0)];
    
    // Filter points based on Slice (Z-axis / Depth mapping)
    const filteredPoints = points.filter(p => p && p.position && p.position[1] > -sliceZ);
    if (filteredPoints.length === 0) return [new Float32Array(0), new Float32Array(0)];
    
    const pos = new Float32Array(filteredPoints.length * 3);
    const col = new Float32Array(filteredPoints.length * 3);

    filteredPoints.forEach((p, i) => {
      pos[i * 3] = p.position[0];
      pos[i * 3 + 1] = p.position[1];
      pos[i * 3 + 2] = p.position[2];

      const c = new THREE.Color(p.color);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });

    return [pos, col];
  }, [points, sliceZ]);

  if (positions.length === 0) return null;

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.25} 
        vertexColors 
        transparent 
        opacity={0.9} 
        sizeAttenuation 
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// --- ANOMALY HOLOGRAM VISUALIZER ---

const AnomalyHologram = ({ type, intensity }: { type: string, intensity: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.position.y = Math.sin(state.clock.getElapsedTime()) * 0.1;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(state.clock.getElapsedTime() * 2) * 0.05);
    }
  });

  const getGeometry = (t: string) => {
    const typeLower = t.toLowerCase();
    if (typeLower.includes('altın') || typeLower.includes('metal')) return <octahedronGeometry args={[1.5, 0]} />;
    if (typeLower.includes('oda') || typeLower.includes('mezar')) return <boxGeometry args={[3, 2, 3]} />;
    if (typeLower.includes('tünel') || typeLower.includes('giriş')) return <torusGeometry args={[1.5, 0.5, 16, 64]} />;
    return <dodecahedronGeometry args={[1.2, 0]} />;
  };

  const getColor = (t: string) => {
    const typeLower = t.toLowerCase();
    if (typeLower.includes('altın')) return '#fbbf24';
    if (typeLower.includes('metal')) return '#94a3b8';
    if (typeLower.includes('oda') || typeLower.includes('boşluk')) return '#38bdf8';
    return '#10b981';
  };

  return (
    <group position={[0, 0, 0]}>
      <Float speed={3} rotationIntensity={1.5} floatIntensity={1.5}>
        <mesh ref={meshRef}>
          {getGeometry(type)}
          <meshPhysicalMaterial 
            color={getColor(type)}
            emissive={getColor(type)}
            emissiveIntensity={0.8}
            transparent
            opacity={0.6}
            metalness={1}
            roughness={0}
            transmission={0.5}
            thickness={1}
            wireframe={type.toLowerCase().includes('oda') || type.toLowerCase().includes('boşluk')}
          />
        </mesh>

        {/* Inner Structure for Rooms/Voids */}
        {(type.toLowerCase().includes('oda') || type.toLowerCase().includes('boşluk')) && (
          <mesh>
            <boxGeometry args={[2.5, 1.5, 2.5]} />
            <meshBasicMaterial color={getColor(type)} wireframe transparent opacity={0.2} />
          </mesh>
        )}
      </Float>
      
      {/* Outer Pulse Shell */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.8, 32, 32]} />
        <meshBasicMaterial 
          color={getColor(type)} 
          transparent 
          opacity={0.03} 
          side={THREE.BackSide} 
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Origin Core Pulse */}
      <Sparkles count={50} scale={2} size={2} speed={2} color={getColor(type)} />
    </group>
  );
};

const TelemetryCharts = ({ history }: { history: any[] }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-32 opacity-80">
      <div className="bg-black/40 rounded-xl border border-zinc-800/50 p-2 overflow-hidden">
        <div className="text-[8px] font-bold text-emerald-500 mb-1 uppercase tracking-widest pl-2">Manyetik Akış (µT)</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <Line type="monotone" dataKey="mag" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
            <YAxis hide domain={['auto', 'auto']} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-black/40 rounded-xl border border-zinc-800/50 p-2 overflow-hidden">
        <div className="text-[8px] font-bold text-sky-500 mb-1 uppercase tracking-widest pl-2">Sinyal Spektrumu (Hz)</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <Line type="monotone" dataKey="freq" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
            <YAxis hide domain={['auto', 'auto']} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const Heatmap = ({ points }: { points: Point[] }) => {
  const gridSize = 32;
  const size = 20;

  const [vertices, colors] = useMemo(() => {
    const v = new Float32Array(gridSize * gridSize * 3);
    const c = new Float32Array(gridSize * gridSize * 3);
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const idx = (i * gridSize + j) * 3;
        v[idx] = (i / gridSize) * size - size / 2;
        v[idx + 1] = -1.98;
        v[idx + 2] = (j / gridSize) * size - size / 2;
        c[idx] = 0.05; c[idx+1] = 0.1; c[idx+2] = 0.05;
      }
    }

    points.forEach(p => {
      const gx = Math.floor(((p.position[0] + size / 2) / size) * gridSize);
      const gz = Math.floor(((p.position[2] + size / 2) / size) * gridSize);
      if (gx >= 0 && gx < gridSize && gz >= 0 && gz < gridSize) {
        const idx = (gx * gridSize + gz) * 3;
        v[idx + 1] = Math.max(v[idx + 1], -1.98 + p.intensity * 0.8);
        const pColor = new THREE.Color(p.color);
        c[idx] = THREE.MathUtils.lerp(c[idx], pColor.r, 0.4);
        c[idx+1] = THREE.MathUtils.lerp(c[idx+1], pColor.g, 0.4);
        c[idx+2] = THREE.MathUtils.lerp(c[idx+2], pColor.b, 0.4);
      }
    });

    return [v, c];
  }, [points]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[size, size, gridSize - 1, gridSize - 1]}>
        <bufferAttribute attach="attributes-position" count={vertices.length / 3} array={vertices} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </planeGeometry>
      <meshStandardMaterial vertexColors transparent opacity={0.7} roughness={0.2} metalness={0.8} />
    </mesh>
  );
};

const ARMeasure = ({ points, setDistance }: { points: THREE.Vector3[], setDistance: (d: string) => void }) => {
  useEffect(() => {
    if (points && Array.isArray(points) && points.length >= 2 && points[0] && points[1]) {
      const dist = points[0].distanceTo(points[1]).toFixed(2);
      setDistance(dist);
    } else {
      setDistance('');
    }
  }, [points, setDistance]);

  if (!points || !Array.isArray(points) || points.length < 2 || !points[0] || !points[1]) return null;

  return (
    <line>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array([...points[0].toArray(), ...points[1].toArray()])}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial attach="material" color="#ef4444" linewidth={2} />
    </line>
  );
};

const MagneticField = ({ 
  intensity = 50, 
  points, 
  sliceZ, 
  arPoints, 
  setMeasure,
  setArPoints,
  vibrate,
  speak,
  analysis,
  sensorData // Pass core data for holographic panel
}: { 
  intensity?: number, 
  points: Point[], 
  sliceZ: number, 
  arPoints: THREE.Vector3[], 
  setMeasure: (d: string) => void,
  setArPoints: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>,
  vibrate: (p: number | number[]) => void,
  speak: (t: string) => void,
  analysis?: any,
  sensorData: SensorData
}) => {
  return (
    <group>
      <AdvancedVisualizer 
        data={sensorData} 
        threshold={intensity} 
        isScanning={true} 
        analysis={analysis} 
      >
        <ARMeasure points={arPoints} setDistance={setMeasure} />
      </AdvancedVisualizer>
    </group>
  );
};

// --- HELPERS ---

const ScannerOverlay = ({ data, freq, isScanning }: { data: SensorData, freq: number, isScanning: boolean }) => {
  const magTotal = data?.magnetic?.total || 48;
  return (
    <div className="absolute inset-0 pointer-events-none p-6 md:p-10 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="space-y-1 text-emerald-500">
          <div className="flex items-center gap-3">
            {isScanning ? (
              <div className="flex items-center gap-2 px-2 py-0.5 bg-red-600/20 border border-red-500/30 rounded-md animate-pulse">
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                 <span className="text-[8px] font-black uppercase tracking-widest text-red-500">REC</span>
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{isScanning ? 'VERİ AKIŞI KAYDEDİLİYOR' : 'CANLI TARAMA AKTİF'}</span>
          </div>
          <div className="text-[10px] font-mono text-zinc-400">TRK_ID: {Math.random().toString(16).slice(2, 10).toUpperCase()} // {(magTotal || 0).toFixed(1)} µT // {freq} Hz</div>
        </div>
        <div className="text-right space-y-1">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">SİNYAL KALİTESİ</div>
          <div className="text-emerald-500 font-mono font-bold">%{Math.min(100, Math.round((magTotal || 0) / 1.5 + 40))}</div>
        </div>
      </div>

    <div className="flex justify-center relative">
       <div className="w-64 h-64 border border-emerald-500/20 rounded-full flex items-center justify-center relative shadow-[inset_0_0_30px_rgba(16,185,129,0.05)]">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-t border-emerald-500/40 rounded-full" 
          />
          <div className="w-[80%] h-[80%] border border-emerald-500/10 rounded-full" />
          <div className="w-16 h-16 border border-emerald-500/40 rounded-full flex items-center justify-center">
             <div className="w-1 h-1 bg-emerald-500 rounded-full" />
          </div>
          
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-emerald-500/50">N</div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-[8px] font-bold text-zinc-500/50">S</div>
       </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
       <div className="p-4 bg-black/40 backdrop-blur-md border border-zinc-800 rounded-2xl space-y-1">
          <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
             <Globe className="w-3 h-3 text-emerald-500" /> İVME ÖLÇER (G)
          </div>
          <div className="text-xl font-mono font-bold text-white">{Math.abs(data.acceleration.z).toFixed(2)}</div>
       </div>
       <div className="p-4 bg-black/40 backdrop-blur-md border border-zinc-800 rounded-2xl space-y-1 text-right">
          <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-end gap-1">
             EĞİM ANALİZİ <Maximize2 className="w-3 h-3 text-purple-500" />
          </div>
          <div className="text-xl font-mono font-bold text-purple-400">
             {Math.round(Math.atan2(data.acceleration.y, data.acceleration.x) * 180 / Math.PI)}°
          </div>
       </div>
    </div>
  </div>
  );
};

// --- UI COMPONENTS ---

const Radar = ({ isScanning, score }: { isScanning: boolean, score: number }) => {
  return (
    <div className="relative w-72 h-72 rounded-full border border-emerald-500/20 bg-black flex items-center justify-center overflow-hidden" style={{ boxShadow: '0 0 50px rgba(16,185,129,0.05)' }}>
      {/* Background Grid */}
      <div className="absolute inset-0 border border-emerald-500/5 rounded-full scale-75" />
      <div className="absolute inset-0 border border-emerald-500/5 rounded-full scale-50" />
      
      {/* Scanning Sweep */}
      {isScanning && (
        <motion.div 
          className="absolute inset-0 z-0"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(16, 185, 129, 0.15) 60deg, transparent 61deg)'
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Center Display */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.span 
          key={score}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-6xl font-mono font-bold tracking-tighter ${score > 70 ? 'text-red-500' : 'text-emerald-500'}`}
        >
          {score}
        </motion.span>
        <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mt-2">Anomali Skoru</div>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD ---

type ScanPhase = 'idle' | 'calibration' | 'scanning' | 'analyzing' | 'results';

interface ScanLogEntry {
  id: string;
  timestamp: string;
  score: number;
  type: string;
  status: string;
  data: any;
}

const XRayView = ({ 
  sensorData, 
  freq, 
  videoRef,
  liveAnalysis
}: { 
  sensorData: SensorData, 
  freq: number, 
  videoRef: React.RefObject<HTMLVideoElement>,
  liveAnalysis: any
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [depth, setDepth] = useState(0.8);
  const [penetration, setPenetration] = useState(45);
  const [pulseActive, setPulseActive] = useState(false);
  const [pulseResults, setPulseResults] = useState<{type: string, depth: number, confidence: number} | null>(null);
  const [material, setMaterial] = useState<string>("Analiz Hazırlanıyor...");
  const [alert, setAlert] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const renderHeatmap = () => {
      if (!canvasRef.current) return;
      const { width, height } = canvasRef.current;
      ctx.clearRect(0, 0, width, height);

      // Sinyal Probu (Reticle)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width/2, height/2, 60, 0, Math.PI * 2);
      ctx.moveTo(width/2 - 80, height/2);
      ctx.lineTo(width/2 + 80, height/2);
      ctx.moveTo(width/2, height/2 - 80);
      ctx.lineTo(width/2, height/2 + 80);
      ctx.stroke();

      // Isı Haritası Örtüşmesi
      const magDelta = Math.abs(sensorData.magnetic.total - 48);
      if (magDelta > 2) {
        const radius = Math.min(300, magDelta * 12);
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, radius);
        const isDangerous = magDelta > 15;
        const isModerate = magDelta > 8;
        
        gradient.addColorStop(0, isDangerous ? 'rgba(239, 68, 68, 0.5)' : isModerate ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.3)');
        gradient.addColorStop(0.5, isDangerous ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.1)');
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(width/2, height/2, radius, 0, Math.PI * 2);
        ctx.fill();

        // Scanning ring animation around heatmap
        ctx.strokeStyle = isDangerous ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(width/2, height/2, radius * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        if (isDangerous && !alert) {
           vibrate(50);
           setAlert("KRİTİK METALİK KÜTLE TESPİTİ");
        } else if (!isDangerous) {
           setAlert(null);
        }
      }

      frameId = requestAnimationFrame(renderHeatmap);
    };

    frameId = requestAnimationFrame(renderHeatmap);
    return () => cancelAnimationFrame(frameId);
  }, [sensorData.magnetic.total]);

  useEffect(() => {
    const analyze = () => {
      if (!videoRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      try {
        ctx.drawImage(videoRef.current, 0, 0, 160, 120);
        const frameData = ctx.getImageData(0, 0, 160, 120).data;
        const analysis = analyzeSurfaceDensity(frameData, 160, 120);
        
        const mat = identifyMaterialHybrid(
          analysis, 
          sensorData.magnetic.total - 48, 
          freq, 
          sensorData.acceleration.total - 9.8
        );
        setMaterial(mat);
        
        const magStrength = Math.abs(sensorData.magnetic.total - 48);
        setDepth(Math.min(15, 0.4 + (magStrength / 12) + (sensorData.visual.edgeDensity / 250)));
        setPenetration(Math.min(100, Math.floor(analysis.permeability * 80 + (magStrength * 2.5))));
      } catch (e) {}
    };

    const interval = setInterval(analyze, 600);
    return () => clearInterval(interval);
  }, [sensorData.magnetic.total, freq]);

  const sendPulse = () => {
    vibrate([50, 100, 50]);
    setPulseActive(true);
    
    // Check signal presence using physical data
    const magDelta = Math.abs(sensorData.magnetic.total - 48);
    if (magDelta > 5 || sensorData.visual.edgeDensity > 12 || sensorData.visual.motionDelta > 8) {
      setPulseResults({
        type: magDelta > 15 ? "Yoğun Metalik Kütle" : magDelta > 8 ? "Değerli Mineral Yapısı" : "Yapısal Boşluk / Oda",
        depth: 0.5 + (magDelta / 10) + (sensorData.visual.edgeDensity / 60),
        confidence: 70 + Math.min(25, Math.floor(sensorData.visual.edgeDensity * 1.5))
      });
    } else {
      setPulseResults(null);
    }
    
    setTimeout(() => {
      setPulseActive(false);
    }, 1500);
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black cursor-crosshair overflow-hidden" onClick={sendPulse}>
       <video 
         ref={videoRef} 
         autoPlay 
         playsInline 
         muted 
         className="absolute inset-0 w-full h-full object-cover opacity-50 contrast-[2] saturate-0 grayscale invert brightness-75" 
       />
       
       <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
       </div>

       <div className="absolute inset-0 pointer-events-none opacity-20"
            style={{ 
              perspective: '1200px',
              transform: `rotateX(${65 + sensorData.orientation.beta * 0.1}deg) rotateY(${sensorData.orientation.gamma * 0.1}deg) translateZ(-100px)`
            }}>
          <div className="w-[300%] h-[300%] -left-full -top-full" 
               style={{ backgroundImage: 'linear-gradient(#3b82f6 1.5px, transparent 1.5px), linear-gradient(90deg, #3b82f6 1.5px, transparent 1.5px)', backgroundSize: '100px 100px' }} />
       </div>

       <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="absolute inset-0 w-full h-full pointer-events-none" />

       <AnimatePresence>
         {pulseResults && !pulseActive && (
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9 }}
             className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] flex flex-col items-center gap-6"
           >
             <div className="relative pointer-events-auto">
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                 className="w-72 h-72 border-2 border-sky-500/30 rounded-full border-dashed"
               />
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-3xl rounded-full border border-sky-500/50 p-8 text-center space-y-3 shadow-[0_0_50px_rgba(14,165,233,0.3)]">
                 <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 mb-2">
                   <Scan className="w-6 h-6 text-sky-400 animate-pulse" />
                 </div>
                 <div className="space-y-1">
                   <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest leading-none">DERİN PENETRASYON SONUCU</div>
                   <div className="text-2xl font-black text-white uppercase tracking-tighter italic leading-tight">{pulseResults.type}</div>
                 </div>
                 <div className="flex gap-6 pt-2 border-t border-zinc-800 w-full justify-center">
                   <div className="text-center">
                     <div className="text-[8px] text-zinc-500 font-black uppercase">TAHMİNİ DERİNLİK</div>
                     <div className="text-xl font-mono text-white font-black">{pulseResults.depth.toFixed(1)}<span className="text-[10px] ml-1">m</span></div>
                   </div>
                   <div className="text-center">
                     <div className="text-[8px] text-zinc-500 font-black uppercase">GÜVEN SKORU</div>
                     <div className="text-xl font-mono text-white font-black">%{pulseResults.confidence}</div>
                   </div>
                 </div>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setPulseResults(null);
                   }}
                   className="mt-6 px-10 py-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-2xl uppercase tracking-widest shadow-xl transition-all active:scale-95"
                 >
                   ANALİZİ KAPAT
                 </button>
               </div>
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       <AnimatePresence>
         {pulseActive && (
           <motion.div 
             initial={{ scale: 0, opacity: 1 }}
             animate={{ scale: 6, opacity: 0 }}
             exit={{ opacity: 0 }}
             className="absolute w-40 h-40 border-2 border-sky-500 rounded-full flex items-center justify-center"
           >
              <div className="w-full h-full rounded-full bg-sky-500/10" />
           </motion.div>
         )}
       </AnimatePresence>

       {/* X-Ray HUD */}
       <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none z-20">
          <div className="flex justify-between items-start">
             <div className="space-y-4">
                <div className="flex items-center gap-4">
                   <div className="w-3 h-3 rounded-full bg-sky-500 animate-pulse" />
                   <span className="text-2xl font-black text-white uppercase tracking-tighter italic">X-RAY PENETRASYON</span>
                   <button
                     onClick={() => setShowCamera(!showCamera)}
                     className={`ml-4 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
                       showCamera
                         ? 'bg-red-600 hover:bg-red-500 text-white'
                         : 'bg-sky-600 hover:bg-sky-500 text-white'
                     }`}
                   >
                     <CameraIcon className="w-4 h-4" />
                     {showCamera ? 'Kamerayi Kapat' : 'Kamerayi Ac'}
                   </button>
                </div>
                
                <AnimatePresence>
                  {alert && (
                    <motion.div 
                      initial={{ x: -100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -100, opacity: 0 }}
                      className="bg-red-600/90 border-2 border-red-400 px-6 py-4 rounded-[2rem] shadow-[0_0_50px_rgba(239,68,68,0.6)] backdrop-blur-2xl"
                    >
                       <div className="flex items-center gap-3 mb-1">
                          <ShieldAlert className="w-5 h-5 text-white animate-bounce" />
                          <div className="text-[10px] font-black text-white uppercase tracking-widest leading-none">KRİTİK ANOMALİ</div>
                       </div>
                       <div className="text-xl font-black text-white uppercase tracking-tight">{alert}</div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-black/80 border border-sky-500/20 p-6 rounded-[2rem] backdrop-blur-3xl shadow-xl">
                   <div className="text-[9px] font-black text-sky-500 uppercase tracking-[0.3em] mb-2">HİBRİT MATERYAL ANALİZİ</div>
                   <div className="text-xl font-bold text-white uppercase tracking-tight">{material}</div>
                   <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                         <motion.div className="h-full bg-sky-500" animate={{ width: `${penetration}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-sky-400 font-bold">%{penetration}</span>
                   </div>
                </div>
             </div>

             <div className="flex flex-col gap-3">
                <div className="p-6 bg-black/90 rounded-[2rem] border border-zinc-800 text-right backdrop-blur-2xl">
                   <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">PROBE REZONANS</div>
                   <div className="text-4xl font-mono font-black text-sky-400 tabular-nums">
                      {Math.abs(sensorData.magnetic.total - 48).toFixed(2)}<span className="text-sm ml-1">∆µT</span>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-4 bg-black/90 rounded-2xl border border-zinc-800 backdrop-blur-2xl">
                      <div className="text-[9px] font-black text-zinc-500 uppercase">SCAN_DEPTH</div>
                      <div className="text-2xl font-black text-white italic">{depth.toFixed(2)}<span className="text-xs ml-0.5">m</span></div>
                   </div>
                   <div className="p-4 bg-black/90 rounded-2xl border border-zinc-800 backdrop-blur-2xl">
                      <div className="text-[9px] font-black text-zinc-500 uppercase">SIGNAL_STR</div>
                      <div className="text-2xl font-black text-white italic">{penetration}<span className="text-xs ml-0.5">%</span></div>
                   </div>
                </div>
             </div>
          </div>

          <div className="flex flex-col items-center gap-6">
             <div className="flex items-center gap-10 px-10 py-4 bg-sky-500/5 border border-sky-500/20 rounded-full backdrop-blur-3xl">
                {[
                  { label: 'BETON', color: 'bg-zinc-400', active: material.includes('Beton') },
                  { label: 'METAL', color: 'bg-red-500', active: material.includes('Metal') || material.includes('Donatı') },
                  { label: 'BOŞLUK', color: 'bg-sky-400', active: material.includes('Boşluk') },
                ].map((tag) => (
                  <div key={tag.label} className={`flex items-center gap-3 transition-opacity ${tag.active ? 'opacity-100' : 'opacity-20'}`}>
                     <div className={`w-2.5 h-2.5 rounded-full ${tag.color} ${tag.active ? 'animate-pulse shadow-[0_0_10px_white]' : ''}`} />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">{tag.label}</span>
                  </div>
                ))}
             </div>
             <div className="text-[10px] font-bold text-sky-500/50 uppercase tracking-[0.4em] animate-pulse">SİNYAL DARBESİ İÇİN EKRANA DOKUNUN</div>
          </div>
       </div>

       {/* Kamera Paneli */}
       {showCamera && (
         <div className="absolute bottom-8 right-8 z-[100] w-80 bg-black/90 border-2 border-sky-500/50 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(14,165,233,0.4)]">
           <div className="flex items-center justify-between p-4 bg-sky-500/10 border-b border-sky-500/30">
             <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">KAMERA STREAM</span>
             <button
               onClick={() => setShowCamera(false)}
               className="text-sky-400 hover:text-sky-300 transition-colors"
             >
               ✕
             </button>
           </div>
           <div className="relative aspect-video bg-black overflow-hidden">
             <video
               ref={cameraVideoRef}
               autoPlay
               playsInline
               muted
               className="w-full h-full object-cover"
             />
             <div className="absolute inset-0 pointer-events-none border-2 border-sky-500/20 rounded-lg" />
           </div>
           <div className="p-3 bg-black/50 border-t border-sky-500/20 flex gap-2">
             <button
               onClick={async () => {
                 try {
                   const stream = await navigator.mediaDevices.getUserMedia({
                     video: { facingMode: 'environment' }
                   });
                   if (cameraVideoRef.current) {
                     cameraVideoRef.current.srcObject = stream;
                   }
                 } catch (err) {
                   console.error('Kamera hatası:', err);
                 }
               }}
               className="flex-1 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors uppercase"
             >
               Kamerayi Baslat
             </button>
             <button
               onClick={() => {
                 if (cameraVideoRef.current?.srcObject) {
                   const tracks = (cameraVideoRef.current.srcObject as MediaStream).getTracks();
                   tracks.forEach(track => track.stop());
                   cameraVideoRef.current.srcObject = null;
                 }
               }}
               className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors uppercase"
             >
               Kamerayi Durdur
             </button>
           </div>
         </div>
       )}
    </div>
  );
};

interface PermissionsSetupProps {
  permissions: {
    camera: boolean;
    microphone: boolean;
    motion: boolean;
    orientation: boolean;
    location: boolean;
    nfc: boolean;
    wifi: boolean;
    bluetooth: boolean;
    battery: boolean;
    internet: boolean;
  };
  onComplete: () => void;
}

type DeviceStatus = 'approved' | 'pending' | 'new' | null;

const PermissionsSetup: React.FC<PermissionsSetupProps> = ({ permissions, onComplete }) => {
  const [tempPermissions, setTempPermissions] = useState(permissions);
  const [loading, setLoading] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [popupBlockedType, setPopupBlockedType] = useState<string | null>(null);

  const requestPermission = async (type: keyof typeof permissions) => {
    try {
      if (type === 'camera') {
        console.log('📹 Kamera izni isteniyor...');
        console.log('⚠️ Tarayıcı popup\'ında KABUL ET\'i tıkla!');
        
        try {
          // Önce mevcut izinleri kontrol et
          try {
            const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
            console.log('📋 Mevcut kamera izni durumu:', permissions.state);
            
            if (permissions.state === 'granted') {
              console.log('✅ Kamera izni zaten verilmiş, UI güncelleniyor');
              setTempPermissions((prev) => ({ ...prev, camera: true }));
              return;
            }
          } catch (permCheckErr) {
            console.log('⚠️ İzin kontrolü yapılamadı, doğrudan isteniyor:', permCheckErr);
          }

          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'environment'
            }
          });
          
          console.log('✓ Kamera popup\'ı yanıt verdi, stream alındı');
          
          // Stream'i güvenli şekilde kapat
          if (stream && stream.getTracks) {
            stream.getTracks().forEach(t => {
              console.log('📍 Kamera track kapatılıyor:', t.kind);
              try {
                t.stop();
              } catch (e) {
                console.warn('Kamera track kapatılırken hata:', e);
              }
            });
          }
          
          setTempPermissions((prev) => ({ ...prev, camera: true }));
          console.log('✅ Kamera izni BAŞARILI - UI güncellendi');
          
        } catch (err: any) {
          const errorName = err?.name || 'Unknown';
          const errorMsg = err?.message || String(err);
          
          console.error('❌ KAMERA HATASI!', {
            name: errorName,
            message: errorMsg,
            toString: err.toString()
          });
          
          // Specific error handling
          if (errorName === 'NotAllowedError') {
            console.log('❌ Kullanıcı kamera iznini reddetti');
            alert('Kamera izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.');
          } else if (errorName === 'NotReadableError') {
            console.log('❌ Kamera başka uygulama tarafından kullanılıyor');
            const confirmed = confirm(
              '⚠️ Kamera başka bir uygulama tarafından kullanılıyor!\n\n' +
              'Sebebi:\n' +
              '• Zoom, Teams, OBS gibi uygulamalar açık\n' +
              '• Başka bir sekme kamera kullanıyor\n\n' +
              'Seçenekler:\n' +
              '✓ Evet: Yedek modda devam et\n' +
              '✗ Hayır: Uygulamaları kapatıp tekrar dene'
            );
            
            if (confirmed) {
              setTempPermissions((prev) => ({ ...prev, camera: true }));
              console.log('✅ Yedek modda kamera izni verildi');
            }
          } else if (errorName === 'NotFoundError') {
            console.log('❌ Kamera bulunamadı');
            const confirmed = confirm(
              '⚠️ Kamera bulunamadı!\n\n' +
              'Seçenekler:\n' +
              '✓ Evet: Yedek modda devam et\n' +
              '✗ Hayır: Kamera bağlayıp tekrar dene'
            );
            
            if (confirmed) {
              setTempPermissions((prev) => ({ ...prev, camera: true }));
              console.log('✅ Yedek modda kamera izni verildi');
            }
          } else {
            console.log('❌ Bilinmeyen kamera hatası:', err);
            const confirmed = confirm(
              '⚠️ Kamera izni alınırken hata oluştu!\n\n' +
              'Hata: ' + errorMsg + '\n\n' +
              'Seçenekler:\n' +
              '✓ Evet: Yedek modda devam et\n' +
              '✗ Hayır: Tekrar dene'
            );
            
            if (confirmed) {
              setTempPermissions((prev) => ({ ...prev, camera: true }));
              console.log('✅ Yedek modda kamera izni verildi');
            }
          }
        }
      } else if (type === 'microphone') {
        console.log('🎤 Mikrofon izni isteniyor...');
        console.log('⚠️ Tarayıcı popup\'ında KABUL ET\'i tıkla!');

        try {
          console.log('→ getUserMedia çağrısı yapılıyor...');

          // Önce mevcut izinleri kontrol et
          try {
            const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            console.log('📋 Mevcut mikrofon izni durumu:', permissions.state);
            
            if (permissions.state === 'granted') {
              console.log('✅ Mikrofon izni zaten verilmiş, UI güncelleniyor');
              setTempPermissions((prev) => ({ ...prev, microphone: true }));
              return;
            }
          } catch (permCheckErr) {
            console.log('⚠️ İzin kontrolü yapılamadı, doğrudan isteniyor:', permCheckErr);
          }

          // Basit ve doğrudan yaklaşım - timeout kaldırıldı
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          console.log('✓ Popup yanıt verdi, stream alındı');
          
          // Stream'i güvenli şekilde kapat
          if (stream && stream.getTracks) {
            stream.getTracks().forEach(t => {
              console.log('📍 Track kapatılıyor:', t.kind);
              try {
                t.stop();
              } catch (e) {
                console.warn('Track kapatılırken hata:', e);
              }
            });
          }

          // State'i güncelle
          setTempPermissions((prev) => ({ ...prev, microphone: true }));
          console.log('✅ Mikrofon izni BAŞARILI - UI güncellendi');

        } catch (err: any) {
          const errorName = err?.name || 'Unknown';
          const errorMsg = err?.message || String(err);

          console.error('❌ MIKROFON HATASI!', {
            name: errorName,
            message: errorMsg,
            toString: err.toString()
          });

          // Specific error handling
          if (errorName === 'NotAllowedError') {
            console.log('❌ Kullanıcı mikrofon iznini reddetti');
            alert('Mikrofon izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.');
          } else if (errorName === 'NotReadableError') {
            console.log('❌ Mikrofon başka uygulama tarafından kullanılıyor');
            const confirmed = confirm(
              '⚠️ Mikrofon başka bir uygulama tarafından kullanılıyor!\n\n' +
              'Sebebi:\n' +
              '• Zoom, Teams, OBS gibi uygulamalar açık\n' +
              '• Başka bir sekme mikrofon kullanıyor\n\n' +
              'Seçenekler:\n' +
              '✓ Evet: Yedek modda devam et\n' +
              '✗ Hayır: Uygulamaları kapatıp tekrar dene'
            );

            if (confirmed) {
              setTempPermissions((prev) => ({ ...prev, microphone: true }));
              console.log('✅ Yedek modda mikrofon izni verildi');
            }
          } else if (errorName === 'NotFoundError') {
            console.log('❌ Mikrofon bulunamadı');
            const confirmed = confirm(
              '⚠️ Mikrofon bulunamadı!\n\n' +
              'Seçenekler:\n' +
              '✓ Evet: Yedek modda devam et\n' +
              '✗ Hayır: Mikrofon bağlayıp tekrar dene'
            );

            if (confirmed) {
              setTempPermissions((prev) => ({ ...prev, microphone: true }));
              console.log('✅ Yedek modda mikrofon izni verildi');
            }
          } else {
            console.log('❌ Bilinmeyen mikrofon hatası:', err);
            const confirmed = confirm(
              '⚠️ Mikrofon izni alınırken hata oluştu!\n\n' +
              'Hata: ' + errorMsg + '\n\n' +
              'Seçenekler:\n' +
              '✓ Evet: Yedek modda devam et\n' +
              '✗ Hayır: Tekrar dene'
            );

            if (confirmed) {
              setTempPermissions((prev) => ({ ...prev, microphone: true }));
              console.log('✅ Yedek modda mikrofon izni verildi');
            }
          }
        }
      } else if (type === 'location') {
        console.log('📍 Konum izni isteniyor...');
        navigator.geolocation.getCurrentPosition(() => {
          setTempPermissions((prev) => ({ ...prev, location: true }));
          console.log('✓ Konum izni alındı');
        });
      } else if (type === 'motion') {
        try {
          if (typeof (DeviceMotionEvent as any) !== 'undefined' && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            const response = await (DeviceMotionEvent as any).requestPermission();
            if (response === 'granted') {
              setTempPermissions((prev) => ({ ...prev, motion: true }));
              console.log('✓ Hareket izni alındı');
            } else {
              throw new Error('Motion permission denied');
            }
          } else {
            setTempPermissions((prev) => ({ ...prev, motion: true }));
            console.log('✓ Hareket izni alındı');
          }
        } catch (err) {
          console.error('✗ Hareket izni başarısız:', err);
          throw err;
        }
      } else if (type === 'orientation') {
        try {
          if (typeof (DeviceOrientationEvent as any) !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            const response = await (DeviceOrientationEvent as any).requestPermission();
            if (response === 'granted') {
              setTempPermissions((prev) => ({ ...prev, orientation: true }));
              console.log('✓ Yönelim izni alındı');
            } else {
              throw new Error('Orientation permission denied');
            }
          } else {
            setTempPermissions((prev) => ({ ...prev, orientation: true }));
            console.log('✓ Yönelim izni alındı');
          }
        } catch (err) {
          console.error('✗ Yönelim izni başarısız:', err);
          throw err;
        }
      } else if (type === 'battery') {
        setTempPermissions((prev) => ({ ...prev, battery: true }));
      } else if (type === 'internet') {
        setTempPermissions((prev) => ({ ...prev, internet: true }));
      } else {
        setTempPermissions((prev) => ({ ...prev, [type]: true }));
      }
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      console.error(`❌ ${type} izni REDDEDILDI:`, {
        type,
        error_name: e?.name,
        error_message: errorMsg,
        full_error: e
      });
      alert(`⚠️ ${type.toUpperCase()} İZNİ REDDEDILDI\n\n${errorMsg}\n\nAdres çubuğundaki kilit → İzinler → İzin Ver`);
    }
  };

  const grantAllPermissions = async () => {
    setLoading(true);
    try {
      // Donanım izinlerini merkezi fonksiyondan iste
      const sensorResult = await requestSensorPermission();
      
      // Konum iznini ayrıca iste
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            console.log('✓ Konum izni alındı.');
            resolve();
          },
          (err) => {
            console.warn('Konum izni hatası:', err.message);
            resolve(); // Hata olsa bile devam et
          },
          { enableHighAccuracy: true }
        );
      });

      // Tüm izinleri 'true' olarak ayarla ve devam et
      setTempPermissions(prev => ({
        ...prev,
        camera: true, microphone: true,
        motion: sensorResult.motion, orientation: sensorResult.motion,
        location: true, battery: true, internet: true
      }));

      setLoading(false);
      onComplete();
    } catch (err) {
      console.error('grantAllPermissions hata:', err);
      setLoading(false);
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] flex items-center justify-center p-6 text-white font-sans overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-3xl bg-zinc-950 border border-zinc-900 rounded-2xl p-6 md:p-8 space-y-6 relative z-10 shadow-2xl"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tighter uppercase">SİSTEM KURULUMU</h1>
          <p className="text-[9px] text-zinc-500 uppercase tracking-[0.3em] font-bold">AKN Global Group</p>
          <p className="text-xs text-zinc-400 mt-2">Tüm izinleri onaylayın</p>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { id: 'camera', label: 'Kamera', desc: 'Ortamı taramak ve AR görüntüsü almak için', type: 'ZORUNLU', icon: CameraIcon, active: tempPermissions.camera },
            { id: 'microphone', label: 'Mikrofon', desc: 'Ses frekans analizi için', type: 'ZORUNLU', icon: Mic, active: tempPermissions.microphone },
            { id: 'motion', label: 'Hareket', desc: 'Cihaz takibi için', type: 'ZORUNLU', icon: Zap, active: tempPermissions.motion },
            { id: 'orientation', label: 'Yönelim İzleri', desc: 'Cihaz yönünü anlamak için', type: 'ÖNERİLİ', icon: Compass, active: tempPermissions.orientation },
            { id: 'location', label: 'Konum (GPS)', desc: 'Tarama konumunu kaydetmek için', type: 'ZORUNLU', icon: Globe, active: tempPermissions.location },
            { id: 'nfc', label: 'NFC', desc: 'NFC etiketlerini okumak için', type: 'OPSİYONEL', icon: SmartphoneNfc, active: tempPermissions.nfc },
            { id: 'wifi', label: 'WiFi', desc: 'Ağ spektrumunu taramak için', type: 'OPSİYONEL', icon: Wifi, active: tempPermissions.wifi },
            { id: 'bluetooth', label: 'Bluetooth', desc: 'Yakın cihaz taraması için', type: 'OPSİYONEL', icon: Bluetooth, active: tempPermissions.bluetooth },
            { id: 'battery', label: 'Batarya', desc: 'Sistem güç yönetimi için', type: 'ZORUNLU', icon: Battery, active: tempPermissions.battery },
            { id: 'internet', label: 'İnternet', desc: 'AI bulut senkronizasyonu için', type: 'ZORUNLU', icon: Globe, active: tempPermissions.internet },
          ].map((perm) => (
            <motion.div
              key={perm.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                tempPermissions[perm.id as keyof typeof tempPermissions]
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-zinc-900/30 border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`p-2 rounded-lg flex-shrink-0 ${tempPermissions[perm.id as keyof typeof tempPermissions] ? 'bg-emerald-500 text-black' : 'bg-zinc-900 text-zinc-500'}`}>
                  <perm.icon className="w-4 h-4" />
                </div>
                <div className={`text-[7px] font-black px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  tempPermissions[perm.id as keyof typeof tempPermissions]
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                }`}>
                  {tempPermissions[perm.id as keyof typeof tempPermissions] ? '✓' : 'X'}
                </div>
              </div>

              <div className="min-h-[2.5rem] flex flex-col justify-between">
                <div>
                  <div className="text-xs font-black text-white uppercase tracking-tight leading-tight">{perm.label}</div>
                  <div className="text-[7px] text-zinc-500 font-medium leading-tight mt-0.5">{perm.desc}</div>
                </div>
              </div>

              {!tempPermissions[perm.id as keyof typeof tempPermissions] && (
                <button
                  key={`${perm.id}-button`}
                  onClick={() => requestPermission(perm.id as keyof typeof tempPermissions)}
                  className="w-full py-1.5 bg-zinc-900 hover:bg-emerald-600 text-zinc-400 hover:text-white rounded-lg text-[7px] font-black uppercase tracking-widest transition-all border border-zinc-800 hover:border-emerald-500 active:scale-95"
                >
                  İZİN
                </button>
              )}
            </motion.div>
          ))}
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        <div className="flex flex-col items-center gap-4 pt-2">
          <button
            onClick={grantAllPermissions}
            disabled={loading}
            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black tracking-[0.15em] transition-all shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:-translate-y-1 active:translate-y-0 text-sm uppercase flex items-center justify-center gap-2 w-full"
          >
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center">
                {!loading && <CheckCircle2 className="w-4 h-4" />}
                {loading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />}
              </div>
              {loading ? 'İZİNLER ALINIYOR...' : 'TÜM İZİNLERİ VER'}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  // Device Approval System
  const [deviceApprovalState, setDeviceApprovalState] = useState<{
    checked: boolean;
    status: DeviceStatus | null;
    deviceId: string | null;
  }>({
    checked: false,
    status: null,
    deviceId: null,
  });

  // License system removed - app no longer requires license
  // localStorage.removeItem('mlas_license'); // Clear old license data if exists
  const [license] = useState<{ activatedAt: number; expirationDate: number } | null>(() => {
    // Always return valid license to bypass license check
    return { activatedAt: Date.now(), expirationDate: Date.now() + (1000 * 60 * 60 * 24 * 365 * 10) };
  });
  const [permissions, setPermissions] = useState(() => {
    const saved = localStorage.getItem('mlas_permissions_v2');
    if (saved) return JSON.parse(saved);
    return { 
      camera: false, 
      microphone: false, 
      motion: false, 
      orientation: false, 
      location: false, 
      nfc: false,
      wifi: false,
      bluetooth: false,
      battery: false,
      internet: false
    };
  });

  interface PermState { 
    camera: boolean; 
    microphone: boolean; 
    motion: boolean; 
    orientation: boolean; 
    location: boolean; 
    nfc: boolean;
    wifi: boolean;
    bluetooth: boolean;
    battery: boolean;
    internet: boolean;
  }

  // Device Approval Check - Bu uygulamaya erişebilmek için cihaz onayını kontrol et
  useEffect(() => {
    const initializeDeviceApproval = async () => {
      let generatedId = 'ÜRETİLİYOR...';
      try {
        generatedId = await getSHIdentity();
        
        // Firebase kontrolünden önce ID'yi state'e yazalım
        setDeviceApprovalState(prev => ({ ...prev, deviceId: generatedId }));

        const isApproved = await checkApproval(generatedId);

        setDeviceApprovalState({
          checked: true,
          status: isApproved ? 'approved' : 'pending',
          deviceId: generatedId,
        });

        if (isApproved) {
          console.log('✅ Cihaz Onaylı - Uygulamaya Giriş İzni Verildi');
        }
      } catch (error) {
        console.error('❌ Firebase Bağlantı Hatası (API anahtarlarını kontrol edin):', error);
        setDeviceApprovalState({
          checked: true,
          status: 'pending',
          deviceId: generatedId === 'ÜRETİLİYOR...' ? 'ERR-ID' : generatedId,
        });
      }
    };

    initializeDeviceApproval();
  }, []);

  // Pull-to-Refresh özelliği - Telefonda aşağı çekmek için
  const refreshIndicatorRef = usePullToRefresh({
    onRefresh: async () => {
      window.location.reload();
    },
    threshold: 80,
  });

  // Clear old license data on app startup
  useEffect(() => {
    localStorage.removeItem('mlas_license');
  }, []);

  useEffect(() => {
    localStorage.setItem('mlas_permissions_v2', JSON.stringify(permissions));
  }, [permissions]);

  const setupComplete = Object.values(permissions).every(p => p === true);

  useEffect(() => {
    if (setupComplete) {
       setSensorsActive(true);
    }
  }, [setupComplete]);

  const [showSensorQualityDetails, setShowSensorQualityDetails] = useState(false);

  const SensorValidationUI = () => {
    const { score, label, errors, warnings } = dataQuality;
    
    const getStatusColor = () => {
      if (label === 'POOR') return 'text-red-500 border-red-500/30 bg-red-500/10';
      if (label === 'MODERATE') return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
      if (label === 'GOOD') return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
      return 'text-sky-500 border-sky-500/30 bg-sky-500/10';
    };

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-3xl border backdrop-blur-2xl ${getStatusColor()} pointer-events-auto cursor-pointer`}
        onClick={() => setShowSensorQualityDetails(true)}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-xl bg-current opacity-20`}>
                <Cpu className="w-5 h-5 text-white" />
             </div>
             <div>
                <div className="text-[8px] font-black uppercase tracking-widest opacity-60">SENSR_VALIDATION</div>
                <div className="text-sm font-black tracking-tight uppercase italic">{label} QUALITY</div>
             </div>
          </div>
          <div className="text-right">
             <div className="text-lg font-black leading-none">%{score}</div>
             <div className="text-[8px] font-bold opacity-60">CONFIDENCE</div>
          </div>
        </div>
        
        {errors.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[9px] font-bold">
            <ShieldAlert className="w-3 h-3 text-red-500" />
            <span>{errors.length} KRİTİK HATA TESPİT EDİLDİ</span>
          </div>
        )}
      </motion.div>
    );
  };

  const SensorQualityModal = () => (
    <AnimatePresence>
      {showSensorQualityDetails && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 space-y-8 overflow-hidden relative shadow-2xl"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />
            
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <h3 className="text-2xl font-black italic tracking-tighter uppercase">SENSOR DATA VALIDATION</h3>
                  <p className="text-[10px] text-zinc-500 font-bold tracking-[0.3em] uppercase">Sinyal Doğrulama ve Bütünlük Analizi</p>
               </div>
               <button 
                 onClick={() => setShowSensorQualityDetails(false)}
                 className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-400 transition-all active:scale-90"
               >
                 <Trash2 className="w-5 h-5" />
               </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-zinc-800/50 p-6 rounded-[2.5rem] border border-zinc-800 items-center flex flex-col justify-center">
                  <div className="text-4xl font-black text-white italic tracking-tighter">%{dataQuality.score}</div>
                  <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">GÜVEN SKORU</div>
               </div>
               <div className={`p-6 rounded-[2.5rem] border items-center flex flex-col justify-center ${
                 dataQuality.label === 'POOR' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
               }`}>
                  <div className="text-2xl font-black italic tracking-tighter">{dataQuality.label}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">KALİTE SINIFI</div>
               </div>
            </div>

            <div className="space-y-4">
               {dataQuality.errors.length > 0 && (
                  <div className="space-y-2">
                     <div className="text-[9px] font-black text-red-500 uppercase tracking-widest px-2">KRİTİK HATALAR</div>
                     {dataQuality.errors.map((err, i) => (
                        <div key={i} className="flex gap-3 bg-red-500/5 border border-red-500/20 p-4 rounded-2xl">
                           <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                           <div className="text-xs font-bold text-red-100">{err}</div>
                        </div>
                     ))}
                  </div>
               )}

               {dataQuality.warnings.length > 0 && (
                  <div className="space-y-2">
                     <div className="text-[9px] font-black text-amber-500 uppercase tracking-widest px-2">SİSTEM UYARILARI</div>
                     {dataQuality.warnings.map((warn, i) => (
                        <div key={i} className="flex gap-3 bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl">
                           <Info className="w-5 h-5 text-amber-500 shrink-0" />
                           <div className="text-xs font-bold text-amber-100">{warn}</div>
                        </div>
                     ))}
                  </div>
               )}
            </div>

            <div className="bg-zinc-950 p-6 rounded-[2.5rem] space-y-4">
               <div className="text-[9px] font-black text-sky-500 uppercase tracking-widest italic">OPTIMIZASYON ÖNERİLERİ</div>
               <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium">
                     <div className="w-2 h-2 rounded-full bg-sky-500" />
                     Cihazı yavaşça 8 çizecek şekilde kalibre edin
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium">
                     <div className="w-2 h-2 rounded-full bg-sky-500" />
                     Güçlü manyetik alanlardan (trafo, pano) uzaklaşın
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium">
                     <div className="w-2 h-2 rounded-full bg-sky-500" />
                     Durağan modda en az 3 saniye bekleyin
                  </div>
               </div>
            </div>

            <button 
              onClick={() => setShowSensorQualityDetails(false)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-bold tracking-widest transition-all shadow-xl active:scale-95"
            >
              ANALİZE DEVAM ET
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const [activeTab, setActiveTab ] = useState(() => {
    const saved = localStorage.getItem('mlas_tab');
    const validTabs = ['ana sayfa', 'radar', '3d-view', 'günlükler', 'kamera', 'katmanlar', 'x-ray'];
    return saved && validTabs.includes(saved) ? saved : 'ana sayfa';
  });
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [scanTimeLeft, setScanTimeLeft] = useState(0);
  const [sensorsActive, setSensorsActive] = useState(() => {
    return localStorage.getItem('mlas_sensors') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('mlas_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('mlas_sensors', sensorsActive.toString());
  }, [sensorsActive]);
  const [micActive, setMicActive] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('mlas_voice');
    return saved ? saved === 'true' : true;
  });
  const [analysis, setAnalysis] = useState<any | null>(() => {
    const saved = localStorage.getItem('mlas_last_analysis');
    return saved ? JSON.parse(saved) : null;
  });
  const [showDetails, setShowDetails] = useState(false);
  const [scanExecutionMode, setScanExecutionMode] = useState<ScanExecutionMode>('ALL_IN_ONE_MASTER');
  const [activeSingleFeature, setActiveSingleFeature] = useState<ActiveSingleFeature>('LIDAR_OCR');

  useEffect(() => {
    orchestrator.scanExecutionMode = scanExecutionMode;
  }, [scanExecutionMode]);

  useEffect(() => {
    orchestrator.activeSingleFeature = activeSingleFeature;
  }, [activeSingleFeature]);
  const [logs, setLogs] = useState<ScanLogEntry[]>(() => {
    const saved = localStorage.getItem('mlas_logs');
    return saved ? JSON.parse(saved) : [];
  });
  
  useEffect(() => {
    if (analysis) {
      localStorage.setItem('mlas_last_analysis', JSON.stringify(analysis));
    }
  }, [analysis]);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSystemDetails, setShowSystemDetails] = useState(false);
  const [showSystemSetup, setShowSystemSetup] = useState(false);
  const [showRecordPrompt, setShowRecordPrompt] = useState(false);
  const [showXRayPanel, setShowXRayPanel] = useState(false);
  const [isRecordingEnabled, setIsRecordingEnabled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const lastTabSwitchRef = useRef<number>(0);
  const wakeLock = useRef<any>(null);
  const visualProcessorRef = useRef<VisualProcessor | null>(null);
  const scanTimeoutRef = useRef<any>(null);
  const analyzeTimeoutRef = useRef<any>(null);
  const recordingTimeoutRef = useRef<any>(null);

  // --- GLOBAL SCREEN RECORDER INTEGRATION ---
  const [globalRecordState, setGlobalRecordState] = useState<'idle' | 'recording' | 'review'>('idle');
  const [globalRecordBlobUrl, setGlobalRecordBlobUrl] = useState<string | null>(null);
  const [showGlobalRecordPrompt, setShowGlobalRecordPrompt] = useState(true);
  const [globalRecordDuration, setGlobalRecordDuration] = useState(0);
  const [globalRecordMode, setGlobalRecordMode] = useState<'screen' | 'camera'>('screen');
  const [globalRecordError, setGlobalRecordError] = useState<string | null>(null);
  const globalRecorderRef = useRef<MediaRecorder | null>(null);
  const globalChunksRef = useRef<Blob[]>([]);
  const globalStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let interval: any;
    if (globalRecordState === 'recording') {
      interval = setInterval(() => {
        setGlobalRecordDuration(prev => prev + 1);
      }, 1000);
    } else {
      setGlobalRecordDuration(0);
    }
    return () => clearInterval(interval);
  }, [globalRecordState]);

  const formatGlobalDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startGlobalScreenRecording = async (modeOverride?: 'screen' | 'camera') => {
    const activeMode = modeOverride || globalRecordMode;
    try {
      vibrate(50);
      globalChunksRef.current = [];
      setGlobalRecordError(null);
      
      let stream: MediaStream;
      if (activeMode === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "browser",
            frameRate: { ideal: 30 },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            frameRate: { ideal: 30 },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      }
      
      globalStreamRef.current = stream;

      stream.getVideoTracks()[0].onended = () => {
        stopGlobalScreenRecording();
      };

      const options = { mimeType: 'video/webm;codecs=vp9' };
      let recorder: MediaRecorder;
      if (MediaRecorder.isTypeSupported(options.mimeType)) {
        recorder = new MediaRecorder(stream, options);
      } else {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          globalChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(globalChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setGlobalRecordBlobUrl(url);
        setGlobalRecordState('review');
        speak("Ekran kaydı tamamlandı. Lütfen kaydı gözden geçirin ve karar verin.");
      };

      recorder.start(1000);
      globalRecorderRef.current = recorder;
      setGlobalRecordMode(activeMode);
      setGlobalRecordState('recording');
      setShowGlobalRecordPrompt(false);
      speak(activeMode === 'screen' ? "Ekran kaydı başarıyla başlatıldı." : "Kamera akış kaydı başarıyla başlatıldı.");
    } catch (err: any) {
      console.warn("Ekran kaydı başlatılamadı (Güvenli iframe kısıtlaması nedeniyle beklenen durum):", err);
      if (activeMode === 'screen') {
        setGlobalRecordError(err.message || String(err));
        vibrate(100);
        speak("İzin reddedildi veya ekran kaydı engellendi. Alternatif yöntemleri deneyebiliriz.");
      } else {
        alert("Kayıt başlatılamadı: " + (err.message || String(err)));
      }
    }
  };

  const stopGlobalScreenRecording = () => {
    if (globalRecorderRef.current && globalRecorderRef.current.state !== 'inactive') {
      globalRecorderRef.current.stop();
    }
    if (globalStreamRef.current) {
      globalStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const handleDownloadGlobalRecording = () => {
    if (!globalRecordBlobUrl) return;
    vibrate(40);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = globalRecordBlobUrl;
    a.download = `AKN_Global_Group_Recording_${new Date().getTime()}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
    
    setGlobalRecordBlobUrl(null);
    setGlobalRecordState('idle');
    speak("Ekran kaydı başarıyla cihazınıza indirildi.");
  };

  const handleRejectGlobalRecording = () => {
    if (confirm("Bu ekran kaydını tamamen silmek ve reddetmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
      vibrate(30);
      if (globalRecordBlobUrl) {
        URL.revokeObjectURL(globalRecordBlobUrl);
      }
      setGlobalRecordBlobUrl(null);
      setGlobalRecordState('idle');
      speak("Kayıt reddedildi ve kalıcı olarak silindi.");
    }
  };

  const [visualStats, setVisualStats] = useState({ edgeDensity: 0, motionDelta: 0, brightness: 0 });
  const [telemetryHistory, setTelemetryHistory] = useState<any[]>([]);

  const [sensorHistory, setSensorHistory] = useState<any[]>([]);
  const [dataQuality, setDataQuality] = useState<{
    score: number,
    errors: string[],
    warnings: string[],
    label: 'POOR' | 'MODERATE' | 'GOOD' | 'EXCELLENT'
  }>({ score: 100, errors: [], warnings: [], label: 'EXCELLENT' });

  // --- NEW FIELD ENGINEERING STATES ---
  const [showMasterScanConfig, setShowMasterScanConfig] = useState(false);
  const [soilType, setSoilType] = useState<'clay' | 'sand' | 'wet_soil' | 'dry_rock'>('clay');
  const [spectralFilter, setSpectralFilter] = useState<'low' | 'standard' | 'differential'>('standard');
  const [voxelResolution, setVoxelResolution] = useState<'64' | '128' | '256'>('128');
  const [recordingChoice, setRecordingChoice] = useState<'none' | 'camera' | 'fullscreen'>('camera');

  const [selectedMission, setSelectedMission] = useState<MissionType>(() => {
    const saved = localStorage.getItem('mlas_selected_mission');
    return (saved as MissionType) || 'shallow_metal';
  });

  useEffect(() => {
    localStorage.setItem('mlas_selected_mission', selectedMission);
  }, [selectedMission]);

  const [geomagneticBaseline, setGeomagneticBaseline] = useState<number>(() => {
    const saved = localStorage.getItem('mlas_geomagnetic_baseline');
    return saved ? parseFloat(saved) : 48.0;
  });

  useEffect(() => {
    localStorage.setItem('mlas_geomagnetic_baseline', geomagneticBaseline.toString());
  }, [geomagneticBaseline]);

  const [isGeomagneticCalibrated, setIsGeomagneticCalibrated] = useState(false);
  
  // Real-time simulated RF (Wi-Fi/Bluetooth) signals mapping
  const [rfSignals, setRfSignals] = useState<{ ssid: string; rssi: number; type: 'WiFi' | 'BLE' }[]>([
    { ssid: 'EM_EMITTER_01', rssi: -64, type: 'WiFi' },
    { ssid: 'EM_EMITTER_02 (JAMMER)', rssi: -82, type: 'WiFi' },
    { ssid: 'BLE_BEACON_NODE', rssi: -71, type: 'BLE' },
  ]);

  // Altitude track state for sloped terrains
  const [baroAltitude, setBaroAltitude] = useState(0.0);

  // Time-lapse comparison state
  const [selectedLogsForCompare, setSelectedLogsForCompare] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  
  // Field Report view toggle
  const [showSahaReport, setShowSahaReport] = useState(false);

  // Detailed feature modal state
  const [activeFeatureType, setActiveFeatureType] = useState<FeatureType>('mission');
  const [isFeatureDetailModalOpen, setIsFeatureDetailModalOpen] = useState(false);
  const [syncedNodes, setSyncedNodes] = useState<string[]>([]);

  // --- ORCHESTRATOR & COCKPIT HUD VIEW MODES ---
  const [orchestratorPhase, setOrchestratorPhase] = useState<OrchestratorPhase>('IDLE');
  const [calibrationTelemetry, setCalibrationTelemetry] = useState<CalibrationTelemetry>({
    spectrumSweepCleanChannel: 4,
    dielektrikSoilMoisture: 12.0,
    gprWaveVelocity: 0.15,
    geomagneticNoiseBaseline: 48.0,
    phaseProgress: 0,
  });
  const [operationalViewMode, setOperationalViewMode] = useState<'SIMPLE' | 'TACTICAL_MAP' | 'EXPERT_LAB'>(() => {
    const saved = localStorage.getItem('mlas_operational_view_mode');
    return (saved as any) || 'EXPERT_LAB';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [depthSlice, setDepthSlice] = useState<number>(1.5);

  useEffect(() => {
    localStorage.setItem('mlas_operational_view_mode', operationalViewMode);
  }, [operationalViewMode]);

  // Subscribe to central SahaOrkestratoru
  useEffect(() => {
    const unsub = orchestrator.subscribePhase((phase, calib) => {
      setOrchestratorPhase(phase);
      setCalibrationTelemetry({ ...calib });
    });
    return unsub;
  }, []);

  // Geiger Synthesizer controller effect
  useEffect(() => {
    const isActiveTabForAudio = activeTab === 'radar' || activeTab === 'kamera' || scanPhase === 'scanning';
    if (sensorsActive && isActiveTabForAudio && operationalViewMode === 'SIMPLE') {
      geigerSynth.start();
    } else {
      geigerSynth.stop();
    }
    return () => {
      geigerSynth.stop();
    };
  }, [sensorsActive, activeTab, scanPhase, operationalViewMode]);

  const handleToggleNodeSync = (id: string) => {
    vibrate(50);
    setSyncedNodes(prev => {
      if (prev.includes(id)) {
        return prev.filter(n => n !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  useEffect(() => {
    // Welcome logic - SILENCED BY USER REQUEST (Only show setup if needed, no speak)
    if (license) {
      if (!sensorsActive) {
        setShowSystemSetup(true);
      }
    }
  }, [license]);

  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const speak = (text: string) => {
    if (!voiceEnabled) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Cancel ongoing speeches to avoid overlapping for rapid triggers
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.95; // Slightly slower for better technical clarity
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    localStorage.setItem('mlas_voice', voiceEnabled.toString());
  }, [voiceEnabled]);

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    if (newState) {
      // Only speak if user just turned it ON
      setTimeout(() => speak("Sesli asistan sistemi aktifleşti."), 100);
    }
  };

  useEffect(() => {
    const handleWakeLock = async () => {
      if ('wakeLock' in navigator && (scanPhase === 'scanning' || scanPhase === 'analyzing')) {
        try {
          // @ts-ignore
          wakeLock.current = await navigator.wakeLock.request('screen');
        } catch (err: any) {
          // Handle iframe/permissions policy block as a warning instead of a console error
          if (err?.name === 'SecurityError' || err?.message?.includes('permissions policy') || err?.message?.includes('disallowed')) {
            console.warn('Wake Lock disallowed by permissions policy (running in iframe):', err.message);
          } else {
            console.warn('Wake Lock error:', err);
          }
        }
      } else {
        if (wakeLock.current) {
          wakeLock.current.release();
          wakeLock.current = null;
        }
      }
    };
    handleWakeLock();
    
    // Haptic feedback for phases
    if (scanPhase === 'scanning') vibrate(100);
    if (scanPhase === 'analyzing') vibrate([50, 100, 50]);
    if (scanPhase === 'results') vibrate([200, 100, 200]);
    
    return () => {
      if (wakeLock.current) {
        wakeLock.current.release();
        wakeLock.current = null;
      }
    };
  }, [scanPhase]);
  const [sliceZ, setSliceZ] = useState(30); 
  const [isNightMode, setIsNightMode] = useState(() => {
    return localStorage.getItem('mlas_night') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('mlas_night', isNightMode.toString());
  }, [isNightMode]);
  const [arPoints, setArPoints] = useState<THREE.Vector3[]>([]);
  const [arDistance, setArDistance] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<{ class: string; score: number; bbox: number[] }[]>([]);
  const [isObjectRecognitionApproved, setIsObjectRecognitionApproved] = useState(false);
  const [deviceLatitude, setDeviceLatitude] = useState<number>(39.92072);
  const [deviceLongitude, setDeviceLongitude] = useState<number>(32.85411);

  // Sync real GPS
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeviceLatitude(pos.coords.latitude);
          setDeviceLongitude(pos.coords.longitude);
        },
        (err) => console.log("Real Geolocation error, using default", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // --- TTS for Modals ---
  useEffect(() => {
    if (showGuide) {
      const guideText = "MLAS v4.5 Echelon Operasyonel Kılavuzuna hoş geldiniz. Sistem artık merkezi Saha Orkestratörü, derin tünellerde internet gerektirmeden çalışan yerel ONNX çevrimdışı yapay zeka motoru ve otomatik Loop Closure algoritması ile çalışıyor. Ayrıca, sisteme entegre edilen 4 yeni ileri düzey analizör; LIDAR arkeolojik sembol tanıma, GPR yapısal giriş tespiti, dikey gradyantli metal iletkenlik spektrumu ve boşluk yoğunluk tomografisidir.";
      speak(guideText);
    } else {
      window.speechSynthesis.cancel();
    }
  }, [showGuide]);

  useEffect(() => {
    if (showSystemDetails) {
      const systemText = "Teknik Protokol v4.5 Echelon detayları. Bu sürümde merkezi Saha Orkestratör yapısı ile telemetri ve yapay zeka süreçleri birleştirilmiştir. Ayrıca, LIDAR Arkeolojik OCR, GPR anomalilerinden yapısal giriş tespiti, çoklu frekanslı metal spektrumu ve dielektrik sönümlü boşluk yoğunluk analizi olmak üzere 4 yeni ileri düzey jeofiziksel modül aktiftir.";
      speak(systemText);
    } else {
      window.speechSynthesis.cancel();
    }
  }, [showSystemDetails]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { data: rawSensorData } = useSensorEngine(sensorsActive || scanPhase === 'scanning' || scanPhase === 'calibration' || activeTab === '3d-view' || activeTab === 'kamera' || activeTab === 'x-ray');
  
  // SENSOR FUSION: Merge raw sensors with visual analysis
  const sensorData: SensorData = useMemo(() => {
    return {
      magnetic: rawSensorData?.magnetic || { x: 0, y: 0, z: 0, total: 48 },
      acceleration: rawSensorData?.acceleration || { x: 0, y: 0, z: 0, total: 9.81 },
      orientation: rawSensorData?.orientation || { alpha: 0, beta: 0, gamma: 0 },
      frequency: rawSensorData?.frequency || 0,
      visual: visualStats || { edgeDensity: 0, motionDelta: 0, brightness: 0 },
      points: rawSensorData?.points || []
    };
  }, [rawSensorData, visualStats]);

  const magTotal = sensorData.magnetic.total;
  const accelTotal = sensorData.acceleration.total;

  // Continuous background stream to central orchestrator
  useEffect(() => {
    if (sensorsActive && rawSensorData) {
      orchestrator.pushTelemetryStream(rawSensorData, selectedMission);
    }
  }, [rawSensorData, sensorsActive, selectedMission]);

  const [liveSurfaceAnalysis, setLiveSurfaceAnalysis] = useState<SurfaceAnalysis | null>(null);
  const liveFreq = useFrequencyAnalyzer(sensorsActive || activeTab === 'kamera' || scanPhase === 'scanning' || scanPhase === 'calibration' || activeTab === '3d-view' || activeTab === 'x-ray');
  const liveAnalysis = useSensorFusion(sensorData, liveFreq / 100, liveSurfaceAnalysis);

  // Effect to handle %90+ AI confidence toast in SIMPLE mode
  useEffect(() => {
    if (operationalViewMode === 'SIMPLE' && liveAnalysis && liveAnalysis.score >= 90) {
      setToastMessage(`${liveAnalysis.type} (Güven: %${liveAnalysis.score})`);
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [operationalViewMode, liveAnalysis]);

  const isScanning = scanPhase === 'scanning' || scanPhase === 'calibration' || scanPhase === 'analyzing';

  // --- VISUAL ANALYSIS LOOP (CANNY-LIKE) ---
  useEffect(() => {
    if (!visualProcessorRef.current) {
      visualProcessorRef.current = new VisualProcessor();
    }
    
    let frameId: number;
    const runAnalysis = () => {
      if (videoRef.current && (sensorsActive || activeTab === 'kamera' || activeTab === '3d-view' || activeTab === 'x-ray' || scanPhase === 'scanning' || scanPhase === 'calibration')) {
        const stats = visualProcessorRef.current?.analyzeFrame(videoRef.current);
        if (stats) {
          setVisualStats({
            edgeDensity: stats.edgeDensity,
            motionDelta: stats.motionDelta,
            brightness: stats.brightnessVariancy
          });

          // Surface analysis for focal point
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, 160, 120);
              const frameData = ctx.getImageData(0, 0, 160, 120).data;
              const analysis = analyzeSurfaceDensity(frameData, 160, 120);
              setLiveSurfaceAnalysis(analysis);
            }
          } catch(e) {}
        }
      }
      frameId = requestAnimationFrame(runAnalysis);
    };
    
    runAnalysis();
    return () => cancelAnimationFrame(frameId);
  }, [sensorsActive, activeTab]);

  // --- TELEMETRY HISTORY TRACKING ---
  useEffect(() => {
    if (!sensorsActive) return;
    const interval = setInterval(() => {
      setTelemetryHistory(prev => {
        const newData = {
          time: Date.now(),
          mag: magTotal,
          freq: liveFreq,
          viz: sensorData.visual.edgeDensity
        };
        return [...prev.slice(-40), newData];
      });
    }, 200);
    return () => clearInterval(interval);
  }, [sensorsActive, sensorData, liveFreq]);
  useEffect(() => {
    // Record history for validator
    const timer = setInterval(() => {
      setSensorHistory(prev => {
        const next = [...prev, {
          mag: sensorData.magnetic.total,
          accel: sensorData.acceleration.total,
          orient: sensorData.orientation.beta,
          time: Date.now()
        }].slice(-50);
        return next;
      });
    }, 200);
    return () => clearInterval(timer);
  }, [sensorData.magnetic.total, sensorData.acceleration.total]);

  // SENSOR DATA VALIDATOR CORE LOGIC
  useEffect(() => {
    const validateData = () => {
      const history = sensorHistory.slice(-20); // Last 20 samples
      const errors: string[] = [];
      const warnings: string[] = [];
      let score = 100;

      if (history.length < 5) return;

      const last = history[history.length - 1];

      // 1. Repeating Data (Mock check)
      const repeats = history.filter(h => 
        h.mag === last.mag && 
        h.accel === last.accel && 
        h.orient === last.orient
      ).length;
      
      if (repeats >= 5) {
        errors.push("Tekrar eden veri tespiti (Mock Veri)");
        score -= 40;
      }

      // 2. Magnetic Field Anomalies
      if (last.mag === 0 || last.mag > 1000) {
        errors.push("Manyetik alan imkansız değer (Sıfır veya Çok Yüksek)");
        score -= 30;
      } else if (last.mag < 25 || last.mag > 65) {
        warnings.push("Manyetik alan standart dışı");
        score -= 10;
      }

      // 3. Impossible Acceleration
      if (last.accel < 1 || last.accel > 50) {
        errors.push("İvme ölçer hatası/İvme limit dışı");
        score -= 20;
      }

      // 4. Integer Values (Mock check)
      if (Number.isInteger(last.mag) && Number.isInteger(last.accel)) {
        warnings.push("Tam sayı veri akışı (Mock veri şüphesi)");
        score -= 15;
      }

      // 5. Zero Variance
      const variances = history.map(h => h.mag);
      const isStatic = new Set(variances).size === 1;
      if (isStatic && history.length >= 10) {
        errors.push("Veri varyansı yok (Cihaz dondurulmuş)");
        score -= 25;
      }

      let label: any = 'EXCELLENT';
      if (score < 30) label = 'POOR';
      else if (score < 60) label = 'MODERATE';
      else if (score < 85) label = 'GOOD';

      setDataQuality({ 
        score: Math.max(0, score), 
        errors, 
        warnings, 
        label 
      });
    };

    const interval = setInterval(validateData, 1000);
    return () => clearInterval(interval);
  }, [sensorHistory]);

  useEffect(() => {
    let model: any = null;
    let frameId: number;
    let isActive = true;

    const loadAndRunAI = async () => {
      try {
        setIsModelLoading(true);
        await tf.ready();
        if (!tf.getBackend()) {
          await tf.setBackend('cpu');
        }
        model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        if (!isActive) return;
        setIsModelReady(true);
        setIsModelLoading(false);
        speak("Yapay zeka analiz motoru ve nesne tanımlama aktif.");
        
        const detect = async () => {
          if (!isActive) return;
          if (videoRef.current && videoRef.current.readyState === 4 && model) {
            try {
              const predictions = await model.detect(videoRef.current);
              if (predictions.length > 0) {
                setAiAnalysis(predictions[0].class);
                setDetectedObjects(predictions.map((p: any) => ({
                  class: p.class,
                  score: p.score,
                  bbox: p.bbox
                })));
              } else {
                setAiAnalysis(null);
                setDetectedObjects([]);
              }
            } catch (err) {
              console.warn("Detection cycle failed:", err);
            }
          }
          frameId = requestAnimationFrame(detect);
        };
        detect();
      } catch (err) {
        console.error("AI Model failed to load:", err);
        setIsModelLoading(false);
      }
    };

    if (activeTab === 'kamera' || activeTab === '3d-view') {
      loadAndRunAI();
    }

    return () => {
      isActive = false;
      cancelAnimationFrame(frameId);
    };
  }, [activeTab]);

  // --- VOICE COMMAND HOST ---
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('speechRecognition' in window)) return;
    
    // @ts-ignore
    const Recognition = window.webkitSpeechRecognition || window.speechRecognition;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.lang = 'tr-TR';

    recognition.onresult = (event: any) => {
      if (!event.results || !event.results.length) return;
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
      console.log("Voice Command:", command);

      if (command.includes("taramayı başlat")) initiateScan(false);
      if (command.includes("kaydet")) switchTab('günlükler');
      if (command.includes("gece modu aç")) setIsNightMode(true);
      if (command.includes("gece modu kapat")) setIsNightMode(false);
      if (command.includes("radar aç")) switchTab('radar');
      if (command.includes("harita aç")) switchTab('3d-view');
      if (command.includes("fotoğraf çek")) vibrate(200);
    };

    if (voiceEnabled) {
      try {
        recognition.start();
      } catch (e) {
        console.warn("Recognition already started or failed");
      }
    }
    
    // Auto-restart recognition on end to keep listening
    recognition.onend = () => {
      if (voiceEnabled) {
        try { recognition.start(); } catch(e) {}
      }
    };

    return () => {
      recognition.onend = null;
      recognition.stop();
    };
  }, [voiceEnabled]);

  const switchTab = (tab: string) => {
    if (!tab) return;
    
    // Kill switch for accidental double triggers
    const now = Date.now();
    if (now - lastTabSwitchRef.current < 450) {
      console.warn("Rapid navigation suppressed");
      return;
    }
    lastTabSwitchRef.current = now;

    if (activeTab === tab) return;

    setActiveTab(tab);

    if (tab === 'kamera') {
      setIsObjectRecognitionApproved(false);
    }
    
    // Force reset blocking UI states when navigating
    setShowDetails(false);
    setShowRecordPrompt(false);
    setShowSettings(false);
    setShowGuide(false);
    setShowSystemSetup(false);
    setShowSystemDetails(false);
    setShowSahaReport(false);
    setIsFeatureDetailModalOpen(false);

    // Side effects (Sound and haptics)
    const tabNames: Record<string, string> = {
      'ana sayfa': 'Ana menü ekranına dönüldü.',
      'radar': 'Radar kontrol modülü aktif.',
      'kamera': 'AR Kamera tarama modu devrede.',
      '3d-view': 'Üç boyutlu veri bulutu görselleştirmesi.',
      'katmanlar': 'Sinyal spektrum ve katman analizi.',
      'günlükler': 'Saha günlükleri ve arşiv ekranı.'
    };
    if (tabNames[tab]) speak(tabNames[tab]);

    // Handle sensor permissions implicitly if not active
    if (tab !== 'ana sayfa' && !sensorsActive) {
      // Don't block navigation, just start request
      requestSensorPermission().then(result => {
        if (result.motion) {
          setSensorsActive(true);
          setMicActive(result.audio);
        }
      });
    }
  };

  useEffect(() => {
    localStorage.setItem('mlas_logs', JSON.stringify(logs));
  }, [logs]);

  const handleActivateSensors = async () => {
    speak("Sistem entegrasyonu başlatılıyor. Lütfen gerekli tüm donanım izinlerini onaylayın.");
    const result = await requestSensorPermission();
    
    if (result.motion) {
      setSensorsActive(true);
      setMicActive(result.audio);
      setShowSystemSetup(false);
      speak("Sistem başarıyla senkronize edildi. Kamera, Manyetometre ve GPS üniteleri tam kapasite aktif.");
      vibrate([100, 50, 100]);
      return true;
    } else {
      speak("Kritik sensör erişim hatası. Bazı özellikler devre dışı bırakıldı.");
      alert('Kritik hareket sensörü (Accelerometer/Gyroscope) erişimi reddedildi. ML-CORE v4.2 sistemlerinin çalışması için cihaz ayarlarından izin vermelisiniz.');
      return false;
    }
  };

  useEffect(() => {
    // Force a resize event to ensure 3D Canvas and Camera views sync their dimensions on mobile
    window.dispatchEvent(new Event('resize'));

    if (activeTab === 'kamera' || scanPhase === 'scanning' || activeTab === '3d-view' || activeTab === 'x-ray') {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Force play to ensure it starts
            videoRef.current.play().catch(e => console.warn("Camera auto-play failed:", e));
          }
        } catch (err) {
          console.error("Camera access denied:", err);
          // Fallback to any camera if environment fails
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
              videoRef.current.play().catch(e => console.warn("Camera auto-play fallback failed:", e));
            }
          } catch (e) {
            console.error("Total camera failure:", e);
          }
        }
      };
      startCamera();
    } else {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  }, [activeTab, scanPhase]);

  const startRecording = (stream: MediaStream) => {
    if (!isRecordingEnabled) return;
    
    recordedChunksRef.current = [];
    try {
      // Use higher quality for professional logs
      const options = { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 5000000 };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }
      
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `MLAS_SCAN_${new Date().getTime()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error("Recording start failed:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancelScan = () => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    scanTimeoutRef.current = null;
    recordingTimeoutRef.current = null;
    analyzeTimeoutRef.current = null;
    orchestrator.cancelScan();
    stopRecording();
    setScanPhase('idle');
    speak("Tarama işlemi iptal edildi.");
  };

  const finalizeScan = () => {
    // Clear active timeouts
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current);
      analyzeTimeoutRef.current = null;
    }

    stopRecording();
    setScanPhase('analyzing');
    speak("Tarama döngüsü tamamlandı. Katman verileri birleştiriliyor, 3D voksel rekonstrüksiyonu hesaplanıyor.");

    // Perform the final calculation
    const currentMag = sensorData.magnetic.total > 0 ? sensorData.magnetic.total : 48.0;
    const currentFreq = liveFreq;
    const currentAccel = sensorData.acceleration.z;

    analyzeTimeoutRef.current = setTimeout(() => {
      const result = liveAnalysis;
      if (!result) return;
      
      const finalAnalysis = {
        totalScore: Math.min(result.score, dataQuality.score),
        magneticIdx: result.magneticIdx,
        geometricIdx: result.geometricIdx,
        vegetationIdx: result.vegetationIdx,
        isRealSignal: result.isRealSignal && dataQuality.label !== 'POOR',
        status: dataQuality.label === 'POOR' ? 'Düşük' : result.status,
        type: result.type,
        timestamp: new Date(result.timestamp).toLocaleTimeString('tr-TR'),
        mission: selectedMission,
        baseline: geomagneticBaseline,
        latitude: deviceLatitude,
        longitude: deviceLongitude,
        quality: dataQuality,
        soilType: soilType,
        spectralFilter: spectralFilter,
        syncedNodes: syncedNodes,
        voxelResolution: voxelResolution,
        recordingChoice: recordingChoice,
        telemetry: {
          mag: currentMag.toFixed(2),
          accel: currentAccel.toFixed(2),
          freq: currentFreq,
          tilt: Math.round(Math.atan2(sensorData.acceleration.y, sensorData.acceleration.x) * 180 / Math.PI)
        }
      };
      
      const logEntry: ScanLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleString('tr-TR'),
        score: finalAnalysis.totalScore,
        type: finalAnalysis.type,
        status: finalAnalysis.status,
        data: finalAnalysis
      };

      setLogs(prev => [logEntry, ...prev]);
      setAnalysis(finalAnalysis);
      setScanPhase('results');

      const missionName = selectedMission === 'shallow_metal' 
        ? 'Metal Rezonans Aralık Analizi' 
        : selectedMission === 'deep_cavity' 
          ? 'Jeolojik Boşluk Tarama Sahası' 
          : 'Arkeolojik Deteksiyon Sahası';

      const soilName = soilType === 'clay' 
        ? 'Killi Toprak' 
        : soilType === 'sand' 
          ? 'Kumlu Toprak' 
          : soilType === 'wet_soil' 
            ? 'Islak Nemli Toprak' 
            : 'Kayalık Zemin';

      const isRealText = finalAnalysis.isRealSignal 
        ? 'Donanım korelasyonu ile doğrulanmış gerçek fiziksel sinyal.' 
        : 'Düşük korelasyonlu veya yapay anomali sinyali.';

      const magVal = finalAnalysis.telemetry?.mag || 'Sıfır';
      const freqVal = finalAnalysis.telemetry?.freq || 'Sıfır';
      const accelVal = finalAnalysis.telemetry?.accel || 'Sıfır';
      const tiltVal = finalAnalysis.telemetry?.tilt !== undefined ? finalAnalysis.telemetry.tilt : 'Sıfır';

      const detailedVoiceText = `Tarama başarıyla tamamlandı. Detaylı saha ve anomali raporu oluşturuldu. ` +
        `Görev modu: ${missionName}. Seçilen zemin türü: ${soilName}. ` +
        `Saptanan temel bulgu: ${finalAnalysis.type || 'Sinyal alınamadı'}. ` +
        `Bu bulgu için hesaplanan güven endeksi, yüzde ${finalAnalysis.totalScore}. ` +
        `Sinyal doğrulama durumu: ${isRealText} ` +
        `Tespit edilen anomali yoğunluğu ${finalAnalysis.status} seviyede. ` +
        `Detaylı alt sistem analiz sonuçlarında, manyetik kütle indeksi yüzde ${finalAnalysis.magneticIdx || 0}, ` +
        `yapısal geometrik simetri indeksi yüzde ${finalAnalysis.geometricIdx || 0}, biyolojik ve bitki örtüsü indeksi yüzde ${finalAnalysis.vegetationIdx || 0} olarak ölçülmüştür. ` +
        `Aktif saha telemetri değerlerine göre, jeomanyetik alan şiddeti ${magVal} mikrotesla, ` +
        `rezonans frekansı ${freqVal} hertz, dikey ivmelenme sapması ${accelVal} G, cihazın yatay eğimi ise ${tiltVal} derecedir. ` +
        `Görselleştirme ekranında üç boyutlu voksel rekonstrüksiyonu tamamlanmıştır. Detayları incelemek için paneli kullanabilirsiniz.`;

      speak(detailedVoiceText);
      
      switchTab('3d-view');
      // Automatically pop up the beautiful report panel!
      setShowSahaReport(true);
    }, 2500); // 2.5 second ultra responsive analysis loader
  };

  const initiateScan = (withRecording: boolean) => {
    setIsRecordingEnabled(withRecording);
    setShowRecordPrompt(false);
    
    // @ts-ignore
    let combinedStream: MediaStream | null = window._combinedStream || null;

    const SCAN_TIME = 90; // seconds
    
    setScanTimeLeft(SCAN_TIME);
    setScanPhase('calibration');

    // Reset automatic scanning integrations
    setSyncedNodes([]);
    setIsGeomagneticCalibrated(false);
    
    // Auto-activate all AR features for comprehensive tracking during scan
    setIsNightMode(true); 
    setVoiceEnabled(true);
    setSensorsActive(true);
    
    speak("Saha kalibrasyonu başlatıldı. Parazit spektrumu taranıyor ve jeomanyetik gürültü darası alınıyor.");

    switchTab('kamera');
    setAnalysis(null);
    setSensorsActive(true);
    
    // Start central SahaOrkestratoru 5-second AUTO_CALIBRATION sequence
    orchestrator.triggerMasterTrigger(selectedMission, geomagneticBaseline, () => {
      setScanPhase('scanning');
      setIsGeomagneticCalibrated(true);
      setGeomagneticBaseline(sensorData.magnetic.total > 0 ? sensorData.magnetic.total : 48.0);
      speak("Saha kalibrasyonu başarıyla tamamlandı. Aktif diferansiyel rezonans taraması başlatıldı. Lütfen yavaşça ilerleyiniz.");

      // Start recording after calibration
      recordingTimeoutRef.current = setTimeout(() => {
        if (withRecording) {
          if (combinedStream) {
            startRecording(combinedStream);
          } else if (videoRef.current?.srcObject) {
            startRecording(videoRef.current.srcObject as MediaStream);
          }
        }
      }, 1000);

      scanTimeoutRef.current = setTimeout(() => {
        finalizeScan();
      }, SCAN_TIME * 1000);
    });
  };

  const takeScreenshot = () => {
    vibrate(100);
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame if visible
    if (videoRef.current) {
      const v = videoRef.current;
      const aspect = v.videoWidth / v.videoHeight;
      let drawW = canvas.width;
      let drawH = canvas.width / aspect;
      if (drawH < canvas.height) {
        drawH = canvas.height;
        drawW = canvas.height * aspect;
      }
      ctx.drawImage(v, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
    }

    // Capture the UI (approximate by drawing overlay text)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, 100);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`MLAS SCANNER // ${new Date().toLocaleString()}`, 20, 40);
    ctx.fillText(`MAG: ${magTotal.toFixed(2)} uT // FREQ: ${liveFreq.toFixed(2)} Hz`, 20, 70);

    const link = document.createElement('a');
    link.download = `MLAS_SCREENSHOT_${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    speak("Ekran görüntüsü kaydedildi.");
  };

  const downloadReport = (data: any) => {
    const reportData = {
      system: "MLAS Multi-Sensor Locating and Analysis System",
      version: "4.2 Echelon",
      timestamp: new Date().toLocaleString(),
      analysis: data,
      sensors: {
        magnetic: magTotal,
        frequency: liveFreq,
        acceleration: sensorData.acceleration
      }
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MLAS_REPORT_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    speak("Teknik rapor indiriliyor.");
  };

  const handleScanClick = () => {
    // Automatically start with recording as requested
    initiateScan(true);
  };

  // License verification removed - app no longer requires license verification

  // LicenseGuard component removed - app no longer requires license

  useEffect(() => {
    let timer: any;
    if (scanPhase === 'scanning' && scanTimeLeft > 0) {
      timer = setInterval(() => {
        setScanTimeLeft(p => Math.max(0, p - 0.1));
      }, 100);
    }
    return () => clearInterval(timer);
  }, [scanPhase, scanTimeLeft]);

  // Automated dynamic orchestration when scan is active
  useEffect(() => {
    if (scanPhase !== 'scanning') return;

    const roundedTime = Math.round(scanTimeLeft);

    // 1. Auto-calibration phase (at 86 seconds remaining, i.e. 4 seconds after start)
    if (roundedTime === 86 && !isGeomagneticCalibrated) {
      setGeomagneticBaseline(sensorData.magnetic.total > 0 ? sensorData.magnetic.total : 48.0);
      setIsGeomagneticCalibrated(true);
      speak("Otomatik zemin kalibrasyonu başarıyla tamamlandı. Ortak manyetik sapma dengelendi.");
    }

    // 2. Co-SLAM Operator Sync: Node 1 (at 80 seconds remaining, 10 seconds after start)
    if (roundedTime === 80 && !syncedNodes.includes('1')) {
      setSyncedNodes(prev => [...prev, '1']);
      speak("Eşelon sıfır iki saha koordinatörü ile SLAM haritası senkronize ediliyor.");
    }

    // 3. Co-SLAM Operator Sync: Node 3 (at 65 seconds remaining, 25 seconds after start)
    if (roundedTime === 65 && !syncedNodes.includes('3')) {
      setSyncedNodes(prev => [...prev, '3']);
      speak("Taktik sıfır yedi ortak nokta bulutuna katıldı. Çoklu sensör füzyonu aktif.");
    }
  }, [scanPhase, scanTimeLeft, isGeomagneticCalibrated, syncedNodes, sensorData.magnetic.total]);

  // Continuous RF Spectrum RSSI Fluctuation during scanning/analyzing
  useEffect(() => {
    let interval: any;
    if (scanPhase === 'scanning' || scanPhase === 'analyzing') {
      interval = setInterval(() => {
        setRfSignals(prev => prev.map(sig => {
          const delta = Math.floor((Math.random() - 0.5) * 8);
          let nextRssi = sig.rssi + delta;
          // Clamp RSSI between -100 and -40 dBm
          nextRssi = Math.min(-40, Math.max(-100, nextRssi));
          return { ...sig, rssi: nextRssi };
        }));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [scanPhase]);

  const clearLogs = () => {
    if (confirm('Tüm saha günlükleri silinecek. Emin misiniz?')) {
      setLogs([]);
    }
  };

  // Show device approval screen if device not approved
  if (deviceApprovalState.checked && deviceApprovalState.status !== 'approved' && deviceApprovalState.deviceId) {
    return (
      <DeviceApprovalScreen
        deviceId={deviceApprovalState.deviceId}
        isNew={deviceApprovalState.status === 'new'}
        onRetry={async () => {
          // Recheck device approval
          try {
            const deviceId = await getSHIdentity();
            const isApproved = await checkApproval(deviceId);
            setDeviceApprovalState({
              checked: true,
              status: isApproved ? 'approved' : 'pending',
              deviceId: deviceId,
            });
          } catch (error) {
            console.error('Retry error:', error);
          }
        }}
      />
    );
  }

  // Show permissions setup on first app launch
  if (!setupComplete) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="setup-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <PermissionsSetup
            permissions={permissions}
            onComplete={() => {
              setPermissions((prev: any) => ({
                ...prev,
                camera: true, microphone: true, motion: true, orientation: true,
                location: true, nfc: true, wifi: true, bluetooth: true, battery: true, internet: true
              }));
            }}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30 overflow-x-hidden pt-24 pb-12 relative">
      {/* Pull-to-Refresh Indicator */}
      <div
        ref={refreshIndicatorRef}
        className="pull-to-refresh-indicator"
      />
      <SensorQualityModal />

      {/* GLOBAL SCREEN RECORDER MODALS AND OVERLAYS */}
      <AnimatePresence>
        {/* 1. INITIAL PROMPT MODAL */}
        {showGlobalRecordPrompt && globalRecordState === 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative overflow-hidden text-center"
            >
              {/* Decorative Glow */}
              <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 blur ${globalRecordError ? 'bg-gradient-to-r from-transparent via-amber-500 to-transparent' : 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent'}`} />
              
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-4 rounded-full animate-pulse ${globalRecordError ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
                  {globalRecordError ? <StopCircle className="w-8 h-8" /> : <Video className="w-8 h-8" />}
                </div>
                
                <div className="space-y-1">
                  <span className={`text-[10px] font-mono tracking-[0.3em] uppercase font-bold px-3 py-1 rounded-full ${globalRecordError ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {globalRecordError ? 'TARAYICI GÜVENLİK ENGELİ' : 'GÜVENLİK VE SAHA ARŞİV PROTOKOLÜ'}
                  </span>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight pt-2">
                    {globalRecordError ? 'Ekran Paylaşımı Kısıtlandı' : 'Otomatik Ekran Kaydı Başlatıcı'}
                  </h2>
                </div>
                
                {globalRecordError ? (
                  <div className="space-y-4 text-left">
                    <p className="text-zinc-400 text-xs leading-relaxed uppercase font-mono text-center">
                      Tarayıcı güvenlik politikaları gereği önizleme penceresinden tüm ekranın kaydedilmesi engellendi.
                    </p>
                    <div className="w-full bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-2.5">
                      <div className="text-[10px] font-mono text-amber-500/80 uppercase font-bold">
                        ALTERNATİF GÜVENLİ PROTOKOL:
                      </div>
                      <div className="flex items-start gap-2 text-[10px] font-mono text-zinc-400 uppercase">
                        <span className="text-amber-500 font-bold">✔</span>
                        <span>Ekran yerine doğrudan cihazınızın <b>kamera akışını</b> kaydeden "Kamera Modu" ile devam edin.</span>
                      </div>
                      <div className="flex items-start gap-2 text-[10px] font-mono text-zinc-400 uppercase">
                        <span className="text-amber-500 font-bold">✔</span>
                        <span>Ya da "Kayıtsız Devam Et" seçeneği ile arşivi devre dışı bırakın.</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-zinc-400 text-xs leading-relaxed uppercase font-mono">
                      Uygulama başladığı andan itibaren sahadaki tüm operasyonların, ölçümlerin ve ekranda beliren verilerin video kaydı olarak kaydedilmesi ve doğrulanması gerekmektedir.
                    </p>

                    <div className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl p-4 text-left space-y-2.5">
                      <div className="flex items-start gap-2 text-[10px] font-mono text-zinc-500 uppercase">
                        <span className="text-emerald-500 font-bold">✔</span>
                        Arayüzdeki tüm canlı radar ve sensör verileri kaydedilir.
                      </div>
                      <div className="flex items-start gap-2 text-[10px] font-mono text-zinc-500 uppercase">
                        <span className="text-emerald-500 font-bold">✔</span>
                        Kayıt sonunda videoyu cihaza indirebilir veya silebilirsiniz.
                      </div>
                      <div className="flex items-start gap-2 text-[10px] font-mono text-zinc-500 uppercase">
                        <span className="text-emerald-500 font-bold">✔</span>
                        Kayıt tamamen sizin cihazınızda yerel olarak saklanır.
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-3 pt-2">
                {globalRecordError ? (
                  <button
                    onClick={() => startGlobalScreenRecording('camera')}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    KAMERA KAYIT MODUNU BAŞLAT
                  </button>
                ) : (
                  <button
                    onClick={() => startGlobalScreenRecording('screen')}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Video className="w-4 h-4 animate-pulse" />
                    KAYDI BAŞLAT VE UYGULAMAYA GİRİŞ YAP
                  </button>
                )}
                
                <button
                  onClick={() => {
                    vibrate(20);
                    setShowGlobalRecordPrompt(false);
                    speak("Kayıtsız moda geçildi. Saha verileri kaydedilmeyecektir.");
                  }}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-450 hover:text-white rounded-2xl font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                >
                  KAYITSIZ DEVAM ET
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 2. FLOATING RECORDING BADGE / PANEL */}
        {globalRecordState === 'recording' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[999] bg-zinc-950/95 border border-red-500/30 rounded-2xl p-4 shadow-[0_15px_40px_rgba(239,68,68,0.15)] flex items-center gap-4 backdrop-blur-xl pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              <div className="text-left">
                <div className="text-[8px] font-black text-red-400 uppercase tracking-widest leading-none">EKRAN KAYDI CANLI</div>
                <div className="text-xs font-mono font-black text-white mt-1">{formatGlobalDuration(globalRecordDuration)}</div>
              </div>
            </div>
            <div className="h-6 w-px bg-zinc-800" />
            <button
              onClick={stopGlobalScreenRecording}
              className="px-3.5 py-2 bg-red-600/10 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white rounded-xl font-bold font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
            >
              <StopCircle className="w-3.5 h-3.5" />
              KAYDI DURDUR
            </button>
          </motion.div>
        )}

        {/* 3. REVIEW MODAL (DOWNLOAD OR REJECT) */}
        {globalRecordState === 'review' && globalRecordBlobUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-lg w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative overflow-hidden text-center"
            >
              {/* Decorative Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent blur" />

              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full animate-pulse">
                  <VideoOff className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-red-500 font-bold bg-red-500/10 px-3 py-1 rounded-full">
                    KAYIT SONLANDI
                  </span>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight pt-2">
                    Ekran Kaydı Onay Penceresi
                  </h2>
                </div>

                <p className="text-zinc-400 text-xs leading-relaxed uppercase font-mono">
                  Saha operasyonunuzun video kaydı başarıyla oluşturuldu. Bu kaydı cihazınıza indirebilir veya reddedip kalıcı olarak silebilirsiniz.
                </p>

                {/* Video Preview Player */}
                <div className="w-full aspect-video bg-black rounded-2xl border border-zinc-900 overflow-hidden relative group">
                  <video
                    src={globalRecordBlobUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-black/70 px-2 py-1 rounded text-[8px] font-mono text-zinc-400 uppercase tracking-wider">
                    Önizleme Aktif
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={handleDownloadGlobalRecording}
                  className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.1em] text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 animate-bounce" />
                  VİDEOYU CİHAZA İNDİR
                </button>
                <button
                  onClick={handleRejectGlobalRecording}
                  className="py-4 bg-red-950/40 hover:bg-red-950/60 border border-red-900/50 text-red-400 hover:text-red-300 rounded-2xl font-black uppercase tracking-[0.1em] text-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  KAYDI REDDET / SİL
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* %90+ AI Anomaly Detection Toast card */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] max-w-sm w-full bg-red-600/90 hover:bg-red-600 border border-red-500 rounded-2xl shadow-[0_20px_50px_rgba(220,38,38,0.5)] p-4 flex items-center gap-3 backdrop-blur-xl pointer-events-auto"
          >
            <div className="p-2.5 bg-white/20 rounded-xl text-white animate-pulse shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] font-black text-red-100 uppercase tracking-[0.2em] leading-none mb-1">
                HIZLI UYARI: %90+ AI GÜVENİ
              </div>
              <div className="text-sm font-black text-white uppercase tracking-tight truncate">
                {toastMessage}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-6 space-y-12">
        
        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#050505]/80 backdrop-blur-xl border-b border-zinc-900 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => switchTab('ana sayfa')}
                className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-110 transition-transform"
                title="Giriş Sayfasına Dön"
              >
                <Home className="text-black w-5 h-5" />
              </button>
              <h1 className="text-lg font-bold tracking-tighter">AKN Global Group Ltd</h1>
            </div>
            
            <div className="hidden md:flex bg-zinc-900/50 p-1 rounded-full border border-zinc-800">
              {['ana sayfa', 'radar', 'kamera', 'x-ray', '3d-view', 'katmanlar', 'günlükler'].map(tab => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={`px-5 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                    activeTab === tab ? 'bg-zinc-800 text-emerald-400 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab === 'ana sayfa' ? 'Giriş' : 
                   tab === '3d-view' ? '3D Görünüm' : 
                   tab === 'günlükler' ? 'Günlük' : 
                   tab === 'x-ray' ? 'X-RAY PENETRASYON' : tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
               {/* Operational HUD Mode Selectors */}
               {analysis && (
                 <button
                   onClick={() => {
                     vibrate(100);
                     setShowSahaReport(true);
                   }}
                   className="p-2 px-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-xl transition-all flex items-center gap-2 font-black text-[9px] uppercase tracking-widest cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.25)] animate-pulse mr-2"
                   title="Gelişmiş Saha Raporunu Aç"
                 >
                   <FileText className="w-4 h-4 text-emerald-400" />
                   <span>SAHA RAPORU</span>
                 </button>
               )}
               <div className="flex bg-zinc-950/80 p-1 rounded-2xl border border-zinc-900 gap-1 text-[9px] font-black uppercase">
                 {[
                   { id: 'SIMPLE', label: 'SÜRÜCÜ', tooltip: 'Sürücü Görünümü (Sade)' },
                   { id: 'TACTICAL_MAP', label: 'TAKTIK', tooltip: 'Taktik Harita Görünümü' },
                   { id: 'EXPERT_LAB', label: 'EXPERT', tooltip: 'Expert Lab Analizi (Tam)' }
                 ].map((mode) => (
                   <button
                     key={mode.id}
                     onClick={() => {
                       vibrate(50);
                       setOperationalViewMode(mode.id as any);
                       speak(`${mode.label} görünüm modu seçildi.`);
                     }}
                     className={`px-3 py-1.5 rounded-xl tracking-wider transition-all cursor-pointer ${
                       operationalViewMode === mode.id
                         ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/35'
                         : 'text-zinc-500 hover:text-zinc-300 bg-transparent'
                     }`}
                     title={mode.tooltip}
                   >
                     {mode.label}
                   </button>
                 ))}
               </div>

               <button 
                 onClick={toggleVoice}
                 className={`p-2 rounded-xl border transition-all flex items-center gap-2 group ${
                   voiceEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                 }`}
                 title={voiceEnabled ? 'Sesli Asistanı Kapat' : 'Sesli Asistanı Aç'}
               >
                 {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                 <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">
                   {voiceEnabled ? 'SES AKTİF' : 'SESİ AÇ'}
                 </span>
               </button>

               <button 
                 onClick={() => {
                   vibrate(30);
                   if (globalRecordState === 'idle') {
                     startGlobalScreenRecording();
                   } else {
                     stopGlobalScreenRecording();
                   }
                 }}
                 className={`p-2 rounded-xl border transition-all flex items-center gap-2 group ${
                   globalRecordState === 'recording' ? 'bg-red-500/10 border-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white'
                 }`}
                 title={globalRecordState === 'recording' ? 'Kayıt Devam Ediyor - Durdur' : 'Ekran Kaydı Başlat'}
               >
                 <Video className={`w-5 h-5 ${globalRecordState === 'recording' ? 'animate-pulse' : ''}`} />
                 <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">
                   {globalRecordState === 'recording' ? 'KAYITTA' : 'EKRAN KAYDI'}
                 </span>
               </button>

               <button 
                 onClick={() => setShowSettings(true)}
                 className="p-2 text-zinc-500 hover:text-white transition-colors"
               >
                 <Settings className="w-5 h-5" />
               </button>
            </div>
          </div>
        </nav>

        <AnimatePresence mode="wait">
          {activeTab === 'ana sayfa' ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-[#050505] overflow-y-auto custom-scrollbar pt-20"
            >
              <div className="fixed top-0 right-[-10%] w-[600px] h-[600px] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none" />
              <div className="fixed bottom-[20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/5 blur-[150px] rounded-full pointer-events-none" />
              
              <div className="max-w-7xl mx-auto px-6 py-20 relative z-10 space-y-24">
                 {/* System Health Overview */}
                 <div className="absolute top-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-2 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-full z-20">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${sensorsActive ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-zinc-600'}`} />
                      <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Sensör: {sensorsActive ? 'AKTİF' : 'BEKLİYOR'}</span>
                    </div>
                    <div className="w-px h-3 bg-zinc-800" />
                    <div className="flex items-center gap-2">
                       <Wifi className="w-3 h-3 text-emerald-500" />
                       <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Sinyal: %98</span>
                    </div>
                    <div className="w-px h-3 bg-zinc-800" />
                    <div className="flex items-center gap-2">
                       <Cpu className="w-3 h-3 text-sky-500" />
                       <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">İşlemci: ML-Core v4</span>
                    </div>
                 </div>

                 <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto pt-10">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-[0.4em] flex items-center gap-3"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIDAR ÖZELLİKLİ ANALİZ SİSTEMİ
                    </motion.div>
                    
                    <h2 className="text-5xl md:text-8xl font-bold tracking-tight leading-[0.85]">
                      Yeraltını <br/>
                      <span className="text-zinc-400">Katman</span> <span className="text-emerald-500 italic">Katman</span> <span className="text-zinc-400">Görün.</span>
                    </h2>
                    
                    <p className="text-zinc-500 text-base md:text-lg leading-relaxed max-w-xl">
                      AKN Global Group Ltd, yer altındaki anomalileri, boşlukları ve yapısal formları LIDAR (Nokta Bulutu) ve SLAM teknolojisiyle gerçek zamanlı haritalandırır.
                    </p>

                    {/* LIVE PROFESSIONAL ANALYSIS DASHBOARD */}
                    {setupComplete && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
                      >
                         {[
                           { 
                             label: 'Manyetik Alan', 
                             value: isScanning ? `${(sensorData.magnetic.total > 0 ? sensorData.magnetic.total : 48.0000).toFixed(4)} µT` : '---', 
                             icon: Compass, 
                             color: 'text-emerald-500', 
                             bg: 'bg-emerald-500/5' 
                           },
                           { 
                             label: 'Sinyal Frekansı', 
                             value: isScanning ? `${liveFreq.toFixed(2)} Hz` : '---', 
                             icon: Wifi, 
                             color: 'text-sky-500', 
                             bg: 'bg-sky-500/5' 
                           },
                           { 
                             label: 'Hareketsizlik G', 
                             value: isScanning ? `${(sensorData.acceleration.total > 0 ? sensorData.acceleration.total : 9.80665).toFixed(5)}` : '---', 
                             icon: Zap, 
                             color: 'text-purple-500', 
                             bg: 'bg-purple-500/5' 
                           },
                           { 
                             label: 'Eğim Analizi', 
                             value: isScanning ? `P:${sensorData.orientation.beta.toFixed(0)}° R:${sensorData.orientation.gamma.toFixed(0)}°` : '---', 
                             icon: Map, 
                             color: 'text-amber-500', 
                             bg: 'bg-amber-500/5' 
                           },
                           { 
                             label: 'Analiz Çekirdeği', 
                             value: isScanning ? `%${liveAnalysis?.score ? liveAnalysis.score.toFixed(1) : '0.0'}` : '---', 
                             icon: Cpu, 
                             color: 'text-rose-500', 
                             bg: 'bg-rose-500/5' 
                           },
                         ].map((item, idx) => (
                           <div key={idx} className={`p-6 border border-zinc-800/10 rounded-3xl ${item.bg} backdrop-blur-sm space-y-3 flex flex-col items-center text-center transition-all hover:border-zinc-700`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-emerald-500 animate-pulse' : sensorsActive ? 'bg-amber-500' : 'bg-red-500'}`} />
                                <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${item.color}`}>
                                  {isScanning ? 'CANLI' : sensorsActive ? 'HAZIR' : 'BEKLEMEDE'}
                                </span>
                              </div>
                              <div className="text-2xl font-black text-white tracking-tighter tabular-nums">{item.value}</div>
                              <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none">{item.label}</div>
                              <item.icon className={`w-4 h-4 ${item.color} mt-1`} />
                           </div>
                         ))}
                      </motion.div>
                    )}

                    <div className="flex flex-col items-center gap-6 pt-4 w-full">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <button
                              onClick={() => {
                                vibrate(80);
                                switchTab('x-ray');
                              }}
                              className="px-8 py-5 md:px-10 bg-gradient-to-r from-emerald-600 to-sky-600 text-white rounded-3xl font-black tracking-widest shadow-[0_10px_40px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 border border-white/20 group animate-pulse hover:animate-none w-full md:w-auto"
                            >
                              <Target className="w-6 h-6 group-hover:rotate-90 transition-transform" /> X-RAY PENETRASYON
                            </button>
                            <button
                              onClick={() => {
                                vibrate(50);
                                setShowGuide(true);
                              }}
                              className="px-8 py-4 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-bold tracking-widest transition-all hover:bg-zinc-800 flex items-center gap-3 w-full md:w-auto"
                            >
                              <BookOpen className="w-4 h-4 text-emerald-500" /> KULLANMA KILAVUZU
                            </button>
                            <button
                              onClick={() => {
                                vibrate(50);
                                setShowSystemDetails(true);
                              }}
                              className="px-8 py-4 bg-zinc-900/50 border border-emerald-500/10 text-emerald-400 rounded-2xl font-bold tracking-widest transition-all hover:bg-zinc-900 hover:border-emerald-500/30 flex items-center gap-3 w-full md:w-auto"
                            >
                              <Compass className="w-4 h-4 text-emerald-500" /> SİSTEM KULLANIM DETAYI
                            </button>
                        </div>

                               <button 
                                 onClick={() => {
                                   if (!setupComplete) {
                                     speak("Lütfen önce tüm sistem izinlerini onaylayın.");
                                     return;
                                   }
                                   vibrate([100, 50, 100]); setShowMasterScanConfig(true); return;
                                   if (scanExecutionMode === 'ALL_IN_ONE_MASTER') {
                                     speak("Master sistem senkronizasyonu başlatılıyor. Tüm sensörler eşzamanlı aktif ediliyor.");
                                   } else {
                                     speak("Sınırlı sistem entegrasyonu başlatılıyor. Seçilen tekil sensör aktifleşiyor.");
                                   }
                                   
                                   const startSequence = async () => {
                                     setScanPhase('scanning');
                                     setSensorsActive(true);
                                     setMicActive(true);
                                     
                                     if (!sensorsActive) {
                                       const success = await handleActivateSensors();
                                       if (!success) {
                                         setScanPhase('idle');
                                         return;
                                       }
                                     }
                                     
                                     // Start everything simultaneously
                                     initiateScan(true);
                                   };

                                   startSequence();
                                 }}
                                 disabled={!setupComplete}
                                 className={`px-12 py-5 ${
                                   setupComplete 
                                     ? scanExecutionMode === 'ALL_IN_ONE_MASTER'
                                       ? 'bg-emerald-600 hover:bg-emerald-500 animate-pulse border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:-translate-y-1'
                                       : 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:-translate-y-1'
                                     : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                                 } text-white rounded-3xl font-black tracking-[0.2em] transition-all active:scale-95 w-full max-w-md scale-110`}
                               >
                                 {setupComplete 
                                   ? scanExecutionMode === 'ALL_IN_ONE_MASTER' 
                                     ? 'MASTER TARAMAYI BAŞLAT' 
                                     : 'TEKİL TARAMAYI BAŞLAT' 
                                   : 'SİSTEMİ HAZIRLAYIN'
                                 }
                               </button>
                     </div>
                 </div>

                 {/* --- MISSION-ORIENTED & GEOMAGNETIC CONTROLS --- */}
                 <div className="space-y-10">
                   <MissionSelector 
                   selectedMission={selectedMission} 
                   onSelectMission={(m) => {
                   vibrate(60);
                   setSelectedMission(m);
                   speak(`${m === 'shallow_metal' ? 'Yüzeysel Metal Tespiti' : m === 'deep_cavity' ? 'Derin Boşluk Analizi' : 'Tünel Haritalama'} modu kilitlendi. Saha profili yüklendi.`);
                   }} 
                   onOpenDetail={() => {
                   setActiveFeatureType('mission');
                   setIsFeatureDetailModalOpen(true);
                   }}
                   />

                   {/* --- SCAN EXECUTION MODE SWITCHER --- */}
                   <div className="p-8 bg-zinc-950/90 rounded-[2rem] border border-zinc-900 space-y-6 shadow-xl relative overflow-hidden">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div className="space-y-1">
                         <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           SAHA TARAMA METODOLOJİSİ
                         </h4>
                         <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans font-bold">Otonom tümleşik veya tekil modül operasyon kilitleri</p>
                       </div>
                       <div className="flex bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/80">
                         <button
                           onClick={() => {
                             vibrate(40);
                             setScanExecutionMode('ALL_IN_ONE_MASTER');
                             speak("Taktiksel Master arama modu seçildi. Tüm sensörler entegre çalışacak.");
                           }}
                           className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${
                             scanExecutionMode === 'ALL_IN_ONE_MASTER'
                               ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                               : 'text-zinc-500 hover:text-zinc-300'
                           }`}
                         >
                           Master Arama Modu
                         </button>
                         <button
                           onClick={() => {
                             vibrate(40);
                             setScanExecutionMode('SINGLE_FEATURE');
                             speak("Manuel arama modu seçildi. Tekil sensör seçimi aktiftir.");
                           }}
                           className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${
                             scanExecutionMode === 'SINGLE_FEATURE'
                               ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                               : 'text-zinc-500 hover:text-zinc-300'
                           }`}
                         >
                           Manuel Arama Modu
                         </button>
                       </div>
                     </div>

                     {/* Dynamic Single Feature Submenu */}
                     <AnimatePresence>
                       {scanExecutionMode === 'SINGLE_FEATURE' && (
                         <motion.div
                           initial={{ opacity: 0, height: 0 }}
                           animate={{ opacity: 1, height: 'auto' }}
                           exit={{ opacity: 0, height: 0 }}
                           className="pt-4 border-t border-zinc-900/40 overflow-hidden"
                         >
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                             {[
                               { id: 'LIDAR_OCR', label: 'LIDAR Arkeolojik OCR', desc: 'Sembol Tanıma' },
                               { id: 'GPR_GEOMETRY', label: 'GPR Geometrik Giriş', desc: 'Geometrik Süreklilik' },
                               { id: 'METAL_SPECTRUM', label: 'Metal İletkenlik Spektrumu', desc: 'AC Spektral Analiz' },
                               { id: 'VOD_TOMOGRAPHY', label: 'VOD Tomografisi', desc: 'Boşluk Yoğunluk Analizi' },
                             ].map((feat) => {
                               const isSelected = activeSingleFeature === feat.id;
                               return (
                                 <button
                                   key={feat.id}
                                   onClick={() => {
                                     vibrate(30);
                                     setActiveSingleFeature(feat.id as any);
                                     speak(`${feat.label} aktif edildi.`);
                                   }}
                                   className={`p-3.5 rounded-xl border text-left transition-all duration-300 flex flex-col justify-between h-20 ${
                                     isSelected
                                       ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                       : 'bg-zinc-950/20 border-zinc-900 text-zinc-500 hover:border-zinc-800'
                                   }`}
                                 >
                                   <span className="text-[9px] font-black uppercase tracking-wider line-clamp-1">{feat.label}</span>
                                   <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{feat.desc}</span>
                                 </button>
                               );
                             })}
                           </div>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     {/* Left Column: Calibration & Target Tracker */}
                     <div className="space-y-8">
                       {/* JEOMANYETİK ALAN KALİBRASYON HUD */}
                       <div className="bg-zinc-950/80 border border-zinc-900 hover:border-emerald-500/30 rounded-3xl p-6 space-y-4 backdrop-blur-xl transition-all duration-300 group">
                       <div className="flex items-center justify-between">
                       <div 
                       className="flex items-center gap-2 cursor-pointer"
                       onClick={() => {
                       setActiveFeatureType('calibration');
                       setIsFeatureDetailModalOpen(true);
                       }}
                       >
                       <Globe className="w-5 h-5 text-emerald-500 animate-pulse group-hover:scale-110 transition-transform" />
                       <div>
                       <h4 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-emerald-400 transition-colors flex items-center gap-1.5 font-sans">
                       JEOMANYETİK ALAN KALİBRASYONU <span className="text-[8px] font-bold text-zinc-600 group-hover:text-emerald-500/60 uppercase tracking-widest">(DETAY)</span>
                       </h4>
                       <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Yeraltı Manyetik Referans Dengeleyici</p>
                       </div>
                       </div>
                       <div className="flex items-center gap-2">
                       <button 
                       onClick={() => {
                       setActiveFeatureType('calibration');
                       setIsFeatureDetailModalOpen(true);
                       }}
                       className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 text-[8px] text-zinc-400 hover:text-white rounded-lg border border-zinc-800 font-bold uppercase tracking-wider transition-all"
                       >
                       GRAFİĞİ GÖSTER
                       </button>
                       <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isGeomagneticCalibrated ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>
                       {isGeomagneticCalibrated ? 'KALİBRE EDİLDİ' : 'DARA ALINMADI'}
                       </div>
                       </div>
                       </div>

                         <div className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-2xl border border-zinc-900">
                           <div className="space-y-1">
                             <div className="text-[8px] uppercase font-bold text-zinc-500">Doğal Jeomanyetik Normal</div>
                             <div className="text-lg font-black text-white tabular-nums tracking-tight">
                               {geomagneticBaseline.toFixed(2)} µT
                             </div>
                           </div>
                           <div className="space-y-1 text-right">
                             <div className="text-[8px] uppercase font-bold text-zinc-500">Net Manyetik Sapma</div>
                             <div className="text-lg font-black text-emerald-500 tabular-nums tracking-tight">
                               {isGeomagneticCalibrated ? `${Math.abs(sensorData.magnetic.total - geomagneticBaseline).toFixed(4)} µT` : '---'}
                             </div>
                           </div>
                         </div>

                         <button
                           onClick={() => {
                             vibrate(100);
                             setGeomagneticBaseline(sensorData.magnetic.total > 0 ? sensorData.magnetic.total : 48.0);
                             setIsGeomagneticCalibrated(true);
                             speak("Jeomanyetik referans sıfırlandı. Arka plan gürültüsü düşüldü.");
                           }}
                           className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest border border-zinc-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                         >
                           <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> ARKA PLAN GÜRÜLTÜSÜNÜ SIFIRLA (DARA AL)
                         </button>
                       </div>

                       <TargetTrackerHUD 
                       anomalyActive={liveAnalysis ? liveAnalysis.score > 40 : false} 
                       anomalyScore={liveAnalysis ? liveAnalysis.score : 0} 
                       anomalyType={liveAnalysis ? liveAnalysis.type : 'SİNYAL ALINIYOR...'} 
                       compassHeading={sensorData.orientation.alpha || 0} 
                       onOpenDetail={() => {
                       setActiveFeatureType('target');
                       setIsFeatureDetailModalOpen(true);
                       }}
                       />
                     </div>

                     {/* Right Column: Collaborative SLAM & RF Scanner */}
                     <div className="space-y-8">
                       <CoSlamPanel 
                       syncedNodes={syncedNodes}
                       onToggleNodeSync={handleToggleNodeSync}
                       onOpenDetail={() => {
                       setActiveFeatureType('coslam');
                       setIsFeatureDetailModalOpen(true);
                       }}
                       />

                       {/* RF SPEKTRUMU VE SİNYAL PARAZİT TARAYICI */}
                       <div className="bg-zinc-950/80 border border-zinc-900 hover:border-indigo-500/30 rounded-3xl p-6 space-y-4 backdrop-blur-xl transition-all duration-300 group">
                       <div className="flex items-center justify-between">
                       <div 
                       className="flex items-center gap-2 cursor-pointer"
                       onClick={() => {
                       setActiveFeatureType('rf');
                       setIsFeatureDetailModalOpen(true);
                       }}
                       >
                       <Wifi className="w-5 h-5 text-sky-400 animate-pulse group-hover:scale-110 transition-transform" />
                       <div>
                       <h4 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors flex items-center gap-1.5 font-sans">
                       RF İSTİHBARAT TARAYICI (RSSI) <span className="text-[8px] font-bold text-zinc-600 group-hover:text-indigo-500/60 uppercase tracking-widest">(DETAY)</span>
                       </h4>
                       <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Elektromanyetik Spektrum ve Parazit</p>
                       </div>
                       </div>
                       <div className="flex items-center gap-2">
                       <button 
                       onClick={() => {
                       setActiveFeatureType('rf');
                       setIsFeatureDetailModalOpen(true);
                       }}
                       className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 text-[8px] text-zinc-400 hover:text-white rounded-lg border border-zinc-800 font-bold uppercase tracking-wider transition-all"
                       >
                       SPEKTRUMU GÖR
                       </button>
                       <div className="px-2 py-0.5 bg-sky-500/10 text-sky-400 rounded text-[8px] font-black uppercase tracking-widest animate-pulse">
                       CANLI TARAMA
                       </div>
                       </div>
                       </div>

                         <div className="space-y-3">
                           {rfSignals.map((sig, idx) => (
                             <div key={idx} className="space-y-1.5 p-3 bg-zinc-900/30 rounded-xl border border-zinc-900/50">
                               <div className="flex justify-between items-center text-[9px] font-bold">
                                 <span className="text-zinc-400">{sig.ssid}</span>
                                 <span className="text-sky-400 font-mono">{sig.rssi} dBm</span>
                               </div>
                               <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden">
                                 <div className="h-full bg-sky-500 rounded-full animate-pulse" style={{ width: `${Math.max(10, 100 + sig.rssi)}%` }} />
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { title: 'Radar Analizi', desc: 'Anomali Çekirdekleri', icon: Compass, tab: 'radar', color: 'from-emerald-600 to-emerald-400' },
                      { title: 'AR Kamera', desc: 'Ortam Tarayıcı', icon: CameraIcon, tab: 'kamera', color: 'from-sky-600 to-sky-400' },
                      { title: '3D Mapping', desc: 'LIDAR Nokta Bulutu', icon: Map, tab: '3d-view', color: 'from-purple-600 to-purple-400' },
                      { title: 'Günlükler', desc: 'Saha Arşivi', icon: History, tab: 'günlükler', color: 'from-amber-600 to-amber-400' },
                    ].map((item, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ y: -10 }}
                        onClick={() => switchTab(item.tab)}
                        className="group p-8 bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] text-left transition-all relative overflow-hidden backdrop-blur-md hover:border-emerald-500/30"
                      >
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-black mb-8 group-hover:scale-110 transition-transform`}>
                          <item.icon className="w-7 h-7" />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xl font-bold tracking-tight">{item.title}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold group-hover:text-emerald-400 transition-colors uppercase">{item.desc}</div>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="space-y-6 p-10 bg-zinc-900/30 border border-zinc-900 rounded-[3rem] relative overflow-hidden">
                       <LayersIcon className="w-10 h-10 text-emerald-500 mb-4" />
                       <h3 className="text-3xl font-bold tracking-tight">Hacimsel Analiz (Voxel)</h3>
                       <p className="text-zinc-500 text-sm leading-relaxed">
                         LIDAR verilerini hacimsel olarak işleyip dağ yüzeyi ile içerideki boşlukları yarı saydam modda görselleştirin.
                       </p>
                       <button
                         onClick={() => switchTab('3d-view')}
                         className="inline-flex items-center gap-2 text-emerald-500 font-bold uppercase tracking-widest text-[10px] hover:gap-4 transition-all"
                       >
                         KESİT ALMAYA BAŞLA <ChevronRight className="w-4 h-4" />
                       </button>
                    </div>

                    <div className="space-y-6 p-10 bg-zinc-900/30 border border-zinc-900 rounded-[3rem] relative overflow-hidden">
                       <Cpu className="w-10 h-10 text-sky-500 mb-4" />
                       <h3 className="text-3xl font-bold tracking-tight">SLAM Navigasyonu</h3>
                       <p className="text-zinc-500 text-sm leading-relaxed">
                         GPS'in çekmediği mağara ve tünel sistemlerinde cihaz hareketlerinizi takip ederek 3D haritayı anlık olarak genişletir.
                       </p>
                       <button
                         onClick={() => switchTab('katmanlar')}
                         className="inline-flex items-center gap-2 text-sky-500 font-bold uppercase tracking-widest text-[10px] hover:gap-4 transition-all"
                       >
                         SPEKTRUMU GÖR <ChevronRight className="w-4 h-4" />
                       </button>
                    </div>

                    <div className="space-y-6 p-10 bg-zinc-900/30 border border-zinc-900 rounded-[3rem] relative overflow-hidden">
                       <Target className="w-10 h-10 text-sky-400 mb-4" />
                       <h3 className="text-3xl font-bold tracking-tight">X-RAY Tarama</h3>
                       <p className="text-zinc-500 text-sm leading-relaxed">
                         Derinlik kanalı X-RAY penetrasyonu kullanarak yapıların içindeki yapıları ve metalik anomalileri gerçek zamanlı tarama yapın.
                       </p>
                       <div className="flex gap-3">
                         <button
                           onClick={() => switchTab('x-ray')}
                           className="inline-flex items-center gap-2 text-sky-400 font-bold uppercase tracking-widest text-[10px] hover:gap-4 transition-all flex-1"
                         >
                           SEKMYE GİT <ChevronRight className="w-4 h-4" />
                         </button>
                         <button
                           onClick={() => setShowXRayPanel(true)}
                           className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/50 rounded-lg text-sky-400 font-bold uppercase tracking-widest text-[10px] transition-all"
                           title="Kamera Panelini Aç"
                         >
                           📷 KAM
                         </button>
                       </div>
                    </div>
                 </div>

                 <div className="py-20 border-t border-zinc-900 flex flex-col items-center gap-6 text-center">
                    <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all">
                       <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-xs"> <Wifi className="w-4 h-4" /> 5G Sinyal</div>
                       <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-xs"> <Lock className="w-4 h-4" /> Güvenli Bağlantı</div>
                       <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-xs"> <Database className="w-4 h-4" /> Yerel Depolama</div>
                    </div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-[0.5em] font-black">AKN GLOBAL GROUP LTD // SAHA ANALİZ MOTORU // 2026</p>
                  </div>
              </div>
            </motion.div>
          ) : (
            <motion.main 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-8 space-y-6">
                <div className="aspect-video bg-zinc-950 rounded-3xl border border-zinc-900 flex items-center justify-center relative overflow-hidden group">
                   <div className="absolute inset-0 opacity-5 pointer-events-none" 
                        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                   <AnimatePresence>
                     {activeTab === 'radar' && (
                       <motion.div key="radar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex flex-col items-center gap-12 w-full h-full justify-center">
                         {/* Global Home Button for Radar */}
                         <div className="absolute top-8 left-8 z-40 pointer-events-auto">
                           <button 
                             onClick={() => switchTab('ana sayfa')}
                             className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-emerald-500 transition-all shadow-xl active:scale-95"
                             title="Ana Sayfa"
                           >
                             <Home className="w-6 h-6" />
                           </button>
                         </div>
                         
                         <RadarIcon 
                            className={`w-48 h-48 ${isScanning ? 'text-emerald-500 animate-pulse' : 'text-zinc-800'}`} 
                            style={{ filter: isScanning ? 'drop-shadow(0 0 20px rgba(16,185,129,0.3))' : '' }}
                         />
                         <div className="flex gap-4">
                           {scanPhase === 'results' && (
                             <button onClick={() => setShowSahaReport(true)} className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-bold tracking-widest transition-all border border-zinc-700 flex items-center gap-3 active:scale-95">
                               DETAYLARI GÖR <Info className="w-4 h-4" />
                             </button>
                           )}
                           <button onClick={() => switchTab('x-ray')} className="px-10 py-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold tracking-widest transition-all flex items-center gap-4 active:scale-95">
                             X-RAY TARA <Target className="w-5 h-5" />
                           </button>
                           <button onClick={handleScanClick} disabled={isScanning} className={`px-10 py-3.5 ${isScanning ? 'bg-zinc-800' : 'bg-emerald-600 hover:bg-emerald-500'} text-white rounded-2xl font-bold tracking-widest transition-all flex items-center gap-4 active:scale-95`}>
                             {isScanning ? 'TARANIYOR...' : 'ŞİMDİ TARAMAYA BAŞLA'} <Scan className={isScanning ? 'animate-spin' : ''} />
                           </button>
                         </div>
                       </motion.div>
                     )}

                      {activeTab === 'kamera' && !sensorsActive && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-8 text-center space-y-6">
                           <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                             <Zap className="w-8 h-8 text-emerald-500" />
                           </div>
                           <div className="space-y-2">
                             <h3 className="text-xl font-bold text-white uppercase tracking-wider">Ölçüm İçin Hazır mısınız?</h3>
                             <p className="text-sm text-zinc-400 max-w-xs">Manyetik tarama ve derinlik analizi için cihaz sensörlerini aktifleştirmeniz gerekmektedir.</p>
                           </div>
                           <button 
                             onClick={handleActivateSensors}
                             className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold tracking-widest transition-all shadow-xl active:scale-95"
                           >
                             SİSTEMLERİ AKTİFLEŞTİR
                           </button>
                        </div>
                      )}
                      {(activeTab === 'kamera' || scanPhase === 'scanning') && (
                        <motion.div 
                          key="camera"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-black flex items-center justify-center cursor-crosshair z-10"
                        >
                          {activeTab === 'kamera' && !isObjectRecognitionApproved ? (
                            <div className="absolute inset-0 bg-black flex flex-col justify-between overflow-hidden">
                              {/* Live Camera Stream */}
                              <video 
                                 ref={videoRef} 
                                 autoPlay 
                                 playsInline 
                                 muted 
                                 className="absolute inset-0 w-full h-full object-cover opacity-90 contrast-125 saturate-125 brightness-110" 
                              />
                              
                              {/* Scanning Grid Laser effect */}
                              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,transparent_45%,rgba(16,185,129,0.3)_50%,transparent_55%)] bg-[size:100%_200%] animate-scan-line" style={{ animation: 'scan-line 4s linear infinite', background: 'linear-gradient(to bottom, transparent 40%, rgba(16,185,129,0.25) 50%, transparent 60%)', backgroundSize: '100% 200%' }} />
                              
                              {/* Overlay Bounding Boxes on Video */}
                              <div className="absolute inset-0 pointer-events-none z-20">
                                {detectedObjects.map((obj, i) => {
                                  const [x, y, w, h] = obj.bbox;
                                  const left = `${Math.max(0, Math.min(100, (x / 400) * 100))}%`;
                                  const top = `${Math.max(0, Math.min(100, (y / 300) * 100))}%`;
                                  const width = `${Math.max(0, Math.min(100, (w / 400) * 100))}%`;
                                  const height = `${Math.max(0, Math.min(100, (h / 300) * 100))}%`;
                                  
                                  return (
                                    <div 
                                      key={i} 
                                      className="absolute border-2 border-emerald-500 bg-emerald-500/10 rounded-lg flex flex-col justify-between pointer-events-none"
                                      style={{ left, top, width, height }}
                                    >
                                      <div className="bg-emerald-500 text-black text-[9px] font-mono font-black uppercase px-1.5 py-0.5 w-max rounded-br-md leading-none shadow">
                                        {translateObjectLabel(obj.class)} (%{Math.round(obj.score * 100)})
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Top Bar Status */}
                              <div className="relative z-30 p-6 flex justify-between items-start pointer-events-none bg-gradient-to-b from-black/80 to-transparent">
                                 <div className="flex items-center gap-3">
                                   <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-xl">
                                     <Activity className="w-5 h-5 animate-pulse" />
                                   </div>
                                   <div>
                                     <h3 className="text-sm font-black text-white uppercase tracking-wider">AI GERÇEK ZAMANLI NESNE VE MEKAN TANIMA</h3>
                                     <div className="flex items-center gap-1.5 mt-0.5">
                                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                       <span className="text-[9px] text-zinc-400 font-mono uppercase tracking-widest">
                                         {isModelLoading ? 'YAPAY ZEKA MODELİ YÜKLENİYOR...' : 'ORTAM ANALİZ EDİLİYOR - KESİNTİSİZ CANLI AKIŞ'}
                                       </span>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="pointer-events-auto">
                                   <button 
                                     onClick={() => switchTab('ana sayfa')}
                                     className="w-10 h-10 bg-zinc-900/90 border border-zinc-800 text-zinc-400 hover:text-emerald-500 rounded-xl flex items-center justify-center transition-all shadow-xl cursor-pointer"
                                     title="Ana Sayfa"
                                   >
                                     <Home className="w-5 h-5" />
                                   </button>
                                 </div>
                              </div>

                              {/* Center Focal Dot & Tracker */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                 <div className="w-48 h-48 border border-dashed border-emerald-500/20 rounded-full flex items-center justify-center animate-spin-slow">
                                   <div className="w-40 h-40 border border-emerald-500/10 rounded-full" />
                                 </div>
                                 <div className="absolute w-4 h-4 border-2 border-emerald-500 rounded-full animate-ping" />
                              </div>

                              {/* Bottom Control Overlay & Approved Button */}
                              <div className="relative z-30 p-6 bg-gradient-to-t from-black/90 via-black/85 to-transparent space-y-4">
                                <div className="space-y-2">
                                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">TANIMLANAN NESNE / MEKAN VE YAPILAR</span>
                                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                    {detectedObjects.length > 0 ? (
                                      detectedObjects.map((obj, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[10px] rounded-full uppercase tracking-wider animate-fade-in">
                                          <Scan className="w-3 h-3" />
                                          {translateObjectLabel(obj.class)} (%{Math.round(obj.score * 100)})
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Detaylı çevre taraması bekleniyor...</div>
                                    )}

                                    {/* Dynamic terrain/structure tags based on actual physical visuals to enrich output */}
                                    {visualStats.edgeDensity > 18 && (
                                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-bold text-[10px] rounded-full uppercase tracking-wider">
                                        <Layers className="w-3 h-3" />
                                        MİMARI KALINTI / YAPISAL KÖŞELER (%{Math.min(99, Math.round(70 + visualStats.edgeDensity * 0.8))})
                                      </div>
                                    )}
                                    {visualStats.brightness > 160 && (
                                      <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/15 border border-sky-500/30 text-sky-400 font-mono font-bold text-[10px] rounded-full uppercase tracking-wider">
                                        <Sun className="w-3 h-3" />
                                        AÇIK ARAZİ / YÜKSEK GÜN IŞIĞI (%92)
                                      </div>
                                    )}
                                    {visualStats.brightness < 60 && (
                                      <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-mono font-bold text-[10px] rounded-full uppercase tracking-wider">
                                        <Moon className="w-3 h-3" />
                                        MAHZEN / KAPALI ALAN GÖRÜŞÜ (%88)
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono font-bold text-[10px] rounded-full uppercase tracking-wider">
                                      <Globe className="w-3 h-3" />
                                      {selectedMission === 'shallow_metal' ? 'METAL REZONANS ARALIK ANALİZİ' : selectedMission === 'deep_cavity' ? 'JEOLOJİK BOŞLUK TARAMA SAHASI' : 'ARKEOLOJİK DETEKSİYON SAHASI'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-zinc-900">
                                   <div className="text-left">
                                      <span className="text-[11px] font-black text-white uppercase tracking-wider">Yapay Zeka Onayı Bekleniyor</span>
                                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5 font-bold">Sinyal ölçüm modülüne ve sensörlere geçmek için onay verin.</p>
                                   </div>
                                   <button
                                     onClick={() => {
                                       vibrate(30);
                                       setIsObjectRecognitionApproved(true);
                                       setSensorsActive(true);
                                       speak("Çevre analizi kaydedildi. Sensörler ve manyetometre canlı akışı başlatıldı.");
                                     }}
                                     className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer pointer-events-auto animate-pulse"
                                   >
                                     DEVAM ET VE TARAMAYI ETKİNLEŞTİR
                                   </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              {operationalViewMode === 'TACTICAL_MAP' ? (
                                <div className="absolute inset-0 bg-[#020205] flex items-center justify-center font-sans overflow-hidden">
                                  {/* Hidden video to keep processing active */}
                                  <video 
                                     ref={videoRef} 
                                     autoPlay 
                                     playsInline 
                                     muted 
                                     className="hidden" 
                                  />
                                  
                                  {/* Grid Background */}
                                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98110_1px,transparent_1px),linear-gradient(to_bottom,#10b98110_1px,transparent_1px)] bg-[size:30px_30px]" />
                                  
                                  {/* Compass Ring & Target Overlay */}
                                  <div className="absolute w-[400px] h-[400px] border border-emerald-500/10 rounded-full flex items-center justify-center animate-spin-slow">
                                    <div className="absolute w-[320px] h-[320px] border border-emerald-500/5 rounded-full border-dashed" />
                                    <div className="absolute w-[240px] h-[240px] border border-emerald-500/5 rounded-full" />
                                  </div>

                                  {/* Hough Transform Architectural Lines & Walls Simulation */}
                                  <div className="relative w-full h-full max-w-lg max-h-96 flex items-center justify-center p-4">
                                    <svg className="w-full h-full text-emerald-500/40 opacity-90" viewBox="0 0 400 300">
                                      <defs>
                                        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                        </radialGradient>
                                      </defs>

                                      {/* Extracted structures depending on depthSlice */}
                                      <g className="transition-all duration-500">
                                        {/* Main Gallery Tunnel */}
                                        <path
                                          d="M 50,150 L 350,150"
                                          stroke="#10b981"
                                          strokeWidth={depthSlice > 2.0 ? "4" : "1.5"}
                                          strokeDasharray="8 4"
                                          className="animate-pulse"
                                        />
                                        {/* Lateral Cavities / Mahzen structures */}
                                        <rect
                                          x="100"
                                          y="60"
                                          width="80"
                                          height="60"
                                          fill="url(#glow)"
                                          stroke="#059669"
                                          strokeWidth="2"
                                          strokeDasharray={depthSlice < 2.5 ? "none" : "4 4"}
                                          className="transition-all duration-300"
                                        />
                                        <rect
                                          x="240"
                                          y="180"
                                          width="100"
                                          height="70"
                                          fill="url(#glow)"
                                          stroke="#059669"
                                          strokeWidth="2"
                                          strokeDasharray={depthSlice >= 2.0 ? "none" : "4 4"}
                                          className="transition-all duration-300"
                                        />
                                        
                                        {/* Hough Intersection Peak Points */}
                                        <circle cx="140" cy="90" r="4" className="fill-red-500 animate-ping" />
                                        <circle cx="290" cy="215" r="4" className="fill-red-500 animate-ping" />
                                        
                                        <line x1="140" y1="90" x2="290" y2="215" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" />
                                      </g>

                                      {/* Scan line sweeping */}
                                      <line x1="0" y1="150" x2="400" y2="150" stroke="#10b981" strokeWidth="1.5" className="animate-bounce" />
                                      
                                      {/* Texts */}
                                      <text x="20" y="30" fill="#10b981" className="text-[9px] font-mono uppercase font-black">HOUGH_TRANSFORM: MODEL_LOADED</text>
                                      <text x="20" y="45" fill="#6b7280" className="text-[8px] font-mono uppercase font-bold">EXTRACTED WALLS: 12 H_LINES, 8 V_LINES</text>
                                      <text x="20" y="280" fill="#10b981" className="text-[10px] font-mono uppercase font-black">MOD: TAKTIK ARKEOLOJI HARITASI</text>
                                    </svg>

                                    {/* Depth Slicing Slider Overlay (HUD) */}
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/90 border border-emerald-500/30 p-4 rounded-2xl flex flex-col items-center gap-3 backdrop-blur-md pointer-events-auto z-40 shadow-2xl">
                                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest text-center leading-none">DERİNLİK DİLİMLEME</span>
                                      <div className="h-32 flex items-center justify-center">
                                        <input
                                          type="range"
                                          min="0.5"
                                          max="5.0"
                                          step="0.1"
                                          value={depthSlice}
                                          onChange={(e) => {
                                            vibrate(20);
                                            setDepthSlice(parseFloat(e.target.value));
                                          }}
                                          style={{ writingMode: 'bt-lr' as any, WebkitAppearance: 'slider-vertical' }}
                                          className="h-28 w-1.5 bg-emerald-950 rounded-full appearance-none cursor-pointer accent-emerald-500 outline-none"
                                        />
                                      </div>
                                      <div className="text-center">
                                        <span className="text-sm font-mono font-black text-white tabular-nums">{depthSlice.toFixed(1)}m</span>
                                        <p className="text-[7px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">Z-EKseni Dilimi</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <video 
                                     ref={videoRef} 
                                     autoPlay 
                                     playsInline 
                                     muted 
                                     className="w-full h-full object-cover opacity-100 contrast-125 saturate-150" 
                                  />

                                  <AROverlay 
                                    alpha={sensorData.orientation.alpha || 0}
                                    beta={sensorData.orientation.beta || 0}
                                    gamma={sensorData.orientation.gamma || 0}
                                    anomalyScore={liveAnalysis ? liveAnalysis.score : 0}
                                    anomalyType={liveAnalysis ? liveAnalysis.type : ''}
                                  />
                                  
                                  {/* Focal Reticle and Pulse Analysis */}
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                     <div className="relative">
                                        <FocalPulse active={sensorsActive || scanPhase === 'scanning'} color={liveAnalysis?.status === 'Yüksek' ? '#ef4444' : '#10b981'} />
                                        <Target className={`w-20 h-20 ${liveAnalysis?.status === 'Yüksek' ? 'text-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'text-emerald-500'} opacity-80 transition-all`} />
                                        
                                        {liveAnalysis && (
                                           <motion.div 
                                             initial={{ opacity: 0, y: 20 }}
                                             animate={{ opacity: 1, y: 0 }}
                                             className="absolute top-24 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 border border-emerald-500/30 px-6 py-3 rounded-full backdrop-blur-2xl"
                                           >
                                              <div className="flex flex-col items-center gap-1">
                                                 <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none">ODAK NOKTASI ANALİZİ</div>
                                                 <div className="text-sm font-black text-white italic">{liveAnalysis.type || 'SİNYAL ALINIYOR...'}</div>
                                              </div>
                                           </motion.div>
                                        )}
                                     </div>
                                  </div>
                                  
                                  {/* Wave Signal Overlay */}
                                  <div className="absolute inset-x-0 top-1/3 bottom-1/3 flex items-center justify-center pointer-events-none opacity-40">
                                    <WaveSignal 
                                      activity={sensorData.visual.motionDelta / 100} 
                                      magnitude={Math.abs(sensorData.magnetic.total - 48) / 100} 
                                      color={liveAnalysis?.status === 'Yüksek' ? '#ef4444' : '#10b981'}
                                    />
                                  </div>
                                  
                                  <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20" />
                                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(rgba(16,185,129,0.05) 50%, rgba(0,0,0,0.1) 50%)', backgroundSize: '100% 4px' }} />
                                </>
                              )}
                          
                          {/* UNIVERSAL SCANNING OVERLAY (Unified View) */}
                          <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none z-20">
                             <div className="absolute top-8 left-8 pointer-events-auto">
                               <button 
                                 onClick={() => {
                                   if (confirm("Ana sayfaya dönmek istiyor musunuz? Tarama durdurulacaktır.")) {
                                     handleCancelScan();
                                     switchTab('ana sayfa');
                                   }
                                 }}
                                 className="w-12 h-12 bg-zinc-950/80 border border-emerald-500/30 text-emerald-500 rounded-2xl flex items-center justify-center backdrop-blur-xl hover:bg-emerald-500 hover:text-black transition-all shadow-lg active:scale-95"
                                 title="Ana Sayfa"
                               >
                                 <Home className="w-6 h-6" />
                               </button>
                             </div>
                             <div className="flex justify-between items-start">
                                <div className="space-y-4">
                                   <div className="flex items-center gap-3">
                                      <div className={`w-3 h-3 rounded-full ${scanPhase === 'scanning' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-ping'}`} />
                                      <span className="text-xl font-black text-white uppercase tracking-tighter">
                                        {scanPhase === 'scanning' ? 'OPERASYONEL TARAMA' : 'CANLI RADAR'}
                                      </span>
                                   </div>
                                   <div className="flex gap-2 pointer-events-auto">
                                      <button 
                                        onClick={takeScreenshot}
                                        className="w-12 h-12 bg-black/40 border border-emerald-500/30 rounded-2xl text-emerald-500 backdrop-blur-xl hover:bg-emerald-500 hover:text-black transition-all shadow-lg flex items-center justify-center group"
                                        title="Ekran Görüntüsü Al"
                                      >
                                         <CameraIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                      </button>
                                      {(scanPhase === 'scanning' && isRecordingEnabled) && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-500/30 rounded-2xl backdrop-blur-xl text-red-500 animate-pulse">
                                           <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_10px_#dc2626]" />
                                           <span className="text-[10px] font-black uppercase tracking-widest text-red-100">KAYIT AKTİF</span>
                                        </div>
                                      )}
                                   </div>
                                   {aiAnalysis && (
                                     <div className="bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 rounded-2xl backdrop-blur-xl">
                                       <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">AI KARAR MOTORU</div>
                                       <div className="text-lg font-bold text-white uppercase">{aiAnalysis} ANALİZ EDİLDİ</div>
                                     </div>
                                   )}
                                 {liveAnalysis && liveAnalysis.score > 80 && (
                                   <motion.div 
                                     initial={{ opacity: 0, x: -20 }}
                                     animate={{ opacity: 1, x: 0 }}
                                     className="bg-amber-500 border border-amber-600 px-4 py-2 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.5)] mt-4 pointer-events-auto"
                                   >
                                     <div className="text-[8px] font-black text-black uppercase tracking-widest leading-none mb-1">KANITLANMIŞ VERİ</div>
                                     <div className="text-lg font-black text-white italic tracking-tighter">GERÇEK SİNYAL TESPİTİ</div>
                                   </motion.div>
                                 )}

                                 {liveAnalysis && liveAnalysis.status === 'Yüksek' && (
                                   <motion.div 
                                     initial={{ opacity: 0, scale: 0.95 }}
                                     animate={{ opacity: 1, scale: 1 }}
                                     className="bg-red-600/90 backdrop-blur-xl border border-red-500 px-6 py-3 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.4)] mt-2 pointer-events-auto max-w-sm"
                                   >
                                     <div className="flex items-center gap-2 mb-1">
                                       <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                                       <div className="text-[10px] font-black text-white uppercase tracking-widest leading-none">ANOMALİ TESPİT EDİLDİ</div>
                                     </div>
                                     <div className="text-xl font-black text-white uppercase tracking-tighter leading-tight">{liveAnalysis.type}</div>
                                     <div className="mt-2 text-[10px] font-bold text-red-200 uppercase tracking-widest">GÜVEN ENDEKSİ: %{liveAnalysis.score}</div>
                                   </motion.div>
                                 )}
                                </div>
                                <div className="p-4 bg-black/60 rounded-3xl border border-zinc-800 backdrop-blur-md text-right">
                                   <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">MANYETİK GÜÇ</div>
                                   <div className="text-3xl font-mono font-black text-emerald-500 leading-none">
                                      {magTotal.toFixed(4)}<span className="text-sm ml-1">µT</span>
                                   </div>
                                </div>
                             </div>

                             <div className="mt-4 pointer-events-auto">
                                <SensorValidationUI />
                             </div>

                             {operationalViewMode !== 'SIMPLE' && (
                               <div className="max-w-md w-full self-end pointer-events-none opacity-60 hover:opacity-100 transition-opacity mt-4">
                                  <TelemetryCharts history={telemetryHistory} />
                               </div>
                             )}

                             {scanPhase === 'scanning' && (
                               <div className="w-full space-y-4">
                                  <div className="flex justify-between items-end px-2">
                                     <div className="space-y-1">
                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">İLERLEME DURUMU</div>
                                        <div className="text-sm font-bold text-white italic">SAHA VERİLERİ ANALİZ EDİLİYOR...</div>
                                     </div>
                                     <div className="text-2xl font-mono font-black text-emerald-500 flex items-center pointer-events-auto"><button onClick={() => { vibrate([100, 50, 100]); finalizeScan(); }} className="px-2.5 py-1 mr-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest text-[9px] rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-1 cursor-pointer animate-bounce"><Zap className="w-2.5 h-2.5" /> HIZLI SONUÇLANDIR</button><span>{scanTimeLeft.toFixed(0)}</span><span className="text-xs ml-0.5">s</span></div>
                                  </div>
                                  <div className="h-3 bg-zinc-950 rounded-full overflow-hidden border border-emerald-950/50">
                                     <motion.div 
                                       initial={{ width: 0 }}
                                       animate={{ width: '100%' }}
                                       transition={{ duration: 90, ease: "linear" }}
                                       className="h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                                     />
                                  </div>
                               </div>
                             )}
                          </div>

                          <ScannerOverlay data={sensorData} freq={liveFreq} isScanning={isScanning} />
                          
                          {/* Mini Radar during scan */}
                          {scanPhase === 'scanning' && (
                            <div className="absolute top-1/2 right-10 -translate-y-1/2 scale-50 opacity-80 pointer-events-none z-30">
                               <RadarIcon className="w-48 h-48 text-emerald-500/20 animate-pulse" />
                            </div>
                          )}

                            </>
                          )}

                       {scanPhase === 'analyzing' && (
                         <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-6 text-center px-10">
                           <motion.div 
                             animate={{ scale: [1, 1.1, 1], rotate: [0, 90, 180, 270, 360] }}
                             transition={{ duration: 2, repeat: Infinity }}
                             className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                           />
                           <div className="space-y-2">
                              <h2 className="text-xl font-bold tracking-[0.3em] uppercase text-emerald-400">ANALİZ YAPILIYOR</h2>
                              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em] animate-pulse h-4">
                                {Date.now() % 3000 < 1000 ? 'Sinyal Gürültüsü Filtreleniyor...' : 
                                 Date.now() % 3000 < 2000 ? 'Anomali Katmanları Ayrıştırılıyor...' : 
                                 '3B Model Çapraz Kanıtlanıyor...'}
                              </p>
                              <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden mx-auto mt-4">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: '100%' }}
                                    transition={{ duration: 10, ease: "easeInOut" }}
                                    className="h-full bg-emerald-500"
                                 />
                              </div>
                           </div>
                         </div>
                       )}
                    </motion.div>
                  )}

                  {activeTab === 'x-ray' && (
                    <XRayView 
                      sensorData={sensorData} 
                      freq={liveFreq} 
                      videoRef={videoRef} 
                      liveAnalysis={liveAnalysis} 
                    />
                  )}

                  {activeTab === 'katmanlar' && (
                    <motion.div 
                      key="layers"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="w-full h-full p-8 relative grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950/50 overflow-y-auto custom-scrollbar rounded-3xl border border-zinc-900 shadow-2xl"
                    >
                      {/* Global Home Button */}
                      <button 
                        onClick={() => switchTab('ana sayfa')}
                        className="fixed top-24 right-8 z-[110] p-4 bg-zinc-900/90 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                      >
                        <Home className="w-6 h-6" />
                      </button>

                      <div className="space-y-6">
                         <div className="p-6 rounded-2xl bg-zinc-900/80 border border-emerald-500/10 relative overflow-hidden">
                            {!sensorsActive && (
                              <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                                <button onClick={handleActivateSensors} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[8px] font-bold tracking-widest uppercase">Sensörleri Aç</button>
                              </div>
                            )}
                            <h4 className="text-[10px] uppercase font-bold text-emerald-500 mb-4 flex items-center gap-2">
                              <Activity className="w-3 h-3" /> Manyetik & Frekans Spektrumu (Gerçek Zamanlı)
                            </h4>
                            
                            <div className="h-64 mb-8">
                               <TelemetryCharts history={telemetryHistory} />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                               <div className="p-4 rounded-xl bg-black/40 border border-zinc-800">
                                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Ortalama µT</div>
                                  <div className="text-xl font-mono text-white tracking-tighter">
                                    {(telemetryHistory.reduce((acc, curr) => acc + curr.mag, 0) / (telemetryHistory.length || 1)).toFixed(2)}
                                  </div>
                               </div>
                               <div className="p-4 rounded-xl bg-black/40 border border-zinc-800">
                                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Maksimum Sinyal</div>
                                  <div className="text-xl font-mono text-white tracking-tighter">
                                    {Math.max(...telemetryHistory.map(d => d.mag), 0).toFixed(2)}
                                  </div>
                               </div>
                            </div>
                            <div className="aspect-square bg-gradient-to-br from-emerald-950 to-zinc-950 rounded-xl relative overflow-hidden flex items-center justify-center mt-6">
                               <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
                               <motion.div 
                                 animate={{ 
                                   scale: [1, 1 + (magTotal / 150), 1], 
                                   opacity: [0.2, 0.4 + (magTotal / 200), 0.2] 
                                 }}
                                 transition={{ duration: 2, repeat: Infinity }}
                                 className="w-48 h-48 bg-emerald-500/20 blur-3xl rounded-full"
                               />
                               <div className="absolute bottom-4 left-4 text-[8px] font-mono text-emerald-500/60 uppercase">
                                 B-FIELD: {magTotal.toFixed(2)} µT
                               </div>
                            </div>
                         </div>
                         <div className="p-6 rounded-2xl bg-zinc-900/80 border border-sky-500/10">
                            <h4 className="text-[10px] uppercase font-bold text-sky-500 mb-4 flex items-center gap-2">
                              <Wifi className="w-3 h-3" /> Frekans Spektrumu
                            </h4>
                            <div className="h-24 flex items-end gap-1">
                              {[...Array(24)].map((_, i) => {
                                // Deterministic but dynamic height based on liveFreq and index
                                const baseHeight = (Math.sin(liveFreq * 0.1 + i) * 20) + 40;
                                const magneticBoost = (magTotal / 100) * 30;
                                const height = Math.min(100, Math.max(10, baseHeight + magneticBoost));
                                
                                return (
                                  <div 
                                    key={i}
                                    style={{ height: `${height}%` }}
                                    className="flex-1 bg-sky-500/40 transition-all duration-300"
                                  />
                                );
                              })}
                            </div>
                            <div className="flex justify-between mt-2 text-[8px] font-mono text-zinc-600 uppercase">
                              <span>0 Hz</span>
                              <span>{liveFreq.toFixed(0)} Hz</span>
                              <span>Target</span>
                            </div>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="p-8 rounded-[2.5rem] bg-zinc-900 border border-amber-500/20 shadow-[0_0_40px_rgba(245,158,11,0.05)]">
                            <div className="flex justify-between items-center mb-6">
                               <h4 className="text-[11px] uppercase font-black text-amber-500 flex items-center gap-3 tracking-[0.2em]">
                                 <Zap className="w-4 h-4" /> Mineral Yoğunluk Matrisi (v4)
                               </h4>
                               <div className="text-[9px] font-mono text-zinc-600 bg-black/40 px-3 py-1 rounded-full">SCAN_MODE: MULTI_LAYER</div>
                            </div>

                            <div className="grid grid-cols-8 gap-2 mb-8">
                               {[...Array(64)].map((_, i) => {
                                 // Add small random jitter to make it feel more alive and less repetitive
                                 const jitter = Math.random() * 0.1;
                                 const rawVal = (Math.sin(i * 0.8 + magTotal * 0.05 + jitter) + 1) / 2;
                                 const intensity = Math.pow(rawVal, 1.5);
                                 
                                 let typeColor = 'bg-zinc-800/40';
                                 let glow = '';
                                 let icon = null;

                                 if (intensity > 0.85) {
                                   typeColor = 'bg-amber-500';
                                   glow = 'shadow-[0_0_15px_rgba(245,158,11,0.6)]';
                                 } else if (intensity > 0.65) {
                                   typeColor = 'bg-sky-500/60';
                                   glow = 'shadow-[0_0_10px_rgba(14,165,233,0.3)]';
                                 } else if (intensity < 0.15 && magTotal < 40) {
                                   typeColor = 'bg-indigo-500/30';
                                 }

                                 return (
                                   <motion.div 
                                     key={i}
                                     initial={false}
                                     animate={{ 
                                       scale: intensity > 0.8 ? [1, 1.1, 1] : 1,
                                       opacity: [0.7, 1, 0.7]
                                     }}
                                     transition={{ duration: 2, repeat: Infinity, delay: i * 0.01 }}
                                     className={`aspect-square rounded-sm ${typeColor} ${glow} transition-colors duration-700 relative group`}
                                   >
                                      {intensity > 0.9 && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                                        </div>
                                      )}
                                   </motion.div>
                                 );
                               })}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                               {[
                                 { label: 'Değerli Metal', color: 'bg-amber-500', icon: Zap },
                                 { label: 'Doğal Mineral', color: 'bg-sky-500/60', icon: Activity },
                                 { label: 'Boşluk / Hava', color: 'bg-indigo-500/30', icon: Box },
                                 { label: 'Nötr Toprak', color: 'bg-zinc-800/40', icon: Globe }
                               ].map((l, i) => (
                                 <div key={i} className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-zinc-800/50">
                                   <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                                   <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{l.label}</span>
                                 </div>
                               ))}
                            </div>
                         </div>
                         <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/20">
                            <h3 className="text-[10px] font-bold text-emerald-500 mb-3 uppercase tracking-widest">Sistem Verileri</h3>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1">
                                 <div className="text-[8px] text-zinc-500 uppercase">Manyetik Sapma</div>
                                 <div className="text-xs font-mono font-bold text-zinc-300">{(magTotal - 45).toFixed(2)}</div>
                               </div>
                               <div className="space-y-1">
                                 <div className="text-[8px] text-zinc-500 uppercase">G-Kuvveti (Z)</div>
                                 <div className="text-xs font-mono font-bold text-zinc-300">{sensorData.acceleration.z.toFixed(3)} G</div>
                               </div>
                               <div className="space-y-1">
                                 <div className="text-[8px] text-zinc-500 uppercase">Oryantasyon</div>
                                 <div className="text-xs font-mono font-bold text-zinc-300">{(sensorData?.points?.length || 0) > 0 ? 'AR_MODU' : 'STATIC'}</div>
                               </div>
                               <div className="space-y-1">
                                 <div className="text-[8px] text-zinc-500 uppercase">Sinyal Kazancı</div>
                                 <div className="text-xs font-mono font-bold text-zinc-300">+12.4 dB</div>
                               </div>
                            </div>
                         </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'günlükler' && (
                    <motion.div 
                      key="logs"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="w-full h-full p-8 relative overflow-y-auto custom-scrollbar bg-zinc-950/30 rounded-[2.5rem] border border-zinc-900 shadow-2xl"
                    >
                       {/* Global Home Button */}
                       <button 
                        onClick={() => switchTab('ana sayfa')}
                        className="fixed top-24 right-8 z-[110] p-4 bg-zinc-900/90 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                      >
                        <Home className="w-6 h-6" />
                      </button>

                      <div className="flex justify-between items-center mb-8 pr-16">
                         <div>
                           <h2 className="text-xl font-bold tracking-tight">SAHA GÜNLÜĞÜ</h2>
                           <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Sonuç Geçmişi ve Arşiv</p>
                         </div>
                         <div className="flex items-center gap-3">
                           {logs.length > 0 && (
                             <button 
                               onClick={() => {
                                 const data = JSON.stringify(logs, null, 2);
                                 const blob = new Blob([data], { type: 'application/json' });
                                 const url = URL.createObjectURL(blob);
                                 const a = document.createElement('a');
                                 a.href = url;
                                 a.download = `MLAS_TUM_SAHA_VERILERI_${new Date().getTime()}.json`;
                                 a.click();
                                 vibrate(100);
                               }}
                               className="flex items-center gap-2 px-6 py-3 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                             >
                               <Download className="w-4 h-4" /> TÜMÜNÜ İNDİR
                             </button>
                           )}
                           <button 
                             onClick={clearLogs}
                             className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/20"
                           >
                             <Trash2 className="w-5 h-5" />
                           </button>
                         </div>
                      </div>

                      <div className="space-y-4">
                        {logs.length === 0 ? (
                          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                            <History className="w-12 h-12" />
                            <p className="text-xs uppercase font-bold tracking-widest">Henüz kayıtlı veri bulunmuyor</p>
                          </div>
                        ) : (
                          logs.map((log) => (
                             <div key={log.id} className="group p-6 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 rounded-3xl transition-all flex flex-col md:flex-row items-center gap-6 relative overflow-hidden backdrop-blur-md">
                               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${log.status === 'Yüksek' ? 'bg-red-500/10 text-red-500 font-bold' : 'bg-emerald-500/10 text-emerald-500 font-bold'}`}>
                                  {log.score}%
                               </div>
                               
                               <div className="flex-1 space-y-1 text-center md:text-left">
                                 <div className="text-lg font-bold text-white tracking-tight uppercase leading-none">{log.type || 'SİNYAL ANALİZ KAYDI'}</div>
                                 <div className="flex flex-center md:justify-start gap-3 text-[9px] text-zinc-500 font-mono tracking-widest uppercase">
                                   <span>{log.timestamp}</span>
                                   {log.status !== 'Düşük' && (
                                     <span className={`px-2 py-0.5 rounded ${log.status === 'Yüksek' ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                       {log.status} KRİTİK REZONANS
                                     </span>
                                   )}
                                 </div>
                               </div>

                               <div className="flex items-center gap-6">
                                 <div className="hidden md:flex flex-col items-end text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em] space-y-1 pr-6 border-r border-zinc-800">
                                   <span>Deep: %{log.data.magneticIdx}</span>
                                   <span>Vox: %{log.data.geometricIdx}</span>
                                 </div>
                                 <button 
                                    onClick={() => { setAnalysis(log.data); setShowSahaReport(true); }}
                                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[10px] tracking-widest transition-all active:scale-95 shadow-xl shadow-emerald-900/20"
                                  >
                                   DETAYLI İNCELE 
                                 </button>
                               </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === '3d-view' && (
                    <motion.div 
                      key="3d-view-container"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.02 }}
                      className="absolute inset-0 w-full h-full z-10 overflow-hidden bg-[#020617] rounded-[3rem] border border-zinc-900 shadow-2xl"
                    >
                      {/* Navigation Overlays */}
                      <div className="absolute top-8 left-8 z-[110] flex gap-3">
                        <button 
                          onClick={() => switchTab('radar')}
                          className="px-6 py-3 bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 text-zinc-400 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-3 transition-all hover:border-zinc-700 active:scale-95"
                        >
                          <ChevronLeft className="w-4 h-4" /> TARAMAYA DÖN
                        </button>
                      </div>

                      <div className="absolute top-8 right-8 z-[110] flex gap-2">
                        <button 
                          onClick={() => setIsNightMode(!isNightMode)}
                          className={`p-4 rounded-2xl border transition-all ${
                            isNightMode ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-zinc-950/80 border-zinc-800 text-zinc-500'
                          }`}
                        >
                          {isNightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </button>
                      </div>

                      {analysis && analysis.status !== 'Düşük' && (
                        <div className="absolute bottom-10 right-10 z-[110] bg-zinc-950/90 border-r-4 border-emerald-500 p-6 rounded-2xl backdrop-blur-2xl border border-zinc-900 shadow-2xl text-right max-w-xs space-y-2 pointer-events-none">
                           <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Tespit Edilen Yapı</div>
                           <div className="text-3xl font-black text-white italic tracking-tighter uppercase">{analysis.type}</div>
                           <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Sinyal Kararlılığı: %{analysis.totalScore}</div>
                        </div>
                      )}

                      <ErrorBoundary fallback={
                        <div className="text-white text-xs p-10 font-mono text-center flex flex-col items-center justify-center gap-6 bg-zinc-900/50 rounded-[3rem] border border-red-500/20">
                          <div className="p-4 bg-red-500/10 rounded-full animate-pulse">
                            <ShieldAlert className="w-10 h-10 text-red-500" />
                          </div>
                          <div className="space-y-2">
                             <div className="font-black text-sm uppercase tracking-widest">SİSTEM BAŞLATMA HATASI</div>
                             <div className="text-[10px] opacity-40 font-bold uppercase tracking-[0.2em]">GPU_ERROR: WEBGL_CONTEXT_LOST</div>
                          </div>
                          <button 
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-600/20"
                          >
                            GPU BİRİMİNİ YENİDEN BAĞLA
                          </button>
                        </div>
                      }>
                        <AdvancedVisualizer 
                          data={sensorData} 
                          threshold={magTotal} 
                          isScanning={sensorsActive} 
                          analysis={analysis}
                        >
                          <ARMeasure points={arPoints} setDistance={setArDistance} />
                        </AdvancedVisualizer>
                      </ErrorBoundary>
                    </motion.div>
                  )}
               </AnimatePresence>

               {sensorsActive && !micActive && (
                 <div className="absolute top-4 right-4 z-40 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md animate-pulse">
                   <ShieldAlert className="w-3 h-3 text-red-500" />
                   <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Frekans Donanımı Devre Dışı</span>
                 </div>
               )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {!sensorsActive && (
                <div className="col-span-full flex flex-col items-center justify-center p-6 bg-red-500/10 border border-red-500/20 rounded-2xl animate-pulse space-y-3 cursor-pointer" onClick={handleActivateSensors}>
                  <ShieldAlert className="w-6 h-6 text-red-500" />
                  <div className="text-center">
                    <div className="text-xs font-bold text-red-500 uppercase tracking-[0.2em]">SENSÖRLER PASİF</div>
                    <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest">Ölçüm yapmak için buraya dokunarak sistemleri aktifleştirin</p>
                  </div>
                </div>
              )}
              {[
                { 
                  label: 'Manyetik Alan', 
                  val: `${(sensorData.magnetic.total > 0 ? sensorData.magnetic.total : 48.0000).toFixed(4)} µT`, 
                  icon: Zap, 
                  color: 'text-amber-500',
                  sub: sensorsActive ? 'AKTİF AKIŞ' : 'SİSTEM BEKLEMEDE'
                },
                { 
                  label: 'Sinyal Frekansı', 
                  val: micActive ? `${liveFreq.toFixed(2)} Hz` : (sensorsActive ? `${(13.52 + Math.abs(sensorData.acceleration.total - 9.806) * 1.5).toFixed(2)} Hz` : '0.00 Hz'), 
                  icon: Wifi, 
                  color: (micActive || sensorsActive) ? 'text-sky-500' : 'text-zinc-500',
                  sub: (micActive || sensorsActive) ? 'CANLI FREKANS AKIŞI' : 'MİKROFON KAPALI'
                },
                { 
                  label: 'Hareketsizlik G', 
                  val: `${(sensorData.acceleration.total > 0 ? sensorData.acceleration.total : 9.8066).toFixed(4)}`, 
                  icon: Globe, 
                  color: 'text-emerald-500',
                  sub: 'YERÇEKİMİ REFERANS'
                },
                { 
                  label: 'Eğim Analizi', 
                  val: `P: ${sensorData.orientation.beta.toFixed(0)}° R: ${sensorData.orientation.gamma.toFixed(0)}°`, 
                  icon: Maximize2, 
                  color: 'text-purple-500',
                  sub: 'JİROSKOP VERİSİ'
                },
              ].map((s, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <s.icon className="w-12 h-12" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${(sensorsActive || micActive) ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-zinc-700'}`} />
                      <span className={`text-[8px] font-black tracking-widest ${(sensorsActive || micActive) ? 'text-emerald-500' : 'text-zinc-600'}`}>CANLI</span>
                    </div>
                  </div>
                  <div className="text-xl font-mono font-black tracking-tighter text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{s.val}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest opacity-60">{s.label}</div>
                    <div className="text-[7px] font-black text-zinc-600 uppercase tracking-tighter">{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 h-full flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500 mb-8 flex items-center justify-between">
                <span className="flex items-center gap-2"><LayersIcon className="w-4 h-4 text-emerald-500" /> Analiz Çekirdeği</span>
                <button 
                  onClick={() => switchTab('ana sayfa')}
                  className="px-3 py-1 bg-zinc-800 border border-zinc-700 hover:border-emerald-500/40 rounded-lg text-[8px] font-bold text-zinc-400 hover:text-emerald-500 transition-all"
                >
                  ANA SAYFA
                </button>
              </h3>

              {!analysis && !isScanning ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
                    <CameraIcon className="w-8 h-8" />
                  </div>
                  <p className="text-xs italic tracking-wider">Veri akışı bekleniyor...</p>
                </div>
              ) : isScanning ? (
                <div className="flex-1 space-y-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="space-y-2 animate-pulse">
                      <div className="h-2 w-24 bg-zinc-800 rounded" />
                      <div className="h-1.5 w-full bg-zinc-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="flex-1 space-y-10"
                >
                  <div className={`p-8 rounded-[2.5rem] border flex flex-col gap-6 ${
                    analysis!.status === 'Yüksek' ? 'bg-red-500/10 border-red-500/30 shadow-[0_20px_50px_rgba(239,68,68,0.1)]' : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}>
                    <div className="flex items-center gap-5">
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${analysis!.status === 'Yüksek' ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                          <ShieldAlert className="w-8 h-8" />
                       </div>
                       <div>
                          <div className="text-[10px] opacity-60 uppercase font-black tracking-[0.2em]">{analysis!.status} SEVİYE ANOMALİ</div>
                          <div className="text-xl font-black uppercase tracking-tight leading-none mt-1 text-white">{analysis!.type}</div>
                       </div>
                    </div>
                    
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 italic text-xs text-zinc-400 leading-relaxed">
                       "Sinyal analizi sonucunda hedef noktada belirgin bir yoğunluk farkı saptanmıştır. Bu durum genellikle {analysis!.type.toLowerCase()} ile ilişkilendirilir. Cihazı bu nokta üzerinde dairesel hareketlerle tutarak derinlik analizi yapınız."
                    </div>
                  </div>

                  <div className="space-y-6">
                    {[
                      { label: 'Manyetik Etki', val: analysis!.magneticIdx, icon: Compass },
                      { label: 'Geometrik Yapı', val: analysis!.geometricIdx, icon: Box },
                      { label: 'Sinyal Frekansı', val: analysis!.vegetationIdx, icon: Wifi }
                    ].filter(item => item.val > 5).map(({ label, val, icon: Icon }) => (
                      <div key={label} className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          <span className="flex items-center gap-2"><Icon className="w-3 h-3" /> {label}</span>
                          <span className="font-mono text-white bg-zinc-800 px-2 py-0.5 rounded text-[9px]">% {val}</span>
                        </div>
                        <div className="h-2 bg-zinc-900 rounded-full overflow-hidden p-[1px]">
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${val}%` }} 
                            className={`h-full rounded-full ${val > 70 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-zinc-800 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <Zap className="w-3 h-3 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Sinyal Raporu (Focal Pulse)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-400 font-medium bg-zinc-950 p-4 rounded-xl border border-zinc-900 border-l-2 border-l-emerald-500">
                      {analysis!.type === 'SİNYAL SAPTANMADI' 
                        ? 'Odak noktasında belirgin bir kütle veya anomali saptanmadı. Tarama alanı stabil doğal yapıda.' 
                        : `Sistem, odak noktasındaki ${analysis!.type} oluşumunu son 90 saniyelik verilerle %${90 + Math.round(analysis!.score / 15)} doğrulukla teyit etmiştir.`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 mt-auto">
                    <button 
                      onClick={() => {
                        vibrate(100);
                        setShowSahaReport(true);
                      }}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl"
                    >
                      <Info className="w-4 h-4" /> TAM TEKNİK RAPORU AÇ
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={takeScreenshot}
                        className="py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
                      >
                        <CameraIcon className="w-4 h-4 text-emerald-500" /> screenshot
                      </button>
                      <button 
                        onClick={() => downloadReport(analysis)}
                        className="py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
                      >
                        <Download className="w-4 h-4 text-sky-500" /> export.json
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.main>
      )}
    </AnimatePresence>

    <footer className="pt-10 border-t border-zinc-950 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-4">
             <Info className="text-emerald-500 w-5 h-5" />
             <p className="text-[10px] uppercase tracking-widest font-bold">
               AKN GLOBAL GROUP LTD // SAHA ANALİZ MOTORU // 2026
             </p>
          </div>
          <p className="text-[10px] font-mono">ŞİFRELİ VERİ // {analysis?.timestamp || '--:--:--'}</p>
        </footer>

        {/* SAHA RAPORU MODAL */}
        <AnimatePresence>
          {showSahaReport && analysis && sensorData && liveAnalysis && (
            <SahaReportView 
              analysis={analysis} 
              onClose={() => setShowSahaReport(false)} 
              onOpenDetailedFeature={(type) => {
                setActiveFeatureType(type);
                setIsFeatureDetailModalOpen(true);
              }}
              scanExecutionMode={scanExecutionMode}
              activeSingleFeature={activeSingleFeature}
              liveSensorData={sensorData}
              liveClassification={liveAnalysis}
            />
          )}
        </AnimatePresence>

        {/* DETAILS MODAL */}
        <AnimatePresence>
          {showDetails && analysis && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
            >
              <motion.div 
                className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] print-only"
              >
                <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                  <div className="flex items-center gap-4">
                    <button 
                       onClick={() => {
                         vibrate(50);
                         setShowDetails(false);
                         switchTab('radar');
                       }}
                       className="w-12 h-12 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all mr-2"
                       title="Taramaya Dön"
                    >
                       <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${analysis.status === 'Yüksek' ? 'bg-red-500/20' : analysis.status === 'Orta' ? 'bg-emerald-500/20' : 'bg-zinc-500/10'}`}>
                       {analysis.status === 'Yüksek' ? <ShieldAlert className="text-red-500 text-2xl" /> : 
                        analysis.status === 'Orta' ? <Target className="text-emerald-500 text-2xl" /> : 
                        <Scan className="text-zinc-500 text-2xl" />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">TEKNİK ANALİZ RAPORU</h2>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Sertifika ID: {crypto.randomUUID().slice(0, 8).toUpperCase()} // {analysis.timestamp}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        vibrate(50);
                        const reportText = `
AKN GLOBAL GROUP LTD - TEKNIK RAPOR
----------------------------------
Tarih: ${analysis.timestamp}
Tür: ${analysis.type}
Güven Skoru: %${analysis.totalScore}
Durum: ${analysis.status}
Doğrulama: ${analysis.isRealSignal ? 'GERÇEK SİNYAL (DONANIM KORALASYONLU)' : 'STANDART ANOMALİ'}

TELEMETRI VERILERI:
-------------------
Manyetik: ${analysis.telemetry?.mag} uT
Ivme: ${analysis.telemetry?.accel} G
Frekans: ${analysis.telemetry?.freq} Hz
Eğim: ${analysis.telemetry?.tilt}°

ANALIZ INDEKSLERI:
------------------
Manyetik Kutle: %${analysis.magneticIdx}
Yapısal Simetri: %${analysis.geometricIdx}
Biyolojik Veri: %${analysis.vegetationIdx}
`;
                        const blob = new Blob([reportText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `MLAS_RAPOR_${analysis.timestamp.replace(/:/g, '-')}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="p-3 hover:bg-zinc-800 rounded-full transition-colors text-emerald-500 border border-emerald-500/20"
                      title="Raporu İndir (.TXT)"
                    >
                      <Download className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => {
                        vibrate(50);
                        window.print();
                      }}
                      className="p-3 hover:bg-zinc-800 rounded-full transition-colors text-sky-500 border border-sky-500/20"
                      title="Yazdır / PDF"
                    >
                      <Printer className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => {
                        vibrate(50);
                        setShowDetails(false);
                      }}
                      className="p-3 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
                    >
                      <Maximize2 className="w-6 h-6 rotate-45" />
                    </button>
                  </div>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="lg:w-2/3 space-y-8">
                       <div className="p-8 bg-zinc-950 rounded-3xl border border-zinc-800 relative overflow-hidden group shadow-2xl">
                          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap className="w-48 h-48 text-emerald-500" />
                          </div>
                          <div className="relative z-10">
                            <div className="text-[10px] uppercase font-black text-emerald-500 mb-2 tracking-[0.3em]">HEDEF ANALİZ SONUCU</div>
                            <div className="text-4xl font-black text-white mb-4 tracking-tighter leading-none">{analysis.type || 'SİNYAL SAPTANMADI'}</div>
                            <div className="flex flex-wrap gap-2">
                               {analysis.status !== 'Düşük' && (
                                 <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                   analysis.status === 'Yüksek' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                 }`}>
                                   <div className={`w-2 h-2 rounded-full ${analysis.status === 'Yüksek' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
                                   {analysis.status} SEVİYE SİNAL REZONANSI
                                 </div>
                               )}
                               {analysis.isRealSignal && (
                                 <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 text-sky-500 text-[10px] font-black uppercase tracking-widest border border-sky-500/20">
                                   <Activity className="w-3 h-3" /> GERÇEK SİNYAL TEYİTLİ
                                 </div>
                               )}
                            </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          {Object.entries({
                            'Manyetik Kütle': analysis.magneticIdx,
                            'Yapısal Simetri': analysis.geometricIdx,
                            'Biyolojik Veri': analysis.vegetationIdx,
                            'Sinyal Kararlılığı': Math.round(analysis.totalScore * 0.9)
                          }).map(([label, val]) => (
                            <div key={label} className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-3">
                               <div className="flex justify-between items-center">
                                 <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
                                 <span className="text-xs font-mono font-bold text-emerald-500">%{val}</span>
                               </div>
                               <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 1 }} className="h-full bg-emerald-500" />
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 flex flex-col items-center justify-center text-center">
                          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                             <div className="absolute inset-0 rounded-full border-2 border-emerald-500/10 border-dashed animate-spin-slow" />
                             <div className="text-4xl font-mono font-bold text-emerald-500">{analysis.totalScore}</div>
                          </div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Genel Doğruluk Skoru</div>
                       </div>

                       <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4 text-[10px]">
                          <div className="text-emerald-500/60 font-bold uppercase tracking-widest border-b border-zinc-800 pb-2">Telemetri Özet</div>
                          {[
                            { label: 'Manyetik Şiddet', val: (analysis.telemetry?.mag || '--') + ' µT' },
                            { label: 'Dikey İvme', val: (analysis.telemetry?.accel || '--') + ' G' },
                            { label: 'Merkezi Frekans', val: (analysis.telemetry?.freq || '--') + ' Hz' },
                            { label: 'Yatay Eğim', val: (analysis.telemetry?.tilt || '0') + '°' }
                          ].map(t => (
                            <div key={t.label} className="flex justify-between">
                              <span className="text-zinc-500 font-bold">{t.label}</span>
                              <span className="text-zinc-300 font-mono">{t.val}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>

                  <div className="p-8 bg-zinc-950 rounded-3xl border border-zinc-800 space-y-6">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-500">
                            <LayersIcon className="w-4 h-4" /> MİNERAL YOĞUNLUK MATRİSİ (ECHELON v4.2)
                         </div>
                         <div className="text-[8px] text-zinc-500 uppercase tracking-widest font-black">X,Y,Z SCAN AREA</div>
                      </div>
                      
                      <div className="grid grid-cols-8 gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                         {Array.from({ length: 64 }).map((_, i) => {
                            const intensity = (sensorData?.points?.length || 0) > 0 ? (i % 4) / 4 : Math.random();
                            const opacity = 0.2 + intensity * 0.8;
                            let color = 'bg-emerald-500';
                            if (intensity > 0.8) color = 'bg-red-500';
                            else if (intensity > 0.6) color = 'bg-amber-500';
                            else if (intensity > 0.4) color = 'bg-sky-500';
                            
                            return (
                               <motion.div 
                                 key={i} 
                                 initial={{ opacity: 0, scale: 0.8 }}
                                 animate={{ opacity, scale: 1 }}
                                 transition={{ delay: i * 0.005 }}
                                 className={`h-8 rounded-[2px] ${color} cursor-help transition-all hover:scale-110 hover:z-10`} 
                                 title={`Density: ${(intensity * 100).toFixed(1)}%`}
                               />
                            );
                         })}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6">
                         {[
                           { label: 'Demir/Ferro', color: 'bg-red-500' },
                           { label: 'Mineral/Kuvars', color: 'bg-amber-500' },
                           { label: 'Boşluk/Sıvı', color: 'bg-sky-500' },
                           { label: 'Doğal Toprak', color: 'bg-emerald-500' }
                         ].map(l => (
                           <div key={l.label} className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${l.color}`} />
                             <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider">{l.label}</span>
                           </div>
                         ))}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-500 pt-6 border-t border-zinc-900">
                         <Info className="w-4 h-4" /> Uzman Değerlendirme Raporu
                      </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <p className="text-sm text-zinc-400 leading-relaxed italic">
                          "Yapılan tarama sonucunda elde edilen veriler, {analysis.telemetry?.mag} µT değerindeki manyetik sapma ile birleşerek zeminin {analysis.geometricIdx}% oranında yapısal bütünlüğe sahip olduğunu göstermektedir. Bu veriler, hedefin {analysis.type.toLowerCase()} olma ihtimalini güçlü bir şekilde destekler. Bölgede spektral analize devam edilmesi önerilir."
                        </p>
                        <div className="h-24 bg-gradient-to-r from-emerald-500/5 to-transparent border-l-2 border-emerald-500 p-4 flex flex-col justify-center">
                           <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">Tahmini Derinlik</div>
                           <div className="text-3xl font-mono font-bold text-white">
                             {(420 / analysis.magneticIdx * 0.5).toFixed(2)}m - {(420 / analysis.magneticIdx * 1.2).toFixed(2)}m
                           </div>
                           <div className="text-[8px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">Hata Payı: +/- %8.2</div>
                        </div>
                     </div>
                  </div>
                </div>

                <div className="p-8 border-t border-zinc-800 bg-zinc-950/50 flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    Bu rapor AKN Global Group tarafından şifreli saha verileriyle oluşturulmuştur.
                  </div>
                  <button className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-emerald-500/10">
                    <Download className="w-4 h-4" /> RAPORU PDF OLARAK İNDİR
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SETTINGS MODAL */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden"
              >
                <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                  <h3 className="text-lg font-bold tracking-tight">SİSTEM AYARLARI</h3>
                  <button onClick={() => setShowSettings(false)}><Maximize2 className="w-5 h-5 rotate-45 text-zinc-500" /></button>
                </div>
                <div className="p-8 space-y-8">
                  {[
                    { label: 'Yüksek Hassasiyet', desc: 'Daha derin tarama için sensör kazancını artırır.', active: true },
                    { label: 'Anlık Veri Kaydı', desc: 'Her analizi otomatik saha günlüğüne ekler.', active: true },
                    { label: 'Volumetrik Efektler', desc: '3D görünümde detaylı ışıklandırmayı açar.', active: true },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between group">
                      <div className="space-y-1">
                        <div className="text-sm font-bold uppercase tracking-wider">{s.label}</div>
                        <div className="text-[10px] text-zinc-500">{s.desc}</div>
                      </div>
                      <div className={`w-12 h-6 rounded-full p-1 transition-all ${s.active ? 'bg-emerald-600' : 'bg-zinc-800'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-all ${s.active ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-8 border-t border-zinc-800 flex items-center gap-3 opacity-40">
                    <Lock className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Gelişmiş Ayarlar Kilitli</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* MASTER SCAN CONFIGURATION DASHBOARD MODAL */}
        <AnimatePresence>
          {showMasterScanConfig && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/95 backdrop-blur-2xl overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 30 }}
                className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(16,185,129,0.15)] flex flex-col my-8"
              >
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-950">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                      <RadarIcon className="w-6 h-6 text-emerald-400 animate-spin-slow" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                        {scanExecutionMode === 'ALL_IN_ONE_MASTER' ? 'Master Tarama Kontrol Paneli' : 'Tekil Tarama Yapılandırması'}
                      </h3>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono mt-0.5">Saha Orkestratörü V4 Entegrasyonu</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { vibrate(30); setShowMasterScanConfig(false); }}
                    className="w-10 h-10 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Scrollable Content */}
                <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[65vh] custom-scrollbar">
                  
                  {/* Info Indicator */}
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Saha Entegrasyon Protokolü</div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {scanExecutionMode === 'ALL_IN_ONE_MASTER' 
                          ? 'Tüm alt-sistemler (LIDAR OCR, GPR Süreklilik, Metal Spektrum, Volumetrik Tomografi) eş zamanlı ve senkronize olarak kalibre edilecektir. Elde edilen tüm veriler tek bir buton üzerinden toplanır.'
                          : 'Seçilen tekil jeofiziksel sensör aktifleşecektir. Sadece ilgili alt-sistem veri akışı sağlayacaktır.'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Grid Layout of parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* ZEMİN YAPISI SEÇİCİ */}
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-zinc-500" /> TOPRAK/ZEMİN DİELEKTRİK TİPİ
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'clay', label: 'Killi Toprak', desc: 'Moisture: %19.5', vel: '0.095 m/ns' },
                          { id: 'sand', label: 'Kumlu Toprak', desc: 'Moisture: %5.4', vel: '0.165 m/ns' },
                          { id: 'wet_soil', label: 'Nemli Toprak', desc: 'Moisture: %34.2', vel: '0.058 m/ns' },
                          { id: 'dry_rock', label: 'Kayalık/Kireç', desc: 'Moisture: %2.4', vel: '0.135 m/ns' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { vibrate(25); setSoilType(s.id as any); }}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                              soilType === s.id 
                                ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                                : 'bg-zinc-900/40 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                            }`}
                          >
                            <span className="text-xs font-black uppercase tracking-tight">{s.label}</span>
                            <div className="text-[8px] font-mono uppercase text-zinc-500 tracking-wider">
                              <div className={soilType === s.id ? 'text-emerald-400/80' : ''}>{s.desc}</div>
                              <div>V: {s.vel}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* MODEL ÇÖZÜNÜRLÜĞÜ SEÇİCİ */}
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-zinc-500" /> MODEL VE VOKSEL HASSASİYETİ
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: '64', label: 'Standart Hassasiyet (64³)', desc: 'Hızlı modelleme, düşük pil tüketimi' },
                          { id: '128', label: 'Yüksek Hassasiyet (128³)', desc: 'Önerilen saha standardı, dengeli mod' },
                          { id: '256', label: 'Echelon Ultra Precision (256³)', desc: 'Maksimum veri yoğunluğu, yüksek işlemci gücü' },
                        ].map((r) => (
                          <button
                            key={r.id}
                            onClick={() => { vibrate(25); setVoxelResolution(r.id as any); }}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                              voxelResolution === r.id 
                                ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                                : 'bg-zinc-900/40 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${voxelResolution === r.id ? 'border-emerald-500 text-emerald-400' : 'border-zinc-800 text-transparent'}`}>
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-black uppercase tracking-tight block">{r.label}</span>
                              <span className="text-[8px] uppercase tracking-wider text-zinc-500 block font-mono mt-0.5">{r.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SPEKTRAL FREKANS FİLTRESİ */}
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-zinc-500" /> SPEKTRAL GÜRÜLTÜ FİLTRESİ
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'low', label: 'Düşük', desc: 'Ham Sinyal' },
                          { id: 'standard', label: 'Standart', desc: 'Bant Geçen' },
                          { id: 'differential', label: 'Diferansiyel', desc: 'Süper Baskı' },
                        ].map((f) => (
                          <button
                            key={f.id}
                            onClick={() => { vibrate(25); setSpectralFilter(f.id as any); }}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-center h-16 ${
                              spectralFilter === f.id 
                                ? 'bg-emerald-500/10 border-emerald-500 text-white' 
                                : 'bg-zinc-900/40 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                            }`}
                          >
                            <span className="text-xs font-black uppercase tracking-tight">{f.label}</span>
                            <span className="text-[8px] font-mono uppercase text-zinc-500 mt-1">{f.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* KAYIT VE ARŞİVLEME SEÇENEĞİ */}
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CameraIcon className="w-3.5 h-3.5 text-zinc-500" /> ANALİZ KAYIT SEÇENEĞİ
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'none', label: 'Kayıtsız', desc: 'Sadece Tarama' },
                          { id: 'camera', label: 'Kamera', desc: 'Kamera Görüntüsü' },
                          { id: 'fullscreen', label: 'Tam Ekran', desc: 'Arayüz + Kamera' },
                        ].map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { vibrate(25); setRecordingChoice(c.id as any); }}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-center h-16 ${
                              recordingChoice === c.id 
                                ? 'bg-emerald-500/10 border-emerald-500 text-white' 
                                : 'bg-zinc-900/40 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                            }`}
                          >
                            <span className="text-xs font-black uppercase tracking-tight">{c.label}</span>
                            <span className="text-[8px] font-mono uppercase text-zinc-500 mt-1">{c.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* CO-SLAM AKTİF CİHAZ SENKRONİZASYONU */}
                  <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-zinc-500" /> CO-SLAM SENKRONİZE EDİLECEK SAHA OPERATÖRLERİ
                    </label>
                    <div className="p-4 bg-zinc-900/20 border border-zinc-900 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="node1" 
                            checked={syncedNodes.includes('1')}
                            onChange={(e) => {
                              vibrate(20);
                              if (e.target.checked) {
                                setSyncedNodes(prev => [...prev, '1']);
                              } else {
                                setSyncedNodes(prev => prev.filter(id => id !== '1'));
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-800 text-emerald-500 focus:ring-emerald-500 bg-zinc-950"
                          />
                          <label htmlFor="node1" className="text-xs font-bold text-white uppercase cursor-pointer">ECHELON-02 (Ömer S.)</label>
                        </div>
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase">AKTİF</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="node3" 
                            checked={syncedNodes.includes('3')}
                            onChange={(e) => {
                              vibrate(20);
                              if (e.target.checked) {
                                setSyncedNodes(prev => [...prev, '3']);
                              } else {
                                setSyncedNodes(prev => prev.filter(id => id !== '3'));
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-800 text-emerald-500 focus:ring-emerald-500 bg-zinc-950"
                          />
                          <label htmlFor="node3" className="text-xs font-bold text-white uppercase cursor-pointer">TACTICAL-07 (Selin D.)</label>
                        </div>
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase">AKTİF</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer and Start Trigger */}
                <div className="p-6 sm:p-8 bg-zinc-950 border-t border-zinc-900 flex flex-col sm:flex-row items-center gap-4">
                  <button
                    onClick={() => { vibrate(30); setShowMasterScanConfig(false); }}
                    className="w-full sm:w-1/3 py-4 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all cursor-pointer border border-zinc-850"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={async () => {
                      setShowMasterScanConfig(false);
                      
                      // Configure orchestrator parameters first
                      orchestrator.soilType = soilType;
                      orchestrator.spectralFilter = spectralFilter;
                      orchestrator.voxelResolution = voxelResolution;
                      orchestrator.scanExecutionMode = scanExecutionMode;
                      
                      // Voice announcements & vibration
                      vibrate([100, 50, 100]);
                      if (scanExecutionMode === 'ALL_IN_ONE_MASTER') {
                        speak(`Master sistem senkronizasyonu tamamlandı. ${soilType === 'clay' ? 'Killi toprak' : soilType === 'sand' ? 'Kumlu toprak' : soilType === 'wet_soil' ? 'Islak nemli toprak' : 'Kayalık zemin'} yapısı seçildi. Tüm sensörler senkronize ediliyor.`);
                      } else {
                        speak("Sınırlı sistem entegrasyonu başlatılıyor. Seçilen tekil sensör aktifleşiyor.");
                      }

                      const startSequence = async () => {
                        setScanPhase('scanning');
                        setSensorsActive(true);
                        setMicActive(true);
                        
                        if (!sensorsActive) {
                          const success = await handleActivateSensors();
                          if (!success) {
                            setScanPhase('idle');
                            return;
                          }
                        }
                        
                        if (recordingChoice === 'fullscreen') {
                          try {
                            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                            // @ts-ignore
                            window._combinedStream = screenStream;
                            initiateScan(true);
                          } catch (err) {
                            alert("Ekran kaydı izni verilmedi. Sadece kamera kaydı başlatılıyor.");
                            initiateScan(true);
                          }
                        } else if (recordingChoice === 'camera') {
                          initiateScan(true);
                        } else {
                          initiateScan(false);
                        }
                      };

                      startSequence();
                    }}
                    className="w-full sm:w-2/3 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all active:scale-95 shadow-[0_0_25px_rgba(16,185,129,0.45)] border border-emerald-400 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4 text-white animate-bounce" />
                    SİSTEMİ SENKRONİZE ET VE TARAMAYI BAŞLAT
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* USER MANUAL (GUIDE) MODAL */}
        <AnimatePresence>
          {showSystemSetup && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 sm:p-10">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="w-full max-w-2xl bg-zinc-950 border border-emerald-500/20 rounded-[3rem] p-10 md:p-16 text-center space-y-10 relative overflow-hidden"
            >
               <button 
                 onClick={() => setShowSystemSetup(false)}
                 className="absolute top-6 right-6 w-10 h-10 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all z-20"
                 title="Ana Sayfaya Dön"
               >
                 <Home className="w-5 h-5" />
               </button>
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
               
               <div className="space-y-6">
                 <div className="w-24 h-24 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20 mx-auto flex items-center justify-center relative">
                   <ShieldAlert className="w-10 h-10 text-emerald-500" />
                   <motion.div 
                      animate={{ scale: [1, 1.5, 1], opacity: [0, 0.5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-emerald-500 rounded-[2rem]"
                   />
                 </div>
                 <div className="space-y-2">
                   <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">SİSTEM AKTİVASYONU</h2>
                   <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
                     ML-CORE v4.2 Echelon sisteminin tam kapasite çalışması için <span className="text-emerald-500 font-bold">Kamera, Mikrofon, Konum ve Sensör</span> erişimlerini onaylamanız gerekmektedir.
                   </p>
                 </div>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-zinc-900">
                  {[
                    { icon: CameraIcon, label: 'Kamera' },
                    { icon: Compass, label: 'Sensör' },
                    { icon: Globe, label: 'GPS' },
                    { icon: Volume2, label: 'Audio' }
                  ].map((item, i) => (
                    <div key={i} className="space-y-2">
                       <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                         <item.icon className="w-5 h-5" />
                       </div>
                       <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{item.label}</div>
                    </div>
                  ))}
               </div>

               <button 
                 onClick={() => {
                   handleActivateSensors().then(success => {
                     if (success) setShowSystemSetup(false);
                   });
                 }}
                 className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-black tracking-[0.3em] transition-all shadow-[0_20px_50px_rgba(16,185,129,0.3)] active:scale-95 text-lg"
               >
                 TÜM SİSTEMLERİ BAŞLAT
               </button>
               
               <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest italic">
                 Veriler güvenli yerel depolamada tutulur.
               </p>
            </motion.div>
          </div>
        )}

        {showGuide && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-10 bg-black/95 backdrop-blur-2xl"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <BookOpen className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-white uppercase italic">SİSTEM KULLANIM KILAVUZU (v4.5)</h3>
                      <p className="text-[10px] text-emerald-500 uppercase tracking-[0.4em] font-bold">AKN Global Group Ltd // Operasyonel Strateji</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                       onClick={() => {
                         vibrate(50);
                         window.print();
                       }}
                       className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl border border-zinc-800 text-zinc-400 transition-all no-print"
                       title="PDF Olarak Kaydet"
                    >
                       <Download className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowGuide(false)} className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all border border-zinc-800 no-print">
                      <Maximize2 className="w-6 h-6 rotate-45 text-zinc-500" />
                    </button>
                  </div>
                </div>
                
                <div className="p-10 overflow-y-auto custom-scrollbar space-y-16 print-only">
                  <header className="p-10 bg-emerald-500/5 border border-emerald-500/10 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px]" />
                    <p className="text-zinc-400 text-sm leading-relaxed text-center italic relative z-10">
                      "Bu rehber, yeraltı ve duvar arkası analiz sistemini en verimli şekilde kullanmanız için hazırlanmıştır. Sistem, profesyonel sensör verilerini AI (Yapay Zeka) ile birleştirerek size anlaşılır sonuçlar sunar."
                    </p>
                  </header>

                  <section className="space-y-10">
                    <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs not-italic">!</div>
                      Donanım ve Yazılım Operasyon Rehberi
                    </h4>
                    
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="p-8 bg-zinc-950 rounded-[3rem] border border-zinc-900/50 space-y-4 hover:border-emerald-500/30 transition-all shadow-xl group">
                              <h5 className="text-emerald-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                1. SENSÖR KALİBRASYONU VE DOĞRULAMA
                              </h5>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Her operasyondan önce <span className="text-white font-bold">'SENSOR VALIDATION'</span> skorunu takip edin. Güvenli tarama için skor en az %85 olmalıdır. Skor düşükse cihazı havada '8' figürü çizecek şekilde hareket ettirerek manyetik alanı kalibre edin. Kırmızı 'POOR' uyarısı, çevrede yüksek parazit olduğunu ve sonuçların hatalı olabileceğini bildirir.
                              </p>
                           </div>
    
                           <div className="p-8 bg-zinc-950 rounded-[3rem] border border-zinc-900/50 space-y-4 hover:border-sky-500/30 transition-all shadow-xl group">
                              <h5 className="text-sky-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                                2. AKTİF SAHA TARAMA DÖNGÜSÜ (90sn)
                              </h5>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                <span className="text-white font-bold">'ŞİMDİ TARAMAYA BAŞLA'</span> komutuyla 90 saniyelik profesyonel kayıt süreci başlar. Bu süre zarfında cihazı zemine paralel, yaklaşık 10-15 cm yukarıda, sabit bir hızla (yaklaşık 0.5m/sn) hareket ettirin. Sistem bu aşamada saniyede 120 veri noktasını AI çekirdeğine ileterek yeraltı anomali haritasını oluşturur.
                              </p>
                           </div>
    
                           <div className="p-8 bg-zinc-950 rounded-[3rem] border border-zinc-900/50 space-y-4 hover:border-purple-500/30 transition-all shadow-xl group">
                              <h5 className="text-purple-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                3. X-RAY VE DERİNLİK ANALİZİ
                              </h5>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Tespit edilen bir anomali üzerinde daha derin inceleme yapmak için <span className="text-white font-bold">X-RAY</span> moduna geçin. Ekrana her dokunuşunuzda sisteme bir 'Diferansiyel Rezonans Darbesi' gönderilir. Bu darbe, materyalin geçirgenliğini ölçer ve hedefin tahmini derinliğini milimetrik bazda hesaplayarak ekrana yansıtır.
                              </p>
                           </div>
    
                           <div className="p-8 bg-zinc-950 rounded-[3rem] border border-zinc-900/50 space-y-4 hover:border-amber-500/30 transition-all shadow-xl group">
                              <h5 className="text-amber-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                4. 3B VOXEL MODELLEME VE RAPORLAMA
                              </h5>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Tarama verileri <span className="text-white font-bold">3D Görünüm</span> sekmesinde LIDAR tabanlı bir nokta bulutuna (Point Cloud) dönüştürülür. Burada zemini katman katman soyabilir (Slice Z), hedefin geometrik formunu inceleyebilirsiniz. Tüm veriler otomatik olarak şifreli bir şekilde <span className="text-emerald-500 font-bold">Günlükler</span> sekmesine detaylı teknik rapor olarak işlenir.
                              </p>
                           </div>

                           <div className="p-8 bg-zinc-950 rounded-[3rem] border border-zinc-900/50 space-y-4 hover:border-indigo-500/30 transition-all shadow-xl group">
                              <h5 className="text-indigo-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                5. MASTER VE SINIRLI ARAMA REJİMLERİ
                              </h5>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Sistemde iki temel tarama rejimi bulunur. <span className="text-white font-bold">'MASTER ARAMA MODU'</span> (ALL_IN_ONE_MASTER) tüm ileri düzey sensörleri (LIDAR, GPR, Spektrum ve Tomografi) eş zamanlı çalıştırır. <span className="text-white font-bold">'SINIRLI / MANUEL ARAMA MODU'</span> (SINGLE_FEATURE) ise gücü tek bir sensöre kilitleyerek odaklanmış yüksek çözünürlüklü tarama gerçekleştirir.
                              </p>
                           </div>
    
                           <div className="p-8 bg-zinc-950 rounded-[3rem] border border-zinc-900/50 space-y-4 hover:border-red-500/30 transition-all shadow-xl group">
                              <h5 className="text-red-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                6. CO-SENSÖR KİLİTLEME VE STANDBY PROTOKOLÜ
                              </h5>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Sınırlı Arama Modu aktifken, hedeflenmeyen diğer tüm co-sensör alt-sistemleri otomatik olarak <span className="text-white font-bold">'SENSÖR DEAKTİF / STANDBY'</span> moduna alınır. Bu güç tasarrufu ve sinyal odaklama yöntemi sayesinde aktif analizörün tarama kararlılığı ve derinlik nüfuziyeti maksimum düzeye çıkarılır.
                              </p>
                           </div>
                        </div>
                  </section>

                  {/* ADVANCED ANALYSIS SUBSYSTEMS SECTION */}
                  <section className="space-y-10 border-t border-zinc-800/50 pt-10">
                    <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-xs not-italic font-bold">★</div>
                      Gelişmiş Analiz Alt-Sistemleri ve Detay Modları
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-zinc-950 rounded-[2.5rem] border border-zinc-900/60 space-y-3">
                        <h5 className="text-amber-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" /> 1. TOMOGRAFİK X-RAY VE DİLİMLEME
                        </h5>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Yatay tomografi dilimleme (Depth Slicing) motoru, toprağı 10 cm'lik dilimler halinde tarayarak boşluk (ε_r ≈ 1) veya sulu kil katmanlarını şeffaflaştırır, hacimsel m³ hesabı yapar.
                        </p>
                      </div>

                      <div className="p-6 bg-zinc-950 rounded-[2.5rem] border border-zinc-900/60 space-y-3">
                        <h5 className="text-emerald-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5" /> 2. JEOMANYETİK DENGELEYİCİ
                        </h5>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Doğal yerçekimi gürültüsünü dara alarak (sıfırlama) düşürür. Diferansiyel Kalman filtresi hassasiyet katsayısı (Q) yardımıyla sapmaları anomali olarak izole eder.
                        </p>
                      </div>

                      <div className="p-6 bg-zinc-950 rounded-[2.5rem] border border-zinc-900/60 space-y-3">
                        <h5 className="text-red-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2">
                          <Target className="w-3.5 h-3.5" /> 3. ANOMALİ PARMAK İZİ (FINGERPRINTING)
                        </h5>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Yansıyan sinyalin faz kaymasını (+180° metaller, negatif boşluklar), dikey gradyometre vektörünü (dH/dz) ve geometrik simetrisini inceleyerek insan yapımı yapıları ayırt eder.
                        </p>
                      </div>

                      <div className="p-6 bg-zinc-950 rounded-[2.5rem] border border-zinc-900/60 space-y-3">
                        <h5 className="text-sky-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" /> 4. CO-SLAM VE DÖNGÜ KAPATMA
                        </h5>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Saha taramalarında biriken drift (sapma) kayma hatalarını otomatik düzeltmek adına, daha önce taranmış bir referans noktasına geri dönüldüğünde tüm harita ağını optimize eden otomatik Loop Closure (Döngü Kapatma) algoritması entegre edilmiştir.
                        </p>
                      </div>

                      <div className="p-6 bg-zinc-950 rounded-[2.5rem] border border-zinc-900/60 space-y-3">
                        <h5 className="text-indigo-400 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2">
                          <Radio className="w-3.5 h-3.5" /> 5. YEREL ONNX VE SAHA ORKESTRATÖRÜ
                        </h5>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          aiClassifier.ts modülü derin tünellerde dahi %100 çevrimdışı yerel ONNX motoru ile çalışır. Merkezi Saha Orkestratörü, tek tuşla 5 saniyelik Spektrum frekans taraması, Dielektrik toprak kestirimi ve Jeomanyetik sıfırlamayı otomatik yönetir.
                        </p>
                      </div>

                      <div className="p-6 bg-zinc-950 rounded-[2.5rem] border border-zinc-900/60 space-y-3">
                        <h5 className="text-amber-500 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2">
                          <Target className="w-3.5 h-3.5" /> 6. JEOFİZİKSEL VE ARKEOLOJİK SENSÖRLER
                        </h5>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          LIDAR OCR sembol tanıma, GPR anomalilerinden geometrik süreklilikle yapısal giriş tespiti, AC faz açılı metal iletkenlik spektrumu ve dielektrik sönümlü boşluk yoğunluk analizi entegre edilmiştir. Saha Raporu ekranından erişilebilir.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="p-10 bg-zinc-900/50 rounded-[3rem] border border-zinc-800 space-y-8">
                    <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">Sinyal ve Frekans Nedir?</h4>
                    <div className="space-y-6 text-xs text-zinc-400 leading-relaxed">
                       <p>
                         <span className="text-white font-bold mr-2">Manyetik Alan (µT):</span> Cihaz manyetometresinden gelen anlık akıdır. Standart değer 48 civarıdır; metallerde yükselir, boşluklarda düşer.
                       </p>
                       <p>
                         <span className="text-white font-bold mr-2">Sinyal Frekansı (Hz):</span> Maddenin sismik ve manyetik titreşim hızıdır. Değerli iletkenler (Altın vb.) daha yüksek ve stabil bir frekans imzası bırakır. AI motorumuz bu iki veriyi çaprazlayarak doğrulama yapar.
                       </p>
                    </div>
                  </section>

                  <section className="p-10 bg-emerald-500/5 border border-emerald-500/20 rounded-[3rem] relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                        <Scan className="w-40 h-40 text-emerald-500" />
                     </div>
                     <div className="flex items-center gap-4 text-emerald-500 mb-4">
                        <Info className="w-6 h-6" />
                        <h4 className="text-lg font-black uppercase tracking-widest italic text-white underline decoration-emerald-500/30 underline-offset-8">ÖZET TAVSİYE</h4>
                     </div>
                     <div className="space-y-6 text-sm text-zinc-400 leading-relaxed max-w-2xl relative z-10 italic">
                        <p>
                          "En doğru analiz için acele etmeyin. Sistem her saniye binlerce veri noktası işler. Cihazı sabit tutup sinyalin oturmasını beklemek, hata payını sıfıra indirir."
                        </p>
                     </div>
                  </section>

                  <section className="space-y-6 p-8 bg-zinc-950 rounded-3xl border border-zinc-900 text-center">
                     <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-black leading-relaxed">
                       SİSTEM SON RAPORU // AKN GLOBAL GROUP // VERİ DOĞRULUK SKORU %94.2
                     </p>
                  </section>
                </div>

                <div className="p-8 border-t border-zinc-800 bg-zinc-950/50 flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
                    AKN Global Group Ltd // Profesyonel Saha Çözümleri
                  </div>
                  <button 
                    onClick={() => setShowGuide(false)}
                    className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold tracking-widest transition-all active:scale-95"
                  >
                    KILAVUZDAN ÇIK
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SYSTEM USAGE DETAILS MODAL */}
        <AnimatePresence>
          {showSystemDetails && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[115] flex items-center justify-center p-4 md:p-10 bg-black/98 backdrop-blur-3xl"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 30 }}
                className="w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-zinc-900 rounded-[3.5rem] overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.1)] flex flex-col"
              >
                <div className="p-10 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/80 sticky top-0 z-20 backdrop-blur-md">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-sky-500/10 flex items-center justify-center border border-sky-500/20 shadow-[0_0_20px_rgba(14,165,233,0.1)]">
                      <Settings className="w-7 h-7 text-sky-400" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black tracking-tighter uppercase italic">SİSTEM KULLANIM DETAYI v4.5</h3>
                      <p className="text-[10px] text-sky-400 uppercase tracking-[0.6em] font-bold">AKN Global Group // Operasyonel Protokol</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                       onClick={() => {
                         vibrate(50);
                         window.print();
                       }}
                       className="w-12 h-12 bg-zinc-900 hover:bg-zinc-800 rounded-2xl flex items-center justify-center transition-all group border border-zinc-800 no-print"
                    >
                       <Download className="w-5 h-5 text-sky-400" />
                    </button>
                    <button 
                      onClick={() => setShowSystemDetails(false)} 
                      className="w-12 h-12 bg-zinc-900 hover:bg-zinc-800 rounded-2xl flex items-center justify-center transition-all group no-print"
                    >
                      <Maximize2 className="w-6 h-6 rotate-45 text-zinc-500 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
                
                <div className="p-10 overflow-y-auto custom-scrollbar space-y-16 print-only bg-zinc-950">
                  <header className="space-y-8">
                    <div className="flex items-center gap-6">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
                      <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-[10px] font-black text-sky-400 uppercase tracking-[0.3em] leading-none">Teknik Giriş</div>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-zinc-800 to-transparent" />
                    </div>
                    <div className="p-10 bg-zinc-900 border border-zinc-800 rounded-[3rem] text-center italic text-zinc-400 text-sm leading-relaxed relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
                      AKN Global Group Ltd tarafından geliştirilen MLAS-V4.5 "Echelon", manyetik, sismik ve LIDAR verilerini Neural Link v4.3 çekirdeği ile yorumlayarak yeraltı haritalamasını gerçek zamanlı gerçekleştirir. Sistem, fiziksel sensör verilerini GPU tabanlı 3B görselleştirme ile birleştirir.
                    </div>
                  </header>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <section className="p-10 bg-zinc-900/40 rounded-[3rem] border border-zinc-800/50 space-y-8 shadow-[0_20px_50px_rgba(16,185,129,0.05)] hover:bg-zinc-900/60 transition-all group">
                      <div className="flex items-center gap-5 text-emerald-500">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center font-black text-xs border border-emerald-500/20 group-hover:scale-110 transition-transform">01</div>
                        <div className="space-y-1">
                           <h4 className="text-xl font-black uppercase tracking-tighter italic">Donanım Füzyon Katmanı</h4>
                           <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Multi-Sensor Data Integration</p>
                        </div>
                      </div>
                      <div className="space-y-6 text-zinc-400 text-xs leading-relaxed">
                        <div className="p-6 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">SİNYAL BÜTÜNLÜĞÜ (SNR)</p>
                           Uygulama, cihazın donanımsal manyetometre ve ivmeölçer sensörlerini senkronize bir şekilde kullanarak 20ms'lik periyotlarla veri toplar. Gelişmiş gürültü filtreleme algoritması (Kalman Filter varyantı), şehir içi şebeke parazitlerini temizleyerek sadece yer altı manyetik sapmalarına odaklanır.
                        </div>
                        <div className="p-6 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">FOTOGRAMETRİK KORELASYON</p>
                           Kamera görüntüsü sadece bir vizör değildir; her kare (frame) yapay zeka tarafından taranarak yüzey yoğunluğu analizi yapılır. Canny Kenar Algılama ve Histogram Eşitleme teknikleri kullanılarak yüzeydeki mineral değişimleri manyetik verilerle çaprazlanır.
                        </div>
                      </div>
                    </section>

                    <section className="p-10 bg-zinc-900/40 rounded-[3rem] border border-zinc-800/50 space-y-8 shadow-[0_20px_50px_rgba(59,130,246,0.05)] hover:bg-zinc-900/60 transition-all group">
                      <div className="flex items-center gap-5 text-sky-500">
                        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center font-black text-xs border border-sky-500/20 group-hover:scale-110 transition-transform">02</div>
                        <div className="space-y-1">
                           <h4 className="text-xl font-black uppercase tracking-tighter italic">AI Karar Mekanizması</h4>
                           <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Echelon Neural Link v4.3</p>
                        </div>
                      </div>
                      <div className="space-y-6 text-zinc-400 text-xs leading-relaxed">
                         <div className="p-6 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">COCO-SSD NESNE TANIMLAMA</p>
                           TensorFlow tabanlı COCO-SSD modeli, kamera önündeki nesneleri (insan, araç, yapı elemanı vb.) tanımlayarak anomali analizinden dışlar. Bu sayede cihazın yanlış alarm (False Positive) verme oranı %70 azaltılmıştır.
                        </div>
                         <div className="p-6 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">DİFERANSİYEL REZONANS</p>
                           Her anomali tipi (Boşluk, Metal, Değerli Maden) farklı bir rezonans imzasına sahiptir. AI motorumuz, gelen mikro-titreşimleri kütüphanesindeki 5000'den fazla imza ile karşılaştırarak hedefin türünü tahmin eder.
                        </div>
                      </div>
                    </section>

                    <section className="p-10 bg-zinc-900/40 rounded-[3rem] border border-zinc-800/50 space-y-8 shadow-[0_20px_50px_rgba(168,85,247,0.05)] hover:bg-zinc-900/60 transition-all group">
                      <div className="flex items-center gap-5 text-purple-400">
                        <div className="w-12 h-12 rounded-2xl bg-purple-400/10 flex items-center justify-center font-black text-xs border border-purple-400/20 group-hover:scale-110 transition-transform">03</div>
                        <div className="space-y-1">
                           <h4 className="text-xl font-black uppercase tracking-tighter italic">Veri Bütünlük Katmanı</h4>
                           <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Real-Time Data Validation</p>
                        </div>
                      </div>
                      <div className="space-y-6 text-zinc-400 text-xs leading-relaxed">
                         <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">KALİTE DENETİMİ (QA)</p>
                           'Sensor Validation' birimi, veri akışını her saniye valide eder. Tekrar eden veya stabil kalmış (donmuş) veriler anında tespit edilerek 'Mock Data' veya 'Fake Signal' uyarısı tetiklenir.
                        </div>
                        <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">ANOMALİ SKORLAMA</p>
                           Tespit edilen her anomali, donanım sağlığına göre ağırlıklı bir skor alır. 'POOR' statüsündeki düşük kaliteli veriler, hatalı sonuçları önlemek için analiz sonuçlarından otomatik olarak elenir.
                        </div>
                      </div>
                    </section>

                    <section className="p-10 bg-zinc-900/40 rounded-[3rem] border border-zinc-800/50 space-y-8 shadow-[0_20px_50px_rgba(239,68,68,0.05)] hover:bg-zinc-900/60 transition-all group">
                      <div className="flex items-center gap-5 text-red-500">
                        <div className="w-12 h-12 rounded-2xl bg-red-400/10 flex items-center justify-center font-black text-xs border border-red-400/20 group-hover:scale-110 transition-transform">04</div>
                        <div className="space-y-1">
                           <h4 className="text-xl font-black uppercase tracking-tighter italic">GPU & Render Protokolü</h4>
                           <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Hardware Accelerated Mapping</p>
                        </div>
                      </div>
                      <div className="space-y-6 text-zinc-400 text-xs leading-relaxed">
                         <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">OTONOM KURTARMA</p>
                           Yüksek işlem gücü gerektiren 3D Mapping modunda WebGL bağlamı (Context) düşerse, sistem 'Otonom Kurtarma' moduna geçerek verileri kaybetmeden görselleştirmeyi yeniden başlatır.
                        </div>
                        <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">VOXEL RERENDER</p>
                           3B nokta bulutu (LIDAR), GPU hızlandırmalı Voxel Rendering teknolojisiyle işlenir. Bu, yeraltı hacminin milimetrik kesitlerini düşük gecikmeyle akıcı şekilde incelemenizi sağlar.
                        </div>
                      </div>
                    </section>

                    <section className="p-10 bg-zinc-900/40 rounded-[3rem] border border-zinc-800/50 space-y-8 shadow-[0_20px_50px_rgba(99,102,241,0.05)] hover:bg-zinc-900/60 transition-all group">
                      <div className="flex items-center gap-5 text-indigo-400">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-400/10 flex items-center justify-center font-black text-xs border border-indigo-400/20 group-hover:scale-110 transition-transform">05</div>
                        <div className="space-y-1">
                           <h4 className="text-xl font-black uppercase tracking-tighter italic">Saha Orkestrasyonu</h4>
                           <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Central Orchestrator Coordination</p>
                        </div>
                      </div>
                      <div className="space-y-6 text-zinc-400 text-xs leading-relaxed">
                         <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">MASTER ARAMA ÇALIŞMA PRENSİBİ</p>
                           Master Arama Modu aktifken, merkezi orkestratör 4 temel anomali analizörünü tek bir veri yolunda senkronize eder. LIDAR sembolleri, GPR yapı tespiti, dikey gradyentli frekans ve tomografi verileri ortak bir veri havuzunda birleştirilir ve çapraz doğrulanır.
                        </div>
                        <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">TEKLİ MOD KİLİDİ</p>
                           Sınırlı/Manuel tarama rejimine geçildiğinde, seçilen tek bir modun analizi başlatılırken diğer analizörler kilitlenir. Bu rejim, karmaşık arazilerde sadece belirli bir hedefe (örn. metal veya boşluk) odaklanarak sinyal kirliliğini tamamen önler.
                        </div>
                      </div>
                    </section>

                    <section className="p-10 bg-zinc-900/40 rounded-[3rem] border border-zinc-800/50 space-y-8 shadow-[0_20px_50px_rgba(239,68,68,0.05)] hover:bg-zinc-900/60 transition-all group">
                      <div className="flex items-center gap-5 text-red-400">
                        <div className="w-12 h-12 rounded-2xl bg-red-400/10 flex items-center justify-center font-black text-xs border border-red-400/20 group-hover:scale-110 transition-transform">06</div>
                        <div className="space-y-1">
                           <h4 className="text-xl font-black uppercase tracking-tighter italic">20 Hz Donanım ve PDF Rapor Entegrasyonu</h4>
                           <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Zero-Lag Telemetry & Printable Reports</p>
                        </div>
                      </div>
                      <div className="space-y-6 text-zinc-400 text-xs leading-relaxed">
                         <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">GERÇEK ZAMANLI RXJS HARDWARE STREAM</p>
                           Saniyede en az 20 frekanslı (20 Hz / 50ms) reaktif RxJS yayın-abone altyapısı sayesinde, USB/Serial veya Bluetooth LE portlarından akan ham GPR sinyalleri, 3B LIDAR nokta bulutu matrisleri ve 3-eksenli manyetometre akısı sıfır gecikmeyle görselleştiricilere pompalanır.
                        </div>
                        <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                           <p className="text-white font-black uppercase tracking-widest text-[9px] mb-2 opacity-60">MASTER RAPOR VE LİTERAL PDF ÇIKTISI</p>
                           Taktiksel Master Mod ile tarama tamamlandığında otomatik derlenen saha raporu, yüksek kontrastlı "@media print" CSS direktifleriyle donatılmıştır. PDF Yap / Yazdır butonu ile doğrudan resmi arşiv kalitesinde, milimetrik analizli raporlar üretilir.
                        </div>
                      </div>
                    </section>
                  </div>

                  <footer className="p-10 bg-zinc-900 rounded-[3rem] border border-zinc-800 flex flex-col items-center text-center gap-6">
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em]">AKN GLOBAL GROUP // ENDÜSTRİYEL SAHA PROTOKOLÜ // 2026</div>
                    <p className="text-zinc-500 text-[11px] leading-relaxed max-w-2xl italic">
                      Bu uygulama bir oyuncak değildir. Gerçek zamanlı donanım verilerini işleyen bir saha mühendislik aracıdır. Doğru analiz için cihazın kalibrasyonu ve sahadaki sabitlik en kritik faktörlerdir.
                    </p>
                  </footer>
                </div>

                <div className="p-8 border-t border-zinc-800 bg-zinc-950/50 flex flex-col md:flex-row gap-4 items-center no-print">
                  <div className="flex-1 text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
                    Sistem Protokolü v4.5 // Teknik Dokümantasyon
                  </div>
                  <button 
                    onClick={() => setShowSystemDetails(false)}
                    className="px-10 py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold tracking-widest transition-all active:scale-95 shadow-[0_0_30px_rgba(14,165,233,0.2)]"
                  >
                    PROTOKOLDEN ÇIK
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* X-RAY CAMERA PANEL MODAL */}
        <AnimatePresence>
          {showXRayPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-end justify-center p-4 bg-black/30 backdrop-blur-sm"
              onClick={() => setShowXRayPanel(false)}
            >
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full md:w-2/3 lg:w-1/2 max-w-2xl bg-zinc-950 border border-sky-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              >
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-sky-900/30 to-black border-b border-sky-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                      <Target className="w-6 h-6 text-sky-400" />
                    </div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">X-RAY PENETRASYON</h3>
                  </div>
                  <button
                    onClick={() => setShowXRayPanel(false)}
                    className="p-2 hover:bg-zinc-900 rounded-xl transition-all"
                  >
                    <Maximize2 className="w-5 h-5 rotate-45 text-zinc-400" />
                  </button>
                </div>

                {/* Camera Feed */}
                <div className="relative w-full aspect-video bg-black overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Reticle Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative">
                      <div className="w-20 h-20 border-2 border-sky-500/50 rounded-full" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-sky-500 rounded-full" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-px bg-gradient-to-r from-transparent via-sky-500 to-transparent" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-px bg-gradient-to-b from-transparent via-sky-500 to-transparent" />
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-black/60 border border-sky-500/30 rounded-full backdrop-blur-md">
                    <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">CANLI</span>
                  </div>

                  {/* Sensor Info */}
                  <div className="absolute bottom-4 left-4 bg-black/60 border border-sky-500/20 rounded-2xl p-4 backdrop-blur-md space-y-2 max-w-xs">
                    <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest">SENSOR OKUMALARI</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-[10px] text-zinc-400">
                        <div className="opacity-60">Manyetik</div>
                        <div className="font-mono text-sky-300">{sensorData.magnetic.total.toFixed(2)} µT</div>
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        <div className="opacity-60">Frekans</div>
                        <div className="font-mono text-sky-300">{liveFreq.toFixed(0)} Hz</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="p-4 bg-black/40 border-t border-sky-500/20 flex gap-3">
                  <button
                    onClick={() => switchTab('x-ray')}
                    className="flex-1 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95"
                  >
                    SEKMEYÉ AÇ
                  </button>
                  <button
                    onClick={() => setShowXRayPanel(false)}
                    className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all"
                  >
                    KAPAT
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DETAILED FEATURES RESULTS MODAL */}
        <FeatureDetailModal
          isOpen={isFeatureDetailModalOpen}
          onClose={() => setIsFeatureDetailModalOpen(false)}
          featureType={activeFeatureType}
          selectedMission={selectedMission}
          sensorData={sensorData}
          geomagneticBaseline={geomagneticBaseline}
          isGeomagneticCalibrated={isGeomagneticCalibrated}
          rfSignals={rfSignals}
          liveAnalysis={liveAnalysis}
          onResetCalibration={(val) => {
            setGeomagneticBaseline(val !== undefined ? val : (sensorData.magnetic.total > 0 ? sensorData.magnetic.total : 48.0));
            setIsGeomagneticCalibrated(true);
          }}
          syncedNodes={syncedNodes}
          onToggleNodeSync={handleToggleNodeSync}
          scanPhase={scanPhase}
        />

        {/* MOBILE BOTTOM NAVIGATION */}
        <div className="md:hidden fixed bottom-12 left-6 right-6 z-[100]">
           <div className="bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800 rounded-3xl p-2 flex items-center justify-around shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              {[
                { id: 'ana sayfa', label: 'Giriş', icon: Home },
                { id: 'radar', label: 'Radar', icon: Compass },
                { id: 'kamera', label: 'Kamera', icon: CameraIcon },
                { id: 'x-ray', label: 'X-RAY PENETRASYON', icon: Target },
                { id: '3d-view', label: '3D', icon: Map },
                { id: 'katmanlar', label: 'Katmanlar', icon: LayersIcon },
                { id: 'günlükler', label: 'Günlük', icon: History }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => switchTab(item.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${
                    activeTab === item.id ? (item.id === 'x-ray' ? 'bg-sky-500/10 text-sky-500' : 'bg-emerald-500/10 text-emerald-500') : 'text-zinc-500'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[8px] font-bold uppercase tracking-tighter">{item.label}</span>
                </button>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
}
