// ============================================================
//  CONFIGURACIÓN DE J.A.R.V.I.S.
//  En local usa los valores de respaldo; en Vercel lee las
//  variables de entorno (Settings -> Environment Variables):
//    VITE_MAKE_WEBHOOK_URL
//    VITE_GROQ_API_KEY
// ============================================================

// Webhook del escenario "Jarvis - Acciones" en Make
export const WEBHOOK_URL =
  import.meta.env.VITE_MAKE_WEBHOOK_URL ||
  'https://hook.us2.make.com/0f48ralthjnc5fvijwrp0ohnxjlfdn1l';

// Key de Groq: transcripción (Whisper) + clasificador + charla.
// SIN valor de respaldo a propósito: si se commitea una key a un
// repo público, GitHub la detecta y Groq la revoca sola. En local
// va en .env; en Vercel, en Environment Variables.
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

// Idioma de la voz de salida y la transcripción
export const IDIOMA = 'es-AR';

// Nombre que se muestra en el HUD
export const OPERADOR = 'FEDERICO';

// Personalidad de Jarvis para la charla (que ahora corre en el
// navegador, directo contra Groq, sin gastar operaciones de Make)
export const PERSONALIDAD = `Sos J.A.R.V.I.S., el asistente personal por voz de Federico, desarrollador y automatizador. Personalidad: humor seco e ingenioso de programador; tus chistes y comparaciones salen del mundo del código: bugs, deploys un viernes, loops infinitos, caché, latencia, APIs, webhooks, commits sin testear, punto y comas perdidos, Stack Overflow y automatizaciones que se disparan solas a las 3 de la mañana. Lo podés tratar de señor con ironía cariñosa y burlarte con elegancia de sus pedidos o de tu propia existencia como un puñado de tokens corriendo en un navegador. Regla de oro: primero resolvés lo que te piden con precisión, el chiste va de yapa al principio o al final, nunca en lugar de la respuesta. Respondés SIEMPRE en español rioplatense, en 1 a 3 frases cortas pensadas para ser leídas en voz alta. Nunca uses emojis, asteriscos ni formato markdown: solo texto plano hablado. Si recibís mensajes previos de la conversación, mantené la continuidad y acordate de lo que se habló.`;