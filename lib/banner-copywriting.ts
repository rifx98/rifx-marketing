import OpenAI from 'openai';

export interface BannerCopyInput {
  brandName?: string;
  offerText?: string;
  storeDescription?: string;
  contactInfo?: string;
  language?: string;
}

export interface EnhancedBannerCopy {
  brandName: string;
  headline: string;
  offerText: string;
  storeDescription: string;
  bulletPoints: string[];
  contactInfo: string;
  summaryExplanation?: string;
}

/**
 * Normaliza y pule textos localmente como salvaguarda inmediata si falla la red o la IA externa.
 */
function localFallbackEnhance(input: BannerCopyInput): EnhancedBannerCopy {
  let brand = (input.brandName || '').trim();
  if (brand) {
    // Corregir capitalización irregular (ej: 'RIFX mARKETING' -> 'RIFX Marketing')
    brand = brand
      .split(' ')
      .map((word) => {
        if (word.toUpperCase() === 'RIFX') return 'RIFX';
        if (word.length <= 2) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  } else {
    brand = 'RIFX Marketing';
  }

  let offer = (input.offerText || '').trim();
  // Corregir errores ortográficos típicos como "estatiega" -> "estrategia"
  offer = offer
    .replace(/estatiega/gi, 'estrategia')
    .replace(/publicitarias/gi, 'publicitarias')
    .replace(/campanas/gi, 'campañas');

  if (!offer || offer.length < 5) {
    offer = 'Estrategias Digitales que Multiplican tus Clientes';
  } else {
    // Elevar a estilo publicitario si es un borrador en mayúsculas o tosco
    if (offer.toLowerCase().includes('armamos una estrategia') || offer.toLowerCase().includes('estatiega')) {
      offer = 'Armamos la Estrategia Digital de tu Negocio';
    } else {
      offer = offer.charAt(0).toUpperCase() + offer.slice(1);
    }
  }

  let desc = (input.storeDescription || '').trim();
  desc = desc
    .replace(/estatiega/gi, 'estrategia')
    .replace(/campanas/gi, 'campañas');

  if (!desc || desc.length < 10) {
    desc = 'Estudiamos tu mercado a fondo y lanzamos campañas publicitarias estratégicas para captar clientes calificados y escalar tus ventas.';
  } else {
    if (desc.toLowerCase().includes('somos estrategas')) {
      desc = 'Somos estrategas: analizamos tu mercado, diseñamos soluciones a medida y lanzamos pautas publicitarias efectivas para captar nuevos clientes.';
    } else {
      desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    }
  }

  const bulletPoints = [
    'Análisis de Mercado & Competencia',
    'Estrategias Personalizadas',
    'Campañas Publicitarias Efectivas',
    'Crecimiento Real de tu Negocio'
  ];

  return {
    brandName: brand,
    headline: offer.toUpperCase(),
    offerText: offer,
    storeDescription: desc,
    bulletPoints,
    contactInfo: input.contactInfo?.trim() || 'WhatsApp: 0991234567 • @rifx_marketing • www.rifxmarketing.com',
    summaryExplanation: 'Idea comercial pulida, ortografía corregida y optimizada para máxima conversión publicitaria.'
  };
}

/**
 * Eleva la idea borrador del cliente a copywriting publicitario de alta conversión utilizando IA (Groq, Gemini u OpenAI).
 */
export async function enhanceBannerCopywriting(input: BannerCopyInput): Promise<EnhancedBannerCopy> {
  const brand = (input.brandName || '').trim();
  const offer = (input.offerText || '').trim();
  const desc = (input.storeDescription || '').trim();
  const contact = (input.contactInfo || '').trim();
  const lang = (input.language || 'es').trim();

  // Si no hay datos, devolver el esquema base pulido
  if (!brand && !offer && !desc) {
    return localFallbackEnhance(input);
  }

  const systemPrompt = `Eres un Director Creativo y Copywriter Publicitario Senior de élite en una prestigiosa agencia internacional de marketing.
Tu especialidad es tomar BORRADORES O IDEAS CRUDAS entregadas por los clientes (a menudo con errores ortográficos como "estatiega", redacción tosca o desordenada) y transformarlas en CONCEPTOS PUBLICITARIOS DE ALTO IMPACTO, magnéticos, vendedores y con redacción impecable.

INSTRUCCIONES CLAVE:
1. Corrige 100% de la ortografía y puntuación (ej: "estatiega" -> "estrategia", "rifx mARKETING" -> "RIFX Marketing").
2. Eleva la propuesta de valor: mantén la intención y el rubro del cliente, pero redáctalo como una marca de primer nivel.
3. Genera un Headline (titular principal gigante para la pancarta): contundente, memorable, de 3 a 6 palabras en MAYÚSCULAS.
4. Genera un Subheadline / Oferta Comercial clara y persuasiva.
5. Genera una Descripción breve y seductora del servicio o producto (1 o 2 oraciones directas al beneficio).
6. Genera exactamente 4 Bullet Points o beneficios clave ultra-concisos (2 a 4 palabras cada uno) ideales para tarjetas, medallas o insignias del diseño.

RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA (SIN MARKDOWN EXTRA):
{
  "brand_name": "Nombre de la marca bien formateado",
  "headline": "TITULAR PRINCIPAL DE ALTO IMPACTO EN MAYÚSCULAS",
  "offer_text": "Oferta o gancho comercial elevado",
  "store_description": "Descripción publicitaria persuasiva y fluida",
  "bullet_points": ["Beneficio 1", "Beneficio 2", "Beneficio 3", "Beneficio 4"],
  "contact_info": "${contact || 'WhatsApp: 0991234567 • @rifx_marketing'}",
  "summary_explanation": "Breve explicación de las mejoras realizadas"
}`;

  const userPrompt = `Aquí tienes la idea borrador entregada por el cliente para su pancarta publicitaria:
- Nombre de la Tienda / Marca: ${brand || '(no especificado)'}
- Oferta o Gancho Comercial (Borrador): ${offer || '(no especificado)'}
- Descripción Breve del Producto o Estilo (Borrador): ${desc || '(no especificado)'}
- Datos de Contacto: ${contact || '(estándar)'}
- Idioma deseado: ${lang === 'es' ? 'Español' : lang}

Por favor, mejora y eleva esta idea convirtiéndola en copywriting publicitario ganador para su pancarta.`;

  // 1. Intentar con Groq (ultra rápido: <300ms)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groq = new OpenAI({
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: 10_000,
      });

      const completion = await groq.chat.completions.create({
        model: 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      });

      const rawContent = completion.choices[0]?.message?.content;
      if (rawContent) {
        const parsed = JSON.parse(rawContent);
        return {
          brandName: parsed.brand_name || brand || 'RIFX Marketing',
          headline: parsed.headline || parsed.offer_text || 'ESTRATEGIAS DE ALTO IMPACTO',
          offerText: parsed.offer_text || parsed.headline || 'Estrategias Digitales para tu Negocio',
          storeDescription: parsed.store_description || desc,
          bulletPoints: Array.isArray(parsed.bullet_points) && parsed.bullet_points.length > 0
            ? parsed.bullet_points.slice(0, 4)
            : ['Análisis de Mercado', 'Estrategia a Medida', 'Campañas Rentables', 'Resultados Reales'],
          contactInfo: parsed.contact_info || contact,
          summaryExplanation: parsed.summary_explanation || 'Idea mejorada con IA'
        };
      }
    } catch (groqErr: any) {
      console.warn('⚠️ [banner-copywriting] Groq falló, intentando alternativa:', groqErr.message);
    }
  }

  // 2. Intentar con Gemini si Groq no está disponible
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            brandName: parsed.brand_name || brand || 'RIFX Marketing',
            headline: parsed.headline || parsed.offer_text || 'ESTRATEGIAS DIGITALES EFECTIVAS',
            offerText: parsed.offer_text || parsed.headline || 'Estrategias de Marketing que Venden',
            storeDescription: parsed.store_description || desc,
            bulletPoints: Array.isArray(parsed.bullet_points) && parsed.bullet_points.length > 0
              ? parsed.bullet_points.slice(0, 4)
              : ['Análisis de Mercado', 'Estrategia a Medida', 'Campañas Rentables', 'Resultados Reales'],
            contactInfo: parsed.contact_info || contact,
            summaryExplanation: parsed.summary_explanation || 'Idea mejorada con Gemini'
          };
        }
      }
    } catch (geminiErr: any) {
      console.warn('⚠️ [banner-copywriting] Gemini falló:', geminiErr.message);
    }
  }

  // 3. Fallback local inteligente
  return localFallbackEnhance(input);
}
