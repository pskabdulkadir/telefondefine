import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Compass, Shield, ShieldAlert, Globe, RefreshCw, 
  Target, Lock, Unlock, Users, Wifi, AlertTriangle, 
  CloudLightning, Cpu, Sliders, Layers, Play, StopCircle, 
  Activity, Radio, Check, Server, Eye, Network, Zap,
  EyeOff, MapPin, Database, Binary, BarChart2, TrendingUp, Info
} from 'lucide-react';
import { getModelMetadata } from '../lib/aiClassifier';

export type FeatureType = 'mission' | 'calibration' | 'target' | 'coslam' | 'rf';

interface FeatureDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureType: FeatureType;
  selectedMission: string;
  sensorData: any;
  geomagneticBaseline: number;
  isGeomagneticCalibrated: boolean;
  rfSignals: Array<{ ssid: string; rssi: number; type: 'WiFi' | 'BLE' }>;
  liveAnalysis: any;
  onResetCalibration: (val?: number) => void;
  syncedNodes: string[];
  onToggleNodeSync: (id: string) => void;
  scanPhase: 'idle' | 'calibration' | 'scanning' | 'analyzing' | 'results';
}

export const FeatureDetailModal: React.FC<FeatureDetailModalProps> = ({
  isOpen,
  onClose,
  featureType,
  selectedMission,
  sensorData,
  geomagneticBaseline,
  isGeomagneticCalibrated,
  rfSignals,
  liveAnalysis,
  onResetCalibration,
  syncedNodes,
  onToggleNodeSync,
  scanPhase
}) => {
  const [activeTab, setActiveTab] = useState<FeatureType>(featureType);

  // Sync tab with clicked feature initially
  useEffect(() => {
    setActiveTab(featureType);
  }, [featureType, isOpen]);

  // Prevent background scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="bg-zinc-950 border border-zinc-900 rounded-[32px] w-full max-w-6xl h-[85vh] md:h-[82vh] flex flex-col overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.8)] relative z-10"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-zinc-900/60 bg-zinc-950 flex justify-between items-center shrink-0">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-md font-black tracking-[0.15em] text-white uppercase font-sans">
                  SİSTEM DETAYLI ÇÖZÜMLEME HUD
                </h2>
              </div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 font-mono">
                Alt-Sistem Sensör Telemetrisi ve Alan Filtrelemesi // MLAS-V4-ECHELON
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-2xl border border-zinc-800/80 transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selection Row */}
          <div className="px-8 py-3 bg-zinc-950 border-b border-zinc-900/50 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'mission', label: 'X-Ray ve Boşluk Analizi', icon: Layers, color: 'text-amber-400' },
              { id: 'calibration', label: 'Jeomanyetik Kalibrasyon', icon: Globe, color: 'text-emerald-400' },
              { id: 'target', label: 'Metal Kimliklendirme', icon: Target, color: 'text-red-400' },
              { id: 'coslam', label: 'Co-SLAM & Hough Planı', icon: Users, color: 'text-sky-400' },
              { id: 'rf', label: 'RF & GPR Entegrasyonu', icon: Radio, color: 'text-indigo-400' }
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as FeatureType)}
                  className={`px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 active:scale-95 ${
                    isActive 
                      ? 'bg-zinc-900 border-zinc-800 text-white shadow-inner' 
                      : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <TabIcon className={`w-4 h-4 ${isActive ? tab.color : 'text-zinc-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-8 bg-zinc-950/60">
            <AnimatePresence mode="wait">
              {activeTab === 'mission' && (
                <motion.div
                  key="mission"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <MissionDetailTab 
                    selectedMission={selectedMission} 
                    sensorData={sensorData}
                  />
                </motion.div>
              )}

              {activeTab === 'calibration' && (
                <motion.div
                  key="calibration"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <CalibrationDetailTab 
                    geomagneticBaseline={geomagneticBaseline}
                    isGeomagneticCalibrated={isGeomagneticCalibrated}
                    sensorData={sensorData}
                    onResetCalibration={onResetCalibration}
                  />
                </motion.div>
              )}

              {activeTab === 'target' && (
                <motion.div
                  key="target"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <TargetDetailTab 
                    sensorData={sensorData}
                    liveAnalysis={liveAnalysis}
                  />
                </motion.div>
              )}

              {activeTab === 'coslam' && (
                <motion.div
                  key="coslam"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <CoSlamDetailTab 
                    syncedNodes={syncedNodes}
                    onToggleNodeSync={onToggleNodeSync}
                    scanPhase={scanPhase}
                  />
                </motion.div>
              )}

              {activeTab === 'rf' && (
                <motion.div
                  key="rf"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <RFDetailTab 
                    rfSignals={rfSignals}
                    scanPhase={scanPhase}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Status Panel */}
          <div className="px-8 py-4 bg-zinc-950 border-t border-zinc-900/60 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 text-[9px] font-mono tracking-wider text-zinc-500 uppercase">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                DONGU: CANLI SENSOR AKISI
              </span>
              <span>|</span>
              <span>MAG: {sensorData.magnetic.total.toFixed(2)} µT</span>
              <span>|</span>
              <span>YEL: {sensorData.orientation.alpha?.toFixed(0) || '0'}°</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded">
                SUREC: {scanPhase.toUpperCase()}
              </span>
              <span className="text-[10px] text-zinc-600">MLAS V4 SECURITY SHELL</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


/* ==========================================
   1. MISSION DETAIL - TOMOGRAPHIC X-RAY & DEPTH SLICING
   ========================================== */
interface MissionDetailTabProps {
  selectedMission: string;
  sensorData: any;
}

const MissionDetailTab: React.FC<MissionDetailTabProps> = ({ selectedMission, sensorData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [depthSlice, setDepthSlice] = useState<number>(3.5); // Target slice depth (0.0m - 10.0m)
  const [isosurface, setIsosurface] = useState<'all' | 'cavity' | 'metal' | 'clay'>('all');
  const [showEdgeAI, setShowEdgeAI] = useState<boolean>(true);
  
  const modelMetadata = getModelMetadata();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // DRAW SLICE GRAPHICS (TOMOGRAPHY VIEW - HORIZONTAL CROSS SECTION)
    // Draw background radar sweep representation
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, w, h);

    // Draw scanning grid lines
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.05)';
    ctx.lineWidth = 1;
    const size = 25;
    for (let x = 0; x < w; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Dynamic color maps depending on the slider (different cross sections appear as depth changes!)
    // 0.0m - 1.5m: Surface clutter, soil moisture, high metal probability
    // 1.5m - 5.0m: Cavity anomaly, ancient tomb structures, masonry outlines
    // 5.0m - 10.0m: Solid bedrock, deep faults, minor water table echoes

    // Draw scale ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 80, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = 'rgba(161, 161, 170, 0.3)';
    ctx.font = '8px monospace';
    ctx.fillText('RADYAL KALİBRASYON HALKASI (R=12m)', w / 2 - 75, h / 2 - 85);

    // Render features dynamically based on selection and depth
    if (depthSlice < 2.0) {
      // Surface layers
      if (isosurface === 'all' || isosurface === 'metal') {
        // Draw metal targets
        ctx.fillStyle = 'rgba(239, 68, 68, 0.7)'; // Red hot metal voxel
        ctx.beginPath();
        ctx.arc(w * 0.4, h * 0.35, 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.fillText('DEMİR BORU / YÜZEY ANOMALİSİ (Z=1.1m)', w * 0.4 + 16, h * 0.35 + 3);
      }

      if (isosurface === 'all' || isosurface === 'clay') {
        // Clay soil density noise
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.fillRect(w * 0.1, h * 0.6, 120, 60);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.strokeRect(w * 0.1, h * 0.6, 120, 60);
        ctx.fillStyle = '#10b981';
        ctx.fillText('NEMLİ KİL CEBİ (Z=0.8m)', w * 0.1 + 5, h * 0.6 + 12);
      }
    } else if (depthSlice >= 2.0 && depthSlice <= 5.5) {
      // Mid-depth anomalies (Optimal Archaeology Scan Depth)
      if (isosurface === 'all' || isosurface === 'cavity') {
        // Draw main cavity (tomb chamber / corridor)
        ctx.fillStyle = 'rgba(168, 85, 247, 0.25)'; // Purple empty space voxels
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, 75, 45, Math.PI / 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#a855f7';
        ctx.fillText('AÇIK BOŞLUK (MABED / MEZAR ODASI)', w / 2 - 70, h / 2 - 3);
        ctx.fillText('Tahmini Yükseklik: 1.8m // Z=3.1m - 4.9m', w / 2 - 70, h / 2 + 10);
      }

      if (isosurface === 'all' || isosurface === 'metal') {
        // Draw target inside cavity
        ctx.fillStyle = 'rgba(245, 158, 11, 0.8)'; // Golden target
        ctx.beginPath();
        ctx.arc(w / 2 + 15, h / 2 + 10, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.fillText('YÜKSEK İLETKEN METAL SİNYALİ (GOLD INDEX: %89)', w / 2 + 28, h / 2 + 13);
      }
    } else {
      // Deep ground (5.5m - 10.0m)
      if (isosurface === 'all' || isosurface === 'cavity') {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
        ctx.beginPath();
        ctx.arc(w * 0.75, h * 0.7, 30, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#a855f7';
        ctx.stroke();
        ctx.fillStyle = '#a855f7';
        ctx.fillText('KAYALIK MAĞARA TABANI (Z=7.4m)', w * 0.75 - 60, h * 0.7 - 35);
      }

      // Draw solid bedrock indicator
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(w * 0.1, h * 0.1, 150, 80);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillText('ANAKAYA KESİTİ (Z=8.0m+)', w * 0.1 + 10, h * 0.1 + 15);
    }

    // Drawing sweep index line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.9);
    ctx.lineTo(w * 0.95, h * 0.9);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('CO-SLAM RADYOMETRİK TARAMA EKSENİ', w * 0.05, h * 0.87);

  }, [depthSlice, isosurface]);

  // Compute live estimated volume based on active sliders
  const calculateVolume = () => {
    if (isosurface === 'metal') {
      return (0.35 + (depthSlice % 2) * 0.12).toFixed(2);
    } else if (isosurface === 'cavity') {
      return (14.2 - (depthSlice * 0.8)).toFixed(1);
    } else if (isosurface === 'clay') {
      return (8.4 + (depthSlice * 0.5)).toFixed(1);
    }
    return (18.6 - (depthSlice * 0.9)).toFixed(1);
  };

  const currentVolume = calculateVolume();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left info & controls */}
      <div className="lg:col-span-5 space-y-6">
        <div className="space-y-2">
          <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[8px] font-black uppercase tracking-widest w-fit">
            TOMOGRAFİK X-RAY TARAMA MOTORU
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight font-sans leading-none">
            HACİM VE BOŞLUK ANALİZİ
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed pt-2">
            Mevcut voksel (3D piksel) altyapısı sayesinde toprağı katman katman soyabilir, dielektrik ve manyetik filtreler yardımıyla katı taşı şeffaflaştırarak altındaki oda ve tünelleri inceleyebilirsiniz.
          </p>
        </div>

        {/* Depth Slicing Slider Widget */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
            <span>DİNAMİK DİLİMLEME (DEPTH SLICING)</span>
            <span className="text-amber-500 font-mono">AKTİF: {depthSlice.toFixed(2)}m</span>
          </div>

          <div className="space-y-1.5">
            <input 
              type="range" 
              min="0.1" 
              max="10.0" 
              step="0.1" 
              value={depthSlice}
              onChange={(e) => setDepthSlice(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-zinc-950 rounded-full cursor-pointer"
            />
            <div className="flex justify-between text-[8px] text-zinc-500 font-mono uppercase">
              <span>0.1m (YÜZEYSEL)</span>
              <span>5.0m (ORTA DERİNLİK)</span>
              <span>10.0m (DERİN JEOLOJİK)</span>
            </div>
          </div>
        </div>

        {/* Isosurface Filtering Selection */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-3">
          <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">İZOYÜZEY (ISOSURFACE) MASKESİ</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'all', label: 'Tüm Katmanlar', desc: 'GPR + Mag' },
              { id: 'cavity', label: 'Yalnız Boşluklar', desc: 'Oda, Tünel (ε_r ≈ 1)' },
              { id: 'metal', label: 'Değerli Metaller', desc: 'Yüksek İletken' },
              { id: 'clay', label: 'Islak Çökeltiler', desc: 'Su / Kil Cebleri' }
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setIsosurface(opt.id as any)}
                className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${
                  isosurface === opt.id 
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' 
                    : 'bg-zinc-950/60 border-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-[10px] font-bold uppercase">{opt.label}</div>
                <div className="text-[8px] text-zinc-600 font-mono uppercase mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Volume Calculation Engine */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-2.5">
          <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">DİNAMİK HACİM HESAPLAMA MOTORU</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950/60 border border-zinc-900 p-3 rounded-xl">
              <span className="text-[8px] text-zinc-500 font-bold uppercase">Tahmini Hacim</span>
              <div className="text-lg font-mono font-black text-white mt-1">{currentVolume} m³</div>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-900 p-3 rounded-xl">
              <span className="text-[8px] text-zinc-500 font-bold uppercase">Yeraltı Yapısı</span>
              <div className="text-lg font-black text-amber-500 mt-1 uppercase">
                {isosurface === 'cavity' ? 'ODA / BOŞLUK' : isosurface === 'metal' ? 'TEKİL NESNE' : 'KOMPOZİT ALAN'}
              </div>
            </div>
          </div>
          <p className="text-[8px] text-zinc-600 font-mono uppercase leading-normal">
            Yapay zeka anomali sınırlarını kilitledi: Z={ (depthSlice - 0.4).toFixed(1) }m ile { (depthSlice + 1.2).toFixed(1) }m derinlikleri arasında sürekli uzanan jeopolimer form.
          </p>
        </div>
      </div>

      {/* Right side: Visualization & Offline Edge AI Specs */}
      <div className="lg:col-span-7 space-y-6">
        {/* Tomography slice canvas */}
        <div className="border border-zinc-900 bg-zinc-950/40 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
            <span>2D YATAY KESİT (TOMOGRAFİK SLICE VIEW)</span>
            <span className="text-amber-500 font-mono">DİLİM KALINLIĞI: 10 cm</span>
          </div>
          
          <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950">
            <canvas 
              ref={canvasRef} 
              className="w-full h-[280px] block"
              width={500}
              height={280}
            />
          </div>
        </div>

        {/* Edge AI Offline Engine Specifications Terminal */}
        <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-3xl space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-zinc-900/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
              <div className="text-[10px] font-black text-white uppercase tracking-wider">ÇEVRİMDİŞİ YAPAY ZEKA (EDGE AI)</div>
            </div>
            <button 
              onClick={() => setShowEdgeAI(!showEdgeAI)}
              className="text-[8px] text-zinc-500 hover:text-white uppercase font-mono tracking-widest border border-zinc-800 px-2 py-0.5 rounded-md hover:bg-zinc-900 transition-all"
            >
              {showEdgeAI ? 'GİZLE' : 'GÖSTER'}
            </button>
          </div>

          {showEdgeAI && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-xl">
                  <div className="text-[8px] text-zinc-500 font-bold uppercase">Motor Sürümü</div>
                  <div className="text-[10px] font-mono font-bold text-emerald-400 mt-1">ONNX WebAssembly</div>
                </div>
                <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-xl">
                  <div className="text-[8px] text-zinc-500 font-bold uppercase">Model Dosyası</div>
                  <div className="text-[10px] font-mono font-bold text-white mt-1 truncate">{modelMetadata.modelName}</div>
                </div>
                <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-xl">
                  <div className="text-[8px] text-zinc-500 font-bold uppercase">Cihaz İçi Gecikme</div>
                  <div className="text-[10px] font-mono font-bold text-white mt-1">{modelMetadata.latencyMs} ms</div>
                </div>
                <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-xl">
                  <div className="text-[8px] text-zinc-500 font-bold uppercase">Bağlantı Modu</div>
                  <div className="text-[10px] font-mono font-bold text-zinc-400 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> ÇEVRİMDİŞİ SAHA
                  </div>
                </div>
              </div>

              {/* Neural network layer details */}
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-2.5">
                <div className="text-[8px] font-mono font-black text-zinc-500 tracking-wider uppercase flex items-center gap-1">
                  <Binary className="w-3.5 h-3.5 text-zinc-400" /> SINIFLANDIRICI KATMAN YAPISI (LOCAL TENSORES FORWARD-PASS)
                </div>
                <div className="space-y-1 text-[9px] font-mono text-zinc-400 leading-relaxed">
                  {modelMetadata.layers.map((l, i) => (
                    <div key={i} className="flex justify-between border-b border-zinc-900/50 py-1 font-bold">
                      <span className="text-zinc-500">{l.name}</span>
                      <span className="text-white">SHAPE: {JSON.stringify(l.shape)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


/* ==========================================
   2. GEOMAGNETIC CALIBRATION TAB
   ========================================== */
interface CalibrationDetailTabProps {
  geomagneticBaseline: number;
  isGeomagneticCalibrated: boolean;
  sensorData: any;
  onResetCalibration: (val?: number) => void;
}

const CalibrationDetailTab: React.FC<CalibrationDetailTabProps> = ({
  geomagneticBaseline,
  isGeomagneticCalibrated,
  sensorData,
  onResetCalibration
}) => {
  const [kalmanFilterVal, setKalmanFilterVal] = useState(0.85);
  const [filterMode, setFilterMode] = useState<'low-pass' | 'kalman' | 'band-pass'>('kalman');
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    // Record baseline variance history
    const interval = setInterval(() => {
      const val = sensorData.magnetic.total + (Math.random() - 0.5) * 0.1;
      setHistory(prev => {
        const next = [...prev, val];
        if (next.length > 20) next.shift();
        return next;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [sensorData.magnetic.total]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Side: Controls */}
      <div className="lg:col-span-5 space-y-6">
        <div className="space-y-2">
          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[8px] font-black uppercase tracking-widest w-fit">
            JEOMANYETİK DENGELEYİCİ
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight font-sans leading-none">
            MANYETİK ALAN KALİBRASYONU
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed pt-2">
            Bölgesel doğal yerçekimi manyetometre gürültüsünü düşürmek ve sıfırlamak için kullanılır. Sıfırlama işlemi (dara alma) sonrasında ölçülen net sapmalar anomali olarak nitelendirilir.
          </p>
        </div>

        {/* Core Calibration Hud */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">DARA VE REFERANS DEĞERLERİ</span>
            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${isGeomagneticCalibrated ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>
              {isGeomagneticCalibrated ? 'DARA ALINDI' : 'DENGE BOZUK'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900/50">
              <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Referans (Dara)</div>
              <div className="text-xl font-black text-white mt-1 tabular-nums tracking-tighter">
                {geomagneticBaseline.toFixed(2)} µT
              </div>
            </div>
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900/50">
              <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Net Sapma</div>
              <div className="text-xl font-black text-emerald-500 mt-1 tabular-nums tracking-tighter">
                {isGeomagneticCalibrated ? `${Math.abs(sensorData.magnetic.total - geomagneticBaseline).toFixed(4)} µT` : 'Sıfırlanmadı'}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const val = sensorData.magnetic.total > 0 ? sensorData.magnetic.total : 48.0;
              onResetCalibration(val);
            }}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-emerald-950/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> ARKA PLAN JEOMANYETİK GÜRÜLTÜSÜNÜ SIFIRLA
          </button>
        </div>

        {/* Filter Sliders */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-4">
          <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">SİNYAL FİLTRESİ AYARLARI</div>
          
          <div className="flex gap-2">
            {(['low-pass', 'kalman', 'band-pass'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${
                  filterMode === mode 
                    ? 'bg-zinc-900 border-zinc-800 text-white' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode === 'low-pass' ? 'Alçak Geçiren' : mode === 'kalman' ? 'Kalman' : 'Bant Geçiren'}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
              <span>Filtre Hassasiyet Derecesi (Q)</span>
              <span className="text-white font-mono">{kalmanFilterVal.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="0.99" 
              step="0.01" 
              value={kalmanFilterVal}
              onChange={(e) => setKalmanFilterVal(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-zinc-950 rounded-full cursor-pointer"
            />
            <div className="flex justify-between text-[8px] text-zinc-600 uppercase font-mono">
              <span>Hızlı Tepki</span>
              <span>Yüksek Filtreleme (Stabil)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Graph/Scope */}
      <div className="lg:col-span-7 space-y-4">
        <div className="border border-zinc-900 bg-zinc-950/40 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
            <span>MANYETİK VEKTÖR SAPMA DALGASI (REAL-TIME VARIANCE)</span>
            <span className="text-emerald-500 animate-pulse font-mono">OKUMA: {sensorData.magnetic.total.toFixed(3)} µT</span>
          </div>

          {/* Running Oscilloscope Line */}
          <div className="h-64 bg-zinc-950 rounded-2xl border border-zinc-900/80 p-4 relative overflow-hidden flex items-end">
            <div className="absolute inset-0 bg-[radial-gradient(#16a34a_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
            
            {/* Center Zero Line */}
            <div className="absolute top-1/2 inset-x-0 h-px bg-zinc-900 border-dashed border-zinc-800" />
            <div className="absolute top-1/2 left-4 -translate-y-1/2 text-[8px] font-mono text-zinc-600">ZERO BAL.</div>

            {/* Simulated signal graph */}
            <svg className="w-full h-full absolute inset-0 z-10 pointer-events-none">
              <path
                d={`M 0,${128 - (history[0] - geomagneticBaseline) * 100} ${history.map((h, idx) => `L ${(idx / 19) * 460},${128 - (h - geomagneticBaseline) * 100}`).join(' ')}`}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              {/* Highlight points */}
              {history.map((h, idx) => {
                const cx = (idx / 19) * 460;
                const cy = 128 - (h - geomagneticBaseline) * 100;
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r={2}
                    fill="#10b981"
                    className="opacity-70"
                  />
                );
              })}
            </svg>
          </div>

          {/* Status grid */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-zinc-900/30 border border-zinc-900 rounded-xl">
              <div className="text-[8px] text-zinc-500 uppercase font-mono">X Ekseni</div>
              <div className="text-xs font-bold text-white mt-0.5 tabular-nums">{sensorData.magnetic.x.toFixed(2)} µT</div>
            </div>
            <div className="p-3 bg-zinc-900/30 border border-zinc-900 rounded-xl">
              <div className="text-[8px] text-zinc-500 uppercase font-mono">Y Ekseni</div>
              <div className="text-xs font-bold text-white mt-0.5 tabular-nums">{sensorData.magnetic.y.toFixed(2)} µT</div>
            </div>
            <div className="p-3 bg-zinc-900/30 border border-zinc-900 rounded-xl">
              <div className="text-[8px] text-zinc-500 uppercase font-mono">Z Ekseni</div>
              <div className="text-xs font-bold text-white mt-0.5 tabular-nums">{sensorData.magnetic.z.toFixed(2)} µT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


/* ==========================================
   3. TARGET DETAIL - ADVANCED METAL & HAZINE FINGERPRINTING
   ========================================== */
interface TargetDetailTabProps {
  sensorData: any;
  liveAnalysis: any;
}

const TargetDetailTab: React.FC<TargetDetailTabProps> = ({ sensorData, liveAnalysis }) => {
  const [phaseMode, setPhaseMode] = useState<'polarization' | 'gradient' | 'symmetry'>('polarization');
  const [gradientUpper, setGradientUpper] = useState<number>(47.8);
  const [gradientLower, setGradientLower] = useState<number>(48.3);
  const [symmetryIndex, setSymmetryIndex] = useState<number>(92); // 92% symmetric = man made container

  // Wave phase animation offset
  const [waveOffset, setWaveOffset] = useState<number>(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setWaveOffset(prev => prev + 0.1);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Fluctuating magnetic gradient readings if metal target active
  useEffect(() => {
    const interval = setInterval(() => {
      const active = liveAnalysis && liveAnalysis.score > 40;
      const baseUpper = active ? 46.2 : 47.9;
      const baseLower = active ? 51.4 : 48.1;
      setGradientUpper(baseUpper + (Math.random() - 0.5) * 0.15);
      setGradientLower(baseLower + (Math.random() - 0.5) * 0.15);
      setSymmetryIndex(active ? 94 : 14); // 94% symmetric lahit/sandık or 14% natural rock
    }, 800);
    return () => clearInterval(interval);
  }, [liveAnalysis]);

  const gradientDelta = Math.abs(gradientLower - gradientUpper).toFixed(3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left controls */}
      <div className="lg:col-span-5 space-y-6">
        <div className="space-y-2">
          <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[8px] font-black uppercase tracking-widest w-fit">
            METAL VE HAZİNE KİMLİKLENDİRME
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight font-sans leading-none">
            ANOMALİ PARMAK İZİ (FINGERPRINTING)
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed pt-2">
            Sadece metal veya boşluk demenin ötesine geçerek, sinyalin yansıma fazını, dikey gradyometre vektörünü ve şekil geometrisini inceleyen ileri düzey fizik analiz ünitesidir.
          </p>
        </div>

        {/* Phase / Gradient selection tab switches */}
        <div className="flex gap-2 p-1.5 bg-zinc-950/80 rounded-2xl border border-zinc-900">
          {[
            { id: 'polarization', label: 'GPR Fazı', icon: Activity },
            { id: 'gradient', label: 'Gradyan', icon: TrendingUp },
            { id: 'symmetry', label: 'Geometri', icon: BoxIcon }
          ].map((tab) => {
            const TabIcon = tab.icon || Activity;
            return (
              <button
                key={tab.id}
                onClick={() => setPhaseMode(tab.id as any)}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border ${
                  phaseMode === tab.id 
                    ? 'bg-zinc-900 border-zinc-800 text-white' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Left Interactive widgets depending on mode */}
        {phaseMode === 'polarization' && (
          <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-4">
            <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">GPR FAZ ANALİZİ (POLARİZASYON)</div>
            <p className="text-[10px] text-zinc-400 leading-relaxed uppercase font-mono">
              Yansıyan dalganın faz kayması (+/- polarite) dielektrik sınırları belirler:
            </p>
            <div className="space-y-2.5">
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-blue-400 uppercase font-sans">MAVİ: Boşluk ve Hava</span>
                <span className="text-[9px] text-zinc-400 font-mono">ε_r ≈ 1.0 (Faz kayması yok)</span>
              </div>
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-red-400 uppercase font-sans">KIRMIZI: Soy Metaller (Altın/Gümüş)</span>
                <span className="text-[9px] text-zinc-400 font-mono">Faz kayması: +180° (Yüksek İletken)</span>
              </div>
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-emerald-400 uppercase font-sans">YEŞİL: Kil ve Sulu Zemin</span>
                <span className="text-[9px] text-zinc-400 font-mono">Faz kayması: -90° (Kondüktif)</span>
              </div>
            </div>
          </div>
        )}

        {phaseMode === 'gradient' && (
          <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-4">
            <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">JEOMANYETİK GRADYOMETRE GÖSTERİMİ</div>
            <p className="text-[10px] text-zinc-400 leading-normal uppercase font-mono">
              Dikey eksende aralarında 50 cm olan çift diferansiyel sensörler ile metal nesnenin tam merkez dipol koordinat vektörü hesaplanır.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900">
                  <div className="text-[8px] text-zinc-500 font-bold uppercase leading-none">ÜST SENSÖR (H1)</div>
                  <div className="text-sm font-mono font-bold text-white mt-1.5">{gradientUpper.toFixed(2)} µT</div>
                </div>
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900">
                  <div className="text-[8px] text-zinc-500 font-bold uppercase leading-none">ALT SENSÖR (H2)</div>
                  <div className="text-sm font-mono font-bold text-white mt-1.5">{gradientLower.toFixed(2)} µT</div>
                </div>
              </div>
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl flex justify-between items-center">
                <span className="text-[10px] font-bold text-red-400 uppercase">Dikey Gradyan (dH/dz)</span>
                <span className="font-mono text-xs font-bold text-white">{gradientDelta} µT/m</span>
              </div>
            </div>
          </div>
        )}

        {phaseMode === 'symmetry' && (
          <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-4">
            <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">HACİMSEL GEOMETRİ ANALİZİ</div>
            <p className="text-[10px] text-zinc-400 leading-normal uppercase font-mono">
              Yapay zeka nokta bulutunu üç boyutlu matris analizine sokar. Düzgün dairesel veya köşeli formlar insan yapımı objelere işaret eder.
            </p>
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-900 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 uppercase font-bold">Simetri Katsayısı:</span>
                <span className={`font-mono font-black ${symmetryIndex > 80 ? 'text-red-400' : 'text-zinc-500'}`}>{symmetryIndex}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${symmetryIndex}%` }} />
              </div>
              <div className="text-[9px] font-mono leading-relaxed pt-1 border-t border-zinc-900/60 uppercase">
                {symmetryIndex > 80 ? (
                  <span className="text-red-400 font-bold">✓ ANALİZ: %94 İnsan Yapımı Geometrik Obje (Muhtemel lahit, sikke kavanozu veya sandık).</span>
                ) : (
                  <span className="text-zinc-500">✓ ANALİZ: %14 Simetri. Doğal Kayaç, mineral formasyonu veya çatlak yapısı.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Radar Canvas/Scope */}
      <div className="lg:col-span-7 space-y-4">
        {phaseMode === 'polarization' && (
          <div className="border border-zinc-900 bg-zinc-950/40 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
              <span>SİNYAL POLARİZASYON FAZ GRAFİĞİ (OSCİLLOSCOPE VIEW)</span>
              <span className="text-red-500 font-mono animate-pulse">SAHA FREKANSI: 500 MHz GPR</span>
            </div>

            {/* Live sinusoidal polarization waves */}
            <div className="h-64 bg-zinc-950 rounded-2xl border border-zinc-900 p-4 relative overflow-hidden flex items-center">
              <div className="absolute inset-0 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:24px_24px] opacity-5 pointer-events-none" />
              <div className="absolute inset-x-0 h-px bg-zinc-900 border-dashed border-zinc-800" />
              <div className="absolute left-4 top-4 text-[8px] font-mono text-zinc-600">POS POLARITY (+): GOLD/METAL</div>
              <div className="absolute left-4 bottom-4 text-[8px] font-mono text-zinc-600">NEG POLARITY (-): CAVITY/VOID</div>

              <svg className="w-full h-full absolute inset-0 pointer-events-none">
                {/* Baseline wave */}
                <path
                  d={Array.from({ length: 50 }, (_, i) => {
                    const x = (i / 49) * 480;
                    const y = 128 + Math.sin(x * 0.05 + waveOffset) * 45;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke={liveAnalysis && liveAnalysis.score > 40 ? '#ef4444' : 'rgba(239, 68, 68, 0.3)'}
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Second out-of-phase wave representing metal reflection */}
                {liveAnalysis && liveAnalysis.score > 40 && (
                  <path
                    d={Array.from({ length: 50 }, (_, i) => {
                      const x = (i / 49) * 480;
                      // Phase shift representing metal (+180 deg)
                      const y = 128 + Math.sin(x * 0.05 + waveOffset + Math.PI) * 35;
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}
              </svg>
            </div>
            <div className="flex justify-between text-[8px] text-zinc-600 uppercase font-mono">
              <span>HIZLI ÖRNEKLEME GİRİŞİ (RX-1)</span>
              <span>KUTUPSAL KAYMA GENLİĞİ</span>
              <span>VERİCİ ANTEN ÇIKIŞI (TX-1)</span>
            </div>
          </div>
        )}

        {phaseMode === 'gradient' && (
          <div className="border border-zinc-900 bg-zinc-950/40 rounded-3xl p-6 flex flex-col items-center justify-center space-y-4">
            <div className="w-full flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
              <span>MANYETİK SAPMA VEKTÖRÜ (DİPOL MERKEZ HESAPLAYICI)</span>
              <span className="text-red-500 font-mono">OK: MERKEZ İSTİKAMETİ</span>
            </div>

            {/* 3D-like arrow vector */}
            <div className="w-64 h-64 bg-zinc-950 border border-zinc-900 rounded-full relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-8 rounded-full border border-dashed border-zinc-900" />
              <div className="absolute inset-20 rounded-full border border-zinc-900" />
              
              {/* Spinning compass ticks */}
              <div className="absolute inset-x-0 h-px bg-zinc-900/60" />
              <div className="absolute inset-y-0 w-px bg-zinc-900/60" />

              {/* Vector 3D Arrow */}
              <motion.div
                animate={{ rotate: liveAnalysis && liveAnalysis.score > 40 ? 142 : waveOffset * 20 }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-full h-full absolute flex items-center justify-center pointer-events-none"
              >
                <div className="relative w-1.5 h-44 bg-gradient-to-b from-red-500 via-zinc-800 to-zinc-900 flex flex-col justify-between items-center rounded">
                  <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[16px] border-b-red-500 -mt-3.5" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-black shadow" />
                </div>
              </motion.div>
              
              <div className="absolute bottom-4 text-[8px] font-mono font-bold text-red-500 uppercase tracking-widest bg-zinc-950 px-2 py-0.5 border border-zinc-900 rounded-md shadow">
                {liveAnalysis && liveAnalysis.score > 40 ? 'DİPOL NOKTASI KİLİTLENDİ' : 'GRD SİNYAL ARANIYOR'}
              </div>
            </div>
          </div>
        )}

        {phaseMode === 'symmetry' && (
          <div className="border border-zinc-900 bg-zinc-950/40 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
              <span>HACİMSEL GEOMETRİ SÜZGEÇİ (3D POINT CLOUD CLASSIFIER)</span>
              <span className="text-zinc-500 font-mono">STATUS: AI SHAPE CHECK</span>
            </div>

            {/* Geometric visualizers (rotating 3D box or blob depending on target) */}
            <div className="h-64 bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center justify-center relative overflow-hidden">
              {liveAnalysis && liveAnalysis.score > 40 ? (
                // Draw rigid perfect cube showing human made structure
                <motion.div
                  animate={{ rotateY: 360, rotateX: 180 }}
                  transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                  className="w-32 h-32 relative preserve-3d"
                >
                  {/* Cube faces */}
                  <div className="absolute inset-0 bg-red-500/10 border border-red-500 text-red-500 text-[10px] flex items-center justify-center font-mono font-bold uppercase backdrop-blur-sm [transform:translateZ(64px)]">LAHIT</div>
                  <div className="absolute inset-0 bg-red-500/10 border border-red-500 text-red-500 text-[10px] flex items-center justify-center font-mono font-bold uppercase backdrop-blur-sm [transform:rotateY(90deg)_translateZ(64px)]">SANDIK</div>
                  <div className="absolute inset-0 bg-red-500/10 border border-red-500 text-red-500 text-[10px] flex items-center justify-center font-mono font-bold uppercase backdrop-blur-sm [transform:rotateY(180deg)_translateZ(64px)]">MUHAFAZA</div>
                  <div className="absolute inset-0 bg-red-500/10 border border-red-500 text-red-500 text-[10px] flex items-center justify-center font-mono font-bold uppercase backdrop-blur-sm [transform:rotateY(-90deg)_translateZ(64px)]">METRİK</div>
                  <div className="absolute inset-0 bg-red-500/10 border border-red-500 text-red-500 text-[10px] flex items-center justify-center font-mono font-bold uppercase backdrop-blur-sm [transform:rotateX(90deg)_translateZ(64px)]">ÜST KAPAK</div>
                  <div className="absolute inset-0 bg-red-500/10 border border-red-500 text-red-500 text-[10px] flex items-center justify-center font-mono font-bold uppercase backdrop-blur-sm [transform:rotateX(-90deg)_translateZ(64px)]">TABAN</div>
                </motion.div>
              ) : (
                // Natural irregular blob outline
                <div className="relative flex items-center justify-center">
                  <div className="w-36 h-36 border-2 border-zinc-800 border-dashed rounded-full animate-spin-slow absolute" />
                  <div className="w-24 h-24 bg-zinc-900/40 border border-zinc-700/50 rounded-[40%_60%_70%_30%_/_40%_50%_60%_50%] animate-pulse flex items-center justify-center text-[10px] font-mono text-zinc-500 uppercase">
                    DOĞAL KAYA
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Simple BoxIcon placeholder so we don't import custom svgs
const BoxIcon: React.FC<any> = (props) => (
  <svg 
    viewBox="0 0 24 24" 
    width="24" 
    height="24" 
    stroke="currentColor" 
    strokeWidth="2" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);


/* ==========================================
   4. COLLABORATIVE SLAM NETWORK - LOOP CLOSURE & HOUGH BLUEPRINT
   ========================================== */
interface CoSlamDetailTabProps {
  syncedNodes: string[];
  onToggleNodeSync: (id: string) => void;
  scanPhase: string;
}

const CoSlamDetailTab: React.FC<CoSlamDetailTabProps> = ({
  syncedNodes,
  onToggleNodeSync,
  scanPhase
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Custom features
  const [houghTransform, setHoughTransform] = useState<boolean>(false);
  const [isLoopClosureRunning, setIsLoopClosureRunning] = useState<boolean>(false);
  const [driftError, setDriftError] = useState<number>(3.82); // Initial cumulative sensor drift in meters
  const [loopClosureMsg, setLoopClosureMsg] = useState<string>('Döngü kapatma (Loop Closure) beklemede. Zemin tarandıkça biriken kayma hatası (drift) sönümlenebilir.');

  // Animation ticks
  const [angle, setAngle] = useState(0);
  const pointsRef = useRef<Array<{ x: number; y: number; originalX: number; originalY: number; density: number; type: 'void' | 'metal' | 'normal' }>>([
    { x: 120, y: 150, originalX: 120, originalY: 150, density: 0.8, type: 'metal' },
    { x: 280, y: 110, originalX: 280, originalY: 110, density: 0.9, type: 'void' },
    { x: 200, y: 220, originalX: 200, originalY: 220, density: 0.5, type: 'normal' },
    { x: 80, y: 90, originalX: 80, originalY: 90, density: 0.6, type: 'normal' },
    { x: 340, y: 180, originalX: 340, originalY: 180, density: 0.7, type: 'normal' }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAngle(p => p + 0.03);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  // Run Loop Closure simulation sequence
  const handleTriggerLoopClosure = () => {
    if (isLoopClosureRunning) return;
    setIsLoopClosureRunning(true);
    setLoopClosureMsg('Döngü kapama tetiklendi. Eski koordinatlar taranıp çakıştırılıyor...');

    // Phase 1
    setTimeout(() => {
      setLoopClosureMsg('Hata matrisi hesaplanıyor (SVD Solver)... Kayma hatası saptandı: 3.82 metre.');
      setDriftError(2.4);
    }, 1500);

    // Phase 2: Pull the points back close to original layout to simulate optimization
    setTimeout(() => {
      setLoopClosureMsg('Poz-Grafiği geri gevşetiliyor (Pose-Graph optimization)... Tüm düğümler optimize ediliyor.');
      setDriftError(0.85);
    }, 3000);

    // Phase 3: Complete
    setTimeout(() => {
      setLoopClosureMsg('BAŞARILI: Döngü tamamen kapatıldı! Toplam birikmiş kayma hatası sıfırlandı.');
      setDriftError(0.04);
      setIsLoopClosureRunning(false);
    }, 4500);
  };

  // Draw Point Cloud, Hough lines, and connection nodes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw coordinate map grid
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Connect points with solid straight blueprint lines if Hough Transform enabled!
    if (houghTransform) {
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#0ea5e9';

      // Connect point clouds representing walls
      ctx.beginPath();
      ctx.moveTo(pointsRef.current[3].x, pointsRef.current[3].y);
      ctx.lineTo(pointsRef.current[0].x, pointsRef.current[0].y);
      ctx.lineTo(pointsRef.current[2].x, pointsRef.current[2].y);
      ctx.lineTo(pointsRef.current[4].x, pointsRef.current[4].y);
      ctx.lineTo(pointsRef.current[1].x, pointsRef.current[1].y);
      ctx.stroke();

      ctx.shadowBlur = 0; // reset
      ctx.fillStyle = '#0ea5e9';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('HOUGH ARKEOLOJİK DUVAR ÇİZGİSİ 1', (pointsRef.current[3].x + pointsRef.current[0].x) / 2, (pointsRef.current[3].y + pointsRef.current[0].y) / 2 - 5);
      ctx.fillText('HOUGH ARKEOLOJİK DUVAR ÇİZGİSİ 2', (pointsRef.current[2].x + pointsRef.current[4].x) / 2, (pointsRef.current[2].y + pointsRef.current[4].y) / 2 - 5);
    }

    // Draw point cloud dots
    pointsRef.current.forEach((p) => {
      // If loop closure runs, drift slightly offsets points, else they snap back
      const deltaX = isLoopClosureRunning ? (p.originalX - p.x) * (1 - driftError / 3.82) : 0;
      const deltaY = isLoopClosureRunning ? (p.originalY - p.y) * (1 - driftError / 3.82) : 0;

      const pulse = 1 + Math.sin(angle * 2 + p.x) * 0.15;
      ctx.fillStyle = p.type === 'metal' 
        ? `rgba(245, 158, 11, ${p.density * 0.8})` 
        : p.type === 'void' 
        ? `rgba(168, 85, 247, ${p.density * 0.8})` 
        : `rgba(14, 165, 233, ${p.density * 0.4})`;
      
      ctx.beginPath();
      ctx.arc(p.x + deltaX, p.y + deltaY, 4 * pulse, 0, 2 * Math.PI);
      ctx.fill();

      // Draw dashed circle around targets
      if (p.type !== 'normal') {
        ctx.strokeStyle = p.type === 'metal' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(168, 85, 247, 0.3)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12 * pulse, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });

    // Draw Operator Node connections
    const hostX = canvas.width / 2 + Math.cos(angle * 0.4) * 15;
    const hostY = canvas.height / 2 + Math.sin(angle * 0.4) * 15;

    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(hostX, hostY, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('HOST: SİZ', hostX - 25, hostY - 14);

    // Synced node ÖMER S.
    if (syncedNodes.includes('1')) {
      const omerX = 90 + Math.sin(angle * 0.3) * 10;
      const omerY = 120 + Math.cos(angle * 0.3) * 10;

      // Line to host
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
      ctx.beginPath();
      ctx.moveTo(hostX, hostY);
      ctx.lineTo(omerX, omerY);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(omerX, omerY, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText('ECHELON-02 (ÖMER)', omerX - 45, omerY - 10);
    }

    // Synced node TACTICAL SELİN
    if (syncedNodes.includes('3')) {
      const selinX = 330 + Math.cos(angle * 0.3) * 12;
      const selinY = 190 + Math.sin(angle * 0.3) * 12;

      ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
      ctx.beginPath();
      ctx.moveTo(hostX, hostY);
      ctx.lineTo(selinX, selinY);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(selinX, selinY, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText('TACTICAL-07 (SELİN)', selinX - 45, selinY - 10);
    }

    // Draw Drift vector line if loop closure runs and there's drift error
    if (driftError > 0.1 && houghTransform) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pointsRef.current[0].originalX, pointsRef.current[0].originalY);
      ctx.lineTo(pointsRef.current[0].x, pointsRef.current[0].y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`DRIFT HATA VEKTÖRÜ: ${driftError.toFixed(2)}m`, pointsRef.current[0].x + 10, pointsRef.current[0].y + 15);
    }

  }, [syncedNodes, houghTransform, isLoopClosureRunning, driftError]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left List / Actions */}
      <div className="lg:col-span-5 space-y-6">
        <div className="space-y-2">
          <div className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400 text-[8px] font-black uppercase tracking-widest w-fit">
            CO-SLAM VE JEODESİK DOĞRULAMA
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight font-sans leading-none">
            HATA TOLERANSLI CO-SLAM VE MİMARİ PLAN
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed pt-2">
            Zemin altı taramalarda biriken konum kayma (drift) hatalarını döngü kapatma algoritması ile düzeltip, Hough Transform filtresi yardımıyla noktaları düzgün mimari plan çizgilerine dökün.
          </p>
        </div>

        {/* Loop Closure Trigger Card */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
            <span>DÖNGÜ KAPATMA (LOOP CLOSURE) MOTORU</span>
            <span className="text-sky-400 font-mono">KAYMA: {driftError.toFixed(2)}m</span>
          </div>

          <p className="text-[10px] font-mono leading-relaxed text-zinc-400 bg-zinc-950 p-4 border border-zinc-900 rounded-2xl uppercase">
            {loopClosureMsg}
          </p>

          <button
            onClick={handleTriggerLoopClosure}
            disabled={isLoopClosureRunning || driftError < 0.1}
            className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border ${
              isLoopClosureRunning 
                ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-950/20'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isLoopClosureRunning ? 'animate-spin' : ''}`} />
            {isLoopClosureRunning ? 'HARİTA OPTİMİZE EDİLİYOR...' : 'DÖNGÜYÜ KAPAT VE HARİTAYI OPTİMİZE ET'}
          </button>
        </div>

        {/* Architectural Filter Toggle */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-3">
          <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">ARKEOLOJİK MİMARİ MODELLERİ</div>
          
          <div className="flex justify-between items-center p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
            <div>
              <div className="text-xs font-bold text-white uppercase font-sans">Hough Transform Blueprint</div>
              <div className="text-[8px] text-zinc-500 uppercase mt-0.5">Köşe yakalayıcı çizgisel birleştirme</div>
            </div>
            <button
              onClick={() => setHoughTransform(!houghTransform)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${
                houghTransform 
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' 
                  : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {houghTransform ? 'AKTİF' : 'KAPALI'}
            </button>
          </div>

          {/* Historical Architectural Template Match */}
          <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-2">
            <span className="text-[8px] text-zinc-500 font-bold uppercase">Yapay Zeka Mimari Şablon Eşleşmesi</span>
            <div className="text-sm font-black text-white uppercase mt-0.5 flex justify-between items-center">
              <span>%88 Tümülüs Giriş Dehlizi</span>
              <span className="text-[8px] text-zinc-500 font-mono">(HELENİSTİK ŞABLON)</span>
            </div>
            <p className="text-[8px] text-zinc-600 font-mono leading-relaxed uppercase">
              Algılanan formasyon: Ardışık iki mezar odası ve bunları birbirine bağlayan dar dikey koridor kalıntısı.
            </p>
          </div>
        </div>
      </div>

      {/* Right Canvas / Map */}
      <div className="lg:col-span-7 space-y-4">
        <div className="border border-zinc-900 bg-zinc-950/40 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
            <span>İŞBİRLİKÇİ CO-SLAM NOKTA BULUTU HARİTASI (GRID: 30m)</span>
            <span className="text-sky-400 font-mono">SENK. OPERATÖR SAYISI: {syncedNodes.length}</span>
          </div>

          <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950">
            <canvas
              ref={canvasRef}
              className="w-full h-[320px] block"
              width={480}
              height={320}
            />
          </div>
        </div>
      </div>
    </div>
  );
};


/* ==========================================
   5. RF SPECTRUM AND GPR AUTOMATION (DIALECTRIC CORRECTION)
   ========================================== */
interface RFDetailTabProps {
  rfSignals: Array<{ ssid: string; rssi: number; type: 'WiFi' | 'BLE' }>;
  scanPhase: string;
}

const RFDetailTab: React.FC<RFDetailTabProps> = ({ rfSignals, scanPhase }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dielectricMode, setDielectricMode] = useState<'dry' | 'moist' | 'wet'>('moist');
  const [hyperbolaLock, setHyperbolaLock] = useState<boolean>(true);

  // Spectral GPR waterfall and hyperbola animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame: number;
    let offset = 0;

    const dataRows: number[][] = [];
    const rowsCount = 40;
    const colsCount = 60;

    // Prefill waterfall rows with noise
    for (let i = 0; i < rowsCount; i++) {
      const row = Array.from({ length: colsCount }, () => Math.random() * 40);
      dataRows.push(row);
    }

    const draw = () => {
      offset += 1;
      
      // Add new raw GPR frequency spectral scan row at top
      const newRow = Array.from({ length: colsCount }, (_, colIdx) => {
        let noise = Math.random() * 30;
        // Mock constant frequency signals spikes from RF/WiFi
        if (colIdx === 15) noise += 65 + Math.sin(offset * 0.1) * 8; 
        if (colIdx === 45) noise += 55 + Math.cos(offset * 0.15) * 12; 
        return noise;
      });

      dataRows.unshift(newRow);
      if (dataRows.length > rowsCount) dataRows.pop();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render waterfall
      const cellW = canvas.width / colsCount;
      const cellH = canvas.height / rowsCount;

      for (let r = 0; r < dataRows.length; r++) {
        for (let c = 0; c < colsCount; c++) {
          const power = dataRows[r][c];
          
          let color = `rgba(99, 102, 241, ${power / 100})`; // low = indigo blue
          if (power > 50) {
            color = `rgba(16, 185, 129, ${power / 100})`; // mid = emerald green
          }
          if (power > 75) {
            color = `rgba(239, 68, 68, ${power / 100})`; // high = warning red
          }

          ctx.fillStyle = color;
          ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
        }
      }

      // Draw hyperbolic radar reflections (Ters V harfi) automatically!
      // Draw GPR Hyperbolas representing buried pipe / metal target
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 2.5;

      const hypApexX = canvas.width * 0.65;
      const hypApexY = canvas.height * 0.45;

      ctx.beginPath();
      for (let x = hypApexX - 60; x <= hypApexX + 60; x++) {
        const dx = x - hypApexX;
        // Hyperbola equation: y = y_apex + sqrt(dy_squared + dx_squared)
        const y = hypApexY + Math.sqrt(400 + dx * dx * 1.5) - 20;
        if (x === hypApexX - 60) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Apex highlight circle if locked!
      if (hyperbolaLock) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hypApexX, hypApexY, 8 + Math.sin(offset * 0.2) * 2, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('APEX HEDEF NOKTASI KİLİDİ (GPR AUTOLOCK)', hypApexX - 90, hypApexY - 14);
      }

      // Draw grid overlay
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, [hyperbolaLock]);

  // Compute actual calibrated GPR depth according to soil dielectric
  const getDielectricInfo = () => {
    switch (dielectricMode) {
      case 'dry':
        return {
          dielectric: 'ε_r = 4.0 (Kurak Toprak)',
          speed: '15.0 cm / ns (Hızlı Nüfuz)',
          error: '± %1.1',
          correctedDepth: '3.12 Metre'
        };
      case 'wet':
        return {
          dielectric: 'ε_r = 16.0 (Yüksek Islak Kil / Çamur)',
          speed: '7.5 cm / ns (Yavaş Sönüm)',
          error: '± %2.3',
          correctedDepth: '1.56 Metre'
        };
      case 'moist':
      default:
        return {
          dielectric: 'ε_r = 9.0 (Nemli Zemin)',
          speed: '10.0 cm / ns (Standart)',
          error: '± %1.4',
          correctedDepth: '2.08 Metre'
        };
    }
  };

  const dielectricInfo = getDielectricInfo();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left controls */}
      <div className="lg:col-span-5 space-y-6">
        <div className="space-y-2">
          <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 text-[8px] font-black uppercase tracking-widest w-fit">
            TAYF ANALİZİ VE SİNYAL BİLİMİ
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight font-sans leading-none">
            GPR HİPERBOL OTOMASYONU VE KATMAN KALINLIĞI
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed pt-2">
            GPR ham verisindeki hiperbolik yansımaların tepe noktalarını (apex) otomatik kilitler ve toprağın dielektrik katsayısı doğrultusunda derinlik ölçüm hatasını %3'ün altına düşürür.
          </p>
        </div>

        {/* Dielectric Soil Calibrator */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-4">
          <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">DİELEKTRİK TOPRAK KESTİRİMİ</div>
          
          <div className="grid grid-cols-3 gap-2">
            {(['dry', 'moist', 'wet'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setDielectricMode(m)}
                className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
                  dielectricMode === m 
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400' 
                    : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {m === 'dry' ? 'KURAK' : m === 'moist' ? 'NEMLİ' : 'ISLAK KİL'}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 p-4 bg-zinc-950 border border-zinc-900 rounded-2xl text-xs font-sans">
            <div className="flex justify-between border-b border-zinc-900/60 pb-1">
              <span className="text-zinc-500">Zemin Sabiti:</span>
              <span className="text-white font-bold">{dielectricInfo.dielectric}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900/60 pb-1">
              <span className="text-zinc-500">GPR Sinyal Hızı:</span>
              <span className="text-indigo-400 font-mono font-bold">{dielectricInfo.speed}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900/60 pb-1">
              <span className="text-zinc-500">Düzeltilmiş Derinlik:</span>
              <span className="text-white font-bold">{dielectricInfo.correctedDepth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Derinlik Hata Payı:</span>
              <span className="text-emerald-400 font-bold font-mono">{dielectricInfo.error}</span>
            </div>
          </div>
        </div>

        {/* Hyperbola Lock Switch */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-3xl space-y-3">
          <div className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">GPR HİPERBOL APEX KİLİDİ</div>
          <div className="flex justify-between items-center p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
            <div>
              <div className="text-xs font-bold text-white uppercase font-sans">Otomatik Tepe Takibi</div>
              <div className="text-[8px] text-zinc-500 uppercase mt-0.5">Ters V Yansımasını Voksele Dönüştür</div>
            </div>
            <button
              onClick={() => setHyperbolaLock(!hyperbolaLock)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${
                hyperbolaLock 
                  ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                  : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {hyperbolaLock ? 'AKTİF' : 'KAPALI'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Canvas / Waterfall B-Scan */}
      <div className="lg:col-span-7 space-y-4">
        <div className="border border-zinc-900 bg-zinc-950/40 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 tracking-wider uppercase">
            <span>GPR B-SCAN ŞELALE GÖRÜNTÜSÜ (HYPERBOLIC APEX DETECTION)</span>
            <span className="text-indigo-400 font-mono">BAND: 500 MHz ENTEGRE</span>
          </div>

          <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950">
            <canvas
              ref={canvasRef}
              className="w-full h-[320px] block"
              width={480}
              height={320}
            />
          </div>
          
          <div className="flex justify-between text-[8px] text-zinc-600 font-mono uppercase">
            <span>HAM RADAR VERİSİ (B-SCAN)</span>
            <span>HİPERBOL KALİBRASYONU</span>
            <span>TEPE NOKTASI AYIKLAMA (APEX)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
