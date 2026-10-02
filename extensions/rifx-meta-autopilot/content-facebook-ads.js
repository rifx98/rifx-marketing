// RIFX AI - Meta Ads Manager Injected Copilot & Ghost Cursor Autopilot
// Runs directly inside adsmanager.facebook.com

(function () {
  if (window.__RIFX_FACEBOOK_INJECTED__) return;
  window.__RIFX_FACEBOOK_INJECTED__ = true;

  console.log('🤖 RIFX Meta Ads Copilot activado en Facebook Ads Manager.');

  let campaignData = null;
  let isAutopilotRunning = false;
  let isPaused = false;
  let speedMultiplier = 1;
  const isBillingPage = window.location.href.includes('billing') ||
                        window.location.href.includes('account_settings') ||
                        window.location.href.includes('settings/ad-accounts') ||
                        window.location.href.includes('billing_hub');

  // Cargar datos de la campaña almacenada
  chrome.storage.local.get(['activeCampaign', 'autopilotPending'], (result) => {
    if (result.activeCampaign) {
      campaignData = result.activeCampaign;
      renderFloatingHUD();

      if (result.autopilotPending) {
        chrome.storage.local.set({ autopilotPending: false });
        setTimeout(() => {
          startGhostCursorAutopilot();
        }, 1500);
      }
    } else {
      // Mostrar HUD minimizado esperando campaña
      renderFloatingHUD();
    }
  });

  // Escuchar mensajes desde background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'RIFX_START_AUTOPILOT_NOW') {
      campaignData = message.payload;
      updateHUDData();
      startGhostCursorAutopilot();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER FLOATING HUD
  // ─────────────────────────────────────────────────────────────────────────────
  let hudContainer = null;

  function renderFloatingHUD() {
    if (hudContainer) return;

    hudContainer = document.createElement('div');
    hudContainer.id = 'rifx-meta-floating-hud';
    hudContainer.className = 'rifx-hud-container';

    hudContainer.innerHTML = `
      <div class="rifx-hud-header">
        <div class="rifx-hud-brand">
          <div class="rifx-hud-logo">⚡</div>
          <div>
            <div class="rifx-hud-title">RIFX AI Copilot</div>
            <div class="rifx-hud-subtitle">Piloto Automático Meta Ads</div>
          </div>
        </div>
        <div class="rifx-hud-header-actions">
          <button id="rifx-hud-minimize" class="rifx-btn-icon" title="Minimizar">−</button>
          <button id="rifx-hud-close" class="rifx-btn-icon" title="Cerrar">✕</button>
        </div>
      </div>

      <div id="rifx-hud-body" class="rifx-hud-body">
        <div class="rifx-hud-status-badge">
          <span class="rifx-status-dot"></span>
          <span id="rifx-hud-status-text">Conectado con RIFX CRM</span>
        </div>

        <div id="rifx-hud-campaign-details" class="rifx-hud-details">
          ${renderCampaignSummaryHTML()}
        </div>

        <div class="rifx-hud-action-panel">
          <button id="rifx-btn-start-autopilot" class="rifx-btn-primary">
            <span>🚀 Iniciar Piloto Automático</span>
          </button>

          <div class="rifx-hud-quick-actions">
            <button id="rifx-btn-paste-active" class="rifx-btn-secondary" title="Pega el copy AIDA en el campo de texto donde tengas el cursor">
              ✍️ Pegar Copy en Campo Activo
            </button>
            <button id="rifx-btn-copy-clipboard" class="rifx-btn-secondary">
              📋 Copiar Copy AIDA
            </button>
          </div>

          <div id="rifx-autopilot-controls" class="rifx-autopilot-controls" style="display: none;">
            <div class="rifx-hud-step-indicator">
              <span id="rifx-step-text">Paso 1: Iniciando...</span>
            </div>
            <div class="rifx-controls-row">
              <button id="rifx-btn-pause" class="rifx-btn-mini">⏸️ Pausar</button>
              <button id="rifx-btn-speed" class="rifx-btn-mini">⚡ 2x Velocidad</button>
              <button id="rifx-btn-stop" class="rifx-btn-mini rifx-btn-danger">🛑 Detener</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(hudContainer);
    setupHUDEvents();
  }

  function renderCampaignSummaryHTML() {
    if (!campaignData) {
      return `
        <div class="rifx-empty-state">
          <p>No hay campaña activa enviada desde tu CRM.</p>
          <p class="rifx-hint">Abre tu CRM en <a href="http://localhost:3000/panel?tab=campaigns" target="_blank">localhost:3000</a> y pulsa <b>"Abrir y Rellenar en Facebook"</b>.</p>
        </div>
      `;
    }

    const name = campaignData.productName || campaignData.businessName || 'Campaña RIFX Meta';
    const budget = campaignData.dailyBudget || campaignData.budget || 5;
    const duration = campaignData.durationDays || campaignData.duration_days || 30;
    const location = campaignData.address || campaignData.locationName || 'Local';
    const copyPreview = campaignData.description || campaignData.ad_copy_aida || 'Copy AIDA persuasivo generado con IA.';

    return `
      <div class="rifx-detail-row">
        <span class="rifx-label">📦 Campaña:</span>
        <span class="rifx-val">${escapeHtml(name)}</span>
      </div>
      <div class="rifx-detail-grid">
        <div class="rifx-detail-chip">💰 $${budget} USD / día</div>
        <div class="rifx-detail-chip">📅 ${duration} días</div>
        <div class="rifx-detail-chip">📍 ${escapeHtml(location)}</div>
      </div>
      <div class="rifx-copy-box">
        <div class="rifx-copy-header">✍️ Copy AIDA Persuasivo:</div>
        <div class="rifx-copy-content">${escapeHtml(copyPreview.substring(0, 160))}...</div>
      </div>
    `;
  }

  function updateHUDData() {
    const detailsContainer = document.getElementById('rifx-hud-campaign-details');
    if (detailsContainer) {
      detailsContainer.innerHTML = renderCampaignSummaryHTML();
    }
  }

  function setupHUDEvents() {
    const closeBtn = document.getElementById('rifx-hud-close');
    const minBtn = document.getElementById('rifx-hud-minimize');
    const body = document.getElementById('rifx-hud-body');
    const startBtn = document.getElementById('rifx-btn-start-autopilot');
    const pasteBtn = document.getElementById('rifx-btn-paste-active');
    const copyBtn = document.getElementById('rifx-btn-copy-clipboard');
    const pauseBtn = document.getElementById('rifx-btn-pause');
    const speedBtn = document.getElementById('rifx-btn-speed');
    const stopBtn = document.getElementById('rifx-btn-stop');

    closeBtn?.addEventListener('click', () => {
      hudContainer.style.display = 'none';
    });

    minBtn?.addEventListener('click', () => {
      const isCollapsed = body.style.display === 'none';
      body.style.display = isCollapsed ? 'block' : 'none';
      minBtn.textContent = isCollapsed ? '−' : '+';
    });

    startBtn?.addEventListener('click', () => {
      startGhostCursorAutopilot();
    });

    pasteBtn?.addEventListener('click', () => {
      pasteAIDACopyIntoActiveElement();
    });

    copyBtn?.addEventListener('click', () => {
      const copyText = campaignData?.description || campaignData?.ad_copy_aida || '';
      if (copyText) {
        navigator.clipboard.writeText(copyText).then(() => {
          showHUDToast('✅ ¡Copy AIDA copiado al portapapeles!');
        });
      }
    });

    pauseBtn?.addEventListener('click', () => {
      isPaused = !isPaused;
      pauseBtn.textContent = isPaused ? '▶️ Reanudar' : '⏸️ Pausar';
      showHUDToast(isPaused ? '⏸️ Piloto en pausa' : '▶️ Reanudando piloto...');
    });

    speedBtn?.addEventListener('click', () => {
      speedMultiplier = speedMultiplier === 1 ? 2.5 : 1;
      speedBtn.textContent = speedMultiplier === 1 ? '⚡ 2x Velocidad' : '⚡ 1x Normal';
      showHUDToast(`⚡ Velocidad: ${speedMultiplier}x`);
    });

    stopBtn?.addEventListener('click', () => {
      stopGhostCursorAutopilot('Detenido por el usuario');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GHOST CURSOR ENGINE
  // ─────────────────────────────────────────────────────────────────────────────
  let cursorEl = null;

  function ensureGhostCursor() {
    if (cursorEl) return cursorEl;

    cursorEl = document.createElement('div');
    cursorEl.id = 'rifx-ghost-cursor';
    cursorEl.className = 'rifx-ghost-cursor';
    cursorEl.innerHTML = `
      <div class="rifx-cursor-pointer">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" fill="#1877F2" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="rifx-cursor-bubble" id="rifx-cursor-bubble">🤖 RIFX AI Autopilot</div>
    `;

    document.body.appendChild(cursorEl);
    return cursorEl;
  }

  function setCursorPosition(x, y) {
    const c = ensureGhostCursor();
    c.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function setCursorBubbleText(text) {
    const bubble = document.getElementById('rifx-cursor-bubble');
    if (bubble) bubble.textContent = text;
    const stepText = document.getElementById('rifx-step-text');
    if (stepText) stepText.textContent = text;
  }

  function sleep(ms) {
    const adjustedMs = ms / speedMultiplier;
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (!isAutopilotRunning) {
          resolve();
          return;
        }
        if (!isPaused && Date.now() - start >= adjustedMs) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  async function moveCursorTo(targetX, targetY, durationMs = 600) {
    const c = ensureGhostCursor();
    const rect = c.getBoundingClientRect();
    const startX = rect.left;
    const startY = rect.top;
    const startTime = Date.now();
    const adjustedDuration = durationMs / speedMultiplier;

    return new Promise((resolve) => {
      const step = () => {
        if (!isAutopilotRunning) {
          resolve();
          return;
        }
        if (isPaused) {
          requestAnimationFrame(step);
          return;
        }
        const now = Date.now();
        const progress = Math.min(1, (now - startTime) / adjustedDuration);
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentX = startX + (targetX - startX) * ease;
        const currentY = startY + (targetY - startY) * ease;
        c.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  async function triggerGhostClick(x, y, element) {
    const ripple = document.createElement('div');
    ripple.className = 'rifx-click-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);

    if (element) {
      element.focus?.();
      element.click?.();
      // Dispatch real pointer and mouse events
      ['mousedown', 'mouseup', 'click'].forEach((evtType) => {
        const evt = new MouseEvent(evtType, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        });
        element.dispatchEvent(evt);
      });
    }

    await sleep(250);
  }

  async function typeIntoElement(element, text) {
    if (!element) return;
    element.focus();

    // Clear existing text if possible
    if (element.value !== undefined) {
      element.value = '';
    }

    for (let i = 0; i < text.length; i++) {
      if (!isAutopilotRunning) break;
      while (isPaused) await sleep(100);

      const char = text[i];
      if (element.value !== undefined) {
        element.value += char;
      } else if (element.isContentEditable) {
        element.innerText += char;
      }

      // Dispatch input events so React / Facebook state updates
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      await sleep(18);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTOPILOT ORCHESTRATION ON FACEBOOK ADS MANAGER
  // ─────────────────────────────────────────────────────────────────────────────
  async function startGhostCursorAutopilot() {
    if (!campaignData) {
      showHUDToast('⚠️ Selecciona o genera una campaña primero en el CRM.');
      return;
    }

    isAutopilotRunning = true;
    isPaused = false;
    document.getElementById('rifx-autopilot-controls').style.display = 'block';
    ensureGhostCursor();
    setCursorPosition(window.innerWidth / 2, window.innerHeight / 2);

    try {
      showHUDToast('🚀 Piloto Automático activado en Facebook Ads Manager');

      // ──────────────────────────────────────────
      // PASO 1: Encontrar y Clicar en Botón "+ Crear"
      // ──────────────────────────────────────────
      setCursorBubbleText('🔍 Buscando botón "+ Crear" en Ads Manager...');
      await sleep(600);

      // Meta suele usar aria-label="Crear", o texto "+ Crear" / "Create"
      const createButton = findElementBySelectors([
        '[data-testid="ad-creation-create-button"]',
        'button[aria-label*="Crear"]',
        'button[aria-label*="Create"]',
        'div[role="button"][aria-label*="Crear"]',
        'div[role="button"][aria-label*="Create"]',
        'button:has(span:contains("Crear"))',
      ]) || findElementByText('button, div[role="button"]', ['Crear', 'Create', '+ Crear', '+ Create']);

      if (createButton) {
        const rect = createButton.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        setCursorBubbleText('🖱️ Clicando en "+ Crear" campaña...');
        await moveCursorTo(targetX, targetY, 800);
        await triggerGhostClick(targetX, targetY, createButton);
        await sleep(1500);
      } else {
        setCursorBubbleText('ℹ️ Botón Crear no detectado, continuando con campos activos...');
        await sleep(800);
      }

      // ──────────────────────────────────────────
      // PASO 2: Selección de Objetivo de Campaña
      // ──────────────────────────────────────────
      setCursorBubbleText('🎯 Calibrando objetivo de campaña (Interacción / Ventas)...');
      await sleep(1000);

      const objectiveOption = findElementByText('div, span, label', ['Interacción', 'Engagement', 'Ventas', 'Sales', 'Clientes potenciales', 'Leads']);
      if (objectiveOption) {
        const rect = objectiveOption.getBoundingClientRect();
        if (rect.top > 0 && rect.top < window.innerHeight) {
          await moveCursorTo(rect.left + 20, rect.top + 10, 700);
          await triggerGhostClick(rect.left + 20, rect.top + 10, objectiveOption);
          await sleep(800);
        }
      }

      const continueBtn = findElementByText('button, div[role="button"]', ['Continuar', 'Continue', 'Siguiente', 'Next']);
      if (continueBtn) {
        const rect = continueBtn.getBoundingClientRect();
        if (rect.top > 0 && rect.top < window.innerHeight) {
          await moveCursorTo(rect.left + rect.width / 2, rect.top + rect.height / 2, 600);
          await triggerGhostClick(rect.left + rect.width / 2, rect.top + rect.height / 2, continueBtn);
          await sleep(1500);
        }
      }

      // ──────────────────────────────────────────
      // PASO 3: Rellenar Nombre de Campaña
      // ──────────────────────────────────────────
      setCursorBubbleText('✍️ Escribiendo nombre comercial de la campaña...');
      const nameInput = findElementBySelectors([
        'input[placeholder*="Nombre de la campaña"]',
        'input[placeholder*="Campaign name"]',
        'input[aria-label*="Nombre de la campaña"]',
        'input[aria-label*="Campaign name"]',
      ]) || document.querySelector('input[type="text"]');

      const campName = `[RIFX IA] ${campaignData.productName || campaignData.businessName || 'Campaña Meta Ads'}`;

      if (nameInput) {
        const rect = nameInput.getBoundingClientRect();
        await moveCursorTo(rect.left + 40, rect.top + 15, 700);
        await triggerGhostClick(rect.left + 40, rect.top + 15, nameInput);
        await typeIntoElement(nameInput, campName);
        await sleep(600);
      }

      // ──────────────────────────────────────────
      // PASO 4: Presupuesto Diario
      // ──────────────────────────────────────────
      setCursorBubbleText('💰 Calibrando presupuesto diario óptimo...');
      const budgetInput = findElementBySelectors([
        'input[aria-label*="Presupuesto"]',
        'input[aria-label*="Budget"]',
        'input[placeholder*="0.00"]',
      ]);

      const budgetVal = String(campaignData.dailyBudget || campaignData.budget || 5);

      if (budgetInput) {
        const rect = budgetInput.getBoundingClientRect();
        await moveCursorTo(rect.left + 30, rect.top + 15, 600);
        await triggerGhostClick(rect.left + 30, rect.top + 15, budgetInput);
        await typeIntoElement(budgetInput, budgetVal);
        await sleep(500);
      }

      // ──────────────────────────────────────────
      // PASO 5: Inserción de Copy AIDA Persuasivo
      // ──────────────────────────────────────────
      setCursorBubbleText('✍️ Inyectando texto principal con fórmula AIDA...');
      const copyTextarea = findElementBySelectors([
        'textarea[aria-label*="Texto principal"]',
        'textarea[aria-label*="Primary text"]',
        'div[contenteditable="true"][aria-label*="Texto principal"]',
        'textarea',
      ]);

      const aidaCopy = campaignData.description || campaignData.ad_copy_aida || '';

      if (copyTextarea && aidaCopy) {
        const rect = copyTextarea.getBoundingClientRect();
        await moveCursorTo(rect.left + 50, rect.top + 30, 800);
        await triggerGhostClick(rect.left + 50, rect.top + 30, copyTextarea);
        await typeIntoElement(copyTextarea, aidaCopy);
        await sleep(800);
      }

      // ──────────────────────────────────────────
      // CELEBRACIÓN Y FINALIZACIÓN
      // ──────────────────────────────────────────
      setCursorBubbleText('🎉 ¡Pauta configurada con éxito en Meta Ads Manager!');
      showCelebrationOverlay();

    } catch (err) {
      console.error('Error durante ejecución del piloto:', err);
      showHUDToast('⚠️ Se presentó una pausa en la navegación. Puedes pulsar "Pegar Copy" en cualquier momento.');
    } finally {
      setTimeout(() => {
        stopGhostCursorAutopilot();
      }, 5000);
    }
  }

  function stopGhostCursorAutopilot(reason = '') {
    isAutopilotRunning = false;
    const controls = document.getElementById('rifx-autopilot-controls');
    if (controls) controls.style.display = 'none';

    if (cursorEl) {
      cursorEl.style.opacity = '0';
      setTimeout(() => {
        cursorEl?.remove();
        cursorEl = null;
      }, 500);
    }

    if (reason) showHUDToast(reason);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITIES & SELECTORS
  // ─────────────────────────────────────────────────────────────────────────────
  function findElementBySelectors(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    return null;
  }

  function findElementByText(selector, textArray) {
    const elements = Array.from(document.querySelectorAll(selector));
    for (const el of elements) {
      if (!isVisible(el)) continue;
      const content = el.textContent || el.innerText || '';
      for (const t of textArray) {
        if (content.toLowerCase().includes(t.toLowerCase())) {
          return el;
        }
      }
    }
    return null;
  }

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function pasteAIDACopyIntoActiveElement() {
    const aidaCopy = campaignData?.description || campaignData?.ad_copy_aida || '';
    if (!aidaCopy) {
      showHUDToast('⚠️ No hay copy AIDA disponible para pegar.');
      return;
    }

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || activeEl.isContentEditable)) {
      if (activeEl.value !== undefined) {
        activeEl.value = aidaCopy;
      } else if (activeEl.isContentEditable) {
        activeEl.innerText = aidaCopy;
      }
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      activeEl.dispatchEvent(new Event('change', { bubbles: true }));
      showHUDToast('✍️ ¡Copy AIDA insertado en el campo seleccionado!');
    } else {
      navigator.clipboard.writeText(aidaCopy).then(() => {
        showHUDToast('📋 Haz clic en el campo donde quieres pegar el copy (¡Copiado a tu portapapeles!)');
      });
    }
  }

  function showHUDToast(message) {
    const toast = document.createElement('div');
    toast.className = 'rifx-hud-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('rifx-fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  function showCelebrationOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'rifx-celebration-overlay';
    overlay.innerHTML = `
      <div class="rifx-celebration-modal">
        <div class="rifx-celebration-badge">🚀 ¡Pauta Configurada!</div>
        <h3>La IA ha rellenado los datos en Facebook Ads Manager</h3>
        <p>Revisa tu anuncio en la pantalla, añade tus imágenes o creativos finales y pulsa <b>Publicar</b> en Meta cuando estés listo.</p>
        <button id="rifx-close-celebration" class="rifx-btn-primary">Entendido, continuar en Facebook</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('rifx-close-celebration')?.addEventListener('click', () => {
      overlay.remove();
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
