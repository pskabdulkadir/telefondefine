import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedDeviceId: string | null = null;

/**
 * Cihazın sabit bir kimliğini üretir
 * Örn: SH-ABC123DEF456
 */
export const getDeviceCode = async (): Promise<string> => {
  // Eğer zaten cache'de varsa, aynısını dön
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    // FingerprintJS'i yükle
    const fp = await FingerprintJS.load();
    const result = await fp.get();

    // Cihazın parmak izi ID'sini al (sabit kalır)
    const rawId = result.visitorId;

    // ID'yi SH-XXXX formatına dönüştür
    // SHA-256 hash'in ilk 8 karakterini alıyoruz
    const shortId = rawId.substring(0, 8).toUpperCase();
    const formattedCode = `SH-${shortId}`;

    // Cache'e kaydet (sayfa yenilenene kadar aynı ID döner)
    cachedDeviceId = formattedCode;

    console.log('✅ Cihaz Kimliği Üretildi:', formattedCode);
    return formattedCode;
  } catch (error) {
    console.error('❌ Device ID üretme hatası:', error);
    // Hata durumunda fallback olarak basit bir ID oluştur
    const fallbackId = `SH-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    cachedDeviceId = fallbackId;
    return fallbackId;
  }
};

/**
 * Cached device ID'yi temizle (test için)
 */
export const clearDeviceCache = () => {
  cachedDeviceId = null;
};

/**
 * Cihazın tüm fingerprint detaylarını döner
 */
export const getDeviceFingerprint = async () => {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result;
  } catch (error) {
    console.error('❌ Fingerprint alma hatası:', error);
    return null;
  }
};
