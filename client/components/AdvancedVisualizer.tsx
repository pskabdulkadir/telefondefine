import React, { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  Text, 
  Float, 
  MeshDistortMaterial, 
  Stars, 
  Sparkles,
  Environment,
  ContactShadows,
  OrbitControls,
  Grid
} from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { XR, createXRStore } from '@react-three/xr';
import { Camera as CameraIcon, ShieldAlert } from 'lucide-react';
import { Point, SensorData } from '../lib/sensors';

// --- CUSTOM SHADERS ---

const PointCloudShader = {
  uniforms: {
    uTime: { value: 0 },
    uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
    uThreshold: { value: 0.5 },
    uBaseMag: { value: 48.0 },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uPixelRatio;
    
    attribute float aIntensity;
    attribute float aMagIntensity;
    
    varying float vMagIntensity;
    varying vec3 vColor;
    varying float vDistance;
    
    void main() {
      vMagIntensity = aMagIntensity;
      vColor = color;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vDistance = -mvPosition.z;
      
      // Volumetric feel: Point size based on magnetic intensity
      // Points grow when they hit an anomaly
      float anomaly = abs(aMagIntensity - 48.0);
      float size = (2.0 + anomaly * 0.5) * uPixelRatio;
      
      gl_PointSize = size * (1.5 / vDistance);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uBaseMag;
    varying float vMagIntensity;
    varying vec3 vColor;
    varying float vDistance;
    
    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5));
      if (dist > 0.5) discard;
      
      // Dynamic Heatmap: Blue -> Green -> Yellow -> Red
      // Target anomalies: +/- 5 uT from base
      float diff = vMagIntensity - uBaseMag;
      float absDiff = abs(diff);
      
      // Smooth gradient mapping
      float norm = clamp(absDiff / 20.0, 0.0, 1.0);
      
      vec3 heat;
      if (norm < 0.25) {
        heat = mix(vec3(0.1, 0.3, 1.0), vec3(0.1, 1.0, 0.5), norm * 4.0);
      } else if (norm < 0.5) {
        heat = mix(vec3(0.1, 1.0, 0.5), vec3(1.0, 1.0, 0.0), (norm - 0.25) * 4.0);
      } else if (norm < 0.75) {
        heat = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.5, 0.0), (norm - 0.5) * 4.0);
      } else {
        heat = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.0, 0.1), (norm - 0.75) * 4.0);
      }
      
      // Flicker tied to state
      float flicker = 0.8 + 0.2 * sin(uTime * 10.0);
      float alpha = (0.6 - dist) * 2.0 * flicker;
      
      // Fade distant points for volumetric depth
      alpha *= clamp(1.0 - (vDistance / 20.0), 0.0, 1.0);
      
      gl_FragColor = vec4(heat, alpha);
    }
  `
};

const HologramShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#10b981') },
    uFrequency: { value: 60.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uFrequency;
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      // Scanlines
      float scanline = sin(vPosition.y * 50.0 - uTime * uFrequency * 0.1) * 0.5 + 0.5;
      scanline = pow(scanline, 3.0);
      
      // Flicker - synced with sensor frequency (uFrequency)
      float flicker = 0.95 + 0.05 * sin(uTime * uFrequency * 2.0);
      
      float alpha = (0.2 + scanline * 0.5) * flicker;
      
      // Edge glow
      float edge = 1.0 - vUv.y;
      
      gl_FragColor = vec4(uColor, alpha * edge);
    }
  `
};

// --- COMPONENTS ---

export const AdvancedPointCloud = ({ points, threshold }: { points: Point[], threshold: number }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const [positions, intensity, magIntensity, colors] = useMemo(() => {
    const rawPoints = Array.isArray(points) ? points : [];
    const safePoints = rawPoints.filter(p => p && p.position && Array.isArray(p.position));
    const count = safePoints.length;
    const pos = new Float32Array(count * 3);
    const intens = new Float32Array(count);
    const magIntens = new Float32Array(count);
    const col = new Float32Array(count * 3);

    safePoints.forEach((p, i) => {
      pos[i * 3] = p.position[0];
      pos[i * 3 + 1] = p.position[1];
      pos[i * 3 + 2] = p.position[2];
      intens[i] = p.intensity || 0;
      magIntens[i] = p.magIntensity || 48;
      
      const c = new THREE.Color(p.color || '#10b981');
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });

    return [pos, intens, magIntens, col];
  }, [points]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      materialRef.current.uniforms.uThreshold.value = threshold;
    }
  });

  if (positions.length === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aIntensity"
          count={intensity.length}
          array={intensity}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aMagIntensity"
          count={magIntensity.length}
          array={magIntensity}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        {...PointCloudShader}
      />
    </points>
  );
};

export const HolographicPanel = ({ data }: { data: any }) => {
  const groupRef = useRef<THREE.Group>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      // Floating motion
      const oscillation = Math.sin(state.clock.getElapsedTime());
      groupRef.current.position.y = -1 + oscillation * 0.1;
      groupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.05;
      
      // Scale pulse on high intensity
      const magTotal = data?.magnetic?.total || 48;
      const deviation = Math.abs(magTotal - 48);
      const scaleBoost = 1 + Math.min(0.2, deviation / 50);
      groupRef.current.scale.setScalar(scaleBoost);
    }
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      // Increase flicker on high intensity
      shaderRef.current.uniforms.uFrequency.value = 60.0 + Math.min(60, (data?.magnetic?.total || 48) - 48);
    }
  });

  const hologramUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#10b981') },
    uFrequency: { value: 60.0 },
  }), []);

  return (
    <group ref={groupRef} position={[2, -1, -2]} rotation={[0, -Math.PI / 4, 0]}>
      {/* Background Plate */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[1.5, 2]} />
        <shaderMaterial 
          ref={shaderRef}
          transparent 
          side={THREE.DoubleSide} 
          {...HologramShader} 
          uniforms={hologramUniforms}
        />
      </mesh>
      
      {/* Grid Pattern */}
      <gridHelper args={[2, 10, '#10b981', '#064e3b']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]} />

      <Text
        position={[0, 0.8, 0.05]}
        fontSize={0.08}
        color="#10b981"
      >
        ECHELON v4 STATUS
      </Text>

      <Text
        position={[-0.6, 0.6, 0.05]}
        fontSize={0.05}
        color="#10b981"
        anchorX="left"
      >
        {`MAG_X: ${(data?.magnetic?.x || 0).toFixed(2)}\nMAG_Y: ${(data?.magnetic?.y || 0).toFixed(2)}\nMAG_Z: ${(data?.magnetic?.z || 0).toFixed(2)}\nTOTAL: ${(data?.magnetic?.total || 0).toFixed(2)} uT`}
      </Text>

      <Text
        position={[-0.6, 0.2, 0.05]}
        fontSize={0.05}
        color="#38bdf8"
        anchorX="left"
      >
        {`PITCH: ${(data?.orientation?.beta || 0).toFixed(1)}°\nROLL : ${(data?.orientation?.gamma || 0).toFixed(1)}°\nYAW  : ${(data?.orientation?.alpha || 0).toFixed(1)}°`}
      </Text>

      <Text
        position={[-0.6, -0.2, 0.05]}
        fontSize={0.05}
        color="#fbbf24"
        anchorX="left"
      >
        {`SENSORS: ONLINE\nCALIB: OPTIMAL\nSTREAM: 60Hz`}
      </Text>

      {/* Decorative Borders */}
      <mesh position={[0.7, 0, 0]}>
        <boxGeometry args={[0.02, 1.8, 0.01]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
      </mesh>
      <mesh position={[-0.7, 0, 0]}>
        <boxGeometry args={[0.02, 1.8, 0.01]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

export const store = createXRStore();

export const AdvancedVisualizer = ({ data, threshold, isScanning, analysis, children }: { data: SensorData, threshold: number, isScanning: boolean, analysis: any, children?: React.ReactNode }) => {
  const [canvasKey, setCanvasKey] = React.useState(0);
  const [contextError, setContextError] = React.useState(false);
  const [xrActive, setXrActive] = React.useState(false);

  React.useEffect(() => {
    // Sync current session state on mount
    setXrActive(!!store.getState().session);

    // Subscribe to session transitions
    const unsubscribe = store.subscribe((state: any) => {
      setXrActive(!!state.session);
    });

    return unsubscribe;
  }, []);

  const handleContextLost = (event: any) => {
    event.preventDefault();
    console.warn("WEBGL_CONTEXT_LOST detected. Attempting recovery...");
    setContextError(true);
  };

  const recoverContext = () => {
    setCanvasKey(prev => prev + 1);
    setContextError(false);
  };

  const sceneContent = (
    <group>
      <AdvancedPointCloud points={data?.points} threshold={threshold} />
      <HolographicPanel data={data} />
      <ScanningPlane threshold={threshold} isScanning={isScanning} />
      <Crosshair />
      
      {analysis && (
        <group position={[0, 2, 0]}>
           <DetectionHologram type={analysis.type} status={analysis.status} />
        </group>
      )}

      {!analysis && (Array.isArray(data?.points) ? data.points.length : 0) < 5 && (
        <Float speed={2} rotationIntensity={1} floatIntensity={1}>
          <Text
            position={[0, 0, -2]}
            fontSize={0.8}
            color="#10b981"
            fillOpacity={0.15}
            anchorX="center"
            anchorY="middle"
          >
            SİNYAL BEKLENİYOR...
          </Text>
        </Float>
      )}

      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      <Sparkles count={50} scale={15} size={2} speed={0.8} color="#10b981" />
      <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={20} blur={2.4} />
      <Environment preset="night" />
      <fog attach="fog" args={['#020617', 10, 40]} />

      <Grid 
        infiniteGrid 
        fadeDistance={50} 
        fadeStrength={5} 
        cellSize={1} 
        sectionSize={5} 
        sectionThickness={1.5} 
        sectionColor="#10b981" 
        cellColor="#064e3b" 
        position={[0, -2, 0]}
      />

      <OrbitControls makeDefault enablePan={true} enableZoom={true} dampingFactor={0.05} />
    </group>
  );

  return (
    <div className="relative w-full h-full">
      {/* AR Trigger Button */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-4 pointer-events-auto">
        {contextError ? (
          <button 
            onClick={recoverContext}
            className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all flex items-center gap-3 active:scale-95"
          >
            <ShieldAlert className="w-6 h-6" /> SİSTEMİ YENİDEN BAŞLAT
          </button>
        ) : (
          <button 
            onClick={() => {
              store.enterAR().catch((err: any) => {
                console.warn("AR Mode could not be initialized or was rejected:", err);
              });
            }}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all flex items-center gap-3 active:scale-95"
          >
            <CameraIcon className="w-6 h-6" /> AR MODUNU BAŞLAT
          </button>
        )}
      </div>

      <Canvas 
        key={canvasKey}
        camera={{ position: [0, 8, 15], fov: 60 }} 
        shadows 
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', handleContextLost, false);
        }}
      >
        <Suspense fallback={null}>
          {xrActive ? (
            <XR store={store}>
              {sceneContent}
            </XR>
          ) : (
            sceneContent
          )}
          
          <EffectComposer enableNormalPass={false}>
            <Bloom luminanceThreshold={0.8} intensity={1.5} mipmapBlur={false} />
            <Noise opacity={0.05} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>

          {children}
        </Suspense>
      </Canvas>
    </div>
  );
};

const DetectionHologram = ({ type, status }: { type: string, status: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const typeLower = (type || '').toLowerCase();
  
  const isMetal = typeLower.includes('metal') || typeLower.includes('altın');
  const isVoid = typeLower.includes('boşluk') || typeLower.includes('oda') || typeLower.includes('tünel');
  const isStructure = typeLower.includes('yapı') || typeLower.includes('temel');

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.5;
      meshRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 2) * 0.2;
    }
  });

  return (
    <Float speed={5} rotationIntensity={2} floatIntensity={2}>
      <mesh ref={meshRef}>
        {isMetal && <octahedronGeometry args={[2, 0]} />}
        {isVoid && <boxGeometry args={[4, 2, 4]} />}
        {isStructure && <dodecahedronGeometry args={[2.5, 0]} />}
        {!isMetal && !isVoid && !isStructure && <icosahedronGeometry args={[1.5, 0]} />}
        
        <MeshDistortMaterial 
          color={isMetal ? '#fbbf24' : isVoid ? '#38bdf8' : '#10b981'} 
          speed={isMetal ? 5 : 2} 
          distort={0.4} 
          emissive={isMetal ? '#fbbf24' : isVoid ? '#38bdf8' : '#10b981'} 
          emissiveIntensity={1.5} 
          transparent
          opacity={0.8}
          wireframe={isVoid}
        />
      </mesh>
      
      {/* Scan Ring FX */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0, -1]}>
          <torusGeometry args={[3.2, 0.05, 16, 100]} />
          <meshBasicMaterial color={isMetal ? '#fbbf24' : '#10b981'} transparent opacity={0.2} />
        </mesh>
        <mesh position={[0, 0, 1]}>
          <torusGeometry args={[3.2, 0.05, 16, 100]} />
          <meshBasicMaterial color={isMetal ? '#fbbf24' : '#10b981'} transparent opacity={0.2} />
        </mesh>
      </group>

      {/* Point Cloud Sparkles fixed to detection */}
      <Sparkles count={40} scale={5} size={3} speed={2} color={isMetal ? '#fbbf24' : '#10b981'} />

      <Text
        position={[0, -3.5, 0]}
        fontSize={0.4}
        color="white"
        font="/fonts/Inter-Bold.ttf"
        anchorX="center"
      >
        {`${type.toUpperCase()} // GÜVEN: %${status}`}
      </Text>
    </Float>
  );
}

const ScanningPlane = ({ threshold, isScanning }: { threshold: number, isScanning: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 1.5) * 4;
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = (Math.sin(state.clock.getElapsedTime() * 5) * 0.1 + 0.2) * (isScanning ? 1.5 : 1);
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshBasicMaterial 
        color="#10b981" 
        transparent 
        opacity={0.2} 
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

const Crosshair = () => {
  return (
    <group>
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0.2, 0.22, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0.5, 0.51, 4]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};
