# 🚀 Configuración de Upstash Redis (CRÍTICO para Producción)

## ⚠️ IMPORTANTE
Sin Redis configurado, **tu aplicación NO funcionará en producción**:
- ❌ Login/Register fallan con error 503
- ❌ Phone OTP no se puede enviar
- ❌ Sin protección contra brute-force
- ❌ Sin rate limiting distribuido

**Tiempo estimado:** 15 minutos

---

## 📋 Paso 1: Crear cuenta en Upstash

1. Ve a: https://upstash.com
2. Haz clic en **Sign Up**
3. Opciones de registro:
   - GitHub (recomendado - más rápido)
   - Google
   - Email

---

## 📋 Paso 2: Crear base de datos Redis

1. Una vez dentro, haz clic en **Create Database**

2. Configuración:
   ```
   Name: rifx-rate-limiter
   Type: Regional
   Region: US-EAST-1 (o el más cercano a tu Vercel region)
   Primary Region: us-east-1
   Eviction: (dejar por defecto)
   TLS: Enabled (default)
   ```

3. Plan:
   - **Free tier** es suficiente para empezar
   - Incluye: 10,000 comandos/día
   - Para producción: considera **Pay as you go** ($0.20 por 100k comandos)

4. Haz clic en **Create**

---

## 📋 Paso 3: Obtener credenciales

Después de crear la base de datos:

1. Ve a la pestaña **REST API** (NO usar Redis, usar REST)
2. Verás dos valores:

   ```
   UPSTASH_REDIS_REST_URL
   https://us1-fleet-ant-12345.upstash.io
   
   UPSTASH_REDIS_REST_TOKEN
   AXXXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQQ==
   ```

3. **Copia ambos valores** - los necesitarás en el siguiente paso

---

## 📋 Paso 4: Agregar en Vercel

### Opción A: Dashboard de Vercel (Recomendado)

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto **rifx-marketing**
3. Ve a **Settings** → **Environment Variables**
4. Agrega las dos variables:

   **Primera variable:**
   ```
   Key: UPSTASH_REDIS_REST_URL
   Value: https://us1-fleet-ant-12345.upstash.io
   Environment: Production, Preview, Development (marcar todas)
   ```

   **Segunda variable:**
   ```
   Key: UPSTASH_REDIS_REST_TOKEN
   Value: AXXXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQQ==
   Environment: Production, Preview, Development (marcar todas)
   ```

5. Haz clic en **Save** en cada una

### Opción B: CLI de Vercel

```bash
# Desde tu terminal
cd /ruta/a/tu/proyecto

# Agregar UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_URL production
# Pegar el valor cuando te lo pida

# Agregar UPSTASH_REDIS_REST_TOKEN
vercel env add UPSTASH_REDIS_REST_TOKEN production
# Pegar el valor cuando te lo pida

# También agregar para preview y development
vercel env add UPSTASH_REDIS_REST_URL preview
vercel env add UPSTASH_REDIS_REST_TOKEN preview
```

---

## 📋 Paso 5: Agregar en .env.local (Desarrollo)

Para trabajar localmente con Redis:

```bash
# Edita .env.local y agrega al final:

# -- Upstash Redis (Rate Limiting) --
UPSTASH_REDIS_REST_URL=https://us1-fleet-ant-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQQ==
```

---

## 📋 Paso 6: Re-deploy a producción

Después de agregar las variables en Vercel:

```bash
# Opción A: Trigger redeploy desde Vercel Dashboard
# Ve a Deployments → Click en los 3 puntos → Redeploy

# Opción B: Hacer un commit vacío
git commit --allow-empty -m "chore: trigger redeploy with Redis config"
git push origin main

# Opción C: Deploy manual
vercel --prod
```

---

## ✅ Paso 7: Verificar que funciona

### Test 1: Verificar variables en Vercel

```bash
vercel env ls

# Deberías ver:
# UPSTASH_REDIS_REST_URL   Production, Preview, Development
# UPSTASH_REDIS_REST_TOKEN Production, Preview, Development
```

### Test 2: Probar rate limiting

Una vez deployado:

```bash
# Intentar login 6 veces seguidas (límite es 5)
for i in {1..6}; do 
  curl -X POST https://tu-dominio.vercel.app/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test123"}'
  echo ""
done

# El 6to request debe devolver:
# {"error":"Demasiados intentos..."}
# Status: 429
```

### Test 3: Verificar en logs de Upstash

1. Ve a Upstash Dashboard
2. Selecciona tu database
3. Ve a **Logs** o **Metrics**
4. Deberías ver actividad después de hacer requests a tu API

---

## 📊 Monitoreo

### Ver uso en Upstash

1. Dashboard → Tu database
2. **Metrics** tab:
   - Commands/day
   - Bandwidth
   - Storage usage

### Alertas recomendadas

Si superas el plan Free:
- 8,000 comandos/día → Considera upgrade
- 10,000 comandos/día → Límite alcanzado

---

## 🔧 Troubleshooting

### Error: "Rate limiter unavailable" en producción

**Causa:** Variables no configuradas o mal copiadas

**Solución:**
1. Verifica en Vercel Settings → Environment Variables
2. Asegúrate de que los valores NO tengan espacios extras
3. Re-deploy después de agregar/editar

### Error: "Invalid URL" o "Connection refused"

**Causa:** Usando URL de conexión Redis en vez de REST API

**Solución:**
- ✅ **CORRECTO:** `https://us1-xxx.upstash.io` (REST API URL)
- ❌ **INCORRECTO:** `redis://us1-xxx.upstash.io:6379` (Redis URL)

Usa la URL de **REST API**, no la de Redis.

### Rate limiting no funciona (siempre permite)

**Causa:** Fallback a modo desarrollo (memoria local)

**Solución:**
```bash
# Verificar que las variables están en producción
vercel env ls

# Si no están, agregarlas:
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
```

### Desarrollo local no funciona

**Causa:** Variables no en `.env.local`

**Solución:**
```bash
# Agregar en .env.local:
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Reiniciar servidor
npm run dev
```

---

## 💰 Costos

### Plan Free (Recomendado para empezar)
- **10,000 comandos/día** gratis
- **256 MB** storage
- **TLS/SSL** incluido
- Sin tarjeta de crédito requerida

**Estimación de uso:**
- 1 login = 2 comandos (INCR + EXPIRE)
- 100 logins/día = 200 comandos
- 500 logins/día = 1,000 comandos ✅ Dentro del free tier

### Plan Pay-as-you-go
- **$0.20 por 100,000 comandos**
- Sin límite diario
- Facturación mensual

**Estimación de costos:**
- 50,000 comandos/mes = **$0.10**
- 500,000 comandos/mes = **$1.00**
- 5,000,000 comandos/mes = **$10.00**

---

## 🎯 Siguiente Paso

Una vez configurado Redis:

✅ Tu aplicación estará lista para producción  
✅ Rate limiting funcionará correctamente  
✅ Login/Register/Phone OTP funcionarán  
✅ Protección contra brute-force activa

**Continúa con:** [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs de Vercel: https://vercel.com/[tu-proyecto]/logs
2. Revisa los logs de Upstash Dashboard
3. Verifica que las URLs no tengan espacios o caracteres extra
4. Asegúrate de usar REST API URL (no Redis URL)

---

**Última actualización:** 2026-08-18  
**Configuración obligatoria para:** Producción  
**Tiempo estimado:** 15 minutos
