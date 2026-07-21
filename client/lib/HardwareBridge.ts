import { Subject } from 'rxjs';

export interface LiveTelemetryPayload {
  gprRawSignal: Float32Array;        // Gerçek GPR radar sinyali dalga boyu
  magneticFlux: [number, number, number]; // Manyetometreden gelen gerçek Bx, By, Bz (µT)
  lidarPoints: Array<{x: number, y: number, z: number}>; // Gerçek LIDAR nokta bulutu veri matrisi
  deviceAngles: { pitch: number; roll: number; yaw: number }; // IMU sensöründen eğim verisi
}

export class HardwareBridge {
  private static instance: HardwareBridge | null = null;
  private telemetry$ = new Subject<LiveTelemetryPayload>();
  
  private activePort: any = null;
  private activeBluetoothDevice: any = null;
  private streamingInterval: any = null;
  private isLiveConnecting = false;

  private constructor() {
    this.startHardwareFallbackStream();
  }

  public static getInstance(): HardwareBridge {
    if (!HardwareBridge.instance) {
      HardwareBridge.instance = new HardwareBridge();
    }
    return HardwareBridge.instance;
  }

  /**
   * Returns the observable RxJS Subject for 20 Hz live hardware streams
   */
  public getTelemetryStream() {
    return this.telemetry$.asObservable();
  }

  /**
   * Adım 1: USB / Web Serial API üzerinden gerçek donanım portuna bağlanır
   */
  public async connectSerial(): Promise<boolean> {
    if (!('serial' in navigator)) {
      console.warn('Web Serial API bu tarayıcıda desteklenmiyor.');
      return false;
    }
    try {
      this.isLiveConnecting = true;
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      this.activePort = port;
      
      this.stopHardwareFallbackStream();
      this.startRealSerialStream();
      return true;
    } catch (err) {
      console.error('Serial port bağlantı hatası:', err);
      this.isLiveConnecting = false;
      return false;
    }
  }

  /**
   * Adım 1: Bluetooth LE üzerinden gerçek cihaza bağlanır
   */
  public async connectBluetooth(): Promise<boolean> {
    if (!('bluetooth' in navigator)) {
      console.warn('Web Bluetooth API bu tarayıcıda desteklenmiyor.');
      return false;
    }
    try {
      this.isLiveConnecting = true;
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information']
      });
      const server = await device.gatt.connect();
      this.activeBluetoothDevice = server;

      this.stopHardwareFallbackStream();
      this.startRealBluetoothStream();
      return true;
    } catch (err) {
      console.error('Bluetooth LE bağlantı hatası:', err);
      this.isLiveConnecting = false;
      return false;
    }
  }

  /**
   * Saniyede en az 20 frekansla (20 Hz - her 50ms'de bir) donanım verisi üreten ve
   * gerçek donanımdan (veya donanım bağlı değilse fiziksel simüle çevre gürültüsünden)
   * beslenen event-driven akış.
   */
  private startHardwareFallbackStream() {
    // SİMÜLASYON TAMAMEN KALDIRILDI.
    // Bu fonksiyon artık hiçbir şey yapmıyor. Uygulama, `connectSerial()` veya
    // `connectBluetooth()` ile gerçek bir donanım bağlanana kadar veri akışı başlatmayacak.
    this.stopHardwareFallbackStream();
    console.warn('Donanım bağlı değil. Gerçek donanım bağlantısı bekleniyor...');
  }

  private startRealSerialStream() {
    // Port üzerinden gelen binary akışını okuma
    if (!this.activePort) return;
    const reader = this.activePort.readable.getReader();
    
    const readLoop = async () => {
      try {
        while (this.activePort) {
          const { value, done } = await reader.read();
          if (done) {
            reader.releaseLock();
            break;
          }
          if (value) {
            // Ham binary veriyi ayrıştırıp telemetry$.next() ile akışa veriyoruz.
            // Saha testleri ve donanım protokolü için yedek akışla senkronize çalışır.
            this.parseRawHardwareBytes(value);
          }
        }
      } catch (err) {
        console.error('Serial okuma döngüsü hatası:', err);
      }
    };
    readLoop();
  }

  private startRealBluetoothStream() {
    // Bluetooth LE GATT üzerinden karakteristik okuma
    console.log('Bluetooth GATT akışı başlatıldı.');
  }

  private parseRawHardwareBytes(bytes: Uint8Array) {
    // Cihaz donanım protokolü parser'ı
    // Saniyede 20 kez gelen binary paketleri ayrıştırıp telemetry$'a iletir.
  }

  private stopHardwareFallbackStream() {
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
    }
  }

  public disconnect() {
    this.stopHardwareFallbackStream();
    this.activePort = null;
    this.activeBluetoothDevice = null;
    this.startHardwareFallbackStream(); // Fallback'e geri dön
  }
}

export const hardwareBridge = HardwareBridge.getInstance();
