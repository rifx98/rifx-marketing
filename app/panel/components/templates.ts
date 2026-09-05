export const templates: Record<string, { nodes: any[], edges: any[], name: string }> = {
  captacion_vip: {
    name: 'Bot Captación VIP',
    nodes: [
      { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} },
      { id: 'msg_1', type: 'message', position: { x: 500, y: 150 }, data: { name: 'Bienvenida', text: '¡Hola! Bienvenido a nuestro servicio VIP. 🌟' } },
      { id: 'question_1', type: 'question', position: { x: 800, y: 150 }, data: { name: 'Pedir Nombre', text: 'Para darte una atención personalizada, ¿cuál es tu nombre?', variable: 'nombre_cliente' } },
      { id: 'tag_1', type: 'tag', position: { x: 1100, y: 150 }, data: { name: 'Etiquetar', action: 'add', tag: 'lead-vip' } },
      { id: 'msg_2', type: 'message', position: { x: 1400, y: 150 }, data: { name: 'Despedida', text: 'Gracias {{nombre_cliente}}. Un asesor VIP se comunicará contigo en breve.' } },
      { id: 'human_1', type: 'human', position: { x: 1700, y: 150 }, data: { name: 'Asesor' } }
    ],
    edges: [
      { id: 'e_s_1', source: 'start_1', target: 'msg_1', type: 'smoothstep' },
      { id: 'e_m_q', source: 'msg_1', target: 'question_1', type: 'smoothstep' },
      { id: 'e_q_t', source: 'question_1', target: 'tag_1', type: 'smoothstep' },
      { id: 'e_t_m', source: 'tag_1', target: 'msg_2', type: 'smoothstep' },
      { id: 'e_m_h', source: 'msg_2', target: 'human_1', type: 'smoothstep' }
    ]
  },
  soporte_tecnico: {
    name: 'Soporte Técnico',
    nodes: [
      { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} },
      { id: 'menu_1', type: 'menu', position: { x: 500, y: 150 }, data: { name: 'Opciones de Soporte', text: '¿En qué te podemos ayudar hoy?', buttons: [{ label: 'Problema con mi cuenta' }, { label: 'Facturación' }, { label: 'Hablar con humano' }] } },
      { id: 'msg_cuenta', type: 'question', position: { x: 900, y: 50 }, data: { name: 'Cuenta', text: 'Para problemas con tu cuenta, por favor envíanos tu correo electrónico.', variable: 'correo_electronico' } },
      { id: 'msg_factura', type: 'message', position: { x: 900, y: 250 }, data: { name: 'Facturación', text: 'Puedes revisar tus facturas desde el panel de control. ¿Necesitas algo más?' } },
      { id: 'human_1', type: 'human', position: { x: 900, y: 450 }, data: { name: 'Asesor' } }
    ],
    edges: [
      { id: 'e_s_1', source: 'start_1', target: 'menu_1', type: 'smoothstep' },
      { id: 'e_m_1', source: 'menu_1', sourceHandle: 'Problema con mi cuenta', target: 'msg_cuenta', type: 'smoothstep' },
      { id: 'e_m_2', source: 'menu_1', sourceHandle: 'Facturación', target: 'msg_factura', type: 'smoothstep' },
      { id: 'e_m_3', source: 'menu_1', sourceHandle: 'Hablar con humano', target: 'human_1', type: 'smoothstep' },
      { id: 'e_cuenta_h', source: 'msg_cuenta', target: 'human_1', type: 'smoothstep' }
    ]
  },
  bienvenida_inicial: {
    name: 'Bienvenida Inicial',
    nodes: [
      { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} },
      { id: 'msg_1', type: 'message', position: { x: 500, y: 150 }, data: { name: 'Bienvenida', text: '¡Hola! Gracias por comunicarte con nosotros.' } },
      { id: 'media_1', type: 'media', position: { x: 800, y: 150 }, data: { name: 'Catálogo', mediaType: 'document', url: 'https://ejemplo.com/catalogo.pdf', fileName: 'catalogo.pdf' } },
      { id: 'end_1', type: 'end', position: { x: 1100, y: 150 }, data: { name: 'Fin' } }
    ],
    edges: [
      { id: 'e_s_1', source: 'start_1', target: 'msg_1', type: 'smoothstep' },
      { id: 'e_m_1', source: 'msg_1', target: 'media_1', type: 'smoothstep' },
      { id: 'e_m_e', source: 'media_1', target: 'end_1', type: 'smoothstep' }
    ]
  },
  ia_atencion_cliente: {
    name: 'Atención al Cliente con IA',
    nodes: [
      { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} },
      { id: 'msg_1', type: 'message', position: { x: 500, y: 150 }, data: { name: 'Bienvenida', text: '¡Hola! Soy tu asistente inteligente. Puedes preguntarme cualquier duda sobre nuestros servicios, horarios o envíos.' } },
      { id: 'ai_1', type: 'ai', position: { x: 800, y: 150 }, data: { name: 'IA Respuestas' } },
      { id: 'human_1', type: 'human', position: { x: 800, y: 350 }, data: { name: 'Transferir a Humano' } }
    ],
    edges: [
      { id: 'e_s_1', source: 'start_1', target: 'msg_1', type: 'smoothstep' },
      { id: 'e_m_1', source: 'msg_1', target: 'ai_1', type: 'smoothstep' }
    ]
  },
  ia_calificacion_leads: {
    name: 'Calificación de Leads Inteligente',
    nodes: [
      { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} },
      { id: 'msg_1', type: 'message', position: { x: 500, y: 150 }, data: { name: 'Intro', text: '¡Hola! Me encantaría ayudarte a encontrar el plan ideal. Cuéntame un poco, ¿qué tipo de negocio tienes?' } },
      { id: 'ai_1', type: 'ai', position: { x: 800, y: 150 }, data: { name: 'Asesor IA (Calificador)', context: 'Ofrecemos 3 planes: Plan Emprendedor ($29/mes), Plan Negocio ($59/mes) y Plan Enterprise ($120/mes). Analiza el negocio del cliente y recomiéndale el mejor plan con entusiasmo.', tone: 'vendedor', strictMode: 'no' } },
      { id: 'menu_1', type: 'menu', position: { x: 1100, y: 150 }, data: { name: 'Siguiente Paso', text: '¿Deseas dar el siguiente paso?', buttons: [{ label: 'Hablar con asesor' }, { label: 'Hacer otra pregunta a la IA' }, { label: 'Ver catálogo de planes' }] } },
      { id: 'tag_1', type: 'tag', position: { x: 1400, y: 50 }, data: { name: 'Marcar como Lead', action: 'add', tag: 'lead-calificado-ia' } },
      { id: 'human_1', type: 'human', position: { x: 1700, y: 50 }, data: { name: 'Vendedor' } },
      { id: 'media_1', type: 'media', position: { x: 1400, y: 350 }, data: { name: 'Planes PDF', mediaType: 'document', url: 'https://ejemplo.com/planes.pdf', fileName: 'planes.pdf' } }
    ],
    edges: [
      { id: 'e_s_1', source: 'start_1', target: 'msg_1', type: 'smoothstep' },
      { id: 'e_m_1', source: 'msg_1', target: 'ai_1', type: 'smoothstep' },
      { id: 'e_a_m', source: 'ai_1', target: 'menu_1', type: 'smoothstep' },
      { id: 'e_m_h', source: 'menu_1', sourceHandle: 'Hablar con asesor', target: 'tag_1', type: 'smoothstep' },
      { id: 'e_t_v', source: 'tag_1', target: 'human_1', type: 'smoothstep' },
      { id: 'e_m_ai', source: 'menu_1', sourceHandle: 'Hacer otra pregunta a la IA', target: 'ai_1', type: 'smoothstep' },
      { id: 'e_m_c', source: 'menu_1', sourceHandle: 'Ver catálogo de planes', target: 'media_1', type: 'smoothstep' }
    ]
  },
  ia_recomendacion_ventas: {
    name: 'Recomendador de Productos',
    nodes: [
      { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} },
      { id: 'msg_1', type: 'message', position: { x: 500, y: 150 }, data: { name: 'Bienvenida', text: '¡Hola! Soy tu personal shopper virtual. ¿Estás buscando algo para regalo, tecnología, moda o tienes algo en mente?' } },
      { id: 'ai_1', type: 'ai', position: { x: 800, y: 150 }, data: { name: 'Motor de Recomendaciones IA', context: 'Tenemos stock de zapatillas ($45-$80), relojes inteligentes ($35-$90), audífonos bluetooth ($25-$60) y accesorios. Envío gratis por compras mayores a $50.', tone: 'vendedor' } },
      { id: 'menu_1', type: 'menu', position: { x: 1100, y: 150 }, data: { name: 'Opciones Post-IA', text: '¿Te gustaría realizar la compra o seguir explorando?', buttons: [{ label: 'Hablar con ventas' }, { label: 'Ver catálogo PDF' }] } },
      { id: 'human_1', type: 'human', position: { x: 1400, y: 50 }, data: { name: 'Equipo de Ventas' } },
      { id: 'media_1', type: 'media', position: { x: 1400, y: 250 }, data: { name: 'Envío de Catálogo', mediaType: 'document', url: 'https://ejemplo.com/catalogo.pdf', fileName: 'catalogo.pdf' } }
    ],
    edges: [
      { id: 'e_s_1', source: 'start_1', target: 'msg_1', type: 'smoothstep' },
      { id: 'e_m_1', source: 'msg_1', target: 'ai_1', type: 'smoothstep' },
      { id: 'e_a_m', source: 'ai_1', target: 'menu_1', type: 'smoothstep' },
      { id: 'e_m_v', source: 'menu_1', sourceHandle: 'Hablar con ventas', target: 'human_1', type: 'smoothstep' },
      { id: 'e_m_c', source: 'menu_1', sourceHandle: 'Ver catálogo PDF', target: 'media_1', type: 'smoothstep' }
    ]
  },
  ia_embudo_hibrido: {
    name: 'Embudo Híbrido (Sin IA + Con IA Separados)',
    nodes: [
      { id: 'start_1', type: 'start', position: { x: 250, y: 200 }, data: {} },
      { id: 'menu_principal', type: 'menu', position: { x: 500, y: 200 }, data: { name: 'Menú de Bienvenida', text: '¡Hola! Te damos la bienvenida a nuestra tienda virtual 🌟 ¿Cómo deseas que te atendamos hoy?', buttons: [{ label: '🤖 Asistente Virtual IA (Preguntas y Precios)' }, { label: '📦 Ver Catálogo en PDF (Sin IA)' }, { label: '👩‍💼 Hablar con Asesor Humano' }] } },
      
      // Rama 1: Asistente IA Autónomo (Con Memoria)
      { id: 'ai_msg_intro', type: 'message', position: { x: 850, y: 50 }, data: { name: 'Intro IA', text: '¡Excelente! Nuestro Asistente con IA está activo. Puedes preguntarle precios, disponibilidad, detalles de productos o métodos de pago. ¿Qué deseas consultar?' } },
      { id: 'ai_cerebro', type: 'ai', position: { x: 1150, y: 50 }, data: { name: 'Cerebro IA de Ventas', context: 'Somos una tienda con envíos nacionales en 24-48 horas. Aceptamos efectivo contra entrega, tarjetas y transferencia. Garantía de 1 año en todos los artículos.', tone: 'vendedor', strictMode: 'no' } },
      { id: 'menu_ia_retorno', type: 'menu', position: { x: 1450, y: 50 }, data: { name: 'Opciones de Cierre', text: '¿Deseas concretar tu pedido o seguir conversando?', buttons: [{ label: 'Comprar con Asesor Humano' }, { label: 'Hacer otra pregunta a la IA' }] } },
      
      // Rama 2: Catálogo Directo (Sin IA)
      { id: 'media_catalogo', type: 'media', position: { x: 850, y: 250 }, data: { name: 'Descarga de Catálogo', mediaType: 'document', url: 'https://ejemplo.com/catalogo-completo.pdf', fileName: 'catalogo-completo.pdf' } },
      { id: 'msg_post_catalogo', type: 'message', position: { x: 1150, y: 250 }, data: { name: 'Aviso Catálogo', text: '¡Ahí tienes nuestro catálogo completo! Si deseas pedir algún artículo, solo avísanos.' } },
      
      // Rama 3: Asesor Humano
      { id: 'tag_asesor', type: 'tag', position: { x: 850, y: 400 }, data: { name: 'Marcar Asesor', action: 'add', tag: 'atencion-humana' } },
      { id: 'human_atencion', type: 'human', position: { x: 1150, y: 400 }, data: { name: 'Equipo de Ventas' } }
    ],
    edges: [
      { id: 'e_s_m', source: 'start_1', target: 'menu_principal', type: 'smoothstep' },
      // Conexiones de botones del menú principal
      { id: 'e_m_ai', source: 'menu_principal', sourceHandle: '🤖 Asistente Virtual IA (Preguntas y Precios)', target: 'ai_msg_intro', type: 'smoothstep' },
      { id: 'e_m_pdf', source: 'menu_principal', sourceHandle: '📦 Ver Catálogo en PDF (Sin IA)', target: 'media_catalogo', type: 'smoothstep' },
      { id: 'e_m_hum', source: 'menu_principal', sourceHandle: '👩‍💼 Hablar con Asesor Humano', target: 'tag_asesor', type: 'smoothstep' },
      
      // Flujo Rama IA
      { id: 'e_intro_ai', source: 'ai_msg_intro', target: 'ai_cerebro', type: 'smoothstep' },
      { id: 'e_ai_menu', source: 'ai_cerebro', target: 'menu_ia_retorno', type: 'smoothstep' },
      { id: 'e_menu_loop', source: 'menu_ia_retorno', sourceHandle: 'Hacer otra pregunta a la IA', target: 'ai_cerebro', type: 'smoothstep' },
      { id: 'e_menu_compra', source: 'menu_ia_retorno', sourceHandle: 'Comprar con Asesor Humano', target: 'tag_asesor', type: 'smoothstep' },
      
      // Flujo Rama Catálogo
      { id: 'e_pdf_msg', source: 'media_catalogo', target: 'msg_post_catalogo', type: 'smoothstep' },
      
      // Flujo Rama Humano
      { id: 'e_tag_hum', source: 'tag_asesor', target: 'human_atencion', type: 'smoothstep' }
    ]
  }
};
