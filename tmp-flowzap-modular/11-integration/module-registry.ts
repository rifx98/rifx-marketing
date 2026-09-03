/**
 * Metadata únicamente. NO crea un sidebar nuevo.
 * Claude debe mapear cada módulo a los tabs/rutas YA existentes del CRM.
 */
export const FLOWZAP_UI_MODULES = [
  { key: 'dashboard', label: 'Dashboard', folder: '01-dashboard', preference: 'extend-existing' },
  { key: 'conversations', label: 'Conversaciones', folder: '02-conversations', preference: 'replace-ui-not-route' },
  { key: 'contacts', label: 'Contactos', folder: '03-contacts', preference: 'extend-existing' },
  { key: 'team', label: 'Equipo', folder: '04-team', preference: 'new-subsection-if-missing' },
  { key: 'builder', label: 'Constructor', folder: '05-builder', preference: 'wrap-existing-reactflow' },
  { key: 'ai', label: 'FlowZap AI', folder: '06-ai-premium', preference: 'new-premium-section' },
  { key: 'versions', label: 'Versiones', folder: '07-versions', preference: 'new-subsection' },
  { key: 'whatsapp', label: 'WhatsApp', folder: '08-whatsapp-settings', preference: 'extend-existing-settings' },
  { key: 'wa_campaigns', label: 'Campañas WhatsApp', folder: '09-campaigns', preference: 'separate-from-meta-ads' },
  { key: 'billing', label: 'Facturación', folder: '10-billing', preference: 'extend-existing' },
] as const;
