# 📱 Guía Capacitor — Bienestar Universitario

Convierte la app web en una app nativa iOS y Android **sin reescribir nada**.

---

## Requisitos previos

| Herramienta | Para qué | Descarga |
|---|---|---|
| Node.js 18+ | Base | nodejs.org |
| Xcode 14+ | Build iOS | Mac App Store |
| Android Studio | Build Android | developer.android.com |
| CocoaPods | Dependencias iOS | `sudo gem install cocoapods` |

> **iOS requiere Mac.** Android puedes hacerlo en cualquier sistema.

---

## 1. Instalar dependencias de Capacitor

En la carpeta raíz del proyecto (donde está `server.js`):

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/camera @capacitor/push-notifications
npm install @capacitor/haptics @capacitor/splash-screen
npm install @capacitor/status-bar @capacitor/keyboard @capacitor/network
```

---

## 2. Inicializar Capacitor

```bash
npx cap init "Bienestar Universitario" "mx.universidad.bienestar" --web-dir public
```

Esto crea `capacitor.config.json` (ya incluido en los archivos entregados).

---

## 3. Agregar plataformas

```bash
npx cap add ios
npx cap add android
```

Esto genera las carpetas `ios/` y `android/` con los proyectos nativos.

---

## 4. Configurar la IP del servidor

Edita `public/capacitor-native.js`, línea 20:

```js
// ANTES
const SERVER_URL = IS_CAPACITOR ? 'http://TU_IP_LOCAL:3000' : '';

// DESPUÉS (ejemplo)
const SERVER_URL = IS_CAPACITOR ? 'http://192.168.1.45:3000' : '';
//                                        ↑ tu IP local en desarrollo
//                                   O tu dominio en producción:
// const SERVER_URL = IS_CAPACITOR ? 'https://bienestar.tuUniversidad.mx' : '';
```

Para conocer tu IP local:
```bash
# macOS / Linux
ipconfig getifaddr en0

# Windows
ipconfig
```

> ⚠️ El teléfono y la computadora deben estar en la **misma red WiFi** durante desarrollo.

---

## 5. Configurar CORS en el servidor

En `server.js`, permite el origen de la app nativa:

```js
// Buscar esta línea y actualizar:
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  // En producción cambiar '*' por tu dominio exacto
}));
```

---

## 6. Copiar archivos web al proyecto nativo

Cada vez que cambies el frontend:

```bash
npx cap sync
```

Este comando:
1. Copia `public/` → proyecto iOS/Android
2. Actualiza los plugins de Capacitor
3. Instala los pods de iOS automáticamente

---

## 7. Ejecutar en dispositivo / emulador

### Android
```bash
# Abrir Android Studio (puedes correrlo directo desde ahí)
npx cap open android

# O correr directo si tienes un dispositivo conectado:
npx cap run android
```

### iOS
```bash
# Abrir Xcode
npx cap open ios

# Seleccionar tu dispositivo o simulador en Xcode y presionar ▶
```

---

## 8. Crear iconos y splash screen

Pon una imagen cuadrada de 1024×1024px en `resources/icon.png` y corre:

```bash
npm install -g @capacitor/assets
npx capacitor-assets generate
```

Genera automáticamente todos los tamaños para iOS y Android.

---

## 9. Build para producción (App Store / Play Store)

### Android — APK / AAB
```bash
# En Android Studio → Build → Generate Signed Bundle/APK
# O desde terminal:
cd android && ./gradlew assembleRelease
```

### iOS — Archive para App Store
```bash
# En Xcode → Product → Archive
# Luego distribuir desde Xcode Organizer
```

---

## Estructura final del proyecto

```
bienestar-universitario/
├── server.js                   ← Backend Node.js (no cambia)
├── routes/                     ← Rutas Express (no cambia)
├── config/                     ← BD config (no cambia)
├── capacitor.config.json       ← ← NUEVO
├── manifest.json               ← ← NUEVO (dentro de public/)
├── public/
│   ├── index.html              ← Frontend (actualizado)
│   ├── capacitor-native.js     ← ← NUEVO — bridge nativo
│   ├── mobile-overrides.css    ← ← NUEVO — estilos móvil
│   ├── manifest.json           ← ← NUEVO
│   ├── capacitor.js            ← generado por npx cap sync
│   └── icons/                  ← ← NUEVO (generar con cap assets)
├── ios/                        ← generado por npx cap add ios
└── android/                    ← generado por npx cap add android
```

---

## Features nativas ya integradas

| Feature | iOS | Android |
|---|---|---|
| Cámara + galería nativa | ✅ | ✅ |
| Safe area (notch, home indicator) | ✅ | ✅ |
| Swipe para pasar páginas | ✅ | ✅ |
| Vibración (haptics) al guardar | ✅ | ✅ |
| Push notifications | ✅ | ✅ |
| Botón back de Android | — | ✅ |
| Status bar personalizada | ✅ | ✅ |
| Splash screen | ✅ | ✅ |
| Detección de red (offline) | ✅ | ✅ |

---

## Comandos de referencia rápida

```bash
npx cap sync          # Después de cada cambio en public/
npx cap open ios      # Abrir Xcode
npx cap open android  # Abrir Android Studio
npx cap run android   # Correr en dispositivo Android directo
npx cap doctor        # Diagnóstico del entorno
```
