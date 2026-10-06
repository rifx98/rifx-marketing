import sanitizeHtml from 'sanitize-html';

export type OutreachDraft = {
  business: string;
  email: string;
  observation: string;
  proposal: string;
  subject: string;
  price?: string;
  service_title?: string;
  deliverables?: string;
  deliverables_note?: string;
  image_url?: string;
  template_html?: string | null;
  include_whatsapp?: boolean;
  whatsapp_phone?: string;
};

export const DEFAULT_TEMPLATE_ID = 'default';

export const SAMPLE_OUTREACH: OutreachDraft = {
  business: 'Muebles Universal',
  email: '',
  observation: 'Vi que ofrecen salas personalizadas y retapizado en sus publicaciones.',
  proposal: 'Les propongo una campaña orientada a salas personalizadas: destacar acabados de alta calidad y canalizar las consultas hacia su WhatsApp para cotizar medidas y colores específicos. Así filtramos prospectos calificados listos para ordenar.',
  subject: 'Una idea para las cotizaciones de Muebles Universal',
  price: 'USD 300',
  service_title: 'Gestión de anuncios publicitarios',
  deliverables: '12 piezas gráficas • 3 videos editables',
  deliverables_note: 'La inversión en anuncios se paga por separado.',
  image_url: '',
  template_html: null,
  include_whatsapp: true,
  whatsapp_phone: '+593 98 391 0712',
};

export function validOutreachEmail(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(value)
  );
}

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]!));
}

export function extractOutreachMeta(rawTemplateHtml: string | null | undefined): {
  template_html: string | null;
  meta: Partial<Pick<OutreachDraft, 'price' | 'service_title' | 'deliverables' | 'deliverables_note' | 'image_url' | 'include_whatsapp' | 'whatsapp_phone'>>;
} {
  if (!rawTemplateHtml) return { template_html: null, meta: {} };

  if (rawTemplateHtml.startsWith('meta:')) {
    try {
      const parsed = JSON.parse(rawTemplateHtml.slice(5));
      return { template_html: null, meta: parsed && typeof parsed === 'object' ? parsed : {} };
    } catch {
      return { template_html: null, meta: {} };
    }
  }

  const match = rawTemplateHtml.match(/^<!-- rifx-meta:([\s\S]+?) -->/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      const cleanHtml = rawTemplateHtml.replace(/^<!-- rifx-meta:[\s\S]+? -->/, '');
      return { template_html: cleanHtml || null, meta: parsed && typeof parsed === 'object' ? parsed : {} };
    } catch {
      return { template_html: rawTemplateHtml, meta: {} };
    }
  }

  return { template_html: rawTemplateHtml, meta: {} };
}

export function packOutreachMeta(
  templateHtml: string | null | undefined,
  meta: Partial<Pick<OutreachDraft, 'price' | 'service_title' | 'deliverables' | 'deliverables_note' | 'image_url' | 'include_whatsapp' | 'whatsapp_phone'>>
): string | null {
  let safeImageUrl = meta.image_url;
  if (safeImageUrl && safeImageUrl.startsWith('data:') && safeImageUrl.length > 45_000) {
    safeImageUrl = undefined;
  }

  const hasMeta = Boolean(
    meta.price ||
    meta.service_title ||
    meta.deliverables ||
    meta.deliverables_note ||
    safeImageUrl ||
    meta.include_whatsapp !== undefined ||
    meta.whatsapp_phone
  );

  if (!hasMeta) return templateHtml || null;

  const json = JSON.stringify({
    price: meta.price || undefined,
    service_title: meta.service_title || undefined,
    deliverables: meta.deliverables || undefined,
    deliverables_note: meta.deliverables_note || undefined,
    image_url: safeImageUrl || undefined,
    include_whatsapp: typeof meta.include_whatsapp === 'boolean' ? meta.include_whatsapp : undefined,
    whatsapp_phone: meta.whatsapp_phone || undefined,
  });

  if (!templateHtml) {
    return `meta:${json}`;
  }

  return `<!-- rifx-meta:${json} -->${templateHtml}`;
}

export function prepareOutreachTemplate(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 64_000 ||
    value.startsWith('meta:')
  ) {
    return null;
  }

  const { template_html: rawHtml } = extractOutreachMeta(value);
  if (!rawHtml || !rawHtml.includes('{{negocio}}') || !rawHtml.includes('{{propuesta}}')) {
    return null;
  }

  const color = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i;
  const length = /^(\d{1,4}(\.\d{1,2})?(px|%|em)?|auto)$/i;

  const html = sanitizeHtml(rawHtml, {
    allowedTags: [
      'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th',
      'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4',
      'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'img'
    ],
    allowedAttributes: {
      '*': ['style', 'align'],
      table: ['width', 'cellpadding', 'cellspacing', 'border', 'role', 'bgcolor', 'align'],
      td: ['width', 'height', 'colspan', 'rowspan', 'bgcolor', 'valign', 'align', 'style'],
      th: ['width', 'colspan', 'rowspan', 'bgcolor', 'align', 'style'],
      a: ['href', 'title', 'style', 'target'],
      img: ['src', 'alt', 'width', 'height', 'style'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'data', 'cid'],
    allowedSchemesByTag: { img: ['https', 'http', 'data', 'cid'] },
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [color],
        'background-color': [color],
        background: [color],
        width: [length],
        'max-width': [length],
        height: [length],
        'font-size': [length],
        'line-height': [length],
        'font-family': [/^[a-zA-Z ,'-]+$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        'text-align': [/^(left|center|right|justify)$/],
        'text-decoration': [/^(none|underline)$/],
        'vertical-align': [/^(top|middle|bottom)$/],
        padding: [/^(\d{1,3}(px|em)?\s*){1,4}$/],
        margin: [/^(\d{1,3}(px|em)?\s*){1,4}$/],
        'border-radius': [length],
        border: [/^(0|\d{1,2}px (solid|dashed) #[a-fA-F0-9]{3,8})$/],
        'border-top': [/^(0|\d{1,2}px (solid|dashed) #[a-fA-F0-9]{3,8})$/],
        'border-bottom': [/^(0|\d{1,2}px (solid|dashed) #[a-fA-F0-9]{3,8})$/],
        display: [/^(block|inline|inline-block)$/],
      },
    },
  });

  return html.length <= 64_000 && html.includes('{{negocio}}') && html.includes('{{propuesta}}')
    ? html
    : null;
}

export function parseOutreachDraft(input: Record<string, unknown>): OutreachDraft | null {
  const limits = {
    business: 160,
    email: 254,
    observation: 1600,
    proposal: 2400,
    subject: 200,
  };

  const draft = {} as OutreachDraft;
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || value.length > limits[key]) {
      return null;
    }
    draft[key] = value.trim();
  }

  if (!validOutreachEmail(draft.email) || /[\r\n]/.test(draft.subject)) {
    return null;
  }

  draft.email = draft.email.toLowerCase();

  // Parse optional customization fields
  if (typeof input.price === 'string' && input.price.trim().length <= 80) {
    draft.price = input.price.trim();
  }
  if (typeof input.service_title === 'string' && input.service_title.trim().length <= 160) {
    draft.service_title = input.service_title.trim();
  }
  if (typeof input.deliverables === 'string' && input.deliverables.trim().length <= 400) {
    draft.deliverables = input.deliverables.trim();
  }
  if (typeof input.deliverables_note === 'string' && input.deliverables_note.trim().length <= 300) {
    draft.deliverables_note = input.deliverables_note.trim();
  }
  if (typeof input.image_url === 'string') {
    const img = input.image_url.trim();
    if (!img) {
      draft.image_url = '';
    } else if (
      (/^https?:\/\/.+/i.test(img) && img.length <= 2000) ||
      (/^data:image\/[a-zA-Z+]+;base64,/i.test(img) && img.length <= 8_000_000)
    ) {
      draft.image_url = img;
    }
  }

  if (typeof input.include_whatsapp === 'boolean') {
    draft.include_whatsapp = input.include_whatsapp;
  } else if (typeof input.include_whatsapp === 'string') {
    draft.include_whatsapp = input.include_whatsapp === 'true';
  }
  if (typeof input.whatsapp_phone === 'string' && input.whatsapp_phone.trim().length <= 40) {
    draft.whatsapp_phone = input.whatsapp_phone.trim();
  }

  if (input.template_html != null && input.template_html !== '') {
    const { template_html, meta } = extractOutreachMeta(String(input.template_html));
    if (meta) {
      if (!draft.price && meta.price) draft.price = meta.price;
      if (!draft.service_title && meta.service_title) draft.service_title = meta.service_title;
      if (!draft.deliverables && meta.deliverables) draft.deliverables = meta.deliverables;
      if (!draft.deliverables_note && meta.deliverables_note) draft.deliverables_note = meta.deliverables_note;
      if (!draft.image_url && meta.image_url) draft.image_url = meta.image_url;
      if (draft.include_whatsapp === undefined && meta.include_whatsapp !== undefined) {
        draft.include_whatsapp = meta.include_whatsapp;
      }
      if (!draft.whatsapp_phone && meta.whatsapp_phone) draft.whatsapp_phone = meta.whatsapp_phone;
    }

    if (template_html) {
      const html = prepareOutreachTemplate(template_html);
      if (!html) return null;
      draft.template_html = html;
    } else {
      draft.template_html = null;
    }
  } else {
    draft.template_html = null;
  }

  return draft;
}

export const RIFX_SOCIAL_LINKS = {
  tiktok: 'https://www.tiktok.com/@rifxmarketing',
  facebook: 'https://www.facebook.com/profile.php?id=61556910667259',
  instagram: 'https://www.instagram.com/rifxmarketing/',
};

export function renderSocialLinksCornerHtml(): string {
  return `
                  <td align="right" valign="top" style="text-align:right;padding-left:10px;">
                    <div style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      Redes
                    </div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin-left:auto;">
                      <tr>
                        <!-- TikTok -->
                        <td style="padding:0 3px;">
                          <a href="${RIFX_SOCIAL_LINKS.tiktok}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;background:#000000;border-radius:8px;text-decoration:none;box-shadow:0 2px 5px rgba(0,0,0,0.12);" title="TikTok @rifxmarketing">
                            <img src="https://img.icons8.com/ios-filled/50/ffffff/tiktok--v1.png" width="16" height="16" alt="TikTok" style="display:inline-block;vertical-align:middle;border:0;outline:none;" />
                          </a>
                        </td>
                        <!-- Facebook -->
                        <td style="padding:0 3px;">
                          <a href="${RIFX_SOCIAL_LINKS.facebook}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;background:#1877F2;border-radius:8px;text-decoration:none;box-shadow:0 2px 5px rgba(24,119,242,0.2);" title="Facebook Rifx Marketing">
                            <img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" width="16" height="16" alt="Facebook" style="display:inline-block;vertical-align:middle;border:0;outline:none;" />
                          </a>
                        </td>
                        <!-- Instagram -->
                        <td style="padding:0 3px;">
                          <a href="${RIFX_SOCIAL_LINKS.instagram}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;background:#E1306C;border-radius:8px;text-decoration:none;box-shadow:0 2px 5px rgba(225,48,108,0.2);" title="Instagram @rifxmarketing">
                            <img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new--v1.png" width="16" height="16" alt="Instagram" style="display:inline-block;vertical-align:middle;border:0;outline:none;" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>`;
}

export function renderOutreach(
  draft: OutreachDraft,
  senderEmail: string = 'bryanarcos@rifx-marketing.com'
): { html: string; text: string } {
  const e = escapeEmailHtml;

  const price = draft.price?.trim() || 'USD 300';
  const serviceTitle = draft.service_title?.trim() || 'Gestión de anuncios publicitarios';
  const deliverables = draft.deliverables?.trim() || '12 piezas gráficas • 3 videos editables';
  const deliverablesNote = draft.deliverables_note?.trim() || 'La inversión en anuncios se paga por separado.';
  const imageUrl = draft.image_url?.trim() || '';

  const deliverableItems = deliverables
    .split(/\n|(?:\s*•\s*)/)
    .map(item => item.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean);

  const includeWhatsApp = draft.include_whatsapp !== false;
  const cleanWaPhone = (draft.whatsapp_phone || '593983910712').replace(/\D/g, '') || '593983910712';
  const waText = encodeURIComponent(`Hola Bryan, recibí la propuesta de Rifx Marketing para ${draft.business} y quisiera conversar sobre los detalles.`);
  const waUrl = `https://wa.me/${cleanWaPhone}?text=${waText}`;

  const whatsAppButtonHtml = includeWhatsApp
    ? `
              <!-- Botón oficial de WhatsApp -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 12px;">
                <tr>
                  <td bgcolor="#25D366" style="background:#25D366;border-radius:10px;box-shadow:0 3px 12px rgba(37,211,102,0.35);">
                    <a href="${waUrl}" target="_blank" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:0.2px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;vertical-align:middle;">
                        <tr>
                          <td valign="middle" style="padding-right:9px;line-height:1;">
                            <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/whatsapp.png" width="18" height="18" alt="WA" style="display:block;width:18px;height:18px;border:0;outline:none;" />
                          </td>
                          <td valign="middle" style="color:#ffffff;font-size:14px;font-weight:700;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                            Chatear por WhatsApp
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>`
    : '';

  const text = `Hola, equipo de ${draft.business}:

Soy Bryan Arcos, de Rifx Marketing, en Ambato. ${draft.observation}

${draft.proposal}

${serviceTitle}: ${price}. Incluye ${deliverables}. ${deliverablesNote}
${imageUrl ? `Muestra visual de anuncio: ${imageUrl}\n` : ''}
¿Con quién puedo conversar sobre su publicidad? Si les interesa, acordamos el alcance y el presupuesto de anuncios.${includeWhatsApp ? `\n\n📲 Chatear por WhatsApp: ${waUrl}` : ''}

Bryan Arcos
Director | Rifx Marketing
${senderEmail}
https://rifx-marketing.com/
Redes: TikTok @rifxmarketing • Instagram @rifxmarketing • Facebook Rifx Marketing

Si prefieren no recibir propuestas, pueden indicármelo al responder este correo.`;

  const template = prepareOutreachTemplate(draft.template_html);

  if (template) {
    const values: Record<string, string> = {
      negocio: draft.business,
      observacion: draft.observation,
      propuesta: draft.proposal,
      precio: price,
      servicio: serviceTitle,
      entregables: deliverables,
      imagen: imageUrl ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td align="center"><img src="${e(imageUrl)}" style="max-width:100%;height:auto;border-radius:10px;border:0;display:block;margin:0 auto;" alt="Muestra de anuncio"></td></tr></table>` : '',
    };
    const customized = template.replace(
      /\{\{(negocio|observacion|propuesta|precio|servicio|entregables|imagen)\}\}/g,
      (_match, key: string) => (key === 'imagen' ? values[key] || '' : e(values[key] || '').replace(/\n/g, '<br>'))
    );

    return {
      text,
      html: `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(draft.subject || 'Propuesta Comercial - Rifx Marketing')}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor con marcos de la agencia Rifx Marketing -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(16,50,96,0.08);">
          
          <!-- MARCO SUPERIOR: Header oficial Rifx Marketing -->
          <tr>
            <td bgcolor="#103260" style="background:#103260;padding:22px 26px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="60" valign="middle">
                    <img src="https://rifx-marketing.com/images/rifx-logo-user.png" width="52" height="52" alt="Rifx Marketing" style="display:block;border:0;border-radius:10px;">
                  </td>
                  <td valign="middle" style="padding-left:14px;">
                    <div style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:1px;line-height:1.2;">RIFX MARKETING</div>
                    <div style="color:#93c5fd;font-size:12px;font-weight:500;margin-top:2px;">Publicidad digital &amp; Crecimiento comercial</div>
                    <div style="color:#cbd5e1;font-size:11px;margin-top:1px;">📍 Ambato, Ecuador</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Franja de acento comercial Rifx en gradiente -->
          <tr>
            <td height="4" bgcolor="#f27121" style="background:linear-gradient(90deg, #f27121 0%, #b64e12 100%);line-height:4px;font-size:4px;">&nbsp;</td>
          </tr>

          <!-- CUERPO DEL MENSAJE -->
          <tr>
            <td style="padding:28px 26px 20px;color:#1e293b;font-size:15px;line-height:1.68;">
              ${customized}

              ${whatsAppButtonHtml}
            </td>
          </tr>

          <!-- MARCO INFERIOR: Firma oficial de la agencia -->
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding:22px 26px;background:#fafbfc;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="48" valign="top">
                    <img src="https://rifx-marketing.com/images/rifx-logo-user.png" width="44" height="44" alt="Bryan Arcos" style="display:block;border:0;border-radius:50%;border:1px solid #cbd5e1;">
                  </td>
                  <td valign="top" style="padding-left:14px;">
                    <div style="color:#103260;font-weight:800;font-size:15px;line-height:1.2;">Bryan Arcos</div>
                    <div style="color:#64748b;font-size:12px;margin-top:2px;">Director General • Rifx Marketing</div>
                    <!-- Director | Rifx Marketing -->
                    <div style="font-size:12px;line-height:20px;margin-top:6px;">
                      <div>
                        <a href="mailto:${e(senderEmail)}" style="color:#103260;text-decoration:none;font-weight:600;">${e(senderEmail)}</a>
                      </div>
                      <div style="margin-top:2px;">
                        <a href="https://rifx-marketing.com/" style="color:#b64e12;text-decoration:none;font-weight:700;">rifx-marketing.com</a>
                      </div>
                    </div>
                  </td>
                  ${renderSocialLinksCornerHtml()}
                </tr>
              </table>

              <div style="margin-top:16px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.5;">
                Este correo electrónico es una comunicación oficial y directa de Rifx Marketing. Si prefieres no recibir más mensajes de seguimiento, puedes indicárnoslo al responder este correo.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };
  }

  // Plantilla oficial estándar unificada Rifx Marketing (#103260)
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(draft.subject || 'Propuesta Comercial - Rifx Marketing')}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor con marcos de la agencia Rifx Marketing -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(16,50,96,0.08);">
          
          <!-- MARCO SUPERIOR: Header oficial Rifx Marketing -->
          <tr>
            <td bgcolor="#103260" style="background:#103260;padding:22px 26px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="60" valign="middle">
                    <img src="https://rifx-marketing.com/images/rifx-logo-user.png" width="52" height="52" alt="Rifx Marketing" style="display:block;border:0;border-radius:10px;">
                  </td>
                  <td valign="middle" style="padding-left:14px;">
                    <div style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:1px;line-height:1.2;">RIFX MARKETING</div>
                    <div style="color:#93c5fd;font-size:12px;font-weight:500;margin-top:2px;">Publicidad digital &amp; Crecimiento comercial</div>
                    <div style="color:#cbd5e1;font-size:11px;margin-top:1px;">📍 Ambato, Ecuador</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Franja de acento comercial Rifx en gradiente -->
          <tr>
            <td height="4" bgcolor="#f27121" style="background:linear-gradient(90deg, #f27121 0%, #b64e12 100%);line-height:4px;font-size:4px;">&nbsp;</td>
          </tr>

          <!-- CUERPO DEL MENSAJE -->
          <tr>
            <td style="padding:28px 26px 20px;">
              <h2 style="margin:0 0 16px;color:#103260;font-size:20px;font-weight:700;line-height:1.35;">
                Hola, equipo de ${e(draft.business)}:
              </h2>

              <p style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.68;">
                Soy Bryan Arcos, de Rifx Marketing, en Ambato. ${e(draft.observation).replace(/\n/g, '<br>')}
              </p>

              <p style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.68;">
                ${e(draft.proposal).replace(/\n/g, '<br>')}
              </p>

              ${imageUrl ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                <tr>
                  <td align="center" style="padding:4px 0;">
                    <img src="${e(imageUrl)}" alt="Muestra de anuncio publicitario" style="display:block;max-width:100%;height:auto;border-radius:10px;border:0;margin:0 auto;" />
                  </td>
                </tr>
              </table>` : ''}

              <!-- Tarjeta de paquete comercial -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 22px;">
                    <div style="color:#103260;font-size:15px;font-weight:700;margin-bottom:6px;">${e(serviceTitle)}</div>
                    <div style="color:#103260;font-size:30px;font-weight:800;letter-spacing:-0.5px;margin-bottom:10px;">${e(price)}</div>
                    <!-- ${e(deliverables)} -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                      ${deliverableItems.map(item => `
                      <tr>
                        <td valign="top" style="padding:2px 8px 3px 0;color:#f27121;font-size:14px;line-height:1.5;font-weight:bold;">•</td>
                        <td valign="top" style="padding:2px 0 3px 0;color:#334155;font-size:14px;font-weight:600;line-height:1.5;">${e(item)}</td>
                      </tr>
                      `).join('')}
                    </table>
                    <div style="color:#64748b;font-size:12px;line-height:1.5;margin-top:6px;">${e(deliverablesNote)}</div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;color:#1e293b;font-size:15px;line-height:1.68;">
                ¿Con quién de su equipo puedo conversar sobre su publicidad? Si les interesa, acordamos los detalles, fechas y presupuesto.
              </p>

              ${whatsAppButtonHtml}
            </td>
          </tr>

          <!-- MARCO INFERIOR: Firma oficial de la agencia -->
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding:22px 26px;background:#fafbfc;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="48" valign="top">
                    <img src="https://rifx-marketing.com/images/rifx-logo-user.png" width="44" height="44" alt="Bryan Arcos" style="display:block;border:0;border-radius:50%;border:1px solid #cbd5e1;">
                  </td>
                  <td valign="top" style="padding-left:14px;">
                    <div style="color:#103260;font-weight:800;font-size:15px;line-height:1.2;">Bryan Arcos</div>
                    <div style="color:#64748b;font-size:12px;margin-top:2px;">Director General • Rifx Marketing</div>
                    <!-- Director | Rifx Marketing -->
                    <div style="font-size:12px;line-height:20px;margin-top:6px;">
                      <div>
                        <a href="mailto:${e(senderEmail)}" style="color:#103260;text-decoration:none;font-weight:600;">${e(senderEmail)}</a>
                      </div>
                      <div style="margin-top:2px;">
                        <a href="https://rifx-marketing.com/" style="color:#b64e12;text-decoration:none;font-weight:700;">rifx-marketing.com</a>
                      </div>
                    </div>
                  </td>
                  ${renderSocialLinksCornerHtml()}
                </tr>
              </table>

              <div style="margin-top:16px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.5;">
                Este correo electrónico es una comunicación oficial y directa de Rifx Marketing. Si prefieres no recibir más mensajes de seguimiento, puedes indicárnoslo al responder este correo.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}

export type AgencyReplyParams = {
  replyText: string;
  subject: string;
  senderEmail?: string;
  clientName?: string;
  clientBusiness?: string;
  originalMessage?: string;
  includeWhatsApp?: boolean;
  whatsAppPhone?: string;
};

export function renderAgencyReply({
  replyText,
  subject,
  senderEmail = 'bryanarcos@rifx-marketing.com',
  clientName,
  clientBusiness,
  originalMessage,
  includeWhatsApp = true,
  whatsAppPhone = '593983910712',
}: AgencyReplyParams): { html: string; text: string } {
  const e = escapeEmailHtml;
  const trimmed = replyText.trim();
  const hasGreeting = /^(hola|estimad[oa]|buen[oa]s|saludos|que tal|qué tal)/i.test(trimmed);

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.68;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${e(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const cleanSubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;
  const cleanWaPhone = (whatsAppPhone || '593983910712').replace(/\D/g, '') || '593983910712';
  const waText = encodeURIComponent('Hola Bryan, te escribo en respuesta a tu correo sobre Rifx Marketing.');
  const waUrl = `https://wa.me/${cleanWaPhone}?text=${waText}`;

  const whatsAppButtonHtml = includeWhatsApp
    ? `
              <!-- Botón directo de WhatsApp limpio oficial con logotipo -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 12px;">
                <tr>
                  <td bgcolor="#25D366" style="background:#25D366;border-radius:10px;box-shadow:0 3px 12px rgba(37,211,102,0.35);">
                    <a href="${waUrl}" target="_blank" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:0.2px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;vertical-align:middle;">
                        <tr>
                          <td valign="middle" style="padding-right:9px;line-height:1;">
                            <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/whatsapp.png" width="18" height="18" alt="WA" style="display:block;width:18px;height:18px;border:0;outline:none;" />
                          </td>
                          <td valign="middle" style="color:#ffffff;font-size:14px;font-weight:700;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                            Chatear por WhatsApp
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>`
    : '';

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(cleanSubject)}${clientBusiness ? ` - ${e(clientBusiness)}` : ''}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor con marcos de la agencia Rifx Marketing -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(16,50,96,0.08);">
          
          <!-- MARCO SUPERIOR: Header oficial Rifx Marketing -->
          <tr>
            <td bgcolor="#103260" style="background:#103260;padding:22px 26px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="60" valign="middle">
                    <img src="https://rifx-marketing.com/images/rifx-logo-user.png" width="52" height="52" alt="Rifx Marketing" style="display:block;border:0;border-radius:10px;">
                  </td>
                  <td valign="middle" style="padding-left:14px;">
                    <div style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:1px;line-height:1.2;">RIFX MARKETING</div>
                    <div style="color:#93c5fd;font-size:12px;font-weight:500;margin-top:2px;">Publicidad digital &amp; Crecimiento comercial</div>
                    <div style="color:#cbd5e1;font-size:11px;margin-top:1px;">📍 Ambato, Ecuador</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Franja de acento comercial Rifx en gradiente -->
          <tr>
            <td height="4" bgcolor="#f27121" style="background:linear-gradient(90deg, #f27121 0%, #b64e12 100%);line-height:4px;font-size:4px;">&nbsp;</td>
          </tr>

          <!-- CUERPO DEL MENSAJE -->
          <tr>
            <td style="padding:28px 26px 20px;">
              <!-- Encabezado / Saludo -->
              ${!hasGreeting && clientName ? `
              <h2 style="margin:0 0 16px;color:#103260;font-size:20px;font-weight:700;line-height:1.35;">
                Hola ${e(clientName)},
              </h2>` : ''}

              <!-- Texto redactado -->
              <div style="color:#1e293b;font-size:15px;line-height:1.68;">
                ${paragraphs}
              </div>

              <!-- Cita del mensaje previo del cliente si existe -->
              ${originalMessage ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 20px;background:#f8fafc;border-left:4px solid #103260;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-radius:0 10px 10px 0;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0 0 5px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">
                      💬 En respuesta a tu mensaje anterior:
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.55;color:#334155;font-style:italic;">
                      "${e(originalMessage)}"
                    </p>
                  </td>
                </tr>
              </table>` : ''}

              ${whatsAppButtonHtml}
            </td>
          </tr>

          <!-- MARCO INFERIOR: Firma oficial de la agencia -->
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding:22px 26px;background:#fafbfc;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="48" valign="top">
                    <img src="https://rifx-marketing.com/images/rifx-logo-user.png" width="44" height="44" alt="Bryan Arcos" style="display:block;border:0;border-radius:50%;border:1px solid #cbd5e1;">
                  </td>
                  <td valign="top" style="padding-left:14px;">
                    <div style="color:#103260;font-weight:800;font-size:15px;line-height:1.2;">Bryan Arcos</div>
                    <div style="color:#64748b;font-size:12px;margin-top:2px;">Director General • Rifx Marketing</div>
                    <!-- Director | Rifx Marketing -->
                    <div style="font-size:12px;line-height:20px;margin-top:6px;">
                      <div>
                        <a href="mailto:${e(senderEmail)}" style="color:#103260;text-decoration:none;font-weight:600;">${e(senderEmail)}</a>
                      </div>
                      <div style="margin-top:2px;">
                        <a href="https://rifx-marketing.com/" style="color:#b64e12;text-decoration:none;font-weight:700;">rifx-marketing.com</a>
                      </div>
                    </div>
                  </td>
                  ${renderSocialLinksCornerHtml()}
                </tr>
              </table>

              <div style="margin-top:16px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.5;">
                Este correo electrónico es una comunicación oficial y directa de Rifx Marketing. Si prefieres no recibir más mensajes de seguimiento, puedes indicárnoslo al responder este correo.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${trimmed}

${originalMessage ? `\n---\n💬 En respuesta a tu mensaje anterior:\n"${originalMessage}"\n` : ''}
${includeWhatsApp ? `\n📲 Chatear por WhatsApp: ${waUrl}\n` : ''}
---
Bryan Arcos | Director General
Rifx Marketing • Publicidad Digital & Crecimiento comercial
Email: ${senderEmail}
Web: https://rifx-marketing.com/
Redes: TikTok @rifxmarketing • Instagram @rifxmarketing • Facebook Rifx Marketing
Ambato, Ecuador`;

  return { html, text };
}

export type ParsedBulkRecipient = {
  email: string;
  business: string;
  raw: string;
};

export function parseBulkRecipientList(rawText: string): {
  validItems: ParsedBulkRecipient[];
  invalidLines: string[];
  duplicateCount: number;
} {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const validItems: ParsedBulkRecipient[] = [];
  const invalidLines: string[] = [];
  let duplicateCount = 0;

  for (const line of lines) {
    let email = '';
    let business = '';

    const angleMatch = line.match(/^([^<]+)<([^>]+)>$/);
    if (angleMatch) {
      business = angleMatch[1].trim();
      email = angleMatch[2].trim();
    } else {
      const parts = line.split(/[,;\t|]/);
      if (parts.length >= 2) {
        const p0 = parts[0].trim();
        const p1 = parts.slice(1).join(' ').trim();
        if (validOutreachEmail(p0)) {
          email = p0;
          business = p1;
        } else if (validOutreachEmail(p1)) {
          email = p1;
          business = p0;
        } else {
          const found = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
          if (found) {
            email = found[0];
            business = line.replace(found[0], '').replace(/[,;\t|<>]/g, ' ').trim();
          }
        }
      } else {
        const found = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        if (found) {
          email = found[0];
          business = line.replace(found[0], '').replace(/[<>]/g, '').trim();
        }
      }
    }

    email = email.toLowerCase().trim();
    if (!validOutreachEmail(email)) {
      invalidLines.push(line);
      continue;
    }

    if (seen.has(email)) {
      duplicateCount++;
      continue;
    }

    seen.add(email);
    validItems.push({
      email,
      business: business || 'su negocio',
      raw: line,
    });
  }

  return { validItems, invalidLines, duplicateCount };
}

export function personalizeProposal(
  template: string,
  vars: { business?: string; email?: string; price?: string; service?: string }
): string {
  if (!template) return '';
  let result = template;
  const biz = vars.business?.trim() || 'su negocio';
  result = result.replace(/\{\{\s*negocio\s*\}\}/gi, biz);
  result = result.replace(/\{\{\s*empresa\s*\}\}/gi, biz);
  result = result.replace(/\{\{\s*cliente\s*\}\}/gi, biz);
  if (vars.email) {
    result = result.replace(/\{\{\s*correo\s*\}\}/gi, vars.email);
    result = result.replace(/\{\{\s*email\s*\}\}/gi, vars.email);
  }
  if (vars.price) {
    result = result.replace(/\{\{\s*precio\s*\}\}/gi, vars.price);
  }
  if (vars.service) {
    result = result.replace(/\{\{\s*servicio\s*\}\}/gi, vars.service);
  }
  return result;
}
