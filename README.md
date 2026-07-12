# J.A.R.V.I.S. — Neura Sistemas

Asistente personal por voz con interfaz HUD estilo Iron Man.

**Arquitectura:** Voz → React (este repo) → Webhook de Make → Groq (`openai/gpt-oss-120b`) → Make → React → Voz.

El navegador escucha con la Web Speech API, manda el texto al escenario **"Jarvis - Cerebro (Groq)"** en Make, y lee la respuesta en voz alta con la síntesis de voz del sistema. Todo gratis salvo las operaciones de Make (3 por pregunta).

---

## Requisitos

- [Node.js](https://nodejs.org) 18 o superior (versión LTS recomendada)
- Google Chrome (el reconocimiento de voz funciona ahí)

## Cómo correrlo

```bash
npm install
npm run dev
```

Abrir **http://localhost:5173** en Chrome y permitir el micrófono cuando lo pida.

- **Click en el núcleo** (o barra **ESPACIO**) → hablar
- También se puede **escribir** en la barra inferior y presionar Enter

## Configuración

Todo lo externo vive en `src/config.js`:

- `WEBHOOK_URL` → la URL del webhook de Make (escenario "Jarvis - Cerebro (Groq)")
- `IDIOMA` → idioma de voz y reconocimiento (`es-AR`)
- `OPERADOR` → tu nombre en el HUD

La personalidad de Jarvis **no** está acá: vive en el módulo HTTP del escenario de Make (el `system` prompt que se le manda a Groq). Para cambiarla, editá el escenario en Make.

## Subirlo a GitHub

```bash
git init
git add .
git commit -m "Jarvis HUD v0.1"
```

Después creá un repositorio vacío en github.com y:

```bash
git remote add origin https://github.com/TU_USUARIO/jarvis-hud.git
git branch -M main
git push -u origin main
```

## Estructura

```
src/
  config.js              ← webhook de Make, idioma, operador
  App.jsx                ← layout del HUD (3 columnas + barras)
  styles.css             ← estética Iron Man (tokens de color/tipografía)
  hooks/useJarvis.js     ← máquina de estados: escuchar → Make → hablar
  components/
    ArcReactor.jsx       ← el núcleo central animado
    HudParts.jsx         ← paneles, waveform, consola, reloj, circuitos
```

## Roadmap

- [ ] Wake word "Jarvis" (Picovoice Porcupine, gratis para uso personal)
- [ ] Memoria de conversación (Data Store en Make)
- [ ] Ramas de acciones en Make: clima, tareas, YouTube, agenda, mail
- [ ] Voz premium local (Piper TTS)
- [ ] Gestos con MediaPipe Hands
