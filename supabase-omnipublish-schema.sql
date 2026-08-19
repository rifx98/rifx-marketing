-- ============================================
-- RIFX Marketing — Sistema OmniPublish V1 (Meta Reels)
-- ============================================
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query

-- 0. Habilitar extensión UUID si no está
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de miembros de tenants (Vínculo entre usuarios físicos de Supabase Auth y la cuenta Tenant de RIFX)
CREATE TABLE IF NOT EXISTS tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);

-- 2. Cuentas de Redes Sociales Vinculadas por los Tenants (Limitado a Meta V1)
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'google_calendar')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  profile_picture_url TEXT,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, platform, platform_user_id)
);

-- 3. Entradas de Posts (Videos subidos y metadatos)
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  caption TEXT NOT NULL,
  video_storage_path TEXT NOT NULL,
  video_public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Publicaciones específicas por canal (Reels de Instagram / Reels de Facebook)
CREATE TABLE IF NOT EXISTS social_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE NOT NULL,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  external_media_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Logs detallados para auditoría de errores por publicación
CREATE TABLE IF NOT EXISTS social_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID REFERENCES social_publications(id) ON DELETE CASCADE NOT NULL,
  log_level TEXT DEFAULT 'info' CHECK (log_level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_social_accounts_tenant ON social_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant ON social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_publications_post ON social_publications(post_id);
CREATE INDEX IF NOT EXISTS idx_social_publications_status ON social_publications(status);
CREATE INDEX IF NOT EXISTS idx_social_logs_publication ON social_logs(publication_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS seguras utilizando la tabla tenant_members
CREATE POLICY "Users can view their own memberships" ON tenant_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Members can manage their social accounts" ON social_accounts
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage their social posts" ON social_posts
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage their publications" ON social_publications
  FOR ALL USING (
    post_id IN (
      SELECT id FROM social_posts WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can view their social logs" ON social_logs
  FOR SELECT USING (
    publication_id IN (
      SELECT id FROM social_publications WHERE post_id IN (
        SELECT id FROM social_posts WHERE tenant_id IN (
          SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Permitir acceso completo al service_role (backend de Next.js)
CREATE POLICY "Service role full access tenant_members" ON tenant_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access social_accounts" ON social_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access social_posts" ON social_posts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access social_publications" ON social_publications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access social_logs" ON social_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
