import React, { useEffect, useRef } from 'react';

// ============================================================
//  Piezas del HUD: celdas del tablero, consola de misión,
//  panel FEED, globo terráqueo wireframe, trazas de circuito,
//  mini reactor e iconos SVG del dock / barra de tareas.
// ============================================================

// ---------- Celda genérica del tablero con cabecera ----------
export function Celda({ titulo, extra, pie, children, className = '' }) {
  return (
    <div className={'celda ' + className}>
      {titulo != null && (
        <div className="celda-cab">
          <span>{titulo}</span>
          {extra != null && <span className="celda-extra">{extra}</span>}
        </div>
      )}
      <div className={'celda-cuerpo' + (titulo == null ? ' sin-cab' : '')}>{children}</div>
      {pie != null && <div className="celda-pie">{pie}</div>}
    </div>
  );
}

// ---------- Consola de conversación (datos reales del log) ----------
export function ConsoleLog({ log }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);
  return (
    <div className="consola" ref={ref}>
      {log.map((l, i) => (
        <p key={i} className={'linea quien-' + l.quien}>
          <span className="hora">[{l.hora}]</span>
          <span className="quien">{l.quien}</span>
          <span className="texto">{l.texto}</span>
        </p>
      ))}
    </div>
  );
}

// ---------- Panel FEED (eventos reales, como la referencia) ----------
export function Feed({ log, expandido, onVerTodo }) {
  const ref = useRef(null);
  const items = expandido ? log : log.slice(-2);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log, expandido]);
  return (
    <div className="celda p-feed">
      <div className="feed-tag">FEED</div>
      <div className={'feed-lista' + (expandido ? ' expandido' : '')} ref={ref}>
        {items.map((l, i) => (
          <div key={i} className={'feed-item quien-' + l.quien}>
            <span className="feed-flecha">▶</span>
            <span className="hora">[{l.hora}]</span>
            <span className="feed-quien">{l.quien}:</span>
            <span className="feed-texto">{l.texto}</span>
          </div>
        ))}
      </div>
      <button className="feed-vertodo" onClick={onVerTodo}>
        {expandido ? 'RESUMIR ⧉' : 'VER TODO ⧉'}
      </button>
    </div>
  );
}

// ---------- Globo wireframe (misma geometría de la referencia) ----------
export function Globo() {
  return (
    <svg viewBox="0 0 158 158" width="158" height="158" className="globo">
      <g fill="none" stroke="rgba(90,205,255,.55)" strokeWidth="1">
        <circle cx="79" cy="79" r="62" />
        <ellipse cx="79" cy="79" rx="62" ry="20" />
        <ellipse cx="79" cy="79" rx="62" ry="42" />
        <ellipse cx="79" cy="79" rx="20" ry="62" />
        <ellipse cx="79" cy="79" rx="42" ry="62" />
        <line x1="17" y1="79" x2="141" y2="79" />
        <line x1="79" y1="17" x2="79" y2="141" />
      </g>
      <circle
        cx="79" cy="79" r="72"
        fill="none" stroke="rgba(70,180,235,.3)" strokeWidth="1" strokeDasharray="2 5"
      />
    </svg>
  );
}

// ---------- Trazas de circuito dentro de la consola ----------
export function TrazasCircuito() {
  return (
    <svg className="trazas" viewBox="0 0 600 480" fill="none">
      <g stroke="rgba(80,205,255,.45)" strokeWidth="1.4">
        <polyline points="120,120 120,40 180,40 180,100 420,100" />
        <polyline points="100,140 100,220 160,220 160,160 400,160" />
        <polyline points="130,260 200,260 200,210 480,210" />
        <polyline points="110,290 110,340 260,340 260,270 440,270" />
        <polyline points="140,380 220,380 220,430 380,430" />
        <polyline points="90,180 60,180 60,400 160,400" />
      </g>
      <g fill="#8fe0ff">
        <circle cx="420" cy="100" r="3" />
        <circle cx="400" cy="160" r="3" />
        <circle cx="480" cy="210" r="3" />
        <circle cx="440" cy="270" r="3" />
        <circle cx="380" cy="430" r="3" />
        <circle cx="160" cy="400" r="3" />
        <rect x="117" y="117" width="6" height="6" />
        <rect x="97" y="137" width="6" height="6" />
        <rect x="127" y="257" width="6" height="6" />
        <rect x="107" y="287" width="6" height="6" />
        <rect x="137" y="377" width="6" height="6" />
      </g>
    </svg>
  );
}

// ---------- Mini reactor del clúster de reloj ----------
export function MiniReactor({ estado }) {
  return (
    <div className={'mini-reactor estado-' + estado}>
      <div className="mini-aro-ext" />
      <div className="mini-aro-int" />
      <div className="mini-nucleo" />
    </div>
  );
}

// ---------- Iconos SVG del dock lateral y la barra de tareas ----------
export function Icono({ tipo }) {
  const p = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (tipo) {
    case 'reticula':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <line x1="12" y1="2.5" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="21.5" y2="12" />
        </svg>
      );
    case 'libro':
      return (
        <svg {...p}>
          <path d="M4 5.5C7 4 9 4 12 5.5c3-1.5 5-1.5 8 0V19c-3-1.5-5-1.5-8 0-3-1.5-5-1.5-8 0Z" />
          <line x1="12" y1="5.5" x2="12" y2="19" />
        </svg>
      );
    case 'chispa':
      return (
        <svg {...p}>
          <path d="M12 3.5 14 10l6.5 2L14 14l-2 6.5L10 14l-6.5-2L10 10Z" />
        </svg>
      );
    case 'monitor':
      return (
        <svg {...p}>
          <rect x="3" y="4.5" width="18" height="12.5" rx="1.5" />
          <line x1="9" y1="21" x2="15" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case 'pantalla':
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <line x1="12" y1="9" x2="12" y2="15" />
          <line x1="9" y1="12" x2="15" y2="12" />
        </svg>
      );
    case 'engranaje':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      );
    case 'altavoz':
      return (
        <svg {...p}>
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z" />
          <path d="M15.5 9a4.3 4.3 0 0 1 0 6" />
          <path d="M18 6.5a8 8 0 0 1 0 11" />
        </svg>
      );
    case 'teclado':
      return (
        <svg {...p}>
          <rect x="2.5" y="7" width="19" height="10.5" rx="1.5" />
          <path d="M6 10.5h.01M9.5 10.5h.01M13 10.5h.01M16.5 10.5h.01M7 14h10" />
        </svg>
      );
    case 'cuadrado':
      return (
        <svg {...p}>
          <rect x="5" y="5" width="14" height="14" rx="1" />
        </svg>
      );
    case 'terminal':
      return (
        <svg {...p}>
          <path d="M4 17.5 10 12 4 6.5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    default:
      return null;
  }
}
