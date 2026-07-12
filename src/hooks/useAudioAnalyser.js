import { useEffect, useRef, useState } from 'react';

// ============================================================
//  Analizador de audio REAL del micrófono.
//  Se enciende solo mientras Jarvis está escuchando: abre el
//  micrófono con getUserMedia y expone un AnalyserNode para que
//  los gráficos (waveform + espectro) dibujen la señal de verdad.
// ============================================================

export function useAudioAnalyser(activo) {
  const analyserRef = useRef(null);
  const [info, setInfo] = useState({ micActivo: false, sampleHz: null });

  useEffect(() => {
    if (!activo) return undefined;

    let stream = null;
    let ctx = null;
    let cancelado = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        const fuente = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.72;
        fuente.connect(analyser);
        analyserRef.current = analyser;
        setInfo({ micActivo: true, sampleHz: ctx.sampleRate });
      } catch (e) {
        /* micrófono denegado: los gráficos quedan en línea base */
      }
    })();

    return () => {
      cancelado = true;
      analyserRef.current = null;
      setInfo({ micActivo: false, sampleHz: null });
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ctx) ctx.close().catch(() => {});
    };
  }, [activo]);

  return { analyserRef, ...info };
}
