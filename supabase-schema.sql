-- ============================================
-- RIFX Marketing — Tablas de Supabase
-- ============================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

-- 1. Configuración del Bot
CREATE TABLE IF NOT EXISTS config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_token TEXT,
  whatsapp_phone_id TEXT,
  openai_key TEXT,
  payphone_token TEXT,
  payphone_store_id TEXT,
  ai_prompt TEXT DEFAULT 'Eres Nova, un asesor de ventas de RIFX Marketing. Eres amigable, profesional y persuasivo. Tu objetivo es cerrar ventas de servicios de marketing digital. Los servicios disponibles son: Diseño Web Inmersivo ($850), WhatsApp IA ($300), Ecommerce Interestelar ($1200), Anuncios de Alta Velocidad ($500/mes), Diseño UX/UI ($700). Cuando el cliente esté listo para pagar, responde exactamente con [GENERAR_PAGO:monto:servicio] para activar el cobro automático.',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar fila de config por defecto
INSERT INTO config (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- 2. Conversaciones (cada contacto de WhatsApp)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  customer_name TEXT DEFAULT 'Sin nombre',
  status TEXT DEFAULT 'chatting' CHECK (status IN ('chatting', 'interested', 'bought')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar rápido por teléfono
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);

-- 3. Mensajes (cada mensaje individual)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- 4. Ventas
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  amount INTEGER NOT NULL, -- en centavos
  service TEXT NOT NULL,
  payphone_transaction_id TEXT,
  client_transaction_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

-- 5. Habilitar Row Level Security
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir acceso completo al service_role (backend)
CREATE POLICY "Service role full access" ON config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sales FOR ALL USING (true) WITH CHECK (true);
