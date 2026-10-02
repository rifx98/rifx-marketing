// RIFX AI Meta Ads Autopilot - Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 RIFX AI Meta Ads Autopilot instalado con éxito.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RIFX_LAUNCH_META_ADS') {
    const campaignData = message.payload;
    console.log('📦 Campaña recibida desde RIFX CRM:', campaignData);

    // Guardar en almacenamiento local de la extensión
    chrome.storage.local.set({
      activeCampaign: campaignData,
      autopilotPending: true,
      timestamp: Date.now()
    }, () => {
      // Abrir o enfocar pestaña de Facebook Ads Manager
      const targetUrl = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';

      chrome.tabs.query({ url: '*://adsmanager.facebook.com/*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const tab = tabs[0];
          chrome.tabs.update(tab.id, { active: true }, () => {
            // Notificar a la pestaña existente
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {
                type: 'RIFX_START_AUTOPILOT_NOW',
                payload: campaignData
              }).catch(() => {});
            }, 1000);
          });
        } else {
          // Abrir nueva pestaña
          chrome.tabs.create({ url: targetUrl, active: true }, (newTab) => {
            console.log('🌐 Pestaña de Facebook Ads Manager abierta:', newTab.id);
          });
        }
      });

      sendResponse({ success: true, message: 'Facebook Ads Manager abierto' });
    });

    return true; // respuesta asíncrona
  }

  if (message.type === 'RIFX_LAUNCH_BILLING_SETUP') {
    const businessData = message.payload || {};
    console.log('💳 Solicitud de configuración de pagos en Facebook recibida:', businessData);

    chrome.storage.local.set({
      billingBusinessData: businessData,
      billingPending: true,
      timestamp: Date.now()
    }, () => {
      const billingUrl = 'https://adsmanager.facebook.com/ads/manager/account_settings/billing/';
      chrome.tabs.create({ url: billingUrl, active: true }, (newTab) => {
        console.log('💳 Pestaña de facturación de Meta abierta:', newTab.id);
      });
      sendResponse({ success: true, message: 'Pantalla de facturación de Meta abierta' });
    });
    return true;
  }

  if (message.type === 'RIFX_GET_STATUS') {
    chrome.storage.local.get(['activeCampaign', 'autopilotPending'], (data) => {
      sendResponse(data);
    });
    return true;
  }
});
