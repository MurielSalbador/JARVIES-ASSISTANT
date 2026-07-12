import React, { useEffect, useRef } from 'react';

// ============================================================
//  Gráficos canvas del HUD. Todos dibujan datos reales que les
//  llegan por props: historiales de useSystemMetrics o el
//  AnalyserNode del micrófono. Acá no se inventa ningún dato.
// ============================================================

export function hexA(h, a) {
  h = (h || '#4ad6ff').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function prepararCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.offsetWidth;
  const h = c.offsetHeight;
  c.width = Math.max(4, Math.round(w * dpr));
  c.height = Math.max(4, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

// ---------- Historial -> línea / área / barras ----------
export function MiniGraph({ data = [], max = 100, tipo = 'spark', color = '#4ad6ff' }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || !c.offsetWidth) return;
    const { ctx, w, h } = prepararCanvas(c);
    ctx.clearRect(0, 0, w, h);
    if (!data.length) return;

    const valores = data.map((v) => (v == null ? 0 : v));
    const tope = max === 'auto' ? Math.max(1, ...valores) : max;
    const norm = valores.map((v) => Math.max(0, Math.min(1, v / tope)));

    if (tipo === 'bars') {
      const nBarras = Math.max(8, Math.floor(w / 6));
      const vis = norm.slice(-nBarras);
      const bw = w / vis.length;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      vis.forEach((v, i) => {
        const bh = Math.max(1, v * (h - 2));
        const g = ctx.createLinearGradient(0, h, 0, h - bh);
        g.addColorStop(0, hexA(color, 0.35));
        g.addColorStop(1, hexA(color, 0.95));
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + 0.6, h - bh, bw - 1.4, bh);
      });
      ctx.shadowBlur = 0;
      return;
    }

    const den = Math.max(1, norm.length - 1);
    const trazar = () => {
      ctx.beginPath();
      norm.forEach((v, i) => {
        const x = (i / den) * w;
        const y = h - 3 - v * (h - 6);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    };

    if (tipo === 'area') {
      trazar();
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, hexA(color, 0.42));
      g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g;
      ctx.fill();
    }

    trazar();
    ctx.strokeStyle = hexA(color, 0.95);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [data, max, tipo, color]);

  return <canvas ref={ref} className="grafico" />;
}

// ---------- Forma de onda del micrófono (dominio temporal) ----------
export function AudioWave({ analyserRef, color = '#56c8ff' }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    let raf;
    const buf = new Uint8Array(2048);

    const dibujar = () => {
      raf = requestAnimationFrame(dibujar);
      if (!c || !c.offsetWidth) return;
      const { ctx, w, h } = prepararCanvas(c);
      ctx.clearRect(0, 0, w, h);
      const an = analyserRef.current;
      ctx.beginPath();
      if (an) {
        an.getByteTimeDomainData(buf);
        const n = an.fftSize;
        for (let i = 0; i < n; i += 4) {
          const x = (i / n) * w;
          const y = h / 2 + ((buf[i] - 128) / 128) * (h * 0.46);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
      }
      ctx.strokeStyle = hexA(color, an ? 0.95 : 0.3);
      ctx.lineWidth = 1.4;
      ctx.shadowColor = color;
      ctx.shadowBlur = an ? 7 : 0;
      ctx.stroke();
    };

    raf = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, color]);

  return <canvas ref={ref} className="grafico" />;
}

// ---------- Espectro de frecuencias del micrófono (FFT) ----------
export function SpectrumBars({ analyserRef, color = '#4ad6ff' }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    let raf;
    const buf = new Uint8Array(1024);

    const dibujar = () => {
      raf = requestAnimationFrame(dibujar);
      if (!c || !c.offsetWidth) return;
      const { ctx, w, h } = prepararCanvas(c);
      ctx.clearRect(0, 0, w, h);
      const an = analyserRef.current;
      const nBarras = Math.max(10, Math.floor(w / 6));
      const bw = w / nBarras;

      if (!an) {
        ctx.fillStyle = hexA(color, 0.22);
        for (let i = 0; i < nBarras; i++) ctx.fillRect(i * bw + 0.6, h - 2, bw - 1.4, 2);
        return;
      }

      an.getByteFrequencyData(buf);
      const bins = an.frequencyBinCount;
      const util = Math.floor(bins * 0.7); // las frecuencias más altas casi no traen voz
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      for (let i = 0; i < nBarras; i++) {
        const v = buf[Math.floor((i / nBarras) * util)] / 255;
        const bh = Math.max(2, v * (h - 2));
        const g = ctx.createLinearGradient(0, h, 0, h - bh);
        g.addColorStop(0, hexA(color, 0.35));
        g.addColorStop(1, hexA(color, 0.95));
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + 0.6, h - bh, bw - 1.4, bh);
      }
      ctx.shadowBlur = 0;
    };

    raf = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, color]);

  return <canvas ref={ref} className="grafico" />;
}

// ---------- Aro medidor circular (conic-gradient) ----------
export function Gauge({ pct = 0, color = '#56c8ff', centro = '', etiqueta = '' }) {
  const deg = Math.round(Math.max(0, Math.min(100, pct || 0)) * 3.6);
  return (
    <div className="gauge-wrap">
      <div className="gauge">
        <div
          className="gauge-anillo"
          style={{
            background: `conic-gradient(${color} ${deg}deg, rgba(30,70,110,.5) 0)`,
            boxShadow: `0 0 12px ${hexA(color, 0.35)}`,
          }}
        />
        <div className="gauge-centro">{centro}</div>
      </div>
      <div className="gauge-etq">{etiqueta}</div>
    </div>
  );
}
