import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Layers, Map, Shield, HelpCircle } from 'lucide-react';

export type MissionType = 'shallow_metal' | 'deep_cavity' | 'tunnel_mapping';

interface Mission {
  id: MissionType;
  title: string;
  desc: string;
  depthRange: string;
  focusSensors: string[];
  visualizerMode: string;
  color: string;
  icon: any;
}

export const MISSIONS: Mission[] = [
  {
    id: 'shallow_metal',
    title: 'Yüzeysel Metal Tespiti',
    desc: 'Yüksek çözünürlüklü manyetometre ve ses spektrografisi ile yüzeysel iletken metal arama modu.',
    depthRange: '0.2m - 2.5m',
    focusSensors: ['Manyetometre (Fine)', 'Audio Rezonans (High-Pass)', 'Edge Density'],
    visualizerMode: 'X-Ray & Penetrasyon',
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/40 text-amber-400 shadow-amber-500/5',
    icon: Compass,
  },
  {
    id: 'deep_cavity',
    title: 'Derin Boşluk Analizi',
    desc: 'Düşük frekanslı jeo-fiziksel anomaliler, yerçekimi ivme füzyonu ve yeraltı oda/mahzen tespiti.',
    depthRange: '3.0m - 12.0m',
    focusSensors: ['Yerçekimi İvme Kontrolü', 'Düşük Frekans Analizi', 'Edge Pixel Density'],
    visualizerMode: '3D Mapping & Point Cloud',
    color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/40 text-purple-400 shadow-purple-500/5',
    icon: Layers,
  },
  {
    id: 'tunnel_mapping',
    title: 'Tünel Haritalama & Geçit',
    desc: 'IMU yörünge takibi ve barometrik dikey çözünürlük kalibrasyonu ile doğrusal boşluk tespiti.',
    depthRange: '1.5m - 8.0m',
    focusSensors: ['IMU Trajectory SLAM', 'Barometrik İrtifa', 'Vector Manyetik Alan'],
    visualizerMode: 'Collaborative SLAM Map',
    color: 'from-sky-500/20 to-blue-500/10 border-sky-500/40 text-sky-400 shadow-sky-500/5',
    icon: Map,
  },
];

interface MissionSelectorProps {
  selectedMission: MissionType;
  onSelectMission: (mission: MissionType) => void;
  onOpenDetail?: () => void;
}

export const MissionSelector: React.FC<MissionSelectorProps> = ({
  selectedMission,
  onSelectMission,
  onOpenDetail,
}) => {
  return (
    <div className="w-full space-y-6 group">
      <div className="flex items-center justify-between">
        <div onClick={onOpenDetail} className="cursor-pointer">
          <h3 className="text-lg font-black tracking-tight text-white uppercase group-hover:text-amber-400 transition-colors flex items-center gap-2">
            GÖREV ODAKLI SAHA MODLARI <span className="text-[9px] font-bold text-zinc-600 group-hover:text-amber-500/60 uppercase tracking-widest">(DETAY)</span>
          </h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Saha amacına göre optimize edilmiş sensör profilleri</p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenDetail && (
            <button
              onClick={onOpenDetail}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white text-[9px] font-bold uppercase tracking-wider transition-all"
            >
              PROVAYI İNCELE
            </button>
          )}
          <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Otomatik Kalibrasyon</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MISSIONS.map((mission) => {
          const isSelected = selectedMission === mission.id;
          const Icon = mission.icon;

          return (
            <motion.button
              key={mission.id}
              onClick={() => onSelectMission(mission.id)}
              whileHover={{ y: -4 }}
              className={`text-left p-6 rounded-3xl border transition-all relative overflow-hidden backdrop-blur-md flex flex-col justify-between ${
                isSelected
                  ? `bg-gradient-to-br ${mission.color} shadow-lg ring-1 ring-emerald-500/20`
                  : 'bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                <Icon className="w-24 h-24" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-2xl ${isSelected ? 'bg-zinc-950/60' : 'bg-zinc-900/60'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {isSelected && (
                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[8px] font-black uppercase tracking-widest">
                      KİLİTLİ
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white tracking-tight">{mission.title}</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2">{mission.desc}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-900/40 flex items-center justify-between text-[8px] font-mono tracking-wider uppercase text-zinc-500">
                <div>
                  Derinlik: <span className="text-white font-bold">{mission.depthRange}</span>
                </div>
                <div>
                  Profil: <span className="text-white font-bold">{mission.visualizerMode}</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
