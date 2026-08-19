# ✅ Checklist de Deploy a Producción

## 🎯 ANTES DE HACER DEPLOY

### Seguridad Crítica
- [ ] **Upstash Redis configurado** ([ver guía](./UPSTASH_REDIS_SETUP.md))
  ```bash
  vercel env ls | grep UPSTASH_REDIS
  # Debe mostrar ambas variables en Production
  ```
- [ ] **JWT_SECRET configurado** (mínimo 32 caracteres)
  ```bash
  vercel env ls | grep JWT_SECRET
  ```
- [ ] **CRON_SECRET configurado**
  ```bash
  vercel env ls | grep CRON_SECRET
  ```
- [ ] **ENCRYPTION_KEY configurado**
  ```bash
  vercel env ls | grep ENCRYPTION_KEY
  ```

### Twilio/Phone Auth (Si vas a usar Phone Auth)
- [ ] **Cuenta de Twilio creada**
- [ ] **Número de teléfono comprado**
- [ ] **Variables de Twilio en Vercel:**
  ```bash
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE_NUMBER
  ```
- [ ] **Phone Auth habilitado en Supabase Dashboard**
- [ ] **Migración SQL ejecutada** (campos phone en tabla tenants)

### Supabase
- [ ] **SUPABASE_SERVICE_ROLE_KEY en Vercel**
- [ ] **Phone Auth provider configurado en Supabase** (si aplica)
- [ ] **RLS policies verificadas**

### Variables de Entorno
- [ ] **Todas las variables requeridas en Vercel:**
  ```bash
  # Core
  JWT_SECRET
  ENCRYPTION_KEY
  CRON_SECRET
  
  # Supabase
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  
  # Rate Limiting (CRÍTICO)
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  
  # WhatsApp
  WHATSAPP_TOKEN
  WHATSAPP_PHONE_NUMBER_ID
  WHATSAPP_APP_SECRET
  
  # AI
  GROQ_API_KEY
  FAL_KEY
  
  # Payments
  LEMONSQUEEZY_API_KEY
  LEMONSQUEEZY_WEBHOOK_SECRET
  
  # Optional
  OPENAI_API_KEY (si lo usas)
  TOGETHER_API_KEY
  ```

### Build & Testing
- [ ] **Build local exitoso:**
  ```bash
  npm run build
  # Debe completar sin errores críticos
  ```
- [ ] **No hay secrets hardcodeados:**
  ```bash
  grep -r "sk-proj-\|gsk_\|eyJ" app/ components/ lib/ --include="*.ts" --include="*.tsx"
  # No debe encontrar API keys reales
  ```
- [ ] **Tests pasan** (si tienes tests)

---

## 🚀 DURANTE EL DEPLOY

### Deploy a Vercel

```bash
# Opción 1: Push a main (auto-deploy)
git add .
git commit -m "feat: production-ready with security improvements"
git push origin main

# Opción 2: Deploy manual
vercel --prod

# Opción 3: Dashboard de Vercel
# Settings → Git → Deploy
```

### Monitorear el Deploy

1. Ve a: https://vercel.com/[tu-proyecto]/deployments
2. Click en el deployment más reciente
3. Espera a que diga **"Ready"**
4. Revisa **Build Logs** si hay errores

---

## ✅ DESPUÉS DEL DEPLOY

### Verificación Básica

- [ ] **Sitio carga correctamente:**
  ```bash
  curl -I https://tu-dominio.vercel.app
  # Status: 200 OK
  ```

- [ ] **Headers de seguridad presentes:**
  ```bash
  curl -I https://tu-dominio.vercel.app | grep -E "Strict-Transport-Security|X-Frame-Options|Content-Security-Policy"
  ```

### Test de Autenticación

- [ ] **Login con email funciona**
  ```bash
  curl -X POST https://tu-dominio.vercel.app/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrongpassword"}'
  # Debe devolver error, NO 503 (service unavailable)
  ```

- [ ] **Rate limiting funciona** (debe bloquear después de 5 intentos)
  ```bash
  for i in {1..6}; do 
    curl -X POST https://tu-dominio.vercel.app/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@test.com","password":"test"}'
    echo ""
  done
  # El 6to debe devolver: 429 Too Many Requests
  ```

- [ ] **Phone OTP funciona** (si configurado)
  1. Ve a `/panel`
  2. Click en "Número de teléfono"
  3. Ingresa tu número
  4. Debe recibir SMS en ~5 segundos

### Test de APIs Críticas

- [ ] **GET /api/auth/me funciona**
- [ ] **POST /api/panel/config funciona** (con JWT válido)
- [ ] **Webhooks configurados:**
  - [ ] LemonSqueezy webhook URL
  - [ ] WhatsApp webhook URL (si aplica)

### Monitoreo

- [ ] **Configurar alertas en Vercel:**
  - Settings → Integrations → Slack/Discord (opcional)
  - Alertas para errores 500

- [ ] **Verificar logs en tiempo real:**
  ```bash
  vercel logs --follow
  ```

- [ ] **Upstash Redis muestra actividad:**
  - Dashboard → Tu database → Metrics
  - Debe mostrar comandos ejecutándose

### Performance

- [ ] **Lighthouse Score:**
  - Abre Chrome DevTools
  - Run Lighthouse audit
  - Objetivo: >80 en Performance, >90 en Security

- [ ] **Tiempo de carga < 3 segundos:**
  ```bash
  curl -o /dev/null -s -w "Time: %{time_total}s\n" https://tu-dominio.vercel.app
  ```

---

## 🔥 SI ALGO FALLA

### Error 503: Service Unavailable en /api/auth/*

**Causa:** Redis no configurado

**Solución:**
```bash
# Verificar variables
vercel env ls | grep UPSTASH

# Si no están, agregarlas
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production

# Redeploy
vercel --prod
```

### Error 500: Internal Server Error

**Causa:** Falta alguna variable de entorno crítica

**Solución:**
```bash
# Ver logs
vercel logs --follow

# Buscar errores como:
# "JWT_SECRET environment variable is not set"
# "Cannot connect to Supabase"

# Agregar variable faltante
vercel env add [VARIABLE_NAME] production
```

### Phone OTP no llega

**Causa:** Twilio no configurado o sin crédito

**Solución:**
1. Verificar saldo en Twilio: https://console.twilio.com/billing
2. Verificar logs de SMS: https://console.twilio.com/monitor/logs/sms
3. Verificar variables en Vercel:
   ```bash
   vercel env ls | grep TWILIO
   ```

### Rate limiting no funciona

**Causa:** Redis URL incorrecta

**Solución:**
- Verificar que uses la URL de **REST API** (no Redis URL)
- ✅ Correcto: `https://us1-xxx.upstash.io`
- ❌ Incorrecto: `redis://us1-xxx.upstash.io:6379`

### Build falla

**Causa:** Errores de TypeScript o dependencias

**Solución:**
```bash
# Local build para ver el error exacto
npm run build

# Limpiar caché
rm -rf .next node_modules
npm install
npm run build
```

---

## 🔄 ROLLBACK (Si todo falla)

### Opción 1: Rollback en Vercel Dashboard

1. Ve a: https://vercel.com/[tu-proyecto]/deployments
2. Encuentra el último deployment estable
3. Click en los **3 puntos** → **Promote to Production**

### Opción 2: CLI

```bash
# Ver deployments
vercel list

# Rollback al anterior
vercel rollback
```

### Opción 3: Git

```bash
# Revertir último commit
git revert HEAD
git push origin main
```

---

## 📊 POST-DEPLOY MONITORING

### Primer día
- [ ] Revisar logs cada 2 horas
- [ ] Verificar rate de errores en Vercel Analytics
- [ ] Monitorear uso de Redis en Upstash
- [ ] Verificar que webhooks funcionan

### Primera semana
- [ ] Revisar Vercel Analytics diariamente
- [ ] Verificar costos de Twilio (si aplica)
- [ ] Verificar logs de errores
- [ ] Feedback de primeros usuarios

### Primer mes
- [ ] Análisis de performance
- [ ] Optimizaciones basadas en métricas reales
- [ ] Considerar upgrade de Redis si es necesario
- [ ] Revisar límites de rate limiting

---

## 🎯 MÉTRICAS DE ÉXITO

### Disponibilidad
- **Uptime target:** >99.5% (permitir ~3.6 horas downtime/mes)
- **Response time:** <500ms (p95)
- **Error rate:** <1%

### Seguridad
- **Rate limiting activo:** Bloqueando ataques
- **Sin exposición de secrets:** Verificar logs
- **HTTPS enforced:** Todos los requests

### Performance
- **Lighthouse Score:** >80
- **Time to First Byte:** <200ms
- **Bundle size:** <500KB (initial load)

---

## 📚 RECURSOS ÚTILES

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Upstash Dashboard:** https://console.upstash.com
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Twilio Dashboard:** https://console.twilio.com

**Logs en tiempo real:**
```bash
vercel logs --follow
vercel logs --since=1h
```

**Environment variables:**
```bash
vercel env ls
vercel env pull .env.production
```

---

## ✅ CHECKLIST FINAL

Antes de considerar el deploy completado:

- [ ] Sitio accesible en producción
- [ ] Login/Register funcionan
- [ ] Rate limiting activo
- [ ] Phone Auth funciona (si aplica)
- [ ] WhatsApp conectado (si aplica)
- [ ] Payments funcionan (si aplica)
- [ ] Logs limpios (sin errores críticos)
- [ ] Monitoring configurado
- [ ] Backup plan definido

---

**¡Felicidades! Tu aplicación está en producción de forma segura** 🎉

**Siguiente paso:** Monitorear y optimizar basándose en métricas reales.

---

**Última actualización:** 2026-08-18  
**Versión:** 1.0.0
