# Row Level Security (RLS) — cómo quedó configurado

## Estado actual

Las 23 tablas canónicas tienen RLS **activado y forzado**. Además, la
migración [`012_enable_rls_lockdown.sql`](migrations/012_enable_rls_lockdown.sql)
revoca los privilegios de tabla a `PUBLIC`, `anon` y `authenticated`, y concede
operaciones de datos explícitamente a `service_role`. La migración
[`013_fix_permissive_policies.sql`](migrations/013_fix_permissive_policies.sql)
elimina las políticas históricas `USING (true)`.

En Postgres, "RLS activado + cero políticas" significa **negar todo acceso por
defecto** a cualquier rol que no sea el dueño de la tabla. Es el equivalente a
un candado sin ninguna llave repartida todavía.

## Por qué no rompe nada

Todo el backend (las rutas `app/api/**`) usa `createSupabaseAdmin()`
(`lib/supabase.ts`), que se conecta con la **Service Role Key**. Ese rol
(`service_role`) **siempre ignora RLS por completo**, sin importar si hay
políticas o no — es una propiedad del rol a nivel de Postgres, no depende de
ninguna configuración adicional. Por eso el panel, el bot de WhatsApp, los
cron jobs, etc. siguen funcionando exactamente igual.

El otro cliente definido en `lib/supabase.ts` (`createSupabaseClient()`, con la
**anon key** pública) está pensado para usarse directamente desde el
navegador — pero **no se usa en ninguna parte del código actual**. Por eso
bloquear el acceso de `anon`/`authenticated` no afecta a la aplicación tal
como está hoy.

## Cómo se verifica

Con la anon key pública (la misma que está incrustada en el JS del sitio),
cualquier consulta a `/rest/v1/<tabla>` debe ser rechazada (`401`/`403`, según
la configuración de PostgREST) o devolver cero filas. **Nunca** debe devolver
datos reales:

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/tenants?select=*&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# → acceso denegado o respuesta sin filas; nunca una fila real
```

## Qué pasó antes de la migración 013 (por qué existen 2 migraciones)

La migración 012 activó RLS, pero varias tablas ya tenían políticas viejas
mal configuradas: se llamaban "Service role full access" pero estaban
asignadas al rol `public` (con `USING (true)`) en vez de al rol
`service_role`. Un nombre que sugería una cosa, pero un rol que en realidad
abría la puerta a cualquiera — incluyendo la anon key. La migración 013
elimina específicamente esas políticas mal asignadas. `service_role` no
necesita ninguna política para funcionar (ver arriba), así que borrarlas fue
seguro.

Pueden quedar definidas unas pocas políticas históricas correctamente
restringidas, pero no conceden acceso directo porque `anon` y `authenticated`
no conservan privilegios de tabla:
- `appointments`, `cron_locks`, `cron_runs`: políticas explícitamente
  limitadas al rol `service_role` (no a `public`).
- `social_accounts`, `social_logs`, `social_posts`, `social_publications`,
  `tenant_members`: políticas que usan `auth.uid()` (autenticación nativa de
  Supabase). Como esta app usa JWT propio (no Supabase Auth), `auth.uid()`
  siempre es `null` para estas peticiones — así que estas políticas hoy no
  conceden acceso a nadie vía anon key, pero quedan listas por si en el
  futuro se conecta Supabase Auth.

## Si en el futuro se necesita acceso directo desde el navegador

Por ejemplo, para reemplazar el polling del panel por Supabase Realtime.
Eso requeriría:

1. Un puente entre el JWT propio (`lib/auth.ts`, firmado con `JWT_SECRET`) y
   el sistema de autenticación de Supabase, para que `auth.uid()`/`auth.jwt()`
   puedan leer el `tenantId` del token de la app.
2. Políticas nuevas, **muy específicas**, con `roles: {authenticated}` (nunca
   `{public}`) y una condición `tenant_id = <tenantId del token>` — probadas
   una por una con una petición real antes de darlas por buenas, igual que
   se hizo para verificar el bloqueo actual.

Esto es un proyecto aparte con superficie de seguridad nueva; no se ha
construido todavía.
