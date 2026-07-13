import { useRef, useState, useEffect } from 'react';
import * as playbackService from '../../services/playbackService';

export const WaveformCanvas = ({ filePath, color, isPlaying }: { filePath: string; color: string; isPlaying: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    const loadPeaks = async () => {
      try {
        const data = await playbackService.getAudioPeaks(filePath, 40);
        setPeaks(data);
      } catch (err) {
        console.error("Failed to load peaks for waveform:", err);
      }
    };
    loadPeaks();
  }, [filePath]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / peaks.length - 1;
      const centerY = canvas.height / 2;

      peaks.forEach((peak, i) => {
        // Add subtle animation if playing
        const pulse = isPlaying ? Math.sin(time + i * 0.5) * 0.3 + 0.7 : 1;
        const height = (peak * canvas.height * 0.8) * pulse;
        
        ctx.fillStyle = isPlaying ? color : "rgba(120, 120, 120, 0.4)";
        
        // Top half
        ctx.fillRect(i * (barWidth + 1), centerY - height / 2, barWidth, height / 2);
        // Bottom half (reflection)
        ctx.globalAlpha = 0.5;
        ctx.fillRect(i * (barWidth + 1), centerY, barWidth, height / 2);
        ctx.globalAlpha = 1.0;
      });

      if (isPlaying) {
        time += 0.1;
        animationId = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [peaks, isPlaying, color]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" width={160} height={100} />;
};
