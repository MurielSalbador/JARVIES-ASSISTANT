import { useEffect, useRef, useState } from 'react';

// ============================================================
//  Métricas 100% reales del navegador / sistema.
//  Nada simulado: cada valor sale de una API concreta.
//   - FPS y carga UI      -> requestAnimationFrame (retraso entre frames)
//   - Memoria JS          -> performance.memory (Chrome)
//   - Red                 -> Network Information API + PerformanceObserver
//   - Batería             -> Battery Status API
//   - Almacenamiento      -> StorageManager.estimate()
//   - GPU / Núcleos       -> WebGL renderer + hardwareConcurrency
//   - Ubicación           -> Geolocation API
//   - Clima               -> Open-Meteo (temperatura real de tu zona)
// ============================================================

const MAX_PTS = 90; // ~90 s de historia por gráfico

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function useSystemMetrics() {
  const [m, setM] = useState(() => ({
    hora: new Date(),
    uptime: 0,
    fps: 0,
    carga: 0,
    heapPct: null,
    heapMB: null,
    online: navigator.onLine,
    downlink: null,
    rtt: null,
    tipoRed: null,
    kbps: 0,
    senal: 0,
    bateria: null,
    cargando: null,
    discoUsado: null,
    discoTotal: null,
    nucleos: navigator.hardwareConcurrency || null,
    gpu: null,
    geo: null,
    geoEstado: 'BUSCANDO',
    clima: null,
    hist: { fps: [], carga: [], heap: [], kbps: [], rtt: [], temp: [], disco: [], senal: [] },
  }));

  const vivoRef = useRef(true);

  useEffect(() => {
    vivoRef.current = true;
    const r = {
      frames: 0,
      lag: 0,
      ultimoFrame: performance.now(),
      bytes: 0,
      inicio: Date.now(),
      ticks: 0,
      hist: { fps: [], carga: [], heap: [], kbps: [], rtt: [], temp: [], disco: [], senal: [] },
      bateria: null,
      cargando: null,
      disco: null,
      gpu: null,
      geo: null,
      geoEstado: 'BUSCANDO',
      clima: null,
    };

    // ---- FPS + carga del hilo principal (cuánto se atrasa cada frame) ----
    let raf;
    const frame = (t) => {
      const delta = t - r.ultimoFrame;
      r.ultimoFrame = t;
      r.frames += 1;
      const exceso = clamp((delta - 17) / 33, 0, 1); // 0 = fluido · 1 = frame perdido
      r.lag = r.lag * 0.92 + exceso * 0.08;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ---- Tráfico de red real que genera esta página ----
    let po = null;
    try {
      po = new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) r.bytes += e.transferSize || 0;
      });
      po.observe({ type: 'resource', buffered: true });
    } catch (e) {
      /* navegador sin PerformanceObserver */
    }

    // ---- Batería ----
    let bateriaObj = null;
    const leerBateria = () => {
      if (!bateriaObj) return;
      r.bateria = Math.round(bateriaObj.level * 100);
      r.cargando = bateriaObj.charging;
    };
    if (navigator.getBattery) {
      navigator
        .getBattery()
        .then((b) => {
          if (!vivoRef.current) return;
          bateriaObj = b;
          leerBateria();
          b.addEventListener('levelchange', leerBateria);
          b.addEventListener('chargingchange', leerBateria);
        })
        .catch(() => {});
    }

    // ---- GPU real (nombre del renderer vía WebGL) ----
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (gl && ext) r.gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    } catch (e) {
      /* sin WebGL */
    }

    // ---- Almacenamiento del origen ----
    const leerDisco = () => {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage
          .estimate()
          .then((est) => {
            r.disco = { usado: est.usage || 0, total: est.quota || 0 };
          })
          .catch(() => {});
      }
    };
    leerDisco();

    // ---- Clima real según tu ubicación (Open-Meteo, sin clave) ----
    const leerClima = () => {
      if (!r.geo || !navigator.onLine) return;
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${r.geo.lat}&longitude=${r.geo.lon}` +
          `&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
      )
        .then((resp) => resp.json())
        .then((j) => {
          if (j && j.current) {
            r.clima = {
              temp: j.current.temperature_2m,
              humedad: j.current.relative_humidity_2m,
              viento: j.current.wind_speed_10m,
            };
          }
        })
        .catch(() => {});
    };
    let climaTimer = null;

    // ---- Ubicación real ----
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (!vivoRef.current) return;
          r.geo = {
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            precision: Math.round(p.coords.accuracy),
          };
          r.geoEstado = 'FIJADO';
          leerClima();
          climaTimer = setInterval(leerClima, 10 * 60 * 1000);
        },
        () => {
          r.geoEstado = 'SIN SEÑAL';
        },
        { timeout: 15000, maximumAge: 300000 }
      );
    } else {
      r.geoEstado = 'SIN SEÑAL';
    }

    // ---- Tick de 1 s: consolida todo y publica el estado ----
    const push = (arr, v) => {
      arr.push(v);
      if (arr.length > MAX_PTS) arr.shift();
    };

    const tick = setInterval(() => {
      r.ticks += 1;
      const con = navigator.connection || {};
      const online = navigator.onLine;

      const fps = r.frames;
      r.frames = 0;
      const carga = Math.round(r.lag * 100);
      const kbps = Math.round((r.bytes / 1024) * 10) / 10;
      r.bytes = 0;

      let heapPct = null;
      let heapMB = null;
      if (performance.memory) {
        heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
        // % del heap asignado que está en uso (contra el límite total siempre daría ~0)
        heapPct = Math.round(
          (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100
        );
      }

      // Calidad de enlace derivada de parámetros reales de la conexión
      const base =
        { 'slow-2g': 25, '2g': 40, '3g': 65, '4g': 92 }[con.effectiveType] ?? 80;
      const senal = online ? clamp(Math.round(base - (con.rtt || 0) / 20), 5, 99) : 0;

      if (r.ticks % 20 === 0) leerDisco();

      push(r.hist.fps, fps);
      push(r.hist.carga, carga);
      push(r.hist.heap, heapPct ?? 0);
      push(r.hist.kbps, kbps);
      push(r.hist.rtt, con.rtt ?? 0);
      push(r.hist.temp, r.clima ? r.clima.temp : null);
      push(r.hist.disco, r.disco ? Math.round(r.disco.usado / 1024) : 0); // KB
      push(r.hist.senal, senal);

      setM({
        hora: new Date(),
        uptime: Math.floor((Date.now() - r.inicio) / 1000),
        fps,
        carga,
        heapPct,
        heapMB,
        online,
        downlink: con.downlink ?? null,
        rtt: con.rtt ?? null,
        tipoRed: con.effectiveType ?? null,
        kbps,
        senal,
        bateria: r.bateria,
        cargando: r.cargando,
        discoUsado: r.disco ? r.disco.usado : null,
        discoTotal: r.disco ? r.disco.total : null,
        nucleos: navigator.hardwareConcurrency || null,
        gpu: r.gpu,
        geo: r.geo,
        geoEstado: r.geoEstado,
        clima: r.clima,
        hist: {
          fps: [...r.hist.fps],
          carga: [...r.hist.carga],
          heap: [...r.hist.heap],
          kbps: [...r.hist.kbps],
          rtt: [...r.hist.rtt],
          temp: [...r.hist.temp],
          disco: [...r.hist.disco],
          senal: [...r.hist.senal],
        },
      });
    }, 1000);

    return () => {
      vivoRef.current = false;
      cancelAnimationFrame(raf);
      clearInterval(tick);
      if (climaTimer) clearInterval(climaTimer);
      if (po) po.disconnect();
      if (bateriaObj) {
        bateriaObj.removeEventListener('levelchange', leerBateria);
        bateriaObj.removeEventListener('chargingchange', leerBateria);
      }
    };
  }, []);

  return m;
}
