import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Wifi, AlertTriangle, CloudLightning, ShieldAlert, Check } from 'lucide-react';

interface OperatorNode {
  id: string;
  name: string;
  signal: number;
  status: 'active' | 'synced' | 'offline';
  coverage: number;
}

interface CoSlamPanelProps {
  syncedNodes: string[];
  onToggleNodeSync: (id: string) => void;
  onOpenDetail?: () => void;
}

export const CoSlamPanel: React.FC<CoSlamPanelProps> = ({
  syncedNodes,
  onToggleNodeSync,
  onOpenDetail
}) => {
  const [nodes, setNodes] = useState<OperatorNode[]>([
    { id: '1', name: 'ECHELON-02 (Ömer S.)', signal: 94, status: 'active', coverage: 42 },
    { id: '2', name: 'ECHELON-04 (Murat K.)', signal: 82, status: 'offline', coverage: 78 },
    { id: '3', name: 'TACTICAL-07 (Selin D.)', signal: 98, status: 'active', coverage: 15 },
  ]);

  const [syncing, setSyncing] = useState<string | null>(null);
  const [dataPoints, setDataPoints] = useState<number>(0);

  // --- LOOP CLOSURE STATE & SIMULATION ---
  const [driftValue, setDriftValue] = useState<number>(0.15); // meters
  const [loopClosureStatus, setLoopClosureStatus] = useState<'monitoring' | 'optimizing' | 'success'>('monitoring');

  useEffect(() => {
    // Simülasyon kaldırıldı. dataPoints ve driftValue artık gerçek SLAM verisinden gelmeli.
    // Örnek: setDriftValue(realSlamData.drift);
  }, [syncedNodes]);

  const handleSyncNode = (id: string) => {
    if (syncedNodes.includes(id)) {
      onToggleNodeSync(id);
      return;
    }

    setSyncing(id);
    setTimeout(() => {
      setSyncing(null);
      onToggleNodeSync(id);
    }, 1500);
  };


  return (
    <div className="bg-zinc-950/80 border border-zinc-900 hover:border-sky-500/30 rounded-3xl p-6 space-y-6 backdrop-blur-xl transition-all duration-300 relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onOpenDetail}>
          <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-2xl group-hover:bg-sky-500/20 transition-all">
            <Users className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-sky-400 transition-colors flex items-center gap-1.5">
              İŞBİRLİKÇİ TARAMA (CO-SLAM) <span className="text-[8px] font-bold text-zinc-600 group-hover:text-sky-500/60 uppercase tracking-widest">(DETAY)</span>
            </h4>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Saha Operatörleri Ağ Senkronizasyonu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenDetail && (
            <button 
              onClick={onOpenDetail}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-[8px] text-zinc-400 hover:text-white rounded-lg border border-zinc-800 font-bold uppercase tracking-wider transition-all"
            >
              HARİTAYI AÇ
            </button>
          )}
          <div className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full text-sky-400 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
            <Wifi className="w-2.5 h-2.5 animate-bounce" /> {syncedNodes.length > 0 ? 'AĞ BAĞLANDI' : 'Arama Yapılıyor'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {nodes.map((node) => {
          const isSyncing = syncing === node.id;
          const isSynced = syncedNodes.includes(node.id);
          const isOffline = node.status === 'offline';

          return (
            <div
              key={node.id}
              className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                isSynced
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : isSyncing
                  ? 'bg-sky-500/5 border-sky-500/30 animate-pulse'
                  : 'bg-zinc-900/30 border-zinc-900/80 hover:border-zinc-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white">{node.name}</div>
                  <div className="flex items-center gap-1 text-[8px] font-mono tracking-wider">
                    <Wifi className={`w-3 h-3 ${isOffline ? 'text-zinc-600' : 'text-sky-400'}`} />
                    <span>%{isOffline ? '0' : node.signal}</span>
                  </div>
                </div>

                <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOffline ? 'bg-zinc-600' : isSynced ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span>
                    {isOffline ? 'Çevrimdışı' : isSynced ? 'Saha Verisi Senkronize' : 'Ağ Üzerinde Hazır'}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="text-[9px] font-bold text-zinc-600">
                  Kapsama: <span className="text-zinc-300">%{node.coverage}</span>
                </div>

                <button
                  onClick={() => !isOffline && handleSyncNode(node.id)}
                  disabled={isOffline}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                    isOffline
                      ? 'bg-zinc-900/50 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                      : isSynced
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                      : isSyncing
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {isOffline ? 'KAPALI' : isSynced ? 'BAĞLANTIYI KES' : isSyncing ? 'SENKRONİZASYON...' : 'AĞA KATIL'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {syncedNodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs overflow-hidden space-y-2 md:space-y-0"
          >
            <div className="flex items-center gap-2.5">
              <CloudLightning className={`w-5 h-5 ${loopClosureStatus === 'optimizing' ? 'text-amber-400 animate-spin' : 'text-sky-400 animate-bounce'}`} />
              <div>
                <div className="font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <span>Ortak Nokta Bulutu SLAM</span>
                  {loopClosureStatus === 'optimizing' && (
                    <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded animate-pulse">
                      LOOP_CLOSING_ACTIVE
                    </span>
                  )}
                  {loopClosureStatus === 'success' && (
                    <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded">
                      LOOP_CLOSED_DRIFT_COMPENSATED
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {loopClosureStatus === 'optimizing' 
                    ? 'Referans noktası çakışması tespit edildi! Matris optimize ediliyor...' 
                    : loopClosureStatus === 'success' 
                    ? 'Döngü başarıyla kapatıldı. Birikmiş sapma hatası sıfırlandı!' 
                    : 'Diğer operatörlerin verileriyle birleşik haritalama aktif'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right justify-between w-full md:w-auto">
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 flex flex-col text-left md:text-right">
                <div>Alınan Ek Point: <span className="text-sky-400 font-bold tabular-nums">{dataPoints} pts</span></div>
                <div className="mt-0.5">SLAM Sapması: <span className={`font-bold tabular-nums ${loopClosureStatus === 'optimizing' ? 'text-amber-400' : 'text-emerald-400'}`}>{driftValue.toFixed(2)}m</span></div>
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0">
                <div className={`px-2 py-0.5 rounded font-black text-[8px] uppercase tracking-widest ${
                  loopClosureStatus === 'optimizing' 
                    ? 'bg-amber-500/20 text-amber-400' 
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {loopClosureStatus === 'optimizing' ? 'MATRİS OPTİMİZASYONU' : 'AKTİF FÜZYON'}
                </div>
                <div className="text-[7px] text-sky-400 font-mono tracking-widest uppercase">
                  {loopClosureStatus === 'optimizing' ? 'LOOP CLOSURE: ÇALIŞIYOR' : 'LOOP CLOSURE: HAZIR'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
