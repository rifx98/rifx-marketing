const { createClient } = require('@supabase/supabase-js');
const { jwtVerify } = require('jose');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// We'll simulate the backend logic of our export route using the real tenant ID
const tenantId = '26db5d82-84e2-4af5-9458-add284631021';

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getEcuadorDepartment(city) {
  const c = city.toLowerCase().trim();
  if (c.includes('quito') || c.includes('sangolqui') || c.includes('ruminahui')) return 'Pichincha';
  if (c.includes('guayaquil') || c.includes('milagro') || c.includes('daule') || c.includes('samborondon') || c.includes('duran')) return 'Guayas';
  if (c.includes('cuenca')) return 'Azuay';
  if (c.includes('manta') || c.includes('portoviejo') || c.includes('chone') || c.includes('el carmen') || c.includes('montecristi')) return 'Manabí';
  if (c.includes('santo domingo')) return 'Santo Domingo de los Tsáchilas';
  if (c.includes('machala') || c.includes('pasaje') || c.includes('santa rosa') || c.includes('huaquillas')) return 'El Oro';
  if (c.includes('loja')) return 'Loja';
  if (c.includes('ambato')) return 'Tungurahua';
  if (c.includes('esmeraldas')) return 'Esmeraldas';
  if (c.includes('quevedo') || c.includes('babahoyo')) return 'Los Ríos';
  if (c.includes('riobamba')) return 'Chimborazo';
  if (c.includes('ibarra')) return 'Imbabura';
  if (c.includes('santa elena') || c.includes('la libertad') || c.includes('salinas')) return 'Santa Elena';
  if (c.includes('tulcan')) return 'Carchi';
  if (c.includes('nueva loja') || c.includes('lago agrio')) return 'Sucumbíos';
  if (c.includes('tena')) return 'Napo';
  if (c.includes('puyo')) return 'Pastaza';
  if (c.includes('macas')) return 'Morona Santiago';
  if (c.includes('zamora')) return 'Zamora Chinchipe';
  if (c.includes('puerto baquerizo') || c.includes('galapagos') || c.includes('santa cruz')) return 'Galápagos';
  if (c.includes('latacunga')) return 'Cotopaxi';
  if (c.includes('guaranda')) return 'Bolívar';
  if (c.includes('azogues')) return 'Cañar';
  if (c.includes('francisco de orellana') || c.includes('coca')) return 'Orellana';
  return city.charAt(0).toUpperCase() + city.slice(1);
}

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    realtime: {
      transport: {
        send: () => {},
        close: () => {}
      }
    }
  });

  // 1. Fetch tenant config row
  const { data: config } = await supabase
    .from('config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  let extConfig = {
    openai_key: '', gemini_key: '', groq_key: '',
    dropi_default_product_id: '', dropi_default_price: 50
  };
  try {
    const p = JSON.parse(config?.openai_key || '{}');
    extConfig = { ...extConfig, ...p };
  } catch {
    extConfig.openai_key = config?.openai_key || '';
  }

  // Resolve API key for LLM fallback
  let groqKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
  let openAiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

  console.log('Using Keys:', {
    groqKey: groqKey ? 'present' : 'absent',
    openAiKey: openAiKey ? 'present' : 'absent'
  });

  // 2. Fetch all conversations for the tenant
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', tenantId);

  console.log(`Found ${conversations ? conversations.length : 0} conversations.`);
  if (!conversations || conversations.length === 0) {
    return;
  }

  // 3. Fetch messages for all these conversations
  const convIds = conversations.map(c => c.id);
  const { data: allMessages } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true });

  console.log(`Found ${allMessages ? allMessages.length : 0} total messages.`);

  const messagesByConv = {};
  (allMessages || []).forEach(m => {
    if (!messagesByConv[m.conversation_id]) {
      messagesByConv[m.conversation_id] = [];
    }
    messagesByConv[m.conversation_id].push(m);
  });

  const orders = [];
  const client = (groqKey || openAiKey) ? new OpenAI({
    apiKey: groqKey || openAiKey,
    baseURL: groqKey ? 'https://api.groq.com/openai/v1' : undefined
  }) : null;

  // 4. Process each conversation
  for (const conv of conversations) {
    const msgs = messagesByConv[conv.id] || [];
    
    // Check if there is an existing __ORDER_DATA__ message
    let orderMsg = msgs.find(m => m.content?.startsWith('__ORDER_DATA__:'));
    let orderDetails = null;

    if (orderMsg) {
      const jsonStr = orderMsg.content.substring('__ORDER_DATA__:'.length);
      if (jsonStr !== 'null') {
        try {
          orderDetails = JSON.parse(jsonStr);
          console.log(`Found cached order for ${conv.customer_name}:`, orderDetails);
        } catch (e) {
          console.error('Failed to parse order json from message:', e);
        }
      } else {
        console.log(`Skipping conversation ${conv.customer_name} (cached as no order).`);
        continue;
      }
    } else if (conv.status === 'interested' || conv.status === 'bought') {
      console.log(`Conversation for ${conv.customer_name} is in status ${conv.status} but has no cached order.`);
      // Fallback: Use LLM to extract order if we have a client
      if (client) {
        // Format transcript
        const transcript = msgs
          .filter(m => m.content && !m.content.startsWith('__'))
          .map(m => `${m.role === 'assistant' ? 'Asistente' : 'Cliente'}: ${m.content}`)
          .join('\n');

        if (transcript.length > 50) {
          try {
            console.log(`Extracting order via LLM for conversation ${conv.id}...`);
            const completion = await client.chat.completions.create({
              model: groqKey ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Extract customer shipping order details from the conversation history.
We need the following details in JSON format:
{
  "name": "Customer complete name",
  "phone": "Phone number",
  "address": "Street address and neighborhood",
  "city": "City",
  "product_id": "Product ID (optional)",
  "quantity": 1,
  "price": 50,
  "payment_type": "contra_entrega or anticipado"
}
Rules:
- The fields "name", "phone", "address", and "city" must be extracted from the conversation text. If any of these are missing, return null.
- If no order shipping details are present in the conversation, return null.
- Return ONLY valid JSON or the word "null" (if no order is present). Do not explain or include markdown.`
                },
                {
                  role: 'user',
                  content: `Here is the conversation:\n${transcript}`
                }
              ],
              max_tokens: 300,
              temperature: 0.1
            });

            const text = completion.choices[0]?.message?.content?.trim() || 'null';
            console.log(`LLM Response for ${conv.customer_name}:`, text);
            if (text !== 'null' && text.startsWith('{')) {
              try {
                orderDetails = JSON.parse(text);
                // Cache it in messages table
                const { error: insErr } = await supabase.from('messages').insert({
                  conversation_id: conv.id,
                  role: 'assistant',
                  content: `__ORDER_DATA__:${JSON.stringify(orderDetails)}`,
                  tenant_id: tenantId
                });
                if (insErr) console.error('Insert error:', insErr);
                else console.log(`Successfully cached order in DB for ${conv.customer_name}`);
              } catch (pe) {
                console.error('Failed to parse LLM JSON:', text, pe);
              }
            } else {
              // Cache that there is no order
              const { error: insErr } = await supabase.from('messages').insert({
                conversation_id: conv.id,
                role: 'assistant',
                content: `__ORDER_DATA__:null`,
                tenant_id: tenantId
              });
              if (insErr) console.error('Insert error:', insErr);
              else console.log(`Cached as no order in DB for ${conv.customer_name}`);
            }
          } catch (llmErr) {
            console.error('LLM order extraction failed:', llmErr);
          }
        }
      }
    }

    if (orderDetails) {
      orders.push({
        ...orderDetails,
        customer_name: orderDetails.name || conv.customer_name || 'Cliente',
        phone_number: orderDetails.phone || conv.phone_number || ''
      });
    }
  }

  // 5. Generate CSV
  const csvHeaders = [
    'NOMBRES',
    'APELLIDOS',
    'DIRECCIÓN Y BARRIO',
    'DEPARTAMENTO',
    'CIUDAD',
    'TELÉFONO',
    'ID PRODUCTO',
    'CANTIDAD',
    'PRECIO TOTAL (SIN PUNTOS NI COMAS)',
    'CON RECAUDO',
    'NOTA',
    'EMAIL (OPCIONAL)',
    'ID DE VARIABLE (OPCIONAL)',
    'CODIGO POSTAL (OPCIONAL)',
    'TRANSPORTADORA (OPCIONAL)',
    'CEDULA (OPCIONAL)',
    'COLONIA (OBLIGATORIO SOLO PARA QUIKEN)',
    'SEGURO (SOLO APLICA PARA ENVIA)'
  ];

  const csvRows = orders.map(order => {
    // Split names into NOMBRES and APELLIDOS
    const nameParts = (order.customer_name || '').trim().split(/\s+/);
    const nombres = nameParts[0] || 'Cliente';
    const apellidos = nameParts.slice(1).join(' ') || '.';

    // Resolve city and department
    const ciudad = order.city || 'Quito';
    const departamento = order.departamento || getEcuadorDepartment(ciudad);

    // Clean phone number (remove code prefix if present, but Dropi Ecuador accepts local numbers)
    let phone = (order.phone_number || order.phone || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('593')) {
      phone = '0' + phone.substring(3);
    }

    // Default product and pricing
    const productId = order.product_id || extConfig.dropi_default_product_id || 'DEFAULT_PRODUCT';
    const quantity = order.quantity || 1;
    const unitPrice = order.price || extConfig.dropi_default_price || 50;
    const totalPrice = quantity * unitPrice;

    // Recaudo: cash on delivery (contra_entrega) -> "Si", prepaid -> "No"
    const conRecaudo = (order.payment_type === 'contra_entrega' || !order.payment_type) ? 'Si' : 'No';

    const nota = `Pedido WhatsApp - Ref ${productId}`;

    return [
      escapeCsv(nombres),
      escapeCsv(apellidos),
      escapeCsv(order.address || 'Direccion de entrega'),
      escapeCsv(departamento),
      escapeCsv(ciudad),
      escapeCsv(phone),
      escapeCsv(productId),
      escapeCsv(quantity),
      escapeCsv(Math.round(totalPrice)),
      escapeCsv(conRecaudo),
      escapeCsv(nota),
      '', // EMAIL
      '', // ID DE VARIABLE
      '', // CODIGO POSTAL
      '', // TRANSPORTADORA
      '', // CEDULA
      '', // COLONIA
      ''  // SEGURO
    ].join(',');
  });

  const csvContent = [csvHeaders.join(','), ...csvRows].join('\r\n');
  const outPath = path.join(__dirname, 'test_export.csv');
  fs.writeFileSync(outPath, '\ufeff' + csvContent, 'utf8');
  console.log(`CSV written to: ${outPath}`);
  console.log(`Rows: ${csvRows.length}`);
}

run().catch(console.error);
