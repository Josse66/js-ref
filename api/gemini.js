// ════════════════════════════════════════════════════════════
// /api/gemini.js — Función Serverless de Vercel
//
// La API key NUNCA llega al navegador: vive solo aquí, en el servidor,
// leída desde las variables de entorno de Vercel.
//
// Soporta rotación de varias keys (GEMINI_API_KEY, GEMINI_API_KEY_2...)
// con fallback automático si una está saturada o falla.
// ════════════════════════════════════════════════════════════

const MODEL = 'gemini-2.5-flash';

// Reúne todas las keys disponibles desde las variables de entorno
function getKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 2; i <= 6; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

const SYSTEM_INSTRUCTION = `Eres un tutor de programación que ayuda a un estudiante con sus apuntes personales de JavaScript del curso de freeCodeCamp.

El estudiante empezó a programar desde cero en febrero 2026 y ya domina los fundamentos, ES6, regex, debugging, estructuras de datos, algoritmos y programación orientada a objetos. Tiene buena base conceptual.

Reglas de tus respuestas:
- Responde en español, de forma directa y clara, como un mentor cercano.
- Sé conciso: el estudiante quiere resolver dudas rápidas, no leer ensayos.
- Usa el CONTEXTO de la sección que está leyendo para dar respuestas relevantes a ese tema.
- Cuando muestres código, usa bloques con \`\`\`javascript y comenta lo importante.
- Si te piden un ejemplo, que sea nuevo y distinto al de los apuntes, para reforzar.
- No inventes métodos de JavaScript que no existen.
- Si la pregunta no tiene que ver con programación, redirígelo amablemente al estudio.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const keys = getKeys();
  if (!keys.length) {
    return res.status(500).json({
      error: 'Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel.',
    });
  }

  // Body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { context = '', history = [], question = '' } = body || {};
  if (!question.trim()) {
    return res.status(400).json({ error: 'No se recibió ninguna pregunta.' });
  }

  // Construir el historial de contenidos para Gemini
  const contents = [];

  // Primer turno: contexto de la sección (como mensaje de usuario + ack del modelo)
  contents.push({
    role: 'user',
    parts: [{ text: `${context}\n\n(Usa este contexto para responder mis siguientes preguntas.)` }],
  });
  contents.push({
    role: 'model',
    parts: [{ text: 'Entendido, tengo el contexto de esta sección. ¿Cuál es tu duda?' }],
  });

  // Historial previo de la conversación
  for (const m of history) {
    if (!m || !m.text) continue;
    contents.push({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text) }],
    });
  }

  // La pregunta actual (si no vino ya incluida en history)
  const last = history[history.length - 1];
  if (!last || last.text !== question) {
    contents.push({ role: 'user', parts: [{ text: question }] });
  }

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.95,
    },
  };

  // Intentar con cada key hasta que una funcione (rotación + fallback)
  let lastErr = 'Error desconocido.';
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (r.status === 429 || r.status === 503) {
        // Saturada o no disponible → probar la siguiente key
        lastErr = `Key ${i + 1} saturada (${r.status}).`;
        continue;
      }

      if (!r.ok) {
        const errText = await r.text();
        lastErr = `Gemini respondió ${r.status}.`;
        // 400/403 suelen ser problema de la key/payload; intentar siguiente por si acaso
        if (r.status === 400 || r.status === 403) continue;
        return res.status(502).json({ error: lastErr });
      }

      const data = await r.json();

      // Bloqueo por seguridad
      if (data.promptFeedback?.blockReason) {
        return res.status(200).json({
          text: 'No puedo responder eso. Sigamos con dudas sobre el curso. 🙂',
        });
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.map(p => p.text || '').join('').trim();

      if (!text) { lastErr = 'Respuesta vacía del modelo.'; continue; }

      return res.status(200).json({ text });

    } catch (e) {
      lastErr = e.message || 'Fallo de red al llamar a Gemini.';
      continue;  // probar siguiente key
    }
  }

  return res.status(502).json({ error: `No se pudo obtener respuesta. ${lastErr}` });
}
