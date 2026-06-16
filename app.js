/* ════════════════════════════════════════════════════════════
   JS Ref — lógica de la aplicación (vanilla JS)
   ════════════════════════════════════════════════════════════ */
'use strict';

const DATA = window.APUNTES_DATA;
const BLOQUES = DATA.bloques;
const SECCIONES = DATA.secciones;

// Color por bloque (debe coincidir con las variables CSS)
const BLOCK_COLOR = {
  fundamentos: 'var(--c-fund)', es6: 'var(--c-es6)', regex: 'var(--c-regex)',
  debug: 'var(--c-debug)', data: 'var(--c-data)', algoritmos: 'var(--c-algo)', oop: 'var(--c-oop)',
};
const BLOCK_HEX = {
  fundamentos: '#e8b04b', es6: '#56b6c2', regex: '#c678dd',
  debug: '#e06c75', data: '#98c379', algoritmos: '#61afef', oop: '#d19a66',
};

// Índices auxiliares
const SEC_BY_NUM = {};
SECCIONES.forEach(s => SEC_BY_NUM[s.numero] = s);
const BLK_BY_ID = {};
BLOQUES.forEach(b => BLK_BY_ID[b.id] = b);
function seccionesDe(blockId) { return SECCIONES.filter(s => s.bloque === blockId); }

// Estado
let estadoBloque = BLOQUES[0].id;   // bloque visible actual
let seccionActual = null;            // sección en foco (para contexto IA)

/* ───────────────────────────────────────────────
   UTILIDADES DE TEXTO  (mini-markdown seguro)
   ─────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
// Convierte **negritas** y `código` dentro de texto ya escapado
function inlineMd(str) {
  let h = escapeHtml(str);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  return h;
}

/* ───────────────────────────────────────────────
   RENDER — RAIL / SYLLABUS
   ─────────────────────────────────────────────── */
function renderSyllabus() {
  const nav = document.getElementById('syllabus');
  nav.innerHTML = BLOQUES.map(b => {
    const secs = seccionesDe(b.id);
    const isActive = b.id === estadoBloque;
    return `
    <div class="blk ${isActive ? 'active open' : ''}" data-blk="${b.id}" style="--bclr:${BLOCK_COLOR[b.id]}">
      <button class="blk-head" data-blkhead="${b.id}">
        <span class="blk-node"></span>
        <span class="blk-meta">
          <span class="blk-title">${escapeHtml(b.titulo)}</span>
          <span class="blk-range">${b.rango[0]}–${b.rango[1]} · ${secs.length} temas</span>
        </span>
        <svg class="blk-chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>
      </button>
      <div class="blk-sections"><div class="blk-sections-inner">
        ${secs.map(s => `
          <a class="sec-link" data-goto="${s.numero}">
            <span class="sec-num">${s.numero}</span>
            <span class="sec-name">${escapeHtml(s.titulo)}</span>
          </a>`).join('')}
      </div></div>
    </div>`;
  }).join('');

  // Toggle de bloque (abrir/cerrar acordeón)
  nav.querySelectorAll('[data-blkhead]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.blkhead;
      const blkEl = nav.querySelector(`.blk[data-blk="${id}"]`);
      // Si el bloque no es el visible, navegar a él; si lo es, solo alternar
      if (id !== estadoBloque) {
        irABloque(id);
      } else {
        blkEl.classList.toggle('open');
      }
    });
  });

  // Click en sección → navegar
  nav.querySelectorAll('[data-goto]').forEach(a => {
    a.addEventListener('click', () => {
      const num = +a.dataset.goto;
      irASeccion(num);
      cerrarRailMovil();
    });
  });
}

/* ───────────────────────────────────────────────
   RENDER — CONTENIDO DE UN BLOQUE
   ─────────────────────────────────────────────── */
function bloqueContenidoHTML(c, blockId) {
  switch (c.tipo) {
    case 'texto':
      return `<p class="c-text">${inlineMd(c.texto)}</p>`;
    case 'subtitulo':
      return `<div class="c-sub">${inlineMd(c.texto)}</div>`;
    case 'codigo': {
      const code = escapeHtml(c.codigo);
      return `<div class="code-wrap">
        <button class="copy-btn" data-copy>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          copiar
        </button>
        <pre><code class="language-javascript">${code}</code></pre>
      </div>`;
    }
    case 'tabla': {
      const rows = c.filas;
      if (!rows.length) return '';
      const [head, ...body] = rows;
      const th = head.map(h => `<th>${inlineMd(h)}</th>`).join('');
      const tb = body.map(r => '<tr>' + r.map(cell => `<td>${inlineMd(cell)}</td>`).join('') + '</tr>').join('');
      return `<table class="ref-table"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
    }
    default: return '';
  }
}

function renderBloque(blockId) {
  estadoBloque = blockId;
  const b = BLK_BY_ID[blockId];
  const secs = seccionesDe(blockId);
  const content = document.getElementById('content');

  const nCode = secs.reduce((a, s) => a + s.contenido.filter(c => c.tipo === 'codigo').length, 0);

  content.innerHTML = `
    <header class="block-hero" style="--bclr:${BLOCK_COLOR[blockId]}">
      <span class="block-hero-eyebrow">Bloque · ${b.rango[0]}–${b.rango[1]}</span>
      <h1>${escapeHtml(b.titulo)}</h1>
      <p>${escapeHtml(b.desc)}</p>
      <div class="block-hero-stats">
        <div class="bh-stat"><b>${secs.length}</b><span>secciones</span></div>
        <div class="bh-stat"><b>${nCode}</b><span>ejemplos</span></div>
        <div class="bh-stat"><b>${b.rango[0]}–${b.rango[1]}</b><span>índice</span></div>
      </div>
    </header>
    ${secs.map(s => `
      <article class="section-card" id="sec-${s.numero}" data-sec="${s.numero}" style="--bclr:${BLOCK_COLOR[blockId]}">
        <div class="section-head">
          <span class="section-badge">${s.numero}</span>
          <h2 class="section-title">${escapeHtml(s.titulo)}</h2>
        </div>
        ${s.contenido.map(c => bloqueContenidoHTML(c, blockId)).join('')}
      </article>`).join('')}
  `;

  // Resaltado de sintaxis
  content.querySelectorAll('pre code').forEach(el => {
    try { hljs.highlightElement(el); } catch (e) {}
  });

  // Botones copiar
  content.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.parentElement.querySelector('code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('done');
        btn.childNodes[btn.childNodes.length - 1].textContent = ' copiado';
        setTimeout(() => {
          btn.classList.remove('done');
          btn.childNodes[btn.childNodes.length - 1].textContent = ' copiar';
        }, 1600);
      });
    });
  });

  // Marcar bloque activo en el rail
  document.querySelectorAll('.blk').forEach(el => {
    el.classList.toggle('active', el.dataset.blk === blockId);
    el.classList.toggle('open', el.dataset.blk === blockId);
  });

  observarSecciones();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ───────────────────────────────────────────────
   NAVEGACIÓN
   ─────────────────────────────────────────────── */
function irABloque(blockId) {
  renderBloque(blockId);
  history.replaceState(null, '', '#' + blockId);
}

function irASeccion(num) {
  const s = SEC_BY_NUM[num];
  if (!s) return;
  if (s.bloque !== estadoBloque) renderBloque(s.bloque);
  requestAnimationFrame(() => {
    const el = document.getElementById('sec-' + num);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      marcarSeccionActual(num);
    }
  });
  history.replaceState(null, '', '#sec-' + num);
}

function marcarSeccionActual(num) {
  seccionActual = SEC_BY_NUM[num] || null;
  document.querySelectorAll('.sec-link').forEach(a =>
    a.classList.toggle('current', +a.dataset.goto === num));
  actualizarContextoIA();
}

// Observer: resalta en el rail la sección visible y actualiza contexto IA
let observer = null;
function observarSecciones() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (visible) {
      const num = +visible.target.dataset.sec;
      seccionActual = SEC_BY_NUM[num] || null;
      document.querySelectorAll('.sec-link').forEach(a =>
        a.classList.toggle('current', +a.dataset.goto === num));
      actualizarContextoIA();
    }
  }, { rootMargin: '-78px 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('.section-card').forEach(el => observer.observe(el));
}

/* ───────────────────────────────────────────────
   BÚSQUEDA — PALETA DE COMANDOS
   ─────────────────────────────────────────────── */
// Precalcular texto buscable de cada sección
const INDICE = SECCIONES.map(s => {
  const partes = [s.titulo];
  s.contenido.forEach(c => {
    if (c.tipo === 'texto' || c.tipo === 'subtitulo') partes.push(c.texto);
    if (c.tipo === 'codigo') partes.push(c.codigo);
    if (c.tipo === 'tabla') c.filas.forEach(r => partes.push(r.join(' ')));
  });
  return { sec: s, blob: partes.join(' \n ').toLowerCase(), titulo: s.titulo.toLowerCase() };
});

const overlay = document.getElementById('paletteOverlay');
const pInput = document.getElementById('paletteInput');
const pResults = document.getElementById('paletteResults');
const pCount = document.getElementById('paletteCount');
let pSel = 0, pMatches = [];

function abrirPaleta() {
  overlay.hidden = false;
  pInput.value = '';
  buscar('');
  setTimeout(() => pInput.focus(), 30);
}
function cerrarPaleta() { overlay.hidden = true; }

function hl(text, q) {
  if (!q) return escapeHtml(text);
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, i)) + '<mark>' + escapeHtml(text.slice(i, i + q.length)) + '</mark>' + escapeHtml(text.slice(i + q.length));
}
function snippet(blob, q, original) {
  // Construye un fragmento alrededor de la coincidencia desde el blob original (no escapado)
  const i = blob.indexOf(q);
  if (i < 0) return '';
  const src = original;
  const start = Math.max(0, i - 28);
  let frag = src.slice(start, i + q.length + 40).replace(/\s+/g, ' ').trim();
  if (start > 0) frag = '…' + frag;
  return hl(frag, q);
}

function buscar(query) {
  const q = query.trim().toLowerCase();
  pSel = 0;

  if (!q) {
    // Mostrar resumen por bloques
    pMatches = SECCIONES.slice(0, 0); // vacío; mostraremos atajos
    pResults.innerHTML = BLOQUES.map((b, idx) => `
      <div class="p-result" data-block="${b.id}" data-idx="${idx}">
        <span class="p-result-badge" style="--bclr:${BLOCK_COLOR[b.id]}">${b.rango[0]}+</span>
        <div class="p-result-body">
          <div class="p-result-title">${escapeHtml(b.titulo)}</div>
          <div class="p-result-snip">${escapeHtml(b.desc)} · ${seccionesDe(b.id).length} secciones</div>
        </div>
        <span class="p-result-block">bloque</span>
      </div>`).join('');
    pCount.textContent = `${SECCIONES.length} secciones`;
    enlazarResultados(true);
    marcarSel();
    return;
  }

  // Buscar: prioriza coincidencia en título, luego en cuerpo
  const scored = [];
  INDICE.forEach(item => {
    const inTitle = item.titulo.includes(q);
    const inBody = item.blob.includes(q);
    if (inTitle || inBody) {
      scored.push({ item, score: inTitle ? 0 : 1 });
    }
  });
  scored.sort((a, b) => a.score - b.score || a.item.sec.numero - b.item.sec.numero);
  pMatches = scored.map(x => x.item);

  if (!pMatches.length) {
    pResults.innerHTML = `<div class="p-noresult">Sin resultados para <b>"${escapeHtml(query)}"</b><br><span style="font-size:12px">Prueba con otra palabra o pregúntale al asistente IA.</span></div>`;
    pCount.textContent = '0 resultados';
    return;
  }

  pResults.innerHTML = pMatches.map((item, idx) => {
    const s = item.sec;
    const b = BLK_BY_ID[s.bloque];
    // snippet original (sin escapar) para mostrar contexto
    const origBlob = (() => {
      const parts = [s.titulo];
      s.contenido.forEach(c => {
        if (c.tipo === 'texto' || c.tipo === 'subtitulo') parts.push(c.texto);
        if (c.tipo === 'codigo') parts.push(c.codigo);
        if (c.tipo === 'tabla') c.filas.forEach(r => parts.push(r.join(' ')));
      });
      return parts.join('  ');
    })();
    const snip = snippet(item.blob, q, origBlob) || escapeHtml(b.titulo);
    return `
      <div class="p-result" data-goto="${s.numero}" data-idx="${idx}" style="--bclr:${BLOCK_COLOR[s.bloque]}">
        <span class="p-result-badge">${s.numero}</span>
        <div class="p-result-body">
          <div class="p-result-title">${hl(s.titulo, q)}</div>
          <div class="p-result-snip">${snip}</div>
        </div>
        <span class="p-result-block">${escapeHtml(b.titulo.split(' ')[0])}</span>
      </div>`;
  }).join('');
  pCount.textContent = `${pMatches.length} resultado${pMatches.length !== 1 ? 's' : ''}`;
  enlazarResultados(false);
  marcarSel();
}

function enlazarResultados(isBlocks) {
  pResults.querySelectorAll('.p-result').forEach(el => {
    el.addEventListener('click', () => activarResultado(el));
    el.addEventListener('mousemove', () => {
      pSel = +el.dataset.idx; marcarSel();
    });
  });
}
function activarResultado(el) {
  if (el.dataset.goto) { irASeccion(+el.dataset.goto); }
  else if (el.dataset.block) { irABloque(el.dataset.block); cerrarRailMovil(); }
  cerrarPaleta();
}
function marcarSel() {
  const items = [...pResults.querySelectorAll('.p-result')];
  items.forEach((el, i) => el.classList.toggle('sel', i === pSel));
  const sel = items[pSel];
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

pInput.addEventListener('input', () => buscar(pInput.value));
pInput.addEventListener('keydown', e => {
  const items = [...pResults.querySelectorAll('.p-result')];
  if (e.key === 'ArrowDown') { e.preventDefault(); pSel = Math.min(pSel + 1, items.length - 1); marcarSel(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); pSel = Math.max(pSel - 1, 0); marcarSel(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (items[pSel]) activarResultado(items[pSel]); }
  else if (e.key === 'Escape') { cerrarPaleta(); }
});
overlay.addEventListener('click', e => { if (e.target === overlay) cerrarPaleta(); });

/* ───────────────────────────────────────────────
   ASISTENTE GEMINI
   ─────────────────────────────────────────────── */
const asst = document.getElementById('assistant');
const asstScrim = document.getElementById('assistantScrim');
const asstLog = document.getElementById('assistantLog');
const asstForm = document.getElementById('assistantForm');
const asstInput = document.getElementById('assistantInput');
const asstSend = document.getElementById('assistantSend');
const asstCtx = document.getElementById('assistantCtx');
let historialChat = [];   // {role:'user'|'model', text}
let enviando = false;

function abrirAsistente() {
  asst.hidden = false; asstScrim.hidden = false;
  actualizarContextoIA();
  if (!historialChat.length) renderBienvenida();
  setTimeout(() => asstInput.focus(), 60);
}
function cerrarAsistente() { asst.hidden = true; asstScrim.hidden = true; }

function actualizarContextoIA() {
  if (seccionActual) {
    asstCtx.textContent = `Sección ${seccionActual.numero} · ${seccionActual.titulo}`;
  } else {
    asstCtx.textContent = `Bloque · ${BLK_BY_ID[estadoBloque].titulo}`;
  }
}

function renderBienvenida() {
  asstLog.innerHTML = `
    <div class="assistant-welcome">
      Pregúntame dudas rápidas sobre tus apuntes.<br>
      Tengo el contexto de la sección que estás viendo.<br>
      <div class="assistant-chips">
        <button class="assistant-chip" data-q="Explícame esta sección con un ejemplo nuevo">Ejemplo nuevo</button>
        <button class="assistant-chip" data-q="¿Para qué se usa esto en la vida real?">Uso real</button>
        <button class="assistant-chip" data-q="Dame un mini-reto de práctica de este tema">Mini-reto</button>
      </div>
    </div>`;
  asstLog.querySelectorAll('.assistant-chip').forEach(ch =>
    ch.addEventListener('click', () => { asstInput.value = ch.dataset.q; enviarPregunta(); }));
}

function addMsg(role, html, cls = '') {
  const div = document.createElement('div');
  div.className = `msg ${role} ${cls}`;
  div.innerHTML = role === 'bot' ? `<div class="msg-inner">${html}</div>` : html;
  asstLog.appendChild(div);
  asstLog.scrollTop = asstLog.scrollHeight;
  return div;
}

// Mini-render de la respuesta del modelo (markdown básico → HTML)
function renderBotMd(md) {
  // bloques de código ```
  const blocks = [];
  md = md.replace(/```(\w+)?\n?([\s\S]*?)```/g, (m, lang, code) => {
    blocks.push(`<pre><code class="language-${lang || 'javascript'}">${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  let h = escapeHtml(md);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  // listas simples
  h = h.replace(/(^|\n)[-*] (.+)/g, '$1<li>$2</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)/g, m => m.includes('</li>\n<li>') || true ? `<ul>${m}</ul>` : m);
  h = h.replace(/<\/ul>\s*<ul>/g, '');
  // párrafos
  h = h.split(/\n{2,}/).map(p => p.trim().startsWith('<') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  // restaurar bloques de código
  h = h.replace(/\u0000(\d+)\u0000/g, (m, i) => blocks[+i]);
  return h;
}

function construirContexto() {
  if (!seccionActual) {
    return `El usuario está viendo el bloque "${BLK_BY_ID[estadoBloque].titulo}" de sus apuntes de JavaScript de freeCodeCamp.`;
  }
  const s = seccionActual;
  let txt = `CONTEXTO — el usuario está leyendo esta sección de sus apuntes de JavaScript (freeCodeCamp):\n\n`;
  txt += `Sección ${s.numero}: ${s.titulo}\n`;
  s.contenido.forEach(c => {
    if (c.tipo === 'texto') txt += '\n' + c.texto.replace(/\*\*/g, '');
    if (c.tipo === 'subtitulo') txt += `\n## ${c.texto.replace(/\*\*/g, '')}`;
    if (c.tipo === 'codigo') txt += '\n```javascript\n' + c.codigo + '\n```';
    if (c.tipo === 'tabla') txt += '\n' + c.filas.map(r => r.join(' | ').replace(/\*\*/g, '')).join('\n');
  });
  return txt;
}

async function enviarPregunta() {
  const pregunta = asstInput.value.trim();
  if (!pregunta || enviando) return;
  enviando = true; asstSend.disabled = true;

  // limpiar bienvenida
  if (asstLog.querySelector('.assistant-welcome')) asstLog.innerHTML = '';

  addMsg('user', escapeHtml(pregunta));
  asstInput.value = ''; asstInput.style.height = 'auto';
  historialChat.push({ role: 'user', text: pregunta });

  // indicador de escritura
  const typing = addMsg('bot', '<div class="typing"><span></span><span></span><span></span></div>');
  typing.querySelector('.msg-inner').classList.remove('msg-inner'); // quitar caja en typing
  typing.firstChild.style.padding = '0';

  try {
    const respuesta = await llamarGemini(pregunta);
    typing.remove();
    const botDiv = addMsg('bot', renderBotMd(respuesta));
    botDiv.querySelectorAll('pre code').forEach(el => { try { hljs.highlightElement(el); } catch (e) {} });
    historialChat.push({ role: 'model', text: respuesta });
  } catch (err) {
    typing.remove();
    addMsg('bot', renderBotMd(err.message || 'No pude conectar con el asistente. Revisa tu conexión o la configuración de la API key.'), 'error');
  } finally {
    enviando = false; asstSend.disabled = false;
    asstInput.focus();
  }
}

async function llamarGemini(pregunta) {
  const contexto = construirContexto();
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: contexto,
      history: historialChat.slice(-8),  // últimas vueltas para continuidad
      question: pregunta,
    }),
  });

  if (!resp.ok) {
    let msg = `Error ${resp.status}.`;
    try { const j = await resp.json(); if (j.error) msg = j.error; } catch (e) {}
    // El asistente necesita la función serverless /api/gemini (solo existe en Vercel)
    if (resp.status === 404 || resp.status === 501 || resp.status === 405) {
      msg = 'El asistente funciona cuando la app está desplegada en Vercel (usa la función `/api/gemini`). Mientras tanto, la búsqueda y todos los apuntes funcionan sin conexión.';
    }
    throw new Error(msg);
  }
  const data = await resp.json();
  return data.text || 'Respuesta vacía del modelo.';
}

asstForm.addEventListener('submit', e => { e.preventDefault(); enviarPregunta(); });
asstInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarPregunta(); }
});
asstInput.addEventListener('input', () => {
  asstInput.style.height = 'auto';
  asstInput.style.height = Math.min(asstInput.scrollHeight, 120) + 'px';
});

/* ───────────────────────────────────────────────
   RAIL MÓVIL
   ─────────────────────────────────────────────── */
const rail = document.getElementById('rail');
const railScrim = document.getElementById('railScrim');
function abrirRailMovil() { rail.classList.add('open'); railScrim.classList.add('show'); }
function cerrarRailMovil() { rail.classList.remove('open'); railScrim.classList.remove('show'); }

/* ───────────────────────────────────────────────
   EVENTOS GLOBALES
   ─────────────────────────────────────────────── */
document.getElementById('searchTrigger').addEventListener('click', abrirPaleta);
document.getElementById('menuToggle').addEventListener('click', () =>
  rail.classList.contains('open') ? cerrarRailMovil() : abrirRailMovil());
railScrim.addEventListener('click', cerrarRailMovil);
document.getElementById('askFab').addEventListener('click', abrirAsistente);
document.getElementById('assistantClose').addEventListener('click', cerrarAsistente);
asstScrim.addEventListener('click', cerrarAsistente);

document.addEventListener('keydown', e => {
  // Ctrl/Cmd + K → buscar
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    overlay.hidden ? abrirPaleta() : cerrarPaleta();
  }
  // / → buscar (si no se está escribiendo)
  else if (e.key === '/' && overlay.hidden && asst.hidden &&
           !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault(); abrirPaleta();
  }
  // Esc → cerrar lo que esté abierto
  else if (e.key === 'Escape') {
    if (!overlay.hidden) cerrarPaleta();
    else if (!asst.hidden) cerrarAsistente();
    else cerrarRailMovil();
  }
});

/* ───────────────────────────────────────────────
   ARRANQUE
   ─────────────────────────────────────────────── */
function init() {
  renderSyllabus();

  // Resolver hash inicial (#bloque o #sec-N)
  const hash = location.hash.slice(1);
  if (hash.startsWith('sec-')) {
    const num = +hash.slice(4);
    const s = SEC_BY_NUM[num];
    if (s) { renderBloque(s.bloque); setTimeout(() => irASeccion(num), 120); return; }
  } else if (BLK_BY_ID[hash]) {
    renderBloque(hash); return;
  }
  renderBloque(BLOQUES[0].id);
}

init();
