import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import OpenAI from 'openai';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { enforceTenantRateLimit, readLimitedJsonObject } from '@/lib/request-guards';
import {
  extractOutreachMeta,
  packOutreachMeta,
  parseOutreachDraft,
  prepareOutreachTemplate,
  renderAgencyReply,
  renderOutreach,
  validOutreachEmail,
  personalizeProposal,
  type OutreachDraft,
} from '@/lib/outreach';
import { fetchOutreachInbox, deleteOutreachMessages } from '@/lib/outreach-imap';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = 'id,business,email,observation,proposal,subject,template_html,delivery_status,stage,suppressed,sent_at,created_at';

function getSenderEmail() {
  return process.env.RIFX_OUTREACH_SMTP_USER || 'bryanarcos@rifx-marketing.com';
}

function smtpReady() {
  const host = process.env.RIFX_OUTREACH_SMTP_HOST;
  const pass = process.env.RIFX_OUTREACH_SMTP_PASSWORD;
  const user = process.env.RIFX_OUTREACH_SMTP_USER;
  const port = process.env.RIFX_OUTREACH_SMTP_PORT;
  return !!(host && pass && user && ['465', '587'].includes(port || ''));
}

async function authorize(req: NextRequest) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant) {
    return {
      response: NextResponse.json({ error: 'Inicia sesión en el panel.' }, { status: 401 }),
      tenant: null,
    };
  }

  const targetTenantId = process.env.RIFX_OUTREACH_TENANT_ID;
  if (targetTenantId && tenant.tenantId !== targetTenantId && !tenant.isAdmin) {
    return {
      response: NextResponse.json(
        { error: 'El módulo de correos todavía no está habilitado para esta cuenta.' },
        { status: 403 }
      ),
      tenant: null,
    };
  }

  return { tenant, response: null };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authorize(req);
    if (auth.response) return auth.response;

    const db = createSupabaseAdmin();
    const sender = getSenderEmail();

    const [{ data: contacts, error: contactsError }, templatesResult] = await Promise.all([
      db
        .from('outreach_contacts')
        .select(FIELDS)
        .eq('tenant_id', auth.tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(500),
      db
        .from('outreach_templates')
        .select('id,name,html')
        .eq('tenant_id', auth.tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (contactsError) {
      console.error('[Outreach GET] Error loading contacts:', contactsError);
      return NextResponse.json(
        { error: 'No se pudo cargar la lista de prospectos. Revisa las tablas de Supabase.' },
        { status: 503 }
      );
    }

    const templates = templatesResult.error ? [] : templatesResult.data || [];

    const formattedContacts = (contacts || []).map(c => {
      const { template_html, meta } = extractOutreachMeta(c.template_html);
      return {
        ...c,
        template_html,
        price: meta.price || 'USD 300',
        service_title: meta.service_title || 'Gestión de anuncios publicitarios',
        deliverables: meta.deliverables || '12 piezas gráficas • 3 videos editables',
        deliverables_note: meta.deliverables_note || 'La inversión en anuncios se paga por separado.',
        image_url: meta.image_url || '',
        include_whatsapp: meta.include_whatsapp !== false,
        whatsapp_phone: meta.whatsapp_phone || '+593 98 391 0712',
      };
    });

    const inboxMessages: any[] = [];
    try {
      const inboxRes = await fetchOutreachInbox({ limit: 15 });
      if (inboxRes.success) {
        const contactsByEmail = new Map<string, { id: string; business: string; stage: string }>();
        for (const c of formattedContacts) {
          contactsByEmail.set(c.email.toLowerCase().trim(), c);
        }
        for (const msg of inboxRes.messages) {
          const contact = contactsByEmail.get(msg.fromEmail.toLowerCase().trim());
          if (contact) {
            msg.matchedContactId = contact.id;
            msg.matchedContactBusiness = contact.business;
          }
          inboxMessages.push(msg);
        }
      }
    } catch (e) {
      console.warn('[Outreach GET Inbox sync fallback]', e);
    }

    return NextResponse.json(
      {
        contacts: formattedContacts,
        templates,
        inbox: inboxMessages,
        smtpReady: smtpReady(),
        testEmail: process.env.RIFX_OUTREACH_TEST_EMAIL || '',
        sender,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[Outreach GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'El módulo de correos no está disponible temporalmente.' },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req);
    if (auth.response) return auth.response;

    const tenantId = auth.tenant.tenantId;

    const denied = await enforceTenantRateLimit('outreach', tenantId, 100, 60_000);
    if (denied) return denied;

    const parsed = await readLimitedJsonObject(req, 256 * 1024);
    if (!parsed.ok) return parsed.response;

    const body = parsed.body;
    const db = createSupabaseAdmin();
    const senderEmail = getSenderEmail();

    // 1. Asistente de redacción comercial con IA
    if (body.action === 'ai-generate') {
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      const style = typeof body.style === 'string' ? body.style.trim() : 'Profesional';
      const language = typeof body.language === 'string' ? body.language.trim() : 'Spanish (Español)';
      const business = typeof body.business === 'string' ? body.business.trim() : '';

      if (!prompt || prompt.length > 4000) {
        return NextResponse.json(
          { error: 'Escribe las instrucciones para la redacción con IA (hasta 4,000 caracteres).' },
          { status: 400 }
        );
      }

      const groqKey = process.env.GROQ_API_KEY || '';
      if (!groqKey) {
        return NextResponse.json(
          { error: 'La clave de inteligencia artificial (GROQ_API_KEY) no está configurada.' },
          { status: 503 }
        );
      }

      const groq = new OpenAI({
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: 25_000,
        maxRetries: 1,
      });

      const systemContent = `Eres el director creativo y redactor publicitario senior de Rifx Marketing en Ambato, Ecuador.
Tu misión es transformar las ideas o instrucciones en borrador del usuario en una propuesta de correo comercial impecable, persuasiva, estructurada y de alta conversión dirigida a un negocio potencial.

Reglas de estilo:
- "Profesional": Tono corporativo, elegante, respetuoso y formal.
- "Persuasivo y vendedor": Enfocado en captar clientes, retorno de inversión y urgencia comercial.
- "Directo y conciso": Al grano, claro, con números y entregables definidos.
- "Cercano y amigable": Cálido, empático, moderno y accesible.
- "Consultivo y estratégico": Asesor experto que analizó el negocio y propone mejoras tangibles.

Idioma de redacción: ${language}.
Si el usuario especifica precios o entregables (imágenes, videos, pauta), incorpóralos con precisión.

Debes responder EXCLUSIVAMENTE en formato JSON con la siguiente estructura:
{
  "subject": "Asunto cautivador para el correo (máximo 75 caracteres)",
  "observation": "Observación estratégica y personalizada sobre el negocio o sector (1 o 2 oraciones)",
  "proposal": "Cuerpo central de la propuesta comercial con viñetas claras de beneficios y servicios incluidos",
  "service_title": "Nombre profesional del servicio sugerido (ej: Gestión de Anuncios y Contenido)",
  "price": "Precio sugerido o indicado (ej: USD 300)",
  "deliverables": "Resumen de entregables (ej: 12 piezas gráficas • 3 videos editables)",
  "deliverables_note": "Nota sobre inversión publicitaria (ej: La inversión en anuncios se paga por separado.)",
  "full_draft": "Carta completa lista para leer (con saludo, propuesta con viñetas, cierre comercial y firma)"
}`;

      const userContent = `Instrucciones del usuario:
"${prompt}"

${business ? `Nombre del negocio del cliente: ${business}` : ''}
Estilo seleccionado: ${style}
Idioma: ${language}`;

      try {
        const completion = await groq.chat.completions.create({
          model: 'qwen/qwen3.8-27b',
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 850,
          temperature: 0.6,
        });

        const rawOutput = completion.choices[0]?.message?.content || '{}';
        let parsedJson: Record<string, unknown> = {};
        try {
          parsedJson = JSON.parse(rawOutput);
        } catch {
          const match = rawOutput.match(/\{[\s\S]*\}/);
          if (match) parsedJson = JSON.parse(match[0]);
        }

        return NextResponse.json({
          success: true,
          subject: String(parsedJson.subject || '').slice(0, 200),
          observation: String(parsedJson.observation || '').slice(0, 1600),
          proposal: String(parsedJson.proposal || '').slice(0, 2400),
          service_title: String(parsedJson.service_title || 'Gestión de anuncios publicitarios').slice(0, 160),
          price: String(parsedJson.price || 'USD 300').slice(0, 80),
          deliverables: Array.isArray(parsedJson.deliverables)
            ? parsedJson.deliverables.join(' • ').slice(0, 400)
            : String(parsedJson.deliverables || '12 piezas gráficas • 3 videos editables').slice(0, 400),
          deliverables_note: String(parsedJson.deliverables_note || 'La inversión en anuncios se paga por separado.').slice(0, 300),
          full_draft: String(parsedJson.full_draft || parsedJson.proposal || '').slice(0, 4000),
        });
      } catch (aiErr) {
        console.error('[Outreach AI] Error generating draft:', aiErr);
        return NextResponse.json(
          { error: 'No se pudo generar la propuesta con IA. Intenta con una instrucción más breve.' },
          { status: 502 }
        );
      }
    }

    // 2. Perfeccionamiento profesional de respuesta comercial con IA
    if (body.action === 'ai-improve-reply') {
      const draftText = typeof body.draftText === 'string' ? body.draftText.trim() : '';
      const clientMessage = typeof body.clientMessage === 'string' ? body.clientMessage.trim() : '';
      const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
      const clientBusiness = typeof body.clientBusiness === 'string' ? body.clientBusiness.trim() : '';
      const style = typeof body.style === 'string' ? body.style.trim() : 'Profesional y Persuasivo';

      if (!draftText && !clientMessage) {
        return NextResponse.json(
          { error: 'Escribe un borrador o proporciona el mensaje del cliente para mejorar la respuesta.' },
          { status: 400 }
        );
      }

      const groqKey = process.env.GROQ_API_KEY || '';
      if (!groqKey) {
        return NextResponse.json(
          { error: 'La clave de inteligencia artificial (GROQ_API_KEY) no está configurada.' },
          { status: 503 }
        );
      }

      const groq = new OpenAI({
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: 25_000,
        maxRetries: 1,
      });

      const systemContent = `Eres el director comercial y redactor publicitario senior de Rifx Marketing en Ambato, Ecuador.
Tu misión es redactar o perfeccionar un mensaje de respuesta comercial para un cliente o prospecto interesado en nuestros servicios.
El mensaje debe quedar impecable, altamente profesional, persuasivo, cortés y fluido en español, enfocado en avanzar la conversación hacia el cierre o coordinar los siguientes pasos (ej: agendar videollamada, compartir ejemplos o iniciar el plan acordado).

Reglas fundamentales:
1. Respeta fielmente cualquier dato concreto que el usuario haya puesto en su borrador (precios, número de piezas, horarios). No los inventes ni los alteres.
2. Mantén un tono elegante, ejecutivo y cálido acorde a una agencia moderna de alto nivel.
3. Si el borrador ya incluye saludo o el cliente tiene nombre, incorpóralo de manera natural y respetuosa.
4. Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura:
{
  "improvedText": "Texto completo y perfeccionado del mensaje de respuesta para el cliente"
}`;

      const userContent = `Borrador actual a mejorar:
"${draftText || '(Sin borrador previo, redacta una respuesta comercial profesional en base al mensaje del cliente)'}"

${clientName ? `Nombre del destinatario: ${clientName}` : ''}
${clientBusiness ? `Negocio / Empresa: ${clientBusiness}` : ''}
${clientMessage ? `Mensaje recibido del cliente:\n"${clientMessage}"` : ''}
Estilo: ${style}`;

      try {
        const completion = await groq.chat.completions.create({
          model: 'qwen/qwen3.8-27b',
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 850,
          temperature: 0.5,
        });

        const rawOutput = completion.choices[0]?.message?.content || '{}';
        let parsedJson: Record<string, unknown> = {};
        try {
          parsedJson = JSON.parse(rawOutput);
        } catch {
          const match = rawOutput.match(/\{[\s\S]*\}/);
          if (match) parsedJson = JSON.parse(match[0]);
        }

        const improved = String(parsedJson.improvedText || parsedJson.text || parsedJson.message || '').trim();
        if (!improved) {
          throw new Error('La IA no devolvió texto de respuesta.');
        }

        return NextResponse.json({
          success: true,
          improvedText: improved,
        });
      } catch (aiErr) {
        console.error('[Outreach AI Improve Reply] Error:', aiErr);
        return NextResponse.json(
          { error: 'No se pudo perfeccionar la respuesta con IA. Revisa tu conexión o intenta con un texto más breve.' },
          { status: 502 }
        );
      }
    }

    // Sincronizar bandeja de respuestas de clientes vía IMAP (Nominalia)
    if (body.action === 'sync-inbox') {
      const inboxResult = await fetchOutreachInbox({ limit: 25 });
      if (!inboxResult.success) {
        return NextResponse.json(
          { error: inboxResult.error || 'No se pudo sincronizar el buzón de correo.' },
          { status: 502 }
        );
      }

      // Obtener todos los contactos del tenant para cruzar por email
      const { data: contacts, error: contactsErr } = await db
        .from('outreach_contacts')
        .select('id,email,business,stage')
        .eq('tenant_id', tenantId);

      if (contactsErr) throw contactsErr;

      const contactsByEmail = new Map<string, { id: string; business: string; stage: string }>();
      for (const c of contacts || []) {
        contactsByEmail.set(c.email.toLowerCase().trim(), c);
      }

      let updatedCount = 0;
      const enrichedMessages = [];

      for (const msg of inboxResult.messages) {
        const contact = contactsByEmail.get(msg.fromEmail.toLowerCase().trim());
        if (contact) {
          msg.matchedContactId = contact.id;
          msg.matchedContactBusiness = contact.business;

          // Si el prospecto aún estaba en draft o pending, marcarlo automáticamente como 'replied'
          if (['draft', 'pending'].includes(contact.stage)) {
            await db
              .from('outreach_contacts')
              .update({ stage: 'replied', updated_at: new Date().toISOString() })
              .eq('id', contact.id);
            contact.stage = 'replied';
            updatedCount++;
          }
        }
        enrichedMessages.push(msg);
      }

      return NextResponse.json({
        success: true,
        messages: enrichedMessages,
        updatedCount,
      });
    }

    // Eliminar correos directamente del servidor de Nominalia (IMAP) para liberar memoria del buzón
    if (body.action === 'delete-inbox') {
      const rawUids = Array.isArray(body.uids)
        ? body.uids
        : typeof body.uid === 'string'
          ? [body.uid]
          : [];

      const uids = rawUids.map((id: unknown) => String(id).trim()).filter(Boolean);
      if (uids.length === 0) {
        return NextResponse.json(
          { error: 'No se seleccionaron correos válidos para eliminar.' },
          { status: 400 }
        );
      }

      const delResult = await deleteOutreachMessages(uids);
      if (!delResult.success) {
        return NextResponse.json(
          { error: delResult.error || 'No se pudieron eliminar los correos del servidor de Nominalia.' },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        count: delResult.count,
        deletedUids: uids,
      });
    }

    // Responder a un cliente directamente desde el CRM con marco profesional de la agencia
    if (body.action === 'reply') {
      const to = typeof body.to === 'string' ? body.to.trim() : '';
      const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
      const replyText = typeof body.replyText === 'string' ? body.replyText.trim() : '';
      const contactId = typeof body.contactId === 'string' && UUID.test(body.contactId) ? body.contactId : null;
      const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
      const clientBusiness = typeof body.clientBusiness === 'string' ? body.clientBusiness.trim() : '';
      const originalMessage = typeof body.originalMessage === 'string' ? body.originalMessage.trim() : '';
      const includeWhatsApp = body.includeWhatsApp !== false;
      const whatsAppPhone = typeof body.whatsAppPhone === 'string' ? body.whatsAppPhone.trim() : '';

      if (!to || !validOutreachEmail(to)) {
        return NextResponse.json({ error: 'Dirección de correo de destino no válida.' }, { status: 400 });
      }
      if (!subject || subject.length > 200) {
        return NextResponse.json({ error: 'El asunto es obligatorio (máximo 200 caracteres).' }, { status: 400 });
      }
      if (!replyText || replyText.length > 4000) {
        return NextResponse.json({ error: 'Escribe un mensaje de respuesta de hasta 4000 caracteres.' }, { status: 400 });
      }

      if (!smtpReady()) {
        return NextResponse.json(
          { error: 'Falta conectar o configurar las credenciales del correo en el servidor (Nominalia SMTP).' },
          { status: 503 }
        );
      }

      const port = Number(process.env.RIFX_OUTREACH_SMTP_PORT) || 465;
      const isSecure = port === 465;
      const transporter = nodemailer.createTransport({
        host: process.env.RIFX_OUTREACH_SMTP_HOST,
        port,
        secure: isSecure,
        requireTLS: !isSecure,
        auth: {
          user: senderEmail,
          pass: process.env.RIFX_OUTREACH_SMTP_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      });

      const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;
      
      const { html: replyHtml, text: replyTextBody } = renderAgencyReply({
        replyText,
        subject: replySubject,
        senderEmail,
        clientName,
        clientBusiness,
        originalMessage,
        includeWhatsApp,
        whatsAppPhone,
      });

      try {
        const info = await transporter.sendMail({
          from: {
            name: 'Bryan Arcos | Rifx Marketing',
            address: senderEmail,
          },
          replyTo: senderEmail,
          to,
          subject: replySubject,
          html: replyHtml,
          text: replyTextBody,
        });

        if (!info.accepted?.length) {
          throw new Error('El servidor SMTP no aceptó el envío del correo.');
        }

        if (contactId) {
          await db
            .from('outreach_contacts')
            .update({
              stage: 'replied',
              updated_at: new Date().toISOString(),
            })
            .eq('id', contactId);
        }

        return NextResponse.json({
          success: true,
          message: 'Respuesta con diseño oficial de Rifx Marketing enviada con éxito.',
        });
      } catch (sendError) {
        console.error('[Outreach POST reply] Error sending reply:', sendError);
        return NextResponse.json(
          {
            error: sendError instanceof Error
              ? `Error al enviar correo por SMTP: ${sendError.message}`
              : 'Error al enviar el correo al cliente. Revisa las credenciales de correo.',
          },
          { status: 502 }
        );
      } finally {
        transporter.close();
      }
    }

    // 2. Guardar plantilla personalizada
    if (body.action === 'save-template') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const html = prepareOutreachTemplate(body.html);
      if (!name || name.length > 100 || !html) {
        return NextResponse.json(
          { error: 'Escribe un nombre e incluye {{negocio}} y {{propuesta}} en un HTML de hasta 64 KB.' },
          { status: 400 }
        );
      }

      const { count, error: countError } = await db
        .from('outreach_templates')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (countError) throw countError;
      if ((count || 0) >= 100) {
        return NextResponse.json({ error: 'La biblioteca admite hasta 100 plantillas.' }, { status: 409 });
      }

      const { data, error } = await db
        .from('outreach_templates')
        .insert({ tenant_id: tenantId, name, html })
        .select('id,name,html')
        .single();

      if (error) throw error;
      return NextResponse.json({ template: data });
    }

    // 3. Guardar o actualizar borrador de prospecto
    if (body.action === 'save') {
      const draft = parseOutreachDraft(body);
      if (!draft) {
        return NextResponse.json(
          { error: 'Completa todos los campos obligatorios y revisa el correo y asunto.' },
          { status: 400 }
        );
      }

      const { data: existing, error: lookupError } = await db
        .from('outreach_contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', draft.email)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let targetId = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null;
      if (existing) {
        if (!targetId) {
          targetId = existing.id;
        } else if (targetId !== existing.id) {
          return NextResponse.json(
            { error: 'Ese correo ya está registrado en otro contacto de tu lista.' },
            { status: 409 }
          );
        }
      }

      const packedTemplate = packOutreachMeta(draft.template_html, {
        price: draft.price,
        service_title: draft.service_title,
        deliverables: draft.deliverables,
        deliverables_note: draft.deliverables_note,
        image_url: draft.image_url,
        include_whatsapp: draft.include_whatsapp,
        whatsapp_phone: draft.whatsapp_phone,
      });

      const payload = {
        business: draft.business,
        email: draft.email,
        observation: draft.observation,
        proposal: draft.proposal,
        subject: draft.subject,
        template_html: packedTemplate,
      };

      if (targetId) {
        const { data, error } = await db
          .from('outreach_contacts')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', targetId)
          .eq('tenant_id', tenantId)
          .eq('delivery_status', 'draft')
          .select(FIELDS)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { error: 'Solo se pueden editar propuestas que no hayan iniciado envío.' },
            { status: 409 }
          );
        }

        const { template_html, meta } = extractOutreachMeta(data.template_html);
        return NextResponse.json({
          contact: {
            ...data,
            template_html,
            price: meta.price || draft.price || 'USD 300',
            service_title: meta.service_title || draft.service_title || 'Gestión de anuncios publicitarios',
            deliverables: meta.deliverables || draft.deliverables || '12 piezas gráficas • 3 videos editables',
            deliverables_note: meta.deliverables_note || draft.deliverables_note || 'La inversión en anuncios se paga por separado.',
            image_url: meta.image_url || draft.image_url || '',
            include_whatsapp: meta.include_whatsapp !== undefined ? meta.include_whatsapp : (draft.include_whatsapp !== false),
            whatsapp_phone: meta.whatsapp_phone || draft.whatsapp_phone || '+593 98 391 0712',
          },
        });
      }

      const { data, error } = await db
        .from('outreach_contacts')
        .insert({ ...payload, tenant_id: tenantId })
        .select(FIELDS)
        .single();

      if (error) throw error;

      const { template_html, meta } = extractOutreachMeta(data.template_html);
      return NextResponse.json({
        contact: {
          ...data,
          template_html,
          price: meta.price || draft.price || 'USD 300',
          service_title: meta.service_title || draft.service_title || 'Gestión de anuncios publicitarios',
          deliverables: meta.deliverables || draft.deliverables || '12 piezas gráficas • 3 videos editables',
          deliverables_note: meta.deliverables_note || draft.deliverables_note || 'La inversión en anuncios se paga por separado.',
          image_url: meta.image_url || draft.image_url || '',
          include_whatsapp: meta.include_whatsapp !== undefined ? meta.include_whatsapp : (draft.include_whatsapp !== false),
          whatsapp_phone: meta.whatsapp_phone || draft.whatsapp_phone || '+593 98 391 0712',
        },
      });
    }

    // 4. Cambiar etapa de seguimiento comercial
    if (body.action === 'stage') {
      if (
        typeof body.id !== 'string' ||
        !UUID.test(body.id) ||
        !['pending', 'replied', 'meeting', 'won', 'declined'].includes(String(body.stage))
      ) {
        return NextResponse.json({ error: 'Estado de seguimiento inválido.' }, { status: 400 });
      }

      const { data, error } = await db
        .from('outreach_contacts')
        .update({
          stage: body.stage,
          ...(body.stage === 'declined' ? { suppressed: true } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.id)
        .eq('tenant_id', tenantId)
        .select(FIELDS)
        .maybeSingle();

      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Contacto no encontrado.' }, { status: 404 });
      const { template_html, meta } = extractOutreachMeta(data.template_html);
      return NextResponse.json({
        contact: {
          ...data,
          template_html,
          price: meta.price || 'USD 300',
          service_title: meta.service_title || 'Gestión de anuncios publicitarios',
          deliverables: meta.deliverables || '12 piezas gráficas • 3 videos editables',
          deliverables_note: meta.deliverables_note || 'La inversión en anuncios se paga por separado.',
          image_url: meta.image_url || '',
          include_whatsapp: meta.include_whatsapp !== false,
          whatsapp_phone: meta.whatsapp_phone || '+593 98 391 0712',
        },
      });
    }

    // 5. Envío masivo de propuestas a múltiples correos
    if (body.action === 'bulk-send') {
      if (!smtpReady()) {
        return NextResponse.json(
          { error: 'Falta conectar o configurar las credenciales del correo en el servidor (Nominalia SMTP).' },
          { status: 503 }
        );
      }

      const bulkDenied = await enforceTenantRateLimit('outreach-bulk', tenantId, 30, 60_000);
      if (bulkDenied) return bulkDenied;

      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) {
        return NextResponse.json({ error: 'La lista de destinatarios está vacía.' }, { status: 400 });
      }
      if (rawItems.length > 50) {
        return NextResponse.json(
          { error: 'El lote máximo por envío es de 50 correos. Envía en bloques de hasta 50.' },
          { status: 400 }
        );
      }

      const campaignDraft = body.campaignDraft && typeof body.campaignDraft === 'object' ? (body.campaignDraft as Record<string, unknown>) : {};
      const delayMs = Math.min(Math.max(Number(body.delayMs) || 1200, 200), 5000);
      const saveToCrm = Boolean(body.saveToCrm);

      const port = Number(process.env.RIFX_OUTREACH_SMTP_PORT) || 465;
      const isSecure = port === 465;

      const transporter = nodemailer.createTransport({
        host: process.env.RIFX_OUTREACH_SMTP_HOST,
        port,
        secure: isSecure,
        requireTLS: !isSecure,
        pool: true,
        maxConnections: 1,
        maxMessages: 50,
        auth: {
          user: senderEmail,
          pass: process.env.RIFX_OUTREACH_SMTP_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      });

      const results: Array<{
        email: string;
        business: string;
        status: 'sent' | 'failed' | 'skipped';
        messageId?: string;
        error?: string;
        contactId?: string;
      }> = [];

      try {
        for (let i = 0; i < rawItems.length; i++) {
          const item = rawItems[i] as Record<string, unknown>;
          const email = typeof item.email === 'string' ? item.email.trim() : '';
          const business = typeof item.business === 'string' && item.business.trim() ? item.business.trim() : 'su negocio';
          const contactId = typeof item.id === 'string' && UUID.test(item.id) ? item.id : undefined;

          if (!email || !validOutreachEmail(email)) {
            results.push({ email: email || 'desconocido', business, status: 'failed', error: 'Correo electrónico inválido' });
            continue;
          }

          if (contactId) {
            const { data: contactRecord } = await db
              .from('outreach_contacts')
              .select('suppressed')
              .eq('id', contactId)
              .eq('tenant_id', tenantId)
              .maybeSingle();

            if (contactRecord?.suppressed) {
              results.push({ email, business, status: 'skipped', error: 'Contacto marcado para no contactar' });
              continue;
            }
          }

          const baseSubject = String(item.subject || campaignDraft.subject || 'Propuesta de marketing digital para {{negocio}}');
          const baseProposal = String(item.proposal || campaignDraft.proposal || 'Les presentamos una propuesta comercial exclusiva de Rifx Marketing.');
          const baseObservation = String(item.observation || campaignDraft.observation || 'Analizamos las oportunidades comerciales de su negocio.');

          const personalizedSubject = personalizeProposal(baseSubject, { business, email });
          const personalizedProposal = personalizeProposal(baseProposal, { business, email });
          const personalizedObservation = personalizeProposal(baseObservation, { business, email });

          const draftToSend: OutreachDraft = {
            business,
            email,
            subject: personalizedSubject.slice(0, 200),
            proposal: personalizedProposal.slice(0, 2400),
            observation: personalizedObservation.slice(0, 1600),
            price: String(item.price || campaignDraft.price || 'USD 300').slice(0, 80),
            service_title: String(item.service_title || campaignDraft.service_title || 'Gestión de anuncios publicitarios').slice(0, 160),
            deliverables: String(item.deliverables || campaignDraft.deliverables || '12 piezas gráficas • 3 videos editables').slice(0, 400),
            deliverables_note: String(item.deliverables_note || campaignDraft.deliverables_note || 'La inversión en anuncios se paga por separado.').slice(0, 300),
            image_url: String(item.image_url || campaignDraft.image_url || ''),
            template_html: typeof item.template_html === 'string' ? item.template_html : (typeof campaignDraft.template_html === 'string' ? campaignDraft.template_html : null),
            include_whatsapp: typeof item.include_whatsapp === 'boolean' ? item.include_whatsapp : (campaignDraft.include_whatsapp !== false),
            whatsapp_phone: String(item.whatsapp_phone || campaignDraft.whatsapp_phone || '+593 98 391 0712'),
          };

          const rendered = renderOutreach(draftToSend, senderEmail);

          try {
            const info = await transporter.sendMail({
              from: {
                name: 'Bryan Arcos | Rifx Marketing',
                address: senderEmail,
              },
              replyTo: senderEmail,
              to: email,
              subject: draftToSend.subject,
              html: rendered.html,
              text: rendered.text,
            });

            if (!info.accepted?.length) {
              throw new Error('El servidor de correo no aceptó el destinatario');
            }

            let savedContactId = contactId;
            if (contactId) {
              await db
                .from('outreach_contacts')
                .update({
                  delivery_status: 'sent',
                  sent_at: new Date().toISOString(),
                  provider_message_id: info.messageId,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', contactId);
            } else if (saveToCrm) {
              const { data: upserted } = await db
                .from('outreach_contacts')
                .upsert(
                  {
                    tenant_id: tenantId,
                    email,
                    business,
                    observation: draftToSend.observation,
                    proposal: draftToSend.proposal,
                    subject: draftToSend.subject,
                    delivery_status: 'sent',
                    stage: 'pending',
                    sent_at: new Date().toISOString(),
                    provider_message_id: info.messageId,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'tenant_id,email' }
                )
                .select('id')
                .maybeSingle();

              if (upserted?.id) savedContactId = upserted.id;
            }

            results.push({
              email,
              business,
              status: 'sent',
              messageId: info.messageId,
              contactId: savedContactId,
            });
          } catch (itemErr: any) {
            console.error(`[Outreach Bulk] Error sending to ${email}:`, itemErr);
            if (contactId) {
              await db
                .from('outreach_contacts')
                .update({ delivery_status: 'uncertain', updated_at: new Date().toISOString() })
                .eq('id', contactId);
            }
            results.push({
              email,
              business,
              status: 'failed',
              error: itemErr instanceof Error ? itemErr.message : 'Error al enviar por SMTP',
            });
          }

          if (i < rawItems.length - 1 && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }

        const sentCount = results.filter(r => r.status === 'sent').length;
        const failedCount = results.filter(r => r.status === 'failed').length;

        return NextResponse.json({
          success: true,
          processed: results.length,
          sent: sentCount,
          failed: failedCount,
          results,
        });
      } finally {
        transporter.close();
      }
    }

    // 6. Envío de prueba o envío definitivo individual
    if (body.action !== 'send' && body.action !== 'test') {
      return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    }

    if (!smtpReady()) {
      return NextResponse.json(
        { error: 'Falta conectar o configurar las credenciales del correo en el servidor (Nominalia SMTP).' },
        { status: 503 }
      );
    }

    const sendingDenied = await enforceTenantRateLimit('outreach-send', tenantId, 5, 60_000);
    if (sendingDenied) return sendingDenied;

    let draft;
    let contactId: string | null = null;
    let to: string;

    if (body.action === 'test') {
      draft = parseOutreachDraft(body);
      to = process.env.RIFX_OUTREACH_TEST_EMAIL || '';
      if (!draft || !validOutreachEmail(to)) {
        return NextResponse.json(
          { error: 'Revisa el borrador y asegúrate de configurar tu correo de pruebas RIFX_OUTREACH_TEST_EMAIL.' },
          { status: 400 }
        );
      }
    } else {
      if (typeof body.id !== 'string' || !UUID.test(body.id) || body.confirmed !== true) {
        return NextResponse.json({ error: 'Revisa y confirma el contacto antes de enviar.' }, { status: 400 });
      }

      // Reclamo atómico para evitar duplicados en clics rápidos
      const { data, error } = await db
        .from('outreach_contacts')
        .update({ delivery_status: 'sending', updated_at: new Date().toISOString() })
        .eq('id', body.id)
        .eq('tenant_id', tenantId)
        .eq('delivery_status', 'draft')
        .eq('suppressed', false)
        .select(FIELDS)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json(
          { error: 'Este contacto ya tiene un envío iniciado o está marcado para no contactar.' },
          { status: 409 }
        );
      }

      draft = parseOutreachDraft(data);
      contactId = data.id;
      to = data.email;
    }

    const port = Number(process.env.RIFX_OUTREACH_SMTP_PORT) || 465;
    const isSecure = port === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.RIFX_OUTREACH_SMTP_HOST,
      port,
      secure: isSecure,
      requireTLS: !isSecure,
      auth: {
        user: senderEmail,
        pass: process.env.RIFX_OUTREACH_SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    try {
      if (!draft) throw new Error('Borrador de propuesta inválido');
      const content = renderOutreach(draft, senderEmail);

      let emailHtml = content.html;
      const attachments: Array<{ filename: string; content?: Buffer; path?: string; cid?: string; contentType?: string }> = [];

      if (draft.image_url) {
        if (draft.image_url.startsWith('data:image/')) {
          const match = draft.image_url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            const contentType = match[1];
            const buffer = Buffer.from(match[2], 'base64');
            const cid = 'ad_creative_sample';
            attachments.push({
              filename: 'muestra-anuncio.png',
              content: buffer,
              contentType,
              cid,
            });
            emailHtml = emailHtml.replace(draft.image_url, `cid:${cid}`);
          }
        } else if (draft.image_url.includes('/api/assets/uploads/outreach/')) {
          try {
            const match = draft.image_url.match(/outreach\/([0-9]{10,17}_[a-zA-Z0-9_-]{6,64}\.(?:jpe?g|png|webp|gif))/i);
            if (match) {
              const fileName = `outreach/${match[1]}`;
              const supabase = createSupabaseAdmin();
              const { data: fileData, error: fileError } = await supabase.storage.from('uploads').download(fileName);
              if (!fileError && fileData) {
                const buffer = Buffer.from(await fileData.arrayBuffer());
                const ext = match[1].split('.').pop()?.toLowerCase();
                const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                const cid = 'ad_creative_sample';
                attachments.push({
                  filename: match[1],
                  content: buffer,
                  contentType,
                  cid,
                });
                emailHtml = emailHtml.replace(draft.image_url, `cid:${cid}`);
              }
            }
          } catch (e) {
            console.warn('[Outreach inline CID fetch failed, keeping direct URL]', e);
          }
        }
      }

      const info = await transporter.sendMail({
        from: {
          name: 'Bryan Arcos | Rifx Marketing',
          address: senderEmail,
        },
        replyTo: senderEmail,
        to,
        subject: (body.action === 'test' ? '[Prueba] ' : '') + draft.subject,
        html: emailHtml,
        text: content.text,
        attachments,
      });

      if (!info.accepted?.length) {
        throw new Error('El servidor de correo no aceptó el destinatario');
      }

      if (contactId) {
        const { error } = await db
          .from('outreach_contacts')
          .update({
            delivery_status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: info.messageId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId)
          .eq('tenant_id', tenantId);

        if (error) {
          console.error('[Outreach POST] Status update error:', error);
          return NextResponse.json(
            { error: 'El correo se envió pero no se pudo actualizar el estado. Revisa tu buzón.' },
            { status: 502 }
          );
        }
      }

      return NextResponse.json({ accepted: true, test: body.action === 'test' });
    } catch (sendError) {
      console.error('[Outreach POST] SMTP Error:', sendError);
      if (contactId) {
        await db
          .from('outreach_contacts')
          .update({ delivery_status: 'uncertain', updated_at: new Date().toISOString() })
          .eq('id', contactId)
          .eq('tenant_id', tenantId);
      }
      return NextResponse.json(
        { error: 'No se pudo enviar el correo por SMTP. Revisa tus credenciales de Nominalia.' },
        { status: 502 }
      );
    } finally {
      transporter.close();
    }
  } catch (error) {
    console.error('[Outreach POST] General error:', error);
    return NextResponse.json(
      { error: 'No se pudo completar la operación. Revisa la base de datos y la conexión.' },
      { status: 503 }
    );
  }
}
