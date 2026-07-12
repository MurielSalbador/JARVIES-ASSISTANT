// ============================================================
//  CONFIGURACIÓN DE J.A.R.V.I.S.
//  Todo lo que se conecta "afuera" vive en este archivo.
//  Los valores sensibles se leen desde .env (ver .env.example).
// ============================================================

// Webhook del escenario "Jarvis - Cerebro (Groq)" en Make
export const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL;

// Key de Groq: se usa SOLO para transcribir tu voz con Whisper
// (el cerebro sigue pasando por Make). App de uso personal/local.
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

// Idioma de la voz de salida y la transcripción
export const IDIOMA = 'es-AR';

// Nombre que se muestra en el HUD
export const OPERADOR = 'FEDERICO';
