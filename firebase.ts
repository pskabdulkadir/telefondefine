import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, child, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "BURAYA_KENDI_API_KEY_GELECEK",
  databaseURL: "https://akn-global-sistem-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "akn-global-sistem",
  appId: "BURAYA_APP_ID_GELECEK"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Onay kontrol fonksiyonu
export const checkApproval = async (id: string) => {
  // Geliştirici / Test bypass kontrolü (Local Storage üzerinde)
  if (typeof window !== "undefined" && window.localStorage && window.localStorage.getItem('sh_device_approved') === 'true') {
    return true;
  }

  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `cihazlar/${id}`));
    if (snapshot.exists()) {
      const val = snapshot.val();
      // Hem doğrudan boolean true değerini hem de { onay: true } objesini destekler
      return val === true || val.onay === true;
    } else {
      // Cihaz hiç yoksa, Firebase'e 'onay bekliyor' olarak (false) kaydet
      try {
        await set(ref(db, `cihazlar/${id}`), {
          onay: false,
          kayitTarihi: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Firebase set entry failed:", e);
      }
      return false;
    }
  } catch (error) {
    console.error("Firebase connection/authentication error:", error);
    // Firebase bağlantı hatası durumunda, eğer bypass yoksa onay bekliyor durumuna düşür ama hatayı fırlatma
    return false;
  }
};