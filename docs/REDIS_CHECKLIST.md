# ✅ CHECKLIST: Configuración de Upstash Redis

Sigue esta lista paso a paso y marca cada elemento completado.

---

## 📋 PASO 1: Crear Cuenta en Upstash

- [ ] Ir a: https://upstash.com
- [ ] Click en "Sign Up" o "Get Started"
- [ ] Registrarse con GitHub, Google, o Email
- [ ] Confirmar email (si es necesario)
- [ ] Acceder al dashboard

---

## 📋 PASO 2: Crear Database Redis

- [ ] Click en botón **"Create Database"**
- [ ] Configurar:
  - **Name:** `rifx-rate-limiter`
  - **Type:** Regional
  - **Region:** us-east-1 (o más cercano)
  - **Eviction:** noeviction (default)
  - **TLS:** Enabled ✓
  - **Plan:** Free
- [ ] Click en **"Create"**
- [ ] Esperar a que se cree (30 segundos aprox)

---

## 📋 PASO 3: Obtener Credenciales

- [ ] En el dashboard de tu database, buscar pestaña **"REST API"**
  - ⚠️ **IMPORTANTE:** Usar "REST API", NO "Redis"
- [ ] Copiar **UPSTASH_REDIS_REST_URL**
  - Formato: `https://us1-xxxxx-xxxxx.upstash.io`
- [ ] Copiar **UPSTASH_REDIS_REST_TOKEN**
  - Formato: `AYxxxxxxxxxxxxxxxxxxxxxx==`
- [ ] Guardar ambos valores en un lugar seguro (Notepad, etc.)

---

## 📋 PASO 4: Agregar en .env.local (Desarrollo Local)

- [ ] Abrir archivo `.env.local` en tu editor
- [ ] Buscar al final las líneas:
  ```
  UPSTASH_REDIS_REST_URL=PEGAR_AQUI_TU_URL_DE_UPSTASH
  UPSTASH_REDIS_REST_TOKEN=PEGAR_AQUI_TU_TOKEN_DE_UPSTASH
  ```
- [ ] Reemplazar `PEGAR_AQUI_TU_URL_DE_UPSTASH` con tu URL real
- [ ] Reemplazar `PEGAR_AQUI_TU_TOKEN_DE_UPSTASH` con tu TOKEN real
- [ ] **Guardar archivo** (Ctrl+S / Cmd+S)

**Ejemplo:**
```bash
UPSTASH_REDIS_REST_URL=https://us1-neat-ant-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AYlKaS8dxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx==
```

---

## 📋 PASO 5: Agregar en Vercel (Producción)

### Opción A: Vercel Dashboard (Recomendado)

- [ ] Ir a: https://vercel.com/dashboard
- [ ] Seleccionar proyecto **rifx-marketing**
- [ ] Ir a **Settings** → **Environment Variables**

**Primera Variable:**
- [ ] Click en **"Add New"**
- [ ] **Key:** `UPSTASH_REDIS_REST_URL`
- [ ] **Value:** (pegar tu URL de Upstash)
- [ ] **Environments:** Marcar las 3:
  - ✓ Production
  - ✓ Preview
  - ✓ Development
- [ ] Click **"Save"**

**Segunda Variable:**
- [ ] Click en **"Add New"** nuevamente
- [ ] **Key:** `UPSTASH_REDIS_REST_TOKEN`
- [ ] **Value:** (pegar tu TOKEN de Upstash)
- [ ] **Environments:** Marcar las 3:
  - ✓ Production
  - ✓ Preview
  - ✓ Development
- [ ] Click **"Save"**

### Opción B: Vercel CLI (Alternativa)

Si prefieres terminal, ejecuta:

```bash
# Usar el script helper
bash scripts/setup-redis.sh

# O manualmente:
vercel env add UPSTASH_REDIS_REST_URL production
# (pegar URL cuando te lo pida)

vercel env add UPSTASH_REDIS_REST_TOKEN production
# (pegar TOKEN cuando te lo pida)
```

---

## 📋 PASO 6: Verificación

### En Vercel:
- [ ] Ejecutar: `vercel env ls | grep UPSTASH`
- [ ] Debe mostrar:
  ```
  UPSTASH_REDIS_REST_URL    Production, Preview, Development
  UPSTASH_REDIS_REST_TOKEN  Production, Preview, Development
  ```

### En Upstash Dashboard:
- [ ] Ir a tu database en Upstash
- [ ] Ir a pestaña **"Metrics"**
- [ ] Verificar que el gráfico está visible (aunque esté vacío)

---

## 📋 PASO 7: Test Local (Opcional)

- [ ] En tu terminal, ejecutar:
  ```bash
  npm run dev
  ```
- [ ] Abrir: http://localhost:3000/panel
- [ ] Intentar hacer login 6 veces seguidas con credenciales incorrectas
- [ ] El 6to intento debe ser bloqueado con: "Demasiados intentos"
- [ ] ✅ Si bloquea = Redis funciona correctamente

---

## 📋 PASO 8: Deploy a Producción

- [ ] Hacer commit de los cambios:
  ```bash
  git add .env.local
  git commit -m "chore: configure Upstash Redis for rate limiting"
  ```
  
- [ ] Push a producción:
  ```bash
  git push origin main
  ```
  
- [ ] Esperar a que Vercel haga el deploy automático (2-3 min)

---

## 📋 PASO 9: Verificación en Producción

- [ ] Ir a tu sitio en producción
- [ ] Intentar login 6 veces seguidas con datos incorrectos
- [ ] El 6to intento debe bloquear con error 429
- [ ] Verificar en Upstash Dashboard → Metrics
- [ ] Debe mostrar actividad (comandos ejecutados)

---

## ✅ COMPLETADO

Si marcaste todos los items:

- ✅ Redis configurado correctamente
- ✅ Rate limiting funcionando
- ✅ Tu app está lista para producción

---

## 🚨 TROUBLESHOOTING

### "Rate limiter unavailable" en producción

**Causa:** Variables no configuradas en Vercel

**Solución:**
```bash
vercel env ls | grep UPSTASH
# Si no aparecen, agregarlas en Vercel Dashboard
```

### "Invalid URL" o "Connection refused"

**Causa:** Usando URL de Redis en vez de REST API

**Solución:**
- ✅ **CORRECTO:** `https://us1-xxx.upstash.io` (REST API)
- ❌ **INCORRECTO:** `redis://us1-xxx.upstash.io:6379` (Redis URL)

Verifica que usas la pestaña **"REST API"** en Upstash Dashboard.

### Rate limiting no funciona (siempre permite)

**Causa:** Fallback a modo desarrollo (memoria local)

**Solución:**
1. Verificar que las variables están en Vercel
2. Verificar que el formato de URL es correcto
3. Re-deploy después de agregar variables

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas:

1. **Verifica logs de Vercel:**
   ```bash
   vercel logs --follow
   ```

2. **Verifica dashboard de Upstash:**
   - https://console.upstash.com
   - Ir a tu database → Logs

3. **Consulta la guía completa:**
   - [docs/UPSTASH_REDIS_SETUP.md](./UPSTASH_REDIS_SETUP.md)

---

**Tiempo estimado:** 15 minutos  
**Dificultad:** Fácil  
**Costo:** Gratis (plan Free)
