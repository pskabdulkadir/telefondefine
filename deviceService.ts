import fpPromise from '@fingerprintjs/fingerprintjs';

export const getSHIdentity = async (): Promise<string> => {
  // 1. Önce daha önce kaydedilmiş bir ID var mı bak (Tarayıcı bazlı kalıcılık)
  const savedId = localStorage.getItem('sh_device_identity');
  if (savedId) return savedId;

  try {
    const fp = await fpPromise.load();
    const result = await fp.get();
    const visitorId = result.visitorId;

    // 2. Benzersizliği artırmak için ekstra bileşenler ekle
    const components = [
      visitorId,
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      Math.random().toString(36).substring(2, 15) // İlk üretimde tam rastgelelik sağlar
    ];
    
    const combinedSeed = components.join('|');

    // 3. Karmaşık (Hash) üretim mantığı
    let hash = 0;
    for (let i = 0; i < combinedSeed.length; i++) {
      hash = ((hash << 5) - hash) + combinedSeed.charCodeAt(i);
      hash |= 0; // 32bit integer'a zorla
    }
    
    const shortId = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    const finalId = `SH-${shortId}`;

    // 4. Üretilen ID'yi tarayıcıya kaydet (Böylece hep aynı kalır)
    localStorage.setItem('sh_device_identity', finalId);
    return finalId;

  } catch (error) {
    const fallbackId = `SH-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    localStorage.setItem('sh_device_identity', fallbackId);
    return fallbackId;
  }
};