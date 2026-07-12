import React, { useEffect, useRef, useState } from 'react';
import ArcReactor from './components/ArcReactor';
import {
  Celda,
  ConsoleLog,
  Feed,
  Globo,
  TrazasCircuito,
  MiniReactor,
  Icono,
} from './components/HudParts';
import { MiniGraph, AudioWave, Gauge } from './components/Graphs';
import { useJarvis, ESTADOS } from './hooks/useJarvis';
import { useSystemMetrics } from './hooks/useSystemMetrics';
import { useAudioAnalyser } from './hooks/useAudioAnalyser';
import { OPERADOR } from './config';

// ============================================================
//  J.A.R.V.I.S. HUD — réplica del diseño de referencia:
//  consola de misión al centro, columna derecha (red / audio /
//  reloj), panel FEED abajo y dock lateral. Todos los paneles
//  muestran datos reales: sistema (useSystemMetrics), audio
//  (useAudioAnalyser) y el cerebro (useJarvis -> Make -> Groq).
// ============================================================

const ETIQUETA_ESTADO = {
  [ESTADOS.STANDBY]: 'EN ESPERA',
  [ESTADOS.ESCUCHANDO]: 'ESCUCHANDO…',
  [ESTADOS.PROCESANDO]: 'PROCESANDO',
  [ESTADOS.HABLANDO]: 'RESPONDIENDO',
};

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const p2 = (n) => String(n).padStart(2, '0');

// Coordenada real -> grados° minutos' segundos" (bloque GEO-SYNC)
const gms = (v) => {
  if (v == null) return `--°--' --.----"`;
  const a = Math.abs(v);
  const g = Math.floor(a);
  const minF = (a - g) * 60;
  const min = Math.floor(minF);
  const seg = ((minF - min) * 60).toFixed(4);
  return `${g}°${p2(min)}' ${seg}"`;
};

// Escala UNIFORME: el escenario 1920x1080 se ajusta al viewport
// manteniendo las proporciones EXACTAS del diseño (igual que el
// mockup). El sobrante a los costados queda del color del fondo.
function useEscala() {
  const calcular = () => Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const [s, setS] = useState(calcular);
  useEffect(() => {
    const f = () => setS(calcular());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return s;
}

export default function App() {
  const { estado, transcript, log, escuchar, preguntar, purgarMemoria, historial, red } =
    useJarvis();
  const sys = useSystemMetrics();
  const { analyserRef, micActivo, sampleHz } = useAudioAnalyser(estado === ESTADOS.ESCUCHANDO);

  const [entrada, setEntrada] = useState('');
  const [verGrilla, setVerGrilla] = useState(true);
  const [verScan, setVerScan] = useState(true);
  const [feedTodo, setFeedTodo] = useState(false);
  const inputRef = useRef(null);
  const escala = useEscala();
  const [sesion] = useState(
    () => '0x' + Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')
  );

  // Barra espaciadora = hablar (salvo que estés escribiendo)
  useEffect(() => {
    const h = (e) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement !== inputRef.current) {
        e.preventDefault();
        escuchar();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [escuchar]);

  const enviarTexto = () => {
    if (!entrada.trim()) return;
    preguntar(entrada);
    setEntrada('');
  };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const silenciarVoz = () => {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      /* sin síntesis activa */
    }
  };

  const enfocarInput = () => inputRef.current && inputRef.current.focus();

  // El navegador dispara un click "fantasma" (detail 0) sobre el botón
  // enfocado cuando tocás ESPACIO: el atajo global ya arranca la escucha
  // y ese click fantasma la cortaba al instante. Acá lo ignoramos y
  // soltamos el foco para que ESPACIO nunca vuelva a pegarle al botón.
  const clickMic = (e) => {
    if (e && e.detail === 0) return;
    if (e && e.currentTarget) e.currentTarget.blur();
    escuchar();
  };

  const ahora = sys.hora;
  const hh = p2(ahora.getHours());
  const mm = p2(ahora.getMinutes());
  const ss = p2(ahora.getSeconds());
  const fechaLarga = `${DIAS[ahora.getDay()]} ${p2(ahora.getDate())} ${MESES[ahora.getMonth()]} ${ahora.getFullYear()}`;
  const fechaCorta = `${p2(ahora.getDate())}/${p2(ahora.getMonth() + 1)}`;

  const vozOk = 'speechSynthesis' in window;

  return (
    <div className="visor">
      <div
        className={'escenario estado-' + estado}
        style={{ transform: `translate(-50%,-50%) scale(${escala})` }}
      >
        {/* capas de ambiente */}
        <div className="ambiente" />
        {verGrilla && <div className="grilla-fondo" />}
        <div className="bloom" />

        {/* ============ TIRA SUPERIOR ============ */}
        <header className="tira-sup">
          <span className="t-cian">◆ NEURA SISTEMAS</span>
          <span className="t-apagado">//</span>
          <span className="t-marca">J.A.R.V.I.S. OS</span>
          <span className="t-apagado">v0.2</span>
          <span className="t-sep" />
          <span>
            SISTEMA //{' '}
            <span className={sys.online ? 't-verde' : 't-rojo'}>
              {sys.online ? 'EN LÍNEA' : 'SIN RED'}
            </span>
          </span>
          <span className="t-sep" />
          <span>
            NÚCLEO // <span className="t-cian">{ETIQUETA_ESTADO[estado]}</span>
          </span>
          <span className="t-sep" />
          <span>
            ENLACE MAKE //{' '}
            <span className={red.uplink === 'ERROR' ? 't-rojo' : 't-verde'}>{red.uplink}</span>
          </span>
          <span className="empuje t-apagado">
            OPERADOR {OPERADOR} · SESIÓN {sesion}
          </span>
          <span className="t-sep" />
          <span className="t-fecha">{fechaLarga}</span>
          <span className={'punto-vivo' + (sys.online ? '' : ' rojo')} />
        </header>

        {/* ============ GLOBO + GEO-SYNC + SENSORES (izquierda) ============ */}
        <div className="bloque-globo">
          <Globo />
        </div>

        <div className="bloque-geo">
          <div className="geo-titulo">
            GEO-SYNC // {sys.geoEstado}
            {sys.geo ? ` · ±${sys.geo.precision}m` : ''}
          </div>
          <div className="geo-coord">
            {gms(sys.geo ? sys.geo.lat : null)} <span className="geo-etq">· LAT</span>
          </div>
          <div className="geo-coord">
            {gms(sys.geo ? sys.geo.lon : null)} <span className="geo-etq">· LON</span>
          </div>
        </div>

        <div className="bloque-sensores">
          <div className="sensores-titulo">SENSORES</div>
          <div>
            GPS ········ <span className={sys.geo ? 't-verde' : 't-apagado'}>{sys.geoEstado}</span>
            {sys.geo && (
              <span className="chip">
                <span style={{ width: '100%' }} />
              </span>
            )}
          </div>
          <div>
            CLIMA ······{' '}
            <span className="t-cian">
              {sys.clima ? `${sys.clima.temp}°C · ${sys.clima.humedad}%` : '—'}
            </span>
          </div>
          <div>
            VIENTO ····· <span className="t-cian">{sys.clima ? `${sys.clima.viento} km/h` : '—'}</span>
          </div>
          <div>
            BATERÍA ····{' '}
            <span className="t-cian">
              {sys.bateria != null ? `${sys.bateria}%${sys.cargando ? ' ⚡' : ''}` : 'N/D'}
            </span>
            {sys.bateria != null && (
              <span className="chip">
                <span style={{ width: sys.bateria + '%' }} />
              </span>
            )}
          </div>
          <div>
            RED ········{' '}
            <span className="t-cian">
              {sys.rtt != null ? sys.rtt : '—'}
              {sys.downlink != null ? ` · ${sys.downlink}Mb/s` : ''}
            </span>
          </div>
          <div>
            NÚCLEOS ···· <span className="t-cian">{sys.nucleos ?? '—'}</span>
          </div>
          {sys.gpu && <div className="sensor-gpu">CPU: {sys.gpu}</div>}
        </div>

        {/* ============ DOCK LATERAL ============ */}
        <nav className="dock">
          <button
            className={estado === ESTADOS.ESCUCHANDO ? 'activo' : ''}
            onClick={clickMic}
            title="Micrófono"
          >
            <Icono tipo="reticula" />
          </button>
          <button onClick={purgarMemoria} title="Purgar memoria de conversación">
            <Icono tipo="libro" />
          </button>
          <button
            className={verGrilla ? 'activo' : ''}
            onClick={() => setVerGrilla((v) => !v)}
            title="Grilla de fondo"
          >
            <Icono tipo="chispa" />
          </button>
          <button
            className={verScan ? 'activo' : ''}
            onClick={() => setVerScan((v) => !v)}
            title="Scanlines"
          >
            <Icono tipo="monitor" />
            <span className="badge" />
          </button>
          <button onClick={pantallaCompleta} title="Pantalla completa">
            <Icono tipo="pantalla" />
          </button>
        </nav>

        {/* ============ ARC REACTOR (héroe) ============ */}
        <div className="titulo-core">
          <div className="core-nombre">J.A.R.V.I.S. CORE</div>
          <div className="core-sub">NÚCLEO DEL SISTEMA</div>
        </div>
        <div className="zona-reactor">
          <ArcReactor estado={estado} onClick={clickMic} />
        </div>
        <div className="lectura-reactor">
          VOZ <span className="t-cian">{vozOk ? 'LISTA' : 'N/D'}</span> · MIC{' '}
          <span className={micActivo ? 't-verde' : 't-apagado'}>
            {micActivo ? `EN VIVO · ${(sampleHz / 1000).toFixed(1)}kHz` : 'REPOSO'}
          </span>{' '}
          · MENSAJES <span className="t-cian">{historial.length}</span> · PETICIONES{' '}
          <span className="t-cian">{red.peticiones}</span>
        </div>
        <div className="transcript" aria-live="polite">
          {/* Un solo <span> contenedor: .transcript es flex y, si el texto
              queda suelto junto al resaltado, se comen los espacios. */}
          <span>
            {estado === ESTADOS.ESCUCHANDO ? (
              transcript || '· · · te escucho · · · (ESPACIO o click para enviar)'
            ) : (
              <>
                Click en el núcleo o presioná <span className="t-cian">ESPACIO</span> para hablar
              </>
            )}
          </span>
        </div>

        {/* ============ CONSOLA DE MISIÓN (centro) ============ */}
        <Celda
          className="p-consola"
          titulo="CONSOLA DE MISIÓN"
          extra={
            <button
              className="btn-purgar"
              onClick={purgarMemoria}
              title="Borrar memoria de conversación"
            >
              PURGAR
            </button>
          }
        >
          <div className="hachas" />
          <TrazasCircuito />
          <ConsoleLog log={log} />
        </Celda>

        {/* ============ COLUMNA DERECHA ============ */}
        <Celda
          className="p-red"
          titulo="ACTIVIDAD DE RED"
          extra={<span className="t-verde">▲ {sys.kbps} kB/s</span>}
          pie={`RTT ${sys.rtt ?? '—'}ms · ${sys.tipoRed ? sys.tipoRed.toUpperCase() : '—'} · ↓${sys.downlink ?? '—'} Mb/s · ${sys.online ? 'EN LÍNEA' : 'SIN RED'}`}
        >
          <MiniGraph data={sys.hist.kbps} max="auto" tipo="area" />
        </Celda>

        <Celda
          className="p-audio"
          titulo="TELEMETRÍA // AUDIO"
          extra={
            micActivo ? (
              <span className="t-verde">MIC EN VIVO · {(sampleHz / 1000).toFixed(1)}kHz</span>
            ) : (
              <span className="t-apagado">MIC EN REPOSO</span>
            )
          }
        >
          <AudioWave analyserRef={analyserRef} />
        </Celda>

        <div className="celda p-reloj">
          <div className="reloj-hms">
            {hh}
            <span className="reloj-sep">:</span>
            {mm}
            <span className="reloj-seg">{ss}</span>
          </div>
          <div className="reloj-fecha">{fechaLarga}</div>
          <div className="reloj-fila">
            <MiniReactor estado={estado} />
            <Gauge
              pct={sys.bateria ?? 0}
              color="#5fe3a0"
              centro={sys.bateria != null ? sys.bateria + '%' : 'N/D'}
              etiqueta="BAT"
            />
            <Gauge pct={sys.carga} color="#56c8ff" centro={sys.carga + '%'} etiqueta="CARGA" />
            <Gauge pct={sys.senal} color="#56c8ff" centro={sys.senal + '%'} etiqueta="SEÑAL" />
          </div>
        </div>

        {/* ============ FEED (eventos reales) ============ */}
        <Feed log={log} expandido={feedTodo} onVerTodo={() => setFeedTodo((v) => !v)} />

        {/* ============ BARRA DE TAREAS ============ */}
        <footer className="barra-tareas">
          <div className="bt-logo">
            <Icono tipo="engranaje" />
          </div>
          <button className="bt-boton" onClick={silenciarVoz} title="Silenciar la voz">
            <Icono tipo="altavoz" />
          </button>
          <button className="bt-boton" onClick={enfocarInput} title="Escribir una orden">
            <Icono tipo="teclado" />
          </button>
          <button className="bt-boton" onClick={pantallaCompleta} title="Pantalla completa">
            <Icono tipo="cuadrado" />
          </button>
          <button className="bt-boton" onClick={enviarTexto} title="Transmitir orden escrita">
            <Icono tipo="terminal" />
          </button>
          <div className="cmd">
            <span className="cmd-prompt">&gt;_</span>
            <input
              ref={inputRef}
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviarTexto()}
              placeholder="escribile una orden a Jarvis y presioná Enter"
              spellCheck="false"
            />
          </div>
          <button className="bt-enviar" onClick={enviarTexto}>
            TRANSMITIR
          </button>
          <span className="bt-dato">
            CARGA {sys.carga}% · MEM {sys.heapPct != null ? sys.heapPct + '%' : 'N/D'} · FPS{' '}
            {sys.fps}
          </span>
          <span className="bt-sep" />
          <span className="bt-hora">{hh}:{mm}</span>
          <span className="bt-fecha">{fechaCorta}</span>
        </footer>

        {/* overlays */}
        {verScan && <div className="scanlines" />}
        <div className="vineta" />
      </div>
    </div>
  );
}