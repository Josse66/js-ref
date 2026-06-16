# JS Ref — Apuntes de JavaScript

Referencia rápida e interactiva de mis apuntes de JavaScript del curso **Algoritmos y Estructuras de Datos** de freeCodeCamp. Búsqueda instantánea sobre las 73 secciones, navegación por bloques y un asistente con IA (Gemini) que conoce la sección que estás leyendo.

**73 secciones · 7 bloques · 96 ejemplos de código**

---

## Qué incluye

- **Búsqueda global instantánea** (`⌘K` / `Ctrl+K` o tecla `/`) — busca en títulos, explicaciones y código, con resaltado de coincidencias y navegación por teclado.
- **Recorrido por bloques** — barra lateral tipo línea de tiempo con los 7 bloques del curso, cada uno con su color.
- **Resaltado de sintaxis** con highlight.js y botón de copiar en cada bloque de código.
- **Asistente IA con contexto** — el chat sabe qué sección estás viendo y responde dudas rápidas usando Gemini. La API key vive solo en el servidor, nunca en el navegador.
- **Responsive** — funciona en móvil y escritorio.

---

## Estructura del proyecto

```
.
├── index.html        → la app (estructura)
├── styles.css        → diseño (tema oscuro, acento ámbar)
├── app.js            → toda la lógica: búsqueda, navegación, chat
├── data.js           → el contenido de los apuntes (73 secciones)
├── api/
│   └── gemini.js     → función serverless de Vercel (llama a Gemini)
├── vercel.json       → configuración de despliegue
├── package.json
└── .env.example      → plantilla de variables de entorno
```

Todo es **HTML + CSS + JavaScript vanilla** (sin frameworks), para que el código se entienda completo.

---

## Cómo desplegarlo en Vercel

### 1. Consigue una API key de Gemini (gratis)

Entra a [Google AI Studio](https://aistudio.google.com/app/apikey) y crea una API key.

### 2. Sube el proyecto a GitHub

```bash
git init
git add .
git commit -m "JS Ref — apuntes interactivos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/js-ref.git
git push -u origin main
```

### 3. Conéctalo a Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
2. No necesitas cambiar nada en *Build Settings* (es un sitio estático con una función).
3. Ve a **Settings → Environment Variables** y agrega:

   | Nombre | Valor |
   |--------|-------|
   | `GEMINI_API_KEY` | tu API key |

4. **Deploy**. En menos de un minuto tu app está en línea.

> Cada vez que hagas `git push`, Vercel actualiza la app automáticamente.

### Rotación de keys (opcional)

Si la app recibe tráfico y una key se satura, puedes agregar más y el servidor las prueba en orden:

```
GEMINI_API_KEY_2=...
GEMINI_API_KEY_3=...
```

---

## Desarrollo local

La búsqueda y todos los apuntes funcionan abriendo `index.html` directamente o con cualquier servidor estático. El **asistente IA** necesita la función serverless, así que para probarlo en local usa la CLI de Vercel:

```bash
npm i -g vercel
vercel dev
```

Crea un archivo `.env` (copia `.env.example`) con tu `GEMINI_API_KEY`.

---

## Cómo agregar un bloque nuevo

El proyecto está pensado para crecer con los próximos temas del curso (Programación Funcional, Algoritmos Intermedios, etc.) **sin tocar el código de la app**. Solo se edita `data.js`:

### 1. Agrega el bloque al arreglo `bloques`

```js
{
  id: 'funcional',
  titulo: 'Programación Funcional',
  desc: 'Funciones puras, map, filter, reduce',
  rango: [74, 85]
}
```

### 2. Agrega sus secciones al arreglo `secciones`

Cada sección sigue esta forma:

```js
{
  numero: 74,
  titulo: 'Funciones Puras',
  bloque: 'funcional',
  contenido: [
    { tipo: 'texto', texto: 'Una función pura **siempre** devuelve lo mismo...' },
    { tipo: 'subtitulo', texto: 'Ejemplo' },
    { tipo: 'codigo', codigo: 'const sumar = (a, b) => a + b;' },
    { tipo: 'tabla', filas: [
        ['Concepto', 'Descripción'],
        ['Pura', 'Sin efectos secundarios']
    ]}
  ]
}
```

Tipos de contenido disponibles: `texto`, `subtitulo`, `codigo`, `tabla`. Dentro de `texto`, `subtitulo` y celdas de tabla puedes usar `**negritas**` y `` `código en línea` ``.

### 3. (Opcional) Dale un color al bloque

En `styles.css` agrega una variable `--c-funcional` y en `app.js` añádela a `BLOCK_COLOR`. Si no, hereda el ámbar por defecto.

Eso es todo — el syllabus, la búsqueda y el contexto del asistente lo recogen automáticamente.

---

## Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `⌘K` / `Ctrl+K` | Abrir búsqueda |
| `/` | Abrir búsqueda |
| `↑` `↓` | Navegar resultados |
| `↵` | Abrir sección |
| `Esc` | Cerrar |

---

Hecho con apuntes propios, desde febrero 2026.
