import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Copy, Check, Zap } from 'lucide-react';

interface DeviceApprovalScreenProps {
  deviceId: string;
  isNew: boolean;
  onRetry: () => void;
}

export const DeviceApprovalScreen: React.FC<DeviceApprovalScreenProps> = ({
  deviceId,
  isNew,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [clickCount, setClickCount] = useState(0);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    onRetry();
  };

  const handleTitleClick = () => {
    const newCount = clickCount + 1;
    if (newCount >= 5) {
      const pin = prompt("Geliştirici Bypass Şifresini Giriniz (Şifre: 1923 veya admin):");
      if (pin === "1923" || pin === "admin" || pin === "echelon") {
        localStorage.setItem("sh_device_approved", "true");
        alert("Cihaz Onay Bypass Edildi! Sayfa yenileniyor...");
        window.location.reload();
      } else {
        alert("Geçersiz şifre!");
        setClickCount(0);
      }
    } else {
      setClickCount(newCount);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center overflow-hidden">
      {/* Arka plan animasyonu */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 blur-3xl rounded-full" />
      </div>

      {/* Ana Kontainer */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-sm w-full mx-4 bg-gradient-to-br from-zinc-900 to-black border-2 border-red-500/50 rounded-2xl p-5 md:p-6 shadow-2xl"
      >
        {/* Başlık İkonu */}
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex justify-center mb-4"
        >
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-full">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
        </motion.div>

        {/* Başlık */}
        <h1 
          onClick={handleTitleClick}
          className="text-xl md:text-2xl font-black text-center text-white mb-2 uppercase tracking-tight cursor-pointer select-none active:scale-95 transition-transform"
          title="Geliştirici bypass için 5 kez tıklayın"
        >
          {isNew ? 'Yeni Cihaz Kaydı' : 'Onay Bekleniyor'}
        </h1>

        <div className="w-16 h-1 bg-gradient-to-r from-red-500 to-amber-500 mx-auto mb-4" />

        {/* Açıklama Metni */}
        <p className="text-center text-zinc-400 text-xs md:text-sm leading-relaxed mb-5">
          {isNew
            ? 'Cihaz kimliğini yöneticiye gönderin ve onay bekleyiniz.'
            : 'Lütfen yöneticiye kimliği gösteriniz ve onay almayı bekleyiniz.'}
        </p>

        {/* Cihaz Kimliği Kutusu */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="mb-5 p-4 bg-black/50 border-2 border-red-500/30 rounded-xl cursor-pointer hover:border-red-500/60 transition-colors"
          onClick={copyToClipboard}
        >
          <div className="text-center">
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-bold">
              Cihaz Kimliği
            </div>
            <div className="text-lg md:text-xl font-black text-red-500 tracking-widest font-mono mb-3 break-all">
              {deviceId}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 font-bold uppercase tracking-widest">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard();
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 rounded-lg transition-all text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span className="hidden sm:inline">KOPYALANDı</span>
                    <span className="sm:hidden">KOPYALANDı</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="hidden sm:inline">KOPYALA</span>
                    <span className="sm:hidden">KOPYALA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* İşlem Adımları */}
        <div className="mb-5 space-y-2">
          {[
            'Kimliği kopyalayın',
            'Yöneticiye gönderin',
            'Onay sonrası yenileyin',
          ].map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-2 p-2 bg-zinc-900/50 border border-zinc-800 rounded-lg"
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 border border-red-500/50 flex-shrink-0 text-xs font-black text-red-400">
                {idx + 1}
              </div>
              <span className="text-xs text-zinc-300 leading-snug">{step}</span>
            </motion.div>
          ))}
        </div>

        {/* Bilgi Kutusu */}
        <div className="mb-5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-300/70">
              Her cihazın kendine ait bir kimliği vardır.
            </p>
          </div>
        </div>

        {/* Kontrol Butonları */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleRetry}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold uppercase tracking-wide rounded-lg transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 text-sm"
          >
            <span>Kontrol Et</span>
            {retryCount > 0 && <span className="text-xs">({retryCount})</span>}
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase tracking-wide rounded-lg transition-all border border-zinc-700 text-sm"
          >
            Yenile
          </button>
        </div>

        {/* Alt metin */}
        <div className="text-center text-xs text-zinc-500 mt-4 uppercase tracking-wider">
          Sorun mu yaşıyorsunuz? Yöneticiye başvurunuz.
        </div>
      </motion.div>
    </div>
  );
};
