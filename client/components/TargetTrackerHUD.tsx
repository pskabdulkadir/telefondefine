import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Compass, Lock, Unlock, AlertCircle } from 'lucide-react';

interface TargetTrackerHUDProps {
  anomalyActive: boolean;
  anomalyScore: number;
  anomalyType: string;
  compassHeading: number; // 0 - 360 from device orientation (alpha)
  onOpenDetail?: () => void;
  onTargetUpdate?: (distance: number, locked: boolean) => void;
}

export const TargetTrackerHUD: React.FC<TargetTrackerHUDProps> = ({
  anomalyActive,
  anomalyScore,
  anomalyType,
  compassHeading,
  onOpenDetail,
  onTargetUpdate,
}) => {
  const [locked, setLocked] = useState(false);
  const [targetAngle, setTargetAngle] = useState(135); // arbitrary target direction in degrees
  const [distance, setDistance] = useState(5.4); // meters

  useEffect(() => {
    if (onTargetUpdate) {
      onTargetUpdate(distance, locked);
    }
  }, [distance, locked, onTargetUpdate]);

  useEffect(() => {
    // Simülasyon kaldırıldı. Kilitlenme durumu artık dışarıdan yönetilmeli.
    // Örnek: setLocked(anomalyActive && anomalyScore > 40);
  }, [anomalyActive, anomalyScore, compassHeading]);

  // Dynamically calculate distance reduction as the user points towards the locked angle
  // When heading matches targetAngle, simulate getting "closer"
  const angleDiff = Math.abs((compassHeading - targetAngle + 180) % 360 - 180);
  
  return (
    <div className="bg-zinc-950/85 border border-zinc-900 hover:border-red-500/30 rounded-3xl p-6 backdrop-blur-xl space-y-4 transition-all duration-300 relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onOpenDetail}>
          <Compass className="w-5 h-5 text-emerald-500 animate-spin-slow group-hover:text-red-500 transition-colors" />
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-red-400 transition-colors flex items-center gap-1.5 font-sans">
              HEDEF KİLİTLEME VE TAKİP <span className="text-[8px] font-bold text-zinc-600 group-hover:text-red-500/60 uppercase tracking-widest">(DETAY)</span>
            </h4>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Otomatik Anomali Takip Motoru</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenDetail && (
            <button 
              onClick={onOpenDetail}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-[8px] text-zinc-400 hover:text-white rounded-lg border border-zinc-800 font-bold uppercase tracking-wider transition-all"
            >
              RADARI AÇ
            </button>
          )}
          <div className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 border ${
            locked 
              ? 'bg-red-500/10 text-red-500 border-red-500/20' 
              : 'bg-zinc-900 text-zinc-500 border-zinc-850'
          }`}>
            {locked ? <Lock className="w-2.5 h-2.5 animate-pulse" /> : <Unlock className="w-2.5 h-2.5" />}
            <span>{locked ? 'KİLİTLENDİ' : 'BOS'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Dynamic Navigation Radar Dial */}
        <div className="relative w-28 h-28 shrink-0 rounded-full border border-zinc-800/60 bg-zinc-900/40 flex items-center justify-center overflow-hidden">
          {/* Inner radar rings */}
          <div className="absolute inset-2 rounded-full border border-dashed border-zinc-850" />
          <div className="absolute inset-6 rounded-full border border-zinc-850" />
          <div className="absolute inset-10 rounded-full border border-dashed border-zinc-850" />

          {/* Compass ticks */}
          <div className="absolute top-1 text-[8px] font-mono text-zinc-500">N</div>
          <div className="absolute right-1 text-[8px] font-mono text-zinc-500">E</div>
          <div className="absolute bottom-1 text-[8px] font-mono text-zinc-500">S</div>
          <div className="absolute left-1 text-[8px] font-mono text-zinc-500">W</div>

          {/* Compass Pointer / Needle pointing towards relative target location */}
          {locked ? (
            <motion.div
              animate={{ rotate: targetAngle - compassHeading }}
              transition={{ type: 'spring', stiffness: 50, damping: 15 }}
              className="absolute w-full h-full flex items-center justify-center pointer-events-none"
            >
              <div className="absolute top-1 flex flex-col items-center">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-red-500" />
                <div className="w-0.5 h-8 bg-gradient-to-b from-red-500 to-transparent" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              animate={{ rotate: -compassHeading }}
              className="absolute w-full h-full flex items-center justify-center pointer-events-none"
            >
              <div className="absolute top-1 w-0.5 h-6 bg-emerald-500/40" />
            </motion.div>
          )}

          {/* Locked Icon overlay in center */}
          <div className={`p-1.5 rounded-full z-10 ${locked ? 'bg-red-500/10 text-red-500' : 'bg-zinc-950 text-zinc-600'}`}>
            <Target className={`w-4 h-4 ${locked ? 'animate-ping' : ''}`} />
          </div>
        </div>

        {/* Target Details Panel */}
        <div className="flex-1 space-y-2">
          {locked ? (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em] leading-none">AKTİF HEDEF</div>
                <div className="text-sm font-extrabold text-white leading-tight uppercase mt-1">{anomalyType}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Mesafe</div>
                  <div className="text-xl font-black text-white tabular-nums tracking-tighter mt-1">{distance.toFixed(1)}m</div>
                </div>
                <div>
                  <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Sapma Açısı</div>
                  <div className="text-xl font-black text-white tabular-nums tracking-tighter mt-1">{angleDiff.toFixed(0)}°</div>
                </div>
              </div>

              {angleDiff < 20 && (
                <div className="px-3 py-1 bg-red-500/15 border border-red-500/30 rounded-xl flex items-center gap-1.5 text-red-400 text-[8px] font-black uppercase tracking-widest">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Hedef İstikameti! Yaklaşılıyor</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center md:text-left text-zinc-500 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider">Tarama Yapılıyor...</div>
              <p className="text-[9px] leading-relaxed max-w-xs">Sistem çevrede bir anomali tespit ettiğinde otomatik olarak kilitlenecek ve yönlendirecektir.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
