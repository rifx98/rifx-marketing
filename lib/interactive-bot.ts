/**
 * Genera el JSON requerido por Meta para enviar un mensaje interactivo con botones.
 */
export function buildInteractiveButtonsMessage(
  to: string,
  text: string,
  buttons: Array<{ id: string; title: string }>
) {
  if (buttons.length > 3) {
    throw new Error('WhatsApp allows a maximum of 3 buttons per interactive message.');
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: text,
      },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id.substring(0, 256), // Max length 256
            title: btn.title.substring(0, 20), // Max length 20
          },
        })),
      },
    },
  };
}

/**
 * Genera una respuesta de texto estandar.
 */
export function buildTextMessage(to: string, text: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: { body: text },
  };
}

/**
 * Procesa la lógica principal del bot estático.
 */
export function processStaticBotMessage(
  incomingMessage: any,
  botConfig: any,
  fromPhoneId: string
) {
  const isInteractive = incomingMessage.type === 'interactive';
  
  if (isInteractive && incomingMessage.interactive?.type === 'button_reply') {
    const buttonId = incomingMessage.interactive.button_reply.id;
    
    // Buscar la respuesta configurada para este botón
    const responseText = botConfig.responses?.[buttonId] || 'Gracias por tu respuesta. En breve nos pondremos en contacto contigo.';
    return buildTextMessage(fromPhoneId, responseText);
  }

  // Si no es interactivo (texto, imagen, etc), enviar el menú de bienvenida con botones
  const welcomeText = botConfig.welcome_message || '¡Hola! Por favor selecciona una opción:';
  const buttons = botConfig.buttons || [];

  if (buttons.length > 0) {
    // Tomar máximo los primeros 3 botones (límite de WhatsApp API)
    return buildInteractiveButtonsMessage(fromPhoneId, welcomeText, buttons.slice(0, 3));
  } else {
    // Fallback si no hay botones configurados
    return buildTextMessage(fromPhoneId, welcomeText);
  }
}
