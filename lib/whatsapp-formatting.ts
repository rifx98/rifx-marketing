/**
 * WhatsApp message text formatting & sanitization utilities
 */

/**
 * Formats Markdown-style text for WhatsApp:
 * - Converts double asterisks **bold** to single asterisk *bold*
 * - Converts triple asterisks ***bold italic*** to *_bold italic_*
 * - Converts __bold__ to *bold*
 */
export function formatForWhatsApp(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, '*_$1_*')
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .replace(/__([^_]+)__/g, '*$1*');
}

/**
 * Sanitizes greetings to prevent double/repetitive greetings:
 * 1. Removes accidental back-to-back greetings in the same message (e.g. "¡Hola! ¡Hola!").
 * 2. If isOngoingConversation is true (the user and bot already have chat history),
 *    completely removes initial greetings ("¡Hola!", "Buenas tardes", "Un gusto saludarte")
 *    so the bot goes straight to answering the user's question.
 */
export function sanitizeGreetings(text: string, isOngoingConversation: boolean): string {
  if (!text) return '';
  let cleaned = text.trim();

  // 1. Remove duplicate internal greetings within the same message (e.g. "¡Hola! ¡Hola! ...", "Hola! Buenas tardes!")
  cleaned = cleaned.replace(/^(¡?hola!?\s*(?:👋|😊|🤝)?\s*){2,}/i, '$1');
  cleaned = cleaned.replace(/^(¡?hola!?\s*[,.!-]?\s*)+(¡?hola!?|¡?buen[ao]s\s*(?:días|tardes|noches)?!?\s*)/i, '$2');
  cleaned = cleaned.replace(/^(¡?buen[ao]s\s*(?:días|tardes|noches)?!?\s*[,.!-]?\s*)+(¡?hola!?\s*[,.!-]?\s*)/i, '$1');

  // 2. If the conversation is already ongoing (not the first message), strip initial greetings
  if (isOngoingConversation) {
    let prev = '';
    while (prev !== cleaned) {
      prev = cleaned;
      cleaned = cleaned.replace(/^(?:¡?hola!?\s*(?:de\s+nuevo|otra\s+vez)?|¡?buen[ao]s\s*(?:días|tardes|noches)?!?|saludos!?|qué\s+tal\??)\s*[,.!-]?\s*(?:👋|😊|🤝|🚀|💡)?\s*/i, '');
      cleaned = cleaned.replace(/^(?:es\s+)?(?:un\s+)?(?:gusto|placer)\s+saludarte\s*[,.!-]?\s*(?:👋|😊|🤝|🚀|💡)?\s*/i, '');
      cleaned = cleaned.replace(/^(?:qué\s+bueno\s+saludarte)\s*[,.!-]?\s*(?:👋|😊|🤝|🚀|💡)?\s*/i, '');
      cleaned = cleaned.replace(/^(?:espero\s+que\s+(?:te\s+encuentres|estés)\s+(?:muy\s+)?bien)\s*[,.!-]?\s*(?:👋|😊|🤝)?\s*/i, '');
      cleaned = cleaned.replace(/^(?:¿|¡)?c[oó]mo\s+(?:est[aá]s|te\s+encuentras|te\s+va)(?:\s+el\s+d[íi]a\s+de\s+hoy)?\??\s*[,.!-]?\s*(?:👋|😊|🤝)?\s*/i, '');
    }
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  return cleaned.trim();
}
