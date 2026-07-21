import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Eye, Target, Sparkles, Activity } from 'lucide-react';

interface AROverlayProps {
  alpha: number; // heading (0-360)
  beta: number;  // tilt front/back
  gamma: number; // tilt left/right
  anomalyScore: number;
  anomalyType: string;
}

export const AROverlay: React.FC<AROverlayProps> = ({
  alpha,
  beta,
  gamma,
  anomalyScore,
  anomalyType,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;

    const render = () => {
      // Resize canvas to match layout
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Calculate translation offset based on device orientation angles
      // Normalizing gamma (left/right tilt) and beta (front/back tilt) to pixel displacements
      const offsetX = Math.sin((gamma * Math.PI) / 180) * 180;
      const offsetY = Math.sin((beta * Math.PI) / 180) * 180;

      // Base target center
      const tx = cx + offsetX;
      const ty = cy + offsetY;

      // Draw AR Grid Overlay
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
      }
      for (let j = 0; j < canvas.height; j += 40) {
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
      }
      ctx.stroke();

      // Only draw 3D hologram if there is an active/medium/high anomaly
      if (anomalyScore > 30) {
        // Draw depth lines
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rotation angle derived from heading (alpha)
        const angle = (alpha * Math.PI) / 180;

        // Render 3D Cube / Vault representation
        const size = 120 + Math.sin(Date.now() / 300) * 5; // breathing pulse
        const vertices = [
          { x: -1, y: -1, z: -1 },
          { x: 1, y: -1, z: -1 },
          { x: 1, y: 1, z: -1 },
          { x: -1, y: 1, z: -1 },
          { x: -1, y: -1, z: 1 },
          { x: 1, y: -1, z: 1 },
          { x: 1, y: 1, z: 1 },
          { x: -1, y: 1, z: 1 },
        ];

        // Project and transform vertices
        const projected = vertices.map((v) => {
          // Rotate around Y axis based on compass heading
          const x1 = v.x * Math.cos(angle) - v.z * Math.sin(angle);
          const z1 = v.x * Math.sin(angle) + v.z * Math.cos(angle);

          // Rotate around X axis based on tilt
          const tiltAngle = (beta * Math.PI) / 180;
          const y2 = v.y * Math.cos(tiltAngle) - z1 * Math.sin(tiltAngle);
          const z2 = v.y * Math.sin(tiltAngle) + z1 * Math.cos(tiltAngle);

          // Simple perspective projection
          const distance = 3.0;
          const scale = 1 / (distance - z2 * 0.4);

          return {
            x: tx + x1 * size * scale,
            y: ty + y2 * size * scale * 0.7,
          };
        });

        // Draw connections
        const drawEdge = (i: number, j: number, color: string, width = 1.5) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(projected[i].x, projected[i].y);
          ctx.lineTo(projected[j].x, projected[j].y);
          ctx.stroke();
        };

        const themeColor = anomalyType.includes('METAL') 
          ? 'rgba(245, 158, 11, 0.75)'  // Amber gold color for metallic
          : 'rgba(168, 85, 247, 0.75)'; // Purple for Cavity/Void

        const pulseColor = anomalyType.includes('METAL') 
          ? `rgba(245, 158, 11, ${0.15 + Math.sin(Date.now() / 150) * 0.05})`
          : `rgba(168, 85, 247, ${0.15 + Math.sin(Date.now() / 150) * 0.05})`;

        // Draw solid glowing faces
        ctx.fillStyle = pulseColor;
        ctx.beginPath();
        ctx.moveTo(projected[0].x, projected[0].y);
        ctx.lineTo(projected[1].x, projected[1].y);
        ctx.lineTo(projected[2].x, projected[2].y);
        ctx.lineTo(projected[3].x, projected[3].y);
        ctx.closePath();
        ctx.fill();

        // Draw edges of cube
        // Bottom face
        drawEdge(0, 1, themeColor, 2);
        drawEdge(1, 2, themeColor, 2);
        drawEdge(2, 3, themeColor, 2);
        drawEdge(3, 0, themeColor, 2);
        // Top face
        drawEdge(4, 5, themeColor, 2);
        drawEdge(5, 6, themeColor, 2);
        drawEdge(6, 7, themeColor, 2);
        drawEdge(7, 4, themeColor, 2);
        // Vertical edges
        drawEdge(0, 4, themeColor, 1.5);
        drawEdge(1, 5, themeColor, 1.5);
        drawEdge(2, 6, themeColor, 1.5);
        drawEdge(3, 7, themeColor, 1.5);

        // Draw crosshairs at target coordinates
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, 15, 0, Math.PI * 2);
        ctx.moveTo(tx - 25, ty);
        ctx.lineTo(tx + 25, ty);
        ctx.moveTo(tx, ty - 25);
        ctx.lineTo(tx, ty + 25);
        ctx.stroke();

        // Anomaly Tag Label on top of target
        ctx.fillStyle = 'rgba(5, 5, 5, 0.85)';
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1.5;
        const text = `${anomalyType} [ GÜVEN: %${anomalyScore} ]`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(tx - textWidth / 2 - 12, ty - 60, textWidth + 24, 28);
        ctx.strokeRect(tx - textWidth / 2 - 12, ty - 60, textWidth + 24, 28);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(text, tx - textWidth / 2, ty - 42);
      }

      // Live Center Reticle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.moveTo(cx - 45, cy);
      ctx.lineTo(cx + 45, cy);
      ctx.moveTo(cx, cy - 45);
      ctx.lineTo(cx, cy + 45);
      ctx.stroke();

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [alpha, beta, gamma, anomalyScore, anomalyType]);

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* HUD Info */}
      <div className="absolute top-4 left-4 p-4 bg-zinc-950/85 backdrop-blur-xl border border-zinc-800 rounded-2xl max-w-xs space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-widest">
          <Eye className="w-3.5 h-3.5 animate-pulse" /> AR PROJEKSİYON SEVİYESİ
        </div>
        <div className="grid grid-cols-3 gap-2 text-[8px] font-mono text-zinc-400 uppercase tracking-wider pt-1 border-t border-zinc-900">
          <div>H: <span className="text-white font-bold">{alpha.toFixed(0)}°</span></div>
          <div>B: <span className="text-white font-bold">{beta.toFixed(0)}°</span></div>
          <div>G: <span className="text-white font-bold">{gamma.toFixed(0)}°</span></div>
        </div>
      </div>
    </div>
  );
};
