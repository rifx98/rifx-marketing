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
      { id: 'ai_1', type: 'ai', position: { x: 800, y: 150 }, data: { name: 'Asesor IA (Calificador)' } },
      { id: 'tag_1', type: 'tag', position: { x: 1100, y: 150 }, data: { name: 'Marcar como Lead', action: 'add', tag: 'lead-potencial-ia' } },
      { id: 'human_1', type: 'human', position: { x: 1400, y: 150 }, data: { name: 'Vendedor' } }
    ],
    edges: [
      { id: 'e_s_1', source: 'start_1', target: 'msg_1', type: 'smoothstep' },
      { id: 'e_m_1', source: 'msg_1', target: 'ai_1', type: 'smoothstep' },
      { id: 'e_a_t', source: 'ai_1', target: 'tag_1', type: 'smoothstep' },
      { id: 'e_t_h', source: 'tag_1', target: 'human_1', type: 'smoothstep' }
    ]
  },
  ia_recomendacion_ventas: {
    name: 'Recomendador de Productos',
    nodes: [
      { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} },
      { id: 'msg_1', type: 'message', position: { x: 500, y: 150 }, data: { name: 'Bienvenida', text: '¡Hola! Soy tu personal shopper virtual. ¿Estás buscando algo para regalo, tecnología, moda o tienes algo en mente?' } },
      { id: 'ai_1', type: 'ai', position: { x: 800, y: 150 }, data: { name: 'Motor de Recomendaciones IA' } },
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
  }
};
