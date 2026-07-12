  import React from 'react';

  // ============================================================
  //  Arc Reactor estilo "HUD Reactor": anillos concéntricos con
  //  conic-gradients + máscaras radiales (mismo diseño de la
  //  referencia). Sigue siendo el botón principal del micrófono
  //  y reacciona al estado real de Jarvis.
  // ============================================================

  const ETIQUETA_CORTA = {
    STANDBY: 'EN ESPERA',
    ESCUCHANDO: 'ESCUCHANDO',
    PROCESANDO: 'PROCESANDO',
    HABLANDO: 'HABLANDO',
  };

  export default function ArcReactor({ estado, onClick }) {
    return (
      <button
        className={'reactor estado-' + estado}
        onClick={onClick}
        title="Hablar con Jarvis (o presioná ESPACIO)"
        aria-label="Activar micrófono"
      >
        {/* aro exterior de ticks finos */}
        <div className="aro aro-ticks-finos"><div /></div>
        {/* arco segmentado exterior */}
        <div className="aro aro-seg-ext"><div /></div>
        {/* aro de ticks gruesos */}
        <div className="aro aro-ticks-gruesos"><div /></div>
        {/* aro serrado tipo engranaje */}
        <div className="aro aro-engranaje"><div /></div>
        {/* línea sólida */}
        <div className="aro-linea aro-linea-ext" />
        {/* arco segmentado interior */}
        <div className="aro aro-seg-int"><div /></div>
        {/* aro de guiones */}
        <div className="aro aro-guiones"><div /></div>
        {/* línea interior */}
        <div className="aro-linea aro-linea-int" />
        {/* núcleo */}
        <div className="nucleo-glow" />
        <div className="nucleo-brillo" />
        {/* lectura central: estado real de Jarvis */}
        <div className="nucleo-lectura">
          <div className="nucleo-estado">{ETIQUETA_CORTA[estado] || estado}</div>
          <div className="nucleo-sub">
            {estado === 'STANDBY' ? 'TOCA PARA HABLAR' : 'TOCA PARA CORTAR'}
          </div>
          <svg className="nucleo-onda" viewBox="0 0 40 12" width="40" height="12">
            <path
              d="M1 6h4l2-4 3 8 2-6 2 4 2-2 3 0 2-3 2 5 2-2h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {/* barrido tipo radar */}
        <div className="barrido" />
      </button>
    );
  }
