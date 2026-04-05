# Comunidad Rubik's El Salvador — Sistema de Competencias

Plataforma web para organizar y competir en contests de speedcubing online,
desarrollada para la Comunidad Rubik's El Salvador.

## 🌐 Demo

Desplegada en GitHub Pages: `https://henrymixco35.github.io/Contest_RubiksElSalvador/`

---

## 🗂️ Estructura del Proyecto

```
rubiks-sv-contest/
├── index.html            # UI completa (single-page application)
├── firestore.rules       # Reglas de seguridad de Firestore ⚠️
├── css/
│   └── styles.css        # Todos los estilos de la aplicación
├── js/
│   ├── firebase.js       # Inicialización Firebase (se carga primero, type=module)
│   ├── storage.js        # Capa de persistencia con Firestore
│   ├── config.js         # Constantes (CATEGORIES) y estado global (AppState)
│   ├── timer.js          # Cronómetro con inspección WCA (15s)
│   ├── results.js        # Tabla de resultados y exportación CSV
│   ├── organizer.js      # Panel del organizador con Firebase Auth
│   ├── registration.js   # Formulario de registro del competidor
│   ├── ui.js             # Navegación, modales y notificaciones
│   └── main.js           # Arranque async, listeners globales
└── README.md
```

**Orden de carga de scripts** (el orden importa por dependencias):
`firebase.js` → `storage.js` → `config.js` → `timer.js` → `results.js` →
`organizer.js` → `registration.js` → `ui.js` → `main.js`

---

## ⚙️ Cómo Funciona

### Flujo del Competidor
1. Llega al **Landing** y presiona "Participar en el Contest"
2. Completa el **Registro** (nombre, email, categoría, sugerencias)
3. En el **Timer**, los scrambles se revelan uno por uno al presionar "Ver Scramble"
4. Tiene **15 segundos de inspección** (estándar WCA) antes de iniciar
5. Usa **Espacio** o **toque** para iniciar y detener el cronómetro
6. Aplica **+2** o **DNF** si corresponde tras cada solve
7. Al terminar los 5 solves, revisa el resumen y **envía** sus resultados a Firestore
8. Puede ver la **Tabla de Resultados** actualizada en tiempo real

### Flujo del Organizador
1. Accede al **Panel Organizador** con su email y contraseña de Firebase Auth
2. Configura el nombre y fecha límite del contest
3. Activa las categorías y pega los 5 scrambles de cada una
4. Presiona **Guardar y Activar** — el contest queda disponible en Firestore
5. Puede ver los participantes registrados y su estado (enviado / pendiente)
6. Puede exportar resultados a **CSV** por categoría

---

## 🔥 Configuración de Firebase (obligatorio antes de publicar)

### 1. Obtener el UID del organizador

1. Entrá a [Firebase Console](https://console.firebase.google.com)
2. Navegá a **Authentication → Users**
3. Copiá el valor de la columna **User UID** del usuario organizador

### 2. Pegar el UID en las reglas de seguridad

Abrí `firestore.rules` y reemplazá **todas** las ocurrencias de:
```
"TU_UID_AQUI"
```
por tu UID real. Ejemplo:
```
&& request.auth.uid == "abc123xyz456def789"
```

### 3. Publicar las reglas en Firestore

**Opción A — Firebase Console (recomendada):**
1. Firebase Console → Firestore → **Reglas**
2. Copiá el contenido completo de `firestore.rules`
3. Pegalo en el editor y hacé click en **Publicar**

**Opción B — Firebase CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 4. Autorizar el dominio de GitHub Pages

Firebase Console → Authentication → **Settings → Authorized domains**
→ Agregá: `tu-usuario.github.io`

> Sin este paso el login del organizador no funcionará desde GitHub Pages.

---

## 🚀 Despliegue en GitHub Pages

1. Creá un repositorio en GitHub (ej: `rubiks-sv-contest`)
2. Subí todos los archivos manteniendo la estructura de carpetas
3. En el repo: **Settings → Pages → Branch: main → Save**
4. En unos minutos estará disponible en:
   `https://tu-usuario.github.io/rubiks-sv-contest`

> ✅ No requiere servidor ni hosting de pago.
> La `apiKey` de Firebase en `firebase.js` es pública por diseño —
> la seguridad real la proveen las **reglas de Firestore**, no la apiKey.

---

## 🔒 Modelo de Seguridad

Las reglas de Firestore se validan en los servidores de Google. Aunque alguien
modifique el JavaScript en el navegador, las escrituras no autorizadas son
rechazadas del lado del servidor.

| Acción                          | Quién puede                         |
|---------------------------------|--------------------------------------|
| Leer configuración del contest  | Todos (pública)                      |
| Modificar configuración         | Solo el organizador (Firebase Auth)  |
| Enviar resultados               | Cualquiera (validado por estructura) |
| Leer resultados                 | Todos (pública)                      |
| Borrar resultados (reset)       | Solo el organizador                  |
| Leer lista de participantes     | Solo el organizador                  |
| Modificar resultados ajenos     | Nadie                                |

---

## 📋 Categorías Soportadas

| ID     | Nombre   |
|--------|----------|
| 2x2    | 2x2      |
| 3x3    | 3x3      |
| 4x4    | 4x4      |
| 5x5    | 5x5      |
| 6x6    | 6x6      |
| 7x7    | 7x7      |
| clock  | Clock    |
| mega   | Megaminx |
| pyra   | Pyraminx |
| skewb  | Skewb    |
| sq1    | Sq-1     |
| 3oh    | 3x3 OH   |
| 3bld   | 3x3 BLD  |

Para agregar o quitar categorías, editá el array `CATEGORIES` en `js/config.js`.

---

## 🛠️ Tecnologías

- **HTML5 / CSS3 / JavaScript** — sin frameworks, vanilla puro
- **Firebase Authentication** — login seguro del organizador
- **Cloud Firestore** — base de datos en tiempo real
- **cubing.net/twisty** — previsualización 2D del estado del cubo tras el scramble
- **Google Fonts** — tipografías Space Mono + Syne
- **GitHub Pages** — hosting gratuito

---

## 👤 Autor

Desarrollado por Henry Daniel Mixco Iraheta como proyecto de portafolio.
Comunidad Rubik's El Salvador 🇸🇻