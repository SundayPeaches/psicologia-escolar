/**
 * capacitor-native.js
 * Puente entre la app web y las APIs nativas de Capacitor.
 * Incluir ANTES del script principal en index.html cuando se corra en móvil.
 *
 * Detecta automáticamente si corre en Capacitor o en web browser.
 */

// ── Detectar entorno ────────────────────────────────────────
// En Capacitor 5+, el bridge nativo se inyecta ANTES de que corra este script.
// No crear stub aquí — ya está manejado en index.html.
const IS_CAPACITOR = !!(window.Capacitor?.isNativePlatform?.());
const IS_ANDROID   = IS_CAPACITOR && Capacitor.getPlatform() === 'android';
const IS_IOS       = IS_CAPACITOR && Capacitor.getPlatform() === 'ios';

// ── URL del servidor (CAMBIAR por tu IP/dominio real) ───────
// En desarrollo: usa la IP local de tu máquina, ej: 'http://192.168.1.100:3000'
// En producción: usa el dominio real, ej: 'https://bienestar.miUniversidad.mx'
// Debe decir exactamente esto para el emulador:
const SERVER_URL = IS_CAPACITOR ? 'http://10.0.2.2:3000' : '';

// Sobrescribir la constante API del app principal
// (este script se carga ANTES que el código principal)
window.__CAPACITOR_SERVER__ = SERVER_URL;

console.log(`[Bienestar] Plataforma: ${IS_CAPACITOR ? Capacitor.getPlatform() : 'web'}`);
console.log(`[Bienestar] API base: ${SERVER_URL || '(relativa)'}`);

// ── Cámara nativa ───────────────────────────────────────────
async function nativeCamera() {
  if (!IS_CAPACITOR) {
    // Fallback a input file en web
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = e => resolve(Array.from(e.target.files));
      input.onerror  = reject;
      input.click();
    });
  }

  try {
    const { Camera, CameraResultType, CameraSource } = Capacitor.Plugins;

    // Pedir foto o elegir de galería
    const image = await Camera.getPhoto({
      quality:      90,
      allowEditing: false,
      resultType:   CameraResultType.DataUrl,
      source:       CameraSource.Prompt,   // muestra: Cámara | Galería
      promptLabelHeader:  'Agregar foto',
      promptLabelCancel:  'Cancelar',
      promptLabelPhoto:   'Desde galería',
      promptLabelPicture: 'Tomar foto',
    });

    // Devuelve formato compatible con el collage
    return [{ dataUrl: image.dataUrl, name: 'foto.jpg', size: 0 }];
  } catch (e) {
    if (e.message !== 'User cancelled photos app') console.error('Camera error:', e);
    return [];
  }
}

// ── Haptics (vibración) ─────────────────────────────────────
async function nativeHaptic(style = 'light') {
  if (!IS_CAPACITOR) return;
  try {
    const { Haptics, ImpactStyle } = Capacitor.Plugins;
    const styleMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: styleMap[style] || ImpactStyle.Light });
  } catch(e) {}
}

// ── Push Notifications ──────────────────────────────────────
async function initPushNotifications() {
  if (!IS_CAPACITOR) return;
  try {
    const { PushNotifications } = Capacitor.Plugins;

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', token => {
      console.log('[Push] Token:', token.value);
      // Enviar token al backend para guardar
      fetch(SERVER_URL + '/api/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() })
      }).catch(() => {});
    });

    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('[Push] Recibida:', notification);
      // Mostrar en la UI si la app está abierta
      if (window.showAlert) showAlert('main-alert', `📬 ${notification.title}: ${notification.body}`, 'info');
    });

    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      console.log('[Push] Acción:', action);
      // Navegar a la sección relevante
      const data = action.notification.data;
      if (data?.section && window.showSection) showSection(data.section);
    });

  } catch(e) { console.error('[Push]', e); }
}

// ── Network status ──────────────────────────────────────────
async function initNetworkListener() {
  if (!IS_CAPACITOR) return;
  try {
    const { Network } = Capacitor.Plugins;
    const status = await Network.getStatus();
    window.__ONLINE__ = status.connected;

    Network.addListener('networkStatusChange', s => {
      window.__ONLINE__ = s.connected;
      const msg = s.connected ? '✓ Conexión restaurada' : '⚠ Sin conexión — los cambios se guardarán al reconectar';
      if (window.showAlert) showAlert('main-alert', msg, s.connected ? 'success' : 'info');
    });
  } catch(e) {}
}

// ── StatusBar y SafeArea ────────────────────────────────────
async function initStatusBar() {
  if (!IS_CAPACITOR) return;
  try {
    const { StatusBar, Style } = Capacitor.Plugins;
    await StatusBar.setStyle({ style: Style.Light });
    if (IS_ANDROID) await StatusBar.setBackgroundColor({ color: '#ffffff' });
  } catch(e) {}
}

// ── SplashScreen ────────────────────────────────────────────
async function hideSplash() {
  if (!IS_CAPACITOR) return;
  try {
    await Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 400 });
  } catch(e) {}
}

// ── Back button (Android) ───────────────────────────────────
function initBackButton() {
  if (!IS_ANDROID) return;
  document.addEventListener('ionBackButton', e => {
    e.detail.register(10, () => {
      // Si hay un modal abierto, cerrarlo
      const modal = document.querySelector('.modal.open');
      if (modal) { closeModal(modal.id); return; }
      // Si estamos en el diario, volver a la estantería
      if (window._openNbId) { loadDiario(); return; }
      // De lo contrario, volver a inicio
      if (window.showSection) showSection('inicio');
    });
  });
}

// ── Inicialización ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initStatusBar();
  initBackButton();
  await initNetworkListener();
  // Push se init después del login para tener el token JWT
  window.__initPush__ = initPushNotifications;
  // Ocultar splash cuando la app esté lista
  setTimeout(hideSplash, 500);
});

// Exportar para uso desde el código principal
window.nativeCamera     = nativeCamera;
window.nativeHaptic     = nativeHaptic;
window.IS_CAPACITOR     = IS_CAPACITOR;