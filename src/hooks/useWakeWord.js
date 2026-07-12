import { useEffect, useRef, useState } from 'react';

// ============================================================
//  WAKE WORD "JARVIS" — 100% local con Vosk (WebAssembly).
//  Sin cuentas, sin keys, sin servicios: el audio nunca sale
//  de tu computadora. Requiere: npm install vosk-browser
//
//  Uso en App.jsx:
//    const estadoWake = useWakeWord(modoJarvis && estado === ESTADOS.STANDBY, escuchar);
//
//  El segundo parámetro se dispara cuando escucha "jarvis".
//  Al pasarle "activo" solo en STANDBY, la vigilancia se pausa
//  sola mientras Jarvis graba/procesa/habla (así su propia voz
//  por los parlantes no lo vuelve a despertar).
// ============================================================

// El primer URL que responda se usa. La primera vez baja el
// modelo (~40 MB) y queda cacheado por el navegador.
// Si preferís tenerlo local: descargá el .tar.gz y ponelo en
// public/modelos/vosk-es.tar.gz (tercera opción de la lista).
const MODELOS_CANDIDATOS = [
  'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-es-0.42.tar.gz',
  'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-es-0.3.tar.gz',
  '/modelos/vosk-es.tar.gz',
];

// Caché del modelo entre activaciones (cargarlo es lo caro)
let modeloCargado = null;

// "jarvis" no existe en el vocabulario del modelo de español, así
// que aceptamos también cómo suele transcribirlo: variantes con
// j/y/g/h y con b/v. Se compara sin acentos y sin espacios.
const RE_JARVIS = /(jarvis|jarbis|harvis|harbis|yarvis|yarbis|garvis|garbis|gervis|jervis|charvis|chavis|hardis|jarwis)/;
const oyeJarvis = (texto) => {
  if (!texto) return false;
  const plano = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '');
  return RE_JARVIS.test(plano);
};

export function useWakeWord(activo, alDetectar) {
  // APAGADO | CARGANDO | VIGILANDO | ERROR
  const [estadoWake, setEstadoWake] = useState('APAGADO');
  const alDetectarRef = useRef(alDetectar);
  alDetectarRef.current = alDetectar;

  useEffect(() => {
    if (!activo) {
      setEstadoWake('APAGADO');
      return;
    }

    let vivo = true;
    let stream = null;
    let ctx = null;
    let fuente = null;
    let nodo = null;
    let rec = null;
    let ultimoDisparo = 0;

    (async () => {
      try {
        setEstadoWake('CARGANDO');
        const Vosk = await import('vosk-browser');

        if (!modeloCargado) {
          let url = null;
          for (const candidato of MODELOS_CANDIDATOS) {
            try {
              const r = await fetch(candidato, { method: 'HEAD' });
              if (r.ok) { url = candidato; break; }
            } catch (e) { /* probar el siguiente */ }
          }
          if (!url) throw new Error('no pude descargar el modelo de voz');
          modeloCargado = await Vosk.createModel(url);
        }
        if (!vivo) return;

        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        });
        if (!vivo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Decodificación libre (sin gramática): con gramática
        // restringida, "jarvis" quedaba fuera del vocabulario del
        // modelo y TODO caía en [unk] — por eso nunca disparaba.
        rec = new modeloCargado.KaldiRecognizer(ctx.sampleRate);

        const disparar = () => {
          const ahora = Date.now();
          if (ahora - ultimoDisparo < 3000) return; // anti-rebote
          ultimoDisparo = ahora;
          if (alDetectarRef.current) alDetectarRef.current();
        };
        rec.on('partialresult', (m) => {
          const t = m.result && m.result.partial;
          if (t) {
            console.debug('[wake] oí:', t);
            if (oyeJarvis(t)) disparar();
          }
        });
        rec.on('result', (m) => {
          const t = m.result && m.result.text;
          if (t) {
            console.debug('[wake] frase:', t);
            if (oyeJarvis(t)) disparar();
          }
        });

        fuente = ctx.createMediaStreamSource(stream);
        nodo = ctx.createScriptProcessor(4096, 1, 1);
        nodo.onaudioprocess = (ev) => {
          try { rec.acceptWaveform(ev.inputBuffer); } catch (e) { /* buffer perdido */ }
        };
        fuente.connect(nodo);
        nodo.connect(ctx.destination);

        setEstadoWake('VIGILANDO');
      } catch (e) {
        if (vivo) setEstadoWake('ERROR');
      }
    })();

    return () => {
      vivo = false;
      try { if (rec) rec.remove(); } catch (e) { /* ya removido */ }
      try { if (nodo) nodo.disconnect(); } catch (e) { /* ya desconectado */ }
      try { if (fuente) fuente.disconnect(); } catch (e) { /* ya desconectado */ }
      try { if (ctx) ctx.close(); } catch (e) { /* ya cerrado */ }
      try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ya detenido */ }
    };
  }, [activo]);

  return estadoWake;
}
