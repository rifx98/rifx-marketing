// RIFX AI - CRM Bridge Content Script
// Comunica el CRM web (localhost:3000 / app.rifx.com) con la extensión de Chrome

(function () {
  console.log('⚡ RIFX CRM Extension Bridge inicializado.');

  // Inyectar marca en la página
  function injectReadyBadge() {
    try {
      const script = document.createElement('script');
      script.textContent = `
        window.__RIFX_EXTENSION_INSTALLED__ = true;
        window.dispatchEvent(new CustomEvent('rifx:extension-ready', { detail: { version: '1.0.0' } }));
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      console.warn('Bridge badge warning:', e);
    }
  }

  injectReadyBadge();

  // Escuchar cuando el CRM quiera lanzar el piloto en Facebook
  window.addEventListener('rifx:start-meta-autopilot', (event) => {
    const campaignData = event.detail;
    console.log('🚀 CRM solicitó lanzamiento de Piloto Automático en Facebook:', campaignData);

    try {
      chrome.runtime.sendMessage({
        type: 'RIFX_LAUNCH_META_ADS',
        payload: campaignData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Error al comunicar con la extensión:', chrome.runtime.lastError);
        } else {
          console.log('Respuesta de la extensión:', response);
        }
      });
    } catch (err) {
      console.error('Error enviando mensaje a background:', err);
    }
  });

  // Escuchar cuando el CRM quiera configurar métodos de pago en Facebook
  window.addEventListener('rifx:start-meta-billing', (event) => {
    const businessData = event.detail;
    console.log('💳 CRM solicitó configuración de pagos en Facebook:', businessData);
    try {
      chrome.runtime.sendMessage({
        type: 'RIFX_LAUNCH_BILLING_SETUP',
        payload: businessData
      });
    } catch (err) {
      console.error('Error enviando mensaje de facturación:', err);
    }
  });

  // Escuchar también por window.postMessage
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'RIFX_START_META_AUTOPILOT_ACTION') {
      const campaignData = event.data.payload;
      chrome.runtime.sendMessage({
        type: 'RIFX_LAUNCH_META_ADS',
        payload: campaignData
      });
    }
    if (event.data && event.data.type === 'RIFX_START_META_BILLING_ACTION') {
      chrome.runtime.sendMessage({
        type: 'RIFX_LAUNCH_BILLING_SETUP',
        payload: event.data.payload
      });
    }
  });
})();
