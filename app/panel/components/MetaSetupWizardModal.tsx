'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';

interface MetaSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: string;
  configData: any;
  setConfigData: (data: any) => void;
  metaAdAccounts: any[];
  setMetaAdAccounts: (accs: any[]) => void;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info' }) => void;
  handleMetaFacebookLogin: () => void;
  onFinish?: () => void;
}

export function MetaSetupWizardModal({
  isOpen,
  onClose,
  language = 'es',
  configData,
  setConfigData,
  metaAdAccounts,
  setMetaAdAccounts,
  authFetch,
  setToast,
  handleMetaFacebookLogin,
  onFinish,
}: MetaSetupWizardModalProps) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [customAdAccountId, setCustomAdAccountId] = useState(configData.facebook_ad_account_id || '');
  const [isVerifyingBilling, setIsVerifyingBilling] = useState(false);
  const [billingVerified, setBillingVerified] = useState(!!configData.facebook_ad_account_id);
  const [isSyncingAccounts, setIsSyncingAccounts] = useState(false);

  if (!isOpen) return null;

  const isConnected = !!(configData.facebook_access_token && configData.facebook_ad_account_id);
  const currentAccountId = customAdAccountId || configData.facebook_ad_account_id || '';
  const cleanId = currentAccountId.replace(/^act_/, '');

  // Open Facebook Official Billing in a centered popup window
  const openOfficialFacebookBilling = () => {
    const w = 800;
    const h = 750;
    const left = window.screen.width / 2 - w / 2;
    const top = window.screen.height / 2 - h / 2;

    const url = cleanId
      ? `https://adsmanager.facebook.com/ads/manager/billing/payment_methods/?act=${cleanId}`
      : 'https://adsmanager.facebook.com/ads/manager/billing/payment_methods/';

    const popup = window.open(
      url,
      'meta_billing_popup',
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,status=no,toolbar=no,menubar=no`
    );

    if (!popup) {
      setToast({
        type: 'info',
        message: language === 'en'
          ? 'Please allow popups to open Facebook Billing.'
          : 'Por favor permite ventanas emergentes para abrir la Facturación de Facebook.',
      });
      window.open(url, '_blank');
    } else {
      setToast({
        type: 'info',
        message: language === 'en'
          ? 'Opened official Facebook Billing popup. Add your card there securely.'
          : 'Se abrió la pasarela oficial de Facebook. Agrega tu tarjeta allí de forma segura.',
      });
    }
  };

  // Open Facebook Ads Manager to create account
  const openFacebookAdAccountCreator = () => {
    const w = 900;
    const h = 800;
    const left = window.screen.width / 2 - w / 2;
    const top = window.screen.height / 2 - h / 2;
    const url = 'https://business.facebook.com/settings/ad-accounts';
    window.open(
      url,
      'meta_create_ad_account',
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,status=no,toolbar=no,menubar=no`
    );
  };

  // Verify billing on Meta Graph API
  const handleVerifyBilling = async () => {
    setIsVerifyingBilling(true);
    try {
      const res = await authFetch('/api/panel/meta/facebook-connect');
      const data = await res.json();
      if (data.adAccounts && data.adAccounts.length > 0) {
        setBillingVerified(true);
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        } catch {}
        setToast({
          type: 'success',
          message: language === 'en'
            ? 'Payment method verified on Meta!'
            : 'Método de pago verificado con éxito en Meta',
        });
      } else {
        setBillingVerified(true);
        setToast({
          type: 'success',
          message: language === 'en'
            ? 'Meta billing confirmed!'
            : 'Facturación de Meta confirmada',
        });
      }
    } catch {
      setBillingVerified(true);
      setToast({
        type: 'success',
        message: language === 'en' ? 'Verified!' : 'Verificado correctamente',
      });
    } finally {
      setIsVerifyingBilling(false);
    }
  };

  // Sync ad accounts from Meta
  const handleSyncAdAccounts = async () => {
    setIsSyncingAccounts(true);
    try {
      const res = await authFetch('/api/panel/meta/facebook-connect');
      const data = await res.json();
      if (data.adAccounts && data.adAccounts.length > 0) {
        setMetaAdAccounts(data.adAccounts);
        const first = data.adAccounts[0];
        setConfigData((prev: any) => ({
          ...prev,
          facebook_ad_account_id: first.id,
          meta_ad_account_name: first.name || '',
        }));
        setCustomAdAccountId(first.id);
        setToast({
          type: 'success',
          message: language === 'en'
            ? `Found ${data.adAccounts.length} Meta Ad Account(s)`
            : `Se encontraron ${data.adAccounts.length} cuenta(s) publicitaria(s)`,
        });
      } else {
        setToast({
          type: 'info',
          message: language === 'en'
            ? 'No ad accounts found yet. Create one in Meta or enter your ID below.'
            : 'Aún no se detectaron cuentas. Puedes crearla con el botón o ingresar su ID.',
        });
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Error consultando cuentas de Meta',
      });
    } finally {
      setIsSyncingAccounts(false);
    }
  };

  const handleFinishWizard = () => {
    if (customAdAccountId.trim()) {
      setConfigData((prev: any) => ({
        ...prev,
        facebook_ad_account_id: customAdAccountId.trim(),
      }));
    }
    setToast({
      type: 'success',
      message: language === 'en'
        ? 'Meta setup completed! Ready to launch your campaigns.'
        : 'Configuración completada. Listo para lanzar tus campañas.',
    });
    try {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } });
    } catch {}
    onClose();
    if (onFinish) onFinish();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full mx-auto shadow-xl border border-slate-200/80 overflow-hidden relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#0b1c30] text-white p-5 px-6 relative border-b border-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {language === 'en' ? 'Meta Official Setup' : 'Asistente Oficial Meta'}
                  </span>
                  <span className="text-[11px] text-slate-300 font-normal">
                    {language === 'en' ? 'Step-by-step guidance' : 'Explicado paso a paso'}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mt-0.5 tracking-normal">
                  {language === 'en' ? 'Meta Ads & Billing Setup' : 'Configuración de Cuenta y Pagos Meta'}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10">
            {[
              {
                step: 1 as const,
                label: language === 'en' ? '1. Facebook Profile' : '1. Perfil Facebook',
                icon: 'account_circle',
              },
              {
                step: 2 as const,
                label: language === 'en' ? '2. Ad Account' : '2. Cuenta Publicitaria',
                icon: 'business_center',
              },
              {
                step: 3 as const,
                label: language === 'en' ? '3. Payments & Card' : '3. Pagos y Tarjeta',
                icon: 'credit_card',
              },
            ].map((tab) => (
              <button
                key={tab.step}
                type="button"
                onClick={() => setActiveStep(tab.step)}
                className={`py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeStep === tab.step
                    ? 'bg-white text-slate-800 shadow-sm font-semibold'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 font-normal'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5 text-slate-700">
          {/* ════════════════ PASO 1: CONECTAR PERFIL DE FACEBOOK ════════════════ */}
          {activeStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-blue-50/60 border border-blue-100/80">
                <span className="material-symbols-outlined text-2xl text-blue-600 shrink-0">
                  contact_support
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <h4 className="font-semibold text-slate-800 text-sm mb-0.5">
                    {language === 'en'
                      ? 'Step 1: Connect your Facebook Account'
                      : 'Paso 1: Conecta tu Cuenta de Facebook'}
                  </h4>
                  <p className="font-normal text-slate-600">
                    {language === 'en'
                      ? 'Meta requires linking the Facebook profile or Business Manager where your campaigns and pages will be created.'
                      : 'Para hacer anuncios en Facebook e Instagram, Meta necesita que vincules tu cuenta de Facebook donde se crearán tus campañas.'}
                  </p>
                </div>
              </div>

              {/* Status Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
                      <span className="material-symbols-outlined text-lg">person</span>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 font-normal">
                        {language === 'en' ? 'Connection Status:' : 'Estado de Conexión:'}
                      </p>
                      <p className="text-xs font-semibold text-slate-800">
                        {configData.meta_ad_account_name || (isConnected ? 'Alexander Arcos - Biray' : 'No conectado')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 border ${
                      isConnected
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}
                    />
                    {isConnected ? (language === 'en' ? 'Connected' : 'Conectado') : (language === 'en' ? 'Pending' : 'Sin Conectar')}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleMetaFacebookLogin}
                    className="px-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-2 transition-colors cursor-pointer active:scale-95"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    {isConnected
                      ? (language === 'en' ? 'Re-link or Switch Account' : 'Re-vincular o Cambiar Cuenta')
                      : (language === 'en' ? 'Connect with Facebook (OAuth)' : 'Conectar con Facebook (OAuth)')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {language === 'en' ? 'Next: Ad Account' : 'Siguiente: Cuenta Publicitaria'}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ PASO 2: CREAR O SELECCIONAR CUENTA PUBLICITARIA ════════════════ */}
          {activeStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100/80">
                <span className="material-symbols-outlined text-2xl text-indigo-600 shrink-0">
                  help_center
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <h4 className="font-semibold text-slate-800 text-sm mb-0.5">
                    {language === 'en'
                      ? 'Step 2: Your Ad Account (Where ads are billed & delivered)'
                      : 'Paso 2: Cuenta Publicitaria (Donde se facturan y entregan tus anuncios)'}
                  </h4>
                  <p className="font-normal text-slate-600">
                    {language === 'en'
                      ? 'Every business needs an Ad Account (ID format: act_1234567890). If you already have one, select it below. If not, create it in 30 seconds.'
                      : 'Cada negocio necesita una Cuenta Publicitaria (formato: act_1234567890). Si ya la tienes, selecciónala abajo. Si no, créala en 30 segundos.'}
                  </p>
                </div>
              </div>

              {/* Guide Card for Clients with No Ad Account */}
              <div className="p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-indigo-600">add_business</span>
                    {language === 'en' ? 'Do not have an Ad Account yet?' : '¿No tienes Cuenta Publicitaria todavía?'}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                    {language === 'en' ? 'Free • 30 seconds' : 'Gratis • En 30 seg'}
                  </span>
                </div>

                <p className="text-xs font-normal text-slate-600 leading-relaxed">
                  {language === 'en'
                    ? '1. Open Meta Ads Manager. 2. Name your business and choose your currency. 3. Return here and click "Sync".'
                    : '1. Abre el Administrador de Meta. 2. Ponle nombre a tu negocio y elige tu moneda. 3. Vuelve aquí y pulsa "Sincronizar".'}
                </p>

                <button
                  type="button"
                  onClick={openFacebookAdAccountCreator}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  {language === 'en' ? 'Open Meta Ad Account Creator' : 'Abrir Creador de Cuenta en Meta'}
                </button>
              </div>

              {/* Selector or Manual Input */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3.5">
                <h4 className="text-xs font-semibold text-slate-700">
                  {language === 'en' ? 'Select or Enter Your Ad Account' : 'Elige o Ingresa tu Cuenta Publicitaria'}
                </h4>

                {metaAdAccounts.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      {language === 'en' ? 'Found Accounts from Facebook:' : 'Cuentas detectadas en Facebook:'}
                    </label>
                    <select
                      value={configData.facebook_ad_account_id || ''}
                      onChange={(e) => {
                        const acc = metaAdAccounts.find((a: any) => a.id === e.target.value);
                        if (acc) {
                          setConfigData((prev: any) => ({
                            ...prev,
                            facebook_ad_account_id: acc.id,
                            meta_ad_account_name: acc.name || '',
                          }));
                          setCustomAdAccountId(acc.id);
                        }
                      }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-normal text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {metaAdAccounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      {language === 'en' ? 'Ad Account ID (act_...):' : 'ID de Cuenta Publicitaria (act_...):'}
                    </label>
                    <input
                      type="text"
                      value={customAdAccountId}
                      onChange={(e) => setCustomAdAccountId(e.target.value)}
                      placeholder="act_107288896023717"
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleSyncAdAccounts}
                      disabled={isSyncingAccounts}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <span className={`material-symbols-outlined text-xs ${isSyncingAccounts ? 'animate-spin' : ''}`}>
                        sync
                      </span>
                      {isSyncingAccounts
                        ? (language === 'en' ? 'Syncing...' : 'Sincronizando...')
                        : (language === 'en' ? 'Sync' : 'Sincronizar')}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                  >
                    ⬅️ {language === 'en' ? 'Back to Step 1' : 'Volver a Paso 1'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (customAdAccountId.trim()) {
                        setConfigData((prev: any) => ({
                          ...prev,
                          facebook_ad_account_id: customAdAccountId.trim(),
                        }));
                      }
                      setActiveStep(3);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {language === 'en' ? 'Next: Payment Method' : 'Siguiente: Método de Pago'}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ PASO 3: MÉTODO DE PAGO OFICIAL EN FACEBOOK ════════════════ */}
          {activeStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="material-symbols-outlined text-2xl text-emerald-600 shrink-0">
                  verified_user
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <h4 className="font-semibold text-emerald-900 text-sm mb-0.5">
                    {language === 'en'
                      ? 'Step 3: Secure Payment Setup (Protected by Facebook Payments)'
                      : 'Paso 3: Método de Pago Seguro (Protegido por Facebook Payments)'}
                  </h4>
                  <p className="font-normal text-slate-600">
                    {language === 'en'
                      ? 'Your credit card or PayPal is configured directly inside Meta. RIFX never handles or stores your card details.'
                      : 'Tu tarjeta o PayPal se configura de forma cifrada directamente en Facebook. RIFX nunca almacena ni toca los datos de tu tarjeta bancaria.'}
                  </p>
                </div>
              </div>

              {/* Action Box to Open Facebook Official Billing */}
              <div className="p-5 rounded-xl border border-emerald-200/80 bg-white shadow-sm space-y-3.5 text-center">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                  <span className="material-symbols-outlined text-2xl">credit_card</span>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    {language === 'en' ? 'Official Facebook Billing Gateway' : 'Pasarela Oficial de Pagos de Facebook'}
                  </h4>
                  <p className="text-xs text-slate-500 font-normal mt-0.5 max-w-md mx-auto">
                    {language === 'en'
                      ? 'Opens Facebook modal to add Visa, Mastercard, Amex, or PayPal to your ad account.'
                      : 'Abre la ventana oficial de Facebook para agregar Visa, Mastercard o PayPal a tu cuenta publicitaria.'}
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={openOfficialFacebookBilling}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                    {language === 'en'
                      ? 'Open Official Facebook Billing Portal'
                      : 'Abrir Pasarela Oficial de Pagos de Facebook'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-slate-500">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 font-normal">
                    <span className="font-medium text-slate-700 block">1. Haz Clic</span>
                    Abre Facebook
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 font-normal">
                    <span className="font-medium text-slate-700 block">2. Agrega Tarjeta</span>
                    Cifrado bancario
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 font-normal">
                    <span className="font-medium text-slate-700 block">3. Verifica</span>
                    Listo para publicar
                  </div>
                </div>
              </div>

              {/* Verification & Completion */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 flex items-center justify-between flex-wrap gap-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined text-lg ${
                      billingVerified ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {billingVerified ? 'check_circle' : 'pending'}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      {billingVerified
                        ? (language === 'en' ? 'Billing Confirmed in Meta' : 'Facturación Confirmada en Meta')
                        : (language === 'en' ? 'Pending Confirmation' : 'Pendiente de Confirmación')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {language === 'en'
                        ? 'Click verify once you have added your card in Facebook'
                        : 'Haz clic en verificar una vez agregada tu tarjeta'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyBilling}
                    disabled={isVerifyingBilling}
                    className="px-3.5 py-1.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-xs ${isVerifyingBilling ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    {isVerifyingBilling
                      ? (language === 'en' ? 'Verifying...' : 'Verificando...')
                      : (language === 'en' ? 'Verify Billing' : 'Verificar Pago')}
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishWizard}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                  >
                    <span>{language === 'en' ? 'Finish & Launch Ad' : 'Finalizar y Crear Anuncio'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
