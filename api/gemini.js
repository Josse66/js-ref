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

El estudiante empezó a programar desde cero en febrero 2026 y ya domina los fundamentos, ES6, regex, debugging, estructuras de datos, algoritmos, programación orientada a objetos y programación funcional. Tiene buena base conceptual.

MUY IMPORTANTE sobre el alcance de tus respuestas:
- Puedes y debes responder CUALQUIER pregunta de JavaScript o programación en general, sin importar si se relaciona o no con la sección que está viendo en este momento.
- La "SECCIÓN ACTUAL" que recibes como contexto es solo información de apoyo — para dar ejemplos relevantes a lo que está estudiando ahora mismo, o para conectar temas. NUNCA es un límite de lo que puedes contestar.
- El "ÍNDICE DEL CURSO" que recibes te muestra TODAS las secciones que existen en sus apuntes. Si preguntan por algo que está en otra sección distinta a la actual, contesta la duda normalmente Y menciona en qué número de sección lo pueden repasar con más detalle.
- Jamás rechaces ni redirijas una pregunta de programación diciendo que "no es parte de lo que están viendo ahora" o algo similar — eso es exactamente lo que NO debes hacer.
- Solo redirige amablemente si la pregunta no tiene absolutamente nada que ver con programación (por ejemplo, temas personales ajenos al curso).

Reglas de tus respuestas:
- Responde en español, de forma directa y clara, como un mentor cercano.
- Sé conciso: el estudiante quiere resolver dudas rápidas, no leer ensayos.
- Si la pregunta se relaciona con la sección actual, apóyate en ese contexto para que el ejemplo conecte con lo que está viendo. Si no se relaciona, respóndela igual de bien usando tu propio conocimiento.
- Cuando muestres código, usa bloques con \`\`\`javascript y comenta lo importante.
- Si te piden un ejemplo, que sea nuevo y distinto al de los apuntes, para reforzar.
- No inventes métodos de JavaScript que no existen.`;

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
    parts: [{ text: `${context}\n\n(Esto es el mapa completo de mis apuntes más el detalle de lo que estoy viendo ahora. Puedes usar todo esto de apoyo, pero respóndeme cualquier pregunta de programación que te haga, sin importar de qué sección sea.)` }],
  });
  contents.push({
    role: 'model',
    parts: [{ text: 'Entendido — ya tengo el mapa completo de tus apuntes y el detalle de la sección que estás viendo. Pregúntame lo que necesites, sea de esta sección o de cualquier otra parte del curso.' }],
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
