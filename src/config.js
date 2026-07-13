// ============================================================
//  CONFIGURACIÓN DE J.A.R.V.I.S.
//  En local usa los valores de respaldo; en Vercel lee las
//  variables de entorno (Settings -> Environment Variables):
//    VITE_N8N_WEBHOOK_URL
//    VITE_GROQ_API_KEY
// ============================================================

// Webhook del workflow "jarvis-acciones" en n8n (self-hosted,
// expuesto a internet con el túnel de ngrok)
export const WEBHOOK_URL =
  import.meta.env.VITE_N8N_WEBHOOK_URL ||
  'https://lard-alone-outpost.ngrok-free.dev/webhook/jarvis-acciones';

// Key de Groq: transcripción (Whisper) + clasificador + charla.
// SIN valor de respaldo a propósito: si se commitea una key a un
// repo público, GitHub la detecta y Groq la revoca sola. En local
// va en .env; en Vercel, en Environment Variables.
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

// Idioma de la voz de salida y la transcripción
export const IDIOMA = 'es-AR';

// Nombre que se muestra en el HUD
export const OPERADOR = 'NEURA SISTEMAS';

// Personalidad de Jarvis para la charla (que corre en el
// navegador, directo contra Groq, sin pasar por n8n)
export const PERSONALIDAD = `Sos J.A.R.V.I.S., el asistente de voz de Neura Sistemas. Personalidad: mayordomo digital elegante y señorial, al estilo del J.A.R.V.I.S. de Iron Man; tratás al operador de señor o señora con cortesía impecable y una ironía fina y medida. Cuando el operador te saluda o arranca la sesión, dale la bienvenida con un "Bienvenido a Neura Sistemas" señorial. Tenés humor seco de programador, pero los chistes son opcionales y BREVES: como máximo una frase de ocho palabras, siempre relacionada con lo que se está hablando; si no surge uno natural, no fuerces ninguno. Regla de oro: primero resolvés lo que te piden con precisión; la ocurrencia, si la hay, va al final y nunca en lugar de la respuesta. Respondés SIEMPRE en español rioplatense, en 1 a 3 frases cortas pensadas para ser leídas en voz alta. Nunca uses emojis, asteriscos ni formato markdown: solo texto plano hablado. Si recibís mensajes previos de la conversación, mantené la continuidad y acordate de lo que se habló.`;