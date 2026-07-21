import { db } from './firebase-config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDeviceCode } from './deviceHasher';

export type DeviceStatus = 'approved' | 'pending' | 'rejected' | 'new';

export interface DeviceRecord {
  deviceId: string;
  isApproved: boolean;
  createdAt: any;
  updatedAt?: any;
  lastAccessAt?: any;
}

/**
 * Cihazın Firebase'deki durumunu kontrol eder
 * Üç sonuç olabilir:
 * 1. 'approved' - Cihaz onaylanmış, giriş yap
 * 2. 'pending' - Cihaz beklemede, onay ekranı göster
 * 3. 'new' - İlk kez giriş, Firebase'e kayıt et
 */
export const checkDeviceApproval = async (): Promise<{
  status: DeviceStatus;
  deviceId: string;
  data?: DeviceRecord;
}> => {
  try {
    const deviceId = await getDeviceCode();
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);

    if (snap.exists()) {
      // Cihaz daha önce kaydedilmiş
      const data = snap.data() as DeviceRecord;

      if (data.isApproved === true) {
        console.log('✅ Cihaz ONAYLANDI:', deviceId);
        return { status: 'approved', deviceId, data };
      } else {
        console.log('⏳ Cihaz BEKLEMEDEdir:', deviceId);
        return { status: 'pending', deviceId, data };
      }
    } else {
      // İlk kez giriş - Firebase'e false olarak kaydet
      const newRecord: DeviceRecord = {
        deviceId,
        isApproved: false,
        createdAt: new Date().toISOString(),
      };

      await setDoc(deviceRef, newRecord);
      console.log('🆕 Yeni Cihaz Kaydedildi:', deviceId);

      return { status: 'new', deviceId, data: newRecord };
    }
  } catch (error) {
    console.error('❌ Cihaz onay kontrolü hatası:', error);
    throw error;
  }
};

/**
 * Cihazın son erişim zamanını güncelle
 */
export const updateLastAccess = async (deviceId: string) => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    await setDoc(
      deviceRef,
      { lastAccessAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (error) {
    console.error('❌ Son erişim güncelleme hatası:', error);
  }
};

/**
 * Cihazın Firebase'deki bilgilerini getir
 */
export const getDeviceInfo = async (deviceId: string): Promise<DeviceRecord | null> => {
  try {
    const deviceRef = doc(db, 'devices', deviceId);
    const snap = await getDoc(deviceRef);

    if (snap.exists()) {
      return snap.data() as DeviceRecord;
    }
    return null;
  } catch (error) {
    console.error('❌ Cihaz bilgisi alma hatası:', error);
    return null;
  }
};
