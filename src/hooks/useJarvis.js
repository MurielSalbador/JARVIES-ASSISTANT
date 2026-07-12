import { useState, useRef, useCallback, useEffect } from 'react';
import { WEBHOOK_URL, GROQ_API_KEY, IDIOMA } from '../config';

export const ESTADOS = {
  STANDBY: 'STANDBY',
  ESCUCHANDO: 'ESCUCHANDO',
  PROCESANDO: 'PROCESANDO',
  HABLANDO: 'HABLANDO',
};

const CLAVE_HISTORIAL = 'jarvis_historial';
const MAX_GUARDADOS = 40;   // mensajes que persisten en localStorage
const MAX_ENVIADOS = 12;    // mensajes que viajan a Make en cada pedido
const DEBOUNCE_MS = 350;    // ignora toques repetidos (tecla mantenida, doble click)

// --- Detección de voz por volumen (ya no dependemos de Google) ---
const UMBRAL_VOZ = 0.028;            // sensibilidad: subilo si detecta ruido de fondo como voz
const SILENCIO_TRAS_HABLA_MS = 2200; // 2,2 s callado después de hablar -> envía solo
const ESPERA_SIN_VOZ_MS = 15000;     // 15 s sin detectar voz -> corta
const MAX_GRABACION_MS = 60000;      // tope duro de grabación

const hora = () => new Date().toLocaleTimeString('es-AR', { hour12: false });

const cargarHistorial = () => {
  try {
    const crudo = localStorage.getItem(CLAVE_HISTORIAL);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
};

export function useJarvis() {
  const [estado, setEstado] = useState(ESTADOS.STANDBY);
  const [transcript, setTranscript] = useState('');
  const [historial, setHistorial] = useState(cargarHistorial);
  const [log, setLog] = useState([
    { quien: 'SISTEMA', texto: 'J.A.R.V.I.S. en línea. Voz local + Whisper (Groq) activos.', hora: hora() },
  ]);
  // Estado real del enlace con Make: peticiones hechas, latencia medida, resultado
  const [red, setRed] = useState({ peticiones: 0, latencia: null, uplink: 'SIN TRÁFICO' });

  const detenerRef = useRef(null);
  const ultimoToqueRef = useRef(0);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const historialRef = useRef(historial);
  historialRef.current = historial;

  // Persistir la memoria de conversación en cada cambio
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial));
    } catch (e) {
      /* localStorage lleno o bloqueado: seguimos solo en memoria */
    }
  }, [historial]);

  const addLog = useCallback((quien, texto) => {
    setLog((l) => [...l, { quien, texto, hora: hora() }].slice(-60));
  }, []);

  // ---- Voz de salida (speechSynthesis, blindada contra los bugs de Chrome) ----
  const hablar = useCallback(
    (texto) =>
      new Promise((resolve) => {
        let resuelto = false;
        let latido = null;
        const terminar = () => {
          if (resuelto) return;
          resuelto = true;
          clearInterval(latido);
          resolve();
        };
        try {
          window.speechSynthesis.cancel();
          // Chrome necesita un respiro entre cancel() y speak(),
          // si no a veces se traga la frase sin avisar.
          setTimeout(() => {
            if (resuelto) return;
            const u = new SpeechSynthesisUtterance(texto);
            const voces = window.speechSynthesis.getVoices();
            // Voces masculinas en español según el sistema:
            // Windows (Raul, Pablo), Edge natural (Alvaro, Jorge, Dario),
            // macOS (Diego, Jorge, Juan, Carlos), Android (male)
            const MASCULINAS = /alvaro|jorge|raul|raúl|pablo|dario|darío|diego|juan|carlos|andres|andrés|enrique|gonzalo|male/i;
            const esMasculina = (v) => MASCULINAS.test(v.name);
            const esEspanol = (v) => v.lang && v.lang.startsWith('es');
            const voz =
              voces.find((v) => v.lang === IDIOMA && esMasculina(v)) ||
              voces.find((v) => esEspanol(v) && esMasculina(v)) ||
              voces.find((v) => v.lang === IDIOMA) ||
              voces.find(esEspanol) ||
              null;
            if (voz) u.voice = voz;
            u.lang = voz ? voz.lang : IDIOMA;
            u.rate = 1.02;
            // Grave y pausado, al estilo J.A.R.V.I.S.
            u.pitch = 0.72;
            u.onend = terminar;
            u.onerror = terminar;
            window.speechSynthesis.speak(u);
            // Chrome pausa la síntesis a los ~15 s: resume periódico lo evita
            latido = setInterval(() => {
              if (!window.speechSynthesis.speaking) terminar();
              else window.speechSynthesis.resume();
            }, 4000);
          }, 90);
          // Red de seguridad: pase lo que pase, el estado nunca queda trabado
          const maxMs = Math.min(30000, 4000 + texto.length * 90);
          setTimeout(terminar, maxMs);
        } catch (e) {
          terminar();
        }
      }),
    []
  );

  // ---- Enviar pregunta al cerebro (webhook de Make -> Groq) ----
  const preguntar = useCallback(
    async (texto) => {
      const limpio = (texto || '').trim();
      if (!limpio) return;
      setEstado(ESTADOS.PROCESANDO);
      addLog('VOS', limpio);

      // El texto va embebido en un JSON del lado de Make
      const sanitizado = limpio.replace(/"/g, "'").replace(/\r?\n/g, ' ');
      // Fragmentos JSON separados por coma y CON coma final (contrato del escenario)
      const previos = historialRef.current.slice(-MAX_ENVIADOS);
      const historialStr =
        previos.map((m) => JSON.stringify(m)).join(',') +
        (previos.length ? ',' : '');

      try {
        const t0 = performance.now();
        const r = await fetch(WEBHOOK_URL, {
          method: 'POST',
          body: new URLSearchParams({ texto: sanitizado, historial: historialStr }),
        });
        const respuesta = (await r.text()).trim();
        const latencia = Math.round(performance.now() - t0);
        setRed((s) => ({
          peticiones: s.peticiones + 1,
          latencia,
          uplink: r.ok ? 'OK · ' + latencia + 'ms' : 'HTTP ' + r.status,
        }));
        if (respuesta) {
          setHistorial((h) =>
            [
              ...h,
              { role: 'user', content: sanitizado },
              { role: 'assistant', content: respuesta },
            ].slice(-MAX_GUARDADOS)
          );
          addLog('JARVIS', respuesta);
          setEstado(ESTADOS.HABLANDO);
          await hablar(respuesta);
        } else {
          addLog('SISTEMA', 'Make respondió vacío. Revisá el escenario.');
        }
      } catch (e) {
        setRed((s) => ({ ...s, peticiones: s.peticiones + 1, uplink: 'ERROR' }));
        addLog('SISTEMA', 'Error de conexión con Make: ' + e.message);
      }
      setEstado(ESTADOS.STANDBY);
    },
    [addLog, hablar]
  );

  // ---- Borrar la memoria de conversación ----
  const purgarMemoria = useCallback(() => {
    setHistorial([]);
    try {
      localStorage.removeItem(CLAVE_HISTORIAL);
    } catch (e) {
      /* sin acceso a localStorage: alcanza con limpiar el estado */
    }
    addLog('SISTEMA', 'Memoria de conversación purgada.');
  }, [addLog]);

  // ---- Transcripción con Whisper en Groq (reemplaza al servicio de Google) ----
  const transcribir = useCallback(
    async (blob) => {
      try {
        const fd = new FormData();
        fd.append('file', blob, 'voz.webm');
        fd.append('model', 'whisper-large-v3-turbo');
        fd.append('language', 'es');
        fd.append('temperature', '0');
        fd.append('prompt', 'Conversación en español rioplatense con Jarvis, un asistente de voz.');
        const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + GROQ_API_KEY },
          body: fd,
        });
        if (!r.ok) {
          addLog('SISTEMA', 'Whisper respondió HTTP ' + r.status + '. Revisá la key de Groq en config.js.');
          return '';
        }
        const j = await r.json();
        const texto = (j.text || '').trim();
// Whisper a veces escribe mal el nombre: lo normalizamos
return texto.replace(/\b(harv(i|ie)s?|jarbis|yarvis|jervis|j[aá]rbiz|charvis)\b/gi, 'Jarvis');
      } catch (e) {
        addLog('SISTEMA', 'Error transcribiendo con Groq: ' + e.message);
        return '';
      }
    },
    [addLog]
  );

  // ---- Micrófono: grabación local + detección de silencio por volumen ----
  // Ya NO usa el reconocimiento de Chrome/Google (el del error "network"):
  // graba el audio en tu compu y lo transcribe Whisper en Groq.
  const escuchar = useCallback(async () => {
    // Debounce global: tecla mantenida, doble click, click+espacio
    const ahora = Date.now();
    if (ahora - ultimoToqueRef.current < DEBOUNCE_MS) return;
    ultimoToqueRef.current = ahora;

    // Escape: si quedó hablando, un toque corta la voz y libera el estado
    if (estadoRef.current === ESTADOS.HABLANDO) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* sin voz activa */ }
      setEstado(ESTADOS.STANDBY);
      return;
    }
    if (estadoRef.current === ESTADOS.PROCESANDO) return;

    // Segundo toque mientras graba: corta y envía lo que haya
    if (estadoRef.current === ESTADOS.ESCUCHANDO) {
      if (detenerRef.current) detenerRef.current();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addLog('SISTEMA', 'Este navegador no permite acceder al micrófono.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      addLog('SISTEMA', 'Permiso de micrófono denegado. Habilitalo en el candado de la barra de dirección.');
      return;
    }

    // Grabador
    const mime =
      window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
    let grabador;
    try {
      grabador = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      addLog('SISTEMA', 'No se pudo iniciar el grabador de audio: ' + e.message);
      return;
    }
    const pedazos = [];
    grabador.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) pedazos.push(ev.data);
    };

    // Medidor de volumen para saber cuándo hablás y cuándo te callás
    let ctxAudio = null;
    let analizador = null;
    let buffer = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxAudio = new AC();
      const fuente = ctxAudio.createMediaStreamSource(stream);
      analizador = ctxAudio.createAnalyser();
      analizador.fftSize = 1024;
      fuente.connect(analizador);
      buffer = new Uint8Array(analizador.fftSize);
    } catch (e) {
      /* sin analizador: solo corte manual y tope de tiempo */
    }

    const nivelDeVoz = () => {
      if (!analizador) return 0;
      analizador.getByteTimeDomainData(buffer);
      let suma = 0;
      for (let i = 0; i < buffer.length; i++) suma += Math.abs(buffer[i] - 128);
      return suma / buffer.length / 128;
    };

    let detenido = false;
    let huboVoz = false;
    const inicio = Date.now();
    let ultimoSonido = Date.now();
    let monitor = null;

    const detener = () => {
      if (detenido) return;
      detenido = true;
      clearInterval(monitor);
      try { grabador.stop(); } catch (e) { /* ya estaba detenido */ }
    };
    detenerRef.current = detener;

    monitor = setInterval(() => {
      const nivel = nivelDeVoz();
      if (nivel > UMBRAL_VOZ) {
        if (!huboVoz) setTranscript('te escucho — pausá 2 segundos para enviar');
        huboVoz = true;
        ultimoSonido = Date.now();
      }
      const silencio = Date.now() - ultimoSonido;
      const total = Date.now() - inicio;
      if (huboVoz && silencio > SILENCIO_TRAS_HABLA_MS) detener();
      else if (!huboVoz && total > ESPERA_SIN_VOZ_MS) detener();
      else if (total > MAX_GRABACION_MS) detener();
    }, 120);

    grabador.onstop = async () => {
      clearInterval(monitor);
      stream.getTracks().forEach((t) => t.stop());
      if (ctxAudio) { try { ctxAudio.close(); } catch (e) { /* ya cerrado */ } }
      setTranscript('');

      if (!huboVoz) {
        addLog('SISTEMA', 'No detecté voz. Si estabas hablando, revisá qué micrófono usa el navegador (candado → Micrófono) o bajá UMBRAL_VOZ en useJarvis.js.');
        setEstado(ESTADOS.STANDBY);
        return;
      }
      const blob = new Blob(pedazos, { type: mime || 'audio/webm' });
      if (blob.size < 800) {
        setEstado(ESTADOS.STANDBY);
        return;
      }
      setEstado(ESTADOS.PROCESANDO);
      const texto = await transcribir(blob);
      if (texto) {
        preguntar(texto);
      } else {
        setEstado(ESTADOS.STANDBY);
      }
    };

    setEstado(ESTADOS.ESCUCHANDO);
    setTranscript('grabando…');
    try {
      grabador.start(250);
    } catch (e) {
      clearInterval(monitor);
      stream.getTracks().forEach((t) => t.stop());
      setEstado(ESTADOS.STANDBY);
      addLog('SISTEMA', 'No se pudo grabar: ' + e.message);
    }
  }, [addLog, preguntar, transcribir]);

  // Precargar voces (Chrome las carga async)
  useEffect(() => {
    window.speechSynthesis.getVoices();
    const h = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener &&
      window.speechSynthesis.addEventListener('voiceschanged', h);
    return () => {
      window.speechSynthesis.removeEventListener &&
        window.speechSynthesis.removeEventListener('voiceschanged', h);
    };
  }, []);

  return { estado, transcript, log, escuchar, preguntar, purgarMemoria, historial, red };
}