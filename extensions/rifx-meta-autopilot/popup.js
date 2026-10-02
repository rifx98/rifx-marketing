document.addEventListener('DOMContentLoaded', () => {
  const campNameEl = document.getElementById('camp-name');
  const campDescEl = document.getElementById('camp-desc');
  const btnOpenMeta = document.getElementById('btn-open-meta');
  const btnOpenCrm = document.getElementById('btn-open-crm');

  chrome.storage.local.get(['activeCampaign'], (result) => {
    if (result.activeCampaign) {
      const camp = result.activeCampaign;
      campNameEl.textContent = camp.productName || camp.businessName || 'Campaña Meta Ads';
      campDescEl.textContent = `${camp.description?.substring(0, 100) || 'Copy AIDA'}... | $${camp.dailyBudget || 5}/día`;
    } else {
      campNameEl.textContent = 'Ninguna campaña sincronizada';
      campDescEl.textContent = 'Abre el panel de campañas en RIFX CRM y pulsa "Abrir y Rellenar en Facebook".';
    }
  });

  btnOpenMeta?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns' });
  });

  btnOpenCrm?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/panel?tab=campaigns' });
  });
});
