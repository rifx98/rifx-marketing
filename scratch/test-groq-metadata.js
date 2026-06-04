import OpenAI from 'openai';

async function test() {
  const apiKey = process.env.GROQ_API_KEY;
  console.log('GROQ_API_KEY present:', !!apiKey);
  if (!apiKey) {
    console.error('Error: GROQ_API_KEY is not set');
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const title = "como vender mas";
  const caption = "aca te enseño a vender mas por whatsapp usando plantillas y flujos automaticos en rifx";

  console.log('Calling Groq with:', { title, caption });

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Eres un copywriter y estratega de contenido experto en redes sociales (Instagram, TikTok, YouTube Shorts y Facebook Reels).
Tu objetivo es tomar las ideas o el borrador de un usuario para su video y mejorarlo radicalmente para aumentar la retención, los clics y la interacción.

Debes generar un objeto JSON con exactamente estas dos propiedades:
1. "title": Un título super atractivo y corto (máximo 6 palabras) con 1-2 emojis, ideal para enganchar y usar como texto en el video o portada.
2. "caption": La descripción del video. Debe ser persuasiva, organizada, incluir un gancho inicial, desarrollar la idea clave de forma breve, tener un llamado a la acción (CTA) claro al final (ej. "¡Comenta abajo tu opinión!", "Guarda este reel si te sirvió", etc.) y terminar con 3-5 hashtags relevantes.

Responde ÚNICAMENTE con el objeto JSON crudo, sin bloques de código markdown de tipo \`\`\`json y sin textos introductorios.
El idioma de la respuesta debe ser estrictamente español.`
        },
        {
          role: 'user',
          content: `Borrador/Ideas del usuario:
- Título propuesto: "${title}"
- Descripción/Ideas propuestas: "${caption}"

Mejora y optimiza esta información para redes sociales.`
        }
      ],
      temperature: 0.7,
    });

    console.log('Response from Groq:\n', completion.choices[0]?.message?.content);
  } catch (err) {
    console.error('Error calling Groq:', err);
  }
}

test();
