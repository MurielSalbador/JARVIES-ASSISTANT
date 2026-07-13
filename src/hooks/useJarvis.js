import { useState, useRef, useCallback, useEffect } from 'react';
import { WEBHOOK_URL, GROQ_API_KEY, IDIOMA, PERSONALIDAD } from '../config';

export const ESTADOS = {
  STANDBY: 'STANDBY',
  ESCUCHANDO: 'ESCUCHANDO',
  PROCESANDO: 'PROCESANDO',
  HABLANDO: 'HABLANDO',
};

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELO = 'openai/gpt-oss-120b';

const CLAVE_HISTORIAL = 'jarvis_historial';
const MAX_GUARDADOS = 40;   // mensajes que persisten en localStorage
const MAX_ENVIADOS = 12;    // mensajes de contexto por pedido
const DEBOUNCE_MS = 350;    // ignora toques repetidos (tecla mantenida, doble click)

// --- Detección de voz por volumen ---
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
    { quien: 'SISTEMA', texto: 'J.A.R.V.I.S. en línea. Cerebro local activo, n8n solo para acciones.', hora: hora() },
  ]);
  // Estado del enlace con n8n (solo cuenta llamadas de ACCIONES)
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
          setTimeout(() => {
            if (resuelto) return;
            const u = new SpeechSynthesisUtterance(texto);
            const voces = window.speechSynthesis.getVoices();
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
            u.pitch = 0.72;
            u.onend = terminar;
            u.onerror = terminar;
            window.speechSynthesis.speak(u);
            latido = setInterval(() => {
              if (!window.speechSynthesis.speaking) terminar();
              else window.speechSynthesis.resume();
            }, 4000);
          }, 90);
          const maxMs = Math.min(30000, 4000 + texto.length * 90);
          setTimeout(terminar, maxMs);
        } catch (e) {
          terminar();
        }
      }),
    []
  );

  // ---- Llamada genérica a Groq (chat) desde el navegador ----
  const groqChat = useCallback(async (messages, opciones = {}) => {
    const r = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: MODELO,
        messages,
        temperature: opciones.temperature ?? 0.7,
        max_tokens: opciones.max_tokens ?? 500,
      }),
    });
    if (!r.ok) throw new Error('Groq HTTP ' + r.status);
    const j = await r.json();
    return ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim();
  }, []);

  // ---- Clasificador de intenciones (corre en el navegador, gratis) ----
  const clasificar = useCallback(
    async (texto) => {
      try {
        const salida = await groqChat(
          [
            {
              role: 'system',
              content:
                'Sos un clasificador de intenciones. Leé el pedido del usuario (y el contexto previo si existe) y respondé con UNA SOLA palabra en mayúsculas: CLIMA si pregunta por el clima, el tiempo, la temperatura, la lluvia, el viento o el pronóstico. AGENDAR si pide crear, agendar o anotar una reunión, un evento, una cita, un recordatorio o un zoom en el calendario. EVENTOS si pregunta qué tiene en la agenda o el calendario, sus próximos eventos, reuniones o compromisos. BUSCAR si pide información actual de internet: noticias, precios, cotizaciones, resultados deportivos, datos de personas, empresas o eventos públicos, si dice buscá o buscame, o cualquier dato que cambie con el tiempo o que un modelo de lenguaje no sepa con certeza. CHARLA para todo lo demás. No agregues nada más que la palabra.',
            },
            ...historialRef.current.slice(-6),
            { role: 'user', content: texto },
          ],
          { temperature: 0, max_tokens: 300 }
        );
        const s = salida.toUpperCase();
        if (s.includes('CLIMA')) return 'CLIMA';
        if (s.includes('AGENDAR')) return 'AGENDAR';
        if (s.includes('EVENTOS')) return 'EVENTOS';
        if (s.includes('BUSCAR')) return 'BUSCAR';
        return 'CHARLA';
      } catch (e) {
        return 'CHARLA'; // si el clasificador falla, al menos conversa
      }
    },
    [groqChat]
  );

  // ---- Charla directa (navegador -> Groq, 0 operaciones de Make) ----
  const charlar = useCallback(
    (texto) =>
      groqChat(
        [
          { role: 'system', content: PERSONALIDAD },
          ...historialRef.current.slice(-MAX_ENVIADOS),
          { role: 'user', content: texto },
        ],
        { temperature: 0.85 }
      ),
    [groqChat]
  );

  // ---- Acciones (navegador -> n8n, con la intención ya resuelta) ----
  const accionN8n = useCallback(async (texto, intencion) => {
    const previos = historialRef.current.slice(-MAX_ENVIADOS);
    const historialStr =
      previos.map((m) => JSON.stringify(m)).join(',') + (previos.length ? ',' : '');
    const t0 = performance.now();
    const r = await fetch(WEBHOOK_URL, {
      method: 'POST',
      // El header evita la página de advertencia que ngrok (plan
      // gratis) intercala cuando la petición viene de un navegador.
      headers: { 'ngrok-skip-browser-warning': '1' },
      body: new URLSearchParams({ texto, historial: historialStr, intencion }),
    });
    const respuesta = (await r.text()).trim();
    const latencia = Math.round(performance.now() - t0);
    setRed((s) => ({
      peticiones: s.peticiones + 1,
      latencia,
      uplink: r.ok ? 'OK · ' + latencia + 'ms' : 'HTTP ' + r.status,
    }));
    return respuesta;
  }, []);

  // ---- Orquestador: clasifica y decide adónde va cada pedido ----
  const preguntar = useCallback(
    async (texto) => {
      const limpio = (texto || '').trim();
      if (!limpio) return;
      setEstado(ESTADOS.PROCESANDO);
      addLog('VOS', limpio);

      const sanitizado = limpio.replace(/"/g, "'").replace(/\r?\n/g, ' ');
      let respuesta = '';
      try {
        const intencion = await clasificar(sanitizado);
        if (intencion === 'CHARLA') {
          respuesta = await charlar(sanitizado);
        } else {
          respuesta = await accionN8n(sanitizado, intencion);
        }
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
          addLog('SISTEMA', 'Respuesta vacía. Revisá el workflow de n8n o la key de Groq.');
        }
      } catch (e) {
        addLog('SISTEMA', 'Error: ' + e.message);
      }
      setEstado(ESTADOS.STANDBY);
    },
    [addLog, clasificar, charlar, accionN8n, hablar]
  );

  // ---- Borrar la memoria de conversación ----
  const purgarMemoria = useCallback(() => {
    setHistorial([]);
    try {
      localStorage.removeItem(CLAVE_HISTORIAL);
    } catch (e) {
      /* sin acceso a localStorage */
    }
    addLog('SISTEMA', 'Memoria de conversación purgada.');
  }, [addLog]);

  // ---- Transcripción con Whisper en Groq ----
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
  const escuchar = useCallback(async () => {
    const ahora = Date.now();
    if (ahora - ultimoToqueRef.current < DEBOUNCE_MS) return;
    ultimoToqueRef.current = ahora;

    if (estadoRef.current === ESTADOS.HABLANDO) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* sin voz activa */ }
      setEstado(ESTADOS.STANDBY);
      return;
    }
    if (estadoRef.current === ESTADOS.PROCESANDO) return;

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
        addLog('SISTEMA', 'No detecté voz. Revisá qué micrófono usa el navegador (candado → Micrófono) o bajá UMBRAL_VOZ en useJarvis.js.');
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