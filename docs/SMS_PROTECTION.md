# 🛡️ PROTECCIÓN ANTI-ABUSO DE SMS - Twilio Crédito Gratis

## ✅ IMPLEMENTADO EXITOSAMENTE

Tu aplicación ahora tiene **3 capas de protección** para evitar que abusen de tu crédito gratis de Twilio.

---

## 🔒 PROTECCIONES ACTIVAS

### Capa 1: Límite Global Diario 🌍
```typescript
DAILY_SMS_LIMIT=20  // Solo 20 SMS por día en toda la app
```

**Protege contra:**
- Atacantes que intentan enviar 1000+ SMS
- Bots automatizados
- Spam masivo

**Cómo funciona:**
```
SMS 1-20:  ✅ Permitidos
SMS 21+:   ❌ "Límite diario de SMS alcanzado. Intenta mañana."
```

**Reseteo:** Cada medianoche (00:00)

---

### Capa 2: Rate Limiting por IP 🌐
```typescript
Producción: 2 SMS cada 15 minutos por IP
Desarrollo: 3 SMS cada 5 minutos por IP
```

**Protege contra:**
- Un atacante desde una sola IP
- Scripts automatizados

**Ejemplo:**
```
IP 123.45.67.89:
  12:00 → Envía SMS ✅
  12:05 → Envía SMS ✅
  12:10 → Envía SMS ❌ "Demasiados intentos"
  12:15 → (reset) Puede enviar de nuevo ✅
```

---

### Capa 3: Rate Limiting por Número 📱
```typescript
Producción: 2 SMS cada 15 minutos por número
Desarrollo: 3 SMS cada 5 minutos por número
```

**Protege contra:**
- Alguien intentando spamear el mismo número
- Múltiples IPs atacando un número

**Ejemplo:**
```
+593984123456:
  12:00 → SMS enviado ✅
  12:05 → SMS enviado ✅
  12:10 → Bloqueado ❌ "Demasiados intentos para este numero"
  12:15 → (reset) Disponible de nuevo ✅
```

---

## 💰 DURACIÓN DEL CRÉDITO GRATIS

### Con límite de 20 SMS/día:

```
Crédito gratis:     $15.50 USD
Costo por SMS:      $0.0079 USD
SMS disponibles:    1,900 SMS

Con límite de 20/día:
├── 20 SMS/día × 30 días = 600 SMS/mes
├── 1,900 SMS ÷ 600 = 3.16 meses
└── Duración: ~3 meses ✅
```

### Sin límite (PELIGRO):
```
Un atacante podría gastar todo en 1 hora:
├── 1,900 SMS / 60 min = 31 SMS/min
└── Tu crédito: $0 en minutos ❌
```

---

## 📊 MONITOREO DE USO

### Endpoint de estadísticas (Solo Admins):

```bash
GET /api/admin/sms-stats
```

**Respuesta:**
```json
{
  "today": {
    "date": "2026-08-18",
    "count": 15,
    "limit": 20,
    "remaining": 5,
    "percentage": 75
  },
  "costs": {
    "today": "$0.12 USD",
    "projectedMonthly": "$3.60 USD",
    "perSms": "$0.0079 USD"
  },
  "limits": {
    "perIp": "2 SMS / 15 min",
    "perPhone": "2 SMS / 15 min",
    "globalDaily": "20 SMS / día"
  },
  "twilioCredit": {
    "initial": "$15.50 USD",
    "smsAvailable": 1962,
    "daysRemaining": 98
  }
}
```

---

## ⚙️ CONFIGURACIÓN

### Variables en .env.local:

```bash
# Límite diario global (ajustable)
DAILY_SMS_LIMIT=20

# Credenciales de Twilio (cuando estés listo)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

### Ajustar límite diario:

```bash
# Muy restrictivo (testing)
DAILY_SMS_LIMIT=5

# Normal (recomendado)
DAILY_SMS_LIMIT=20

# Generoso (si tienes muchos usuarios)
DAILY_SMS_LIMIT=50

# Sin límite (NO RECOMENDADO)
DAILY_SMS_LIMIT=999999
```

---

## 📈 ESCENARIOS DE USO

### Escenario 1: Desarrollo/Testing
```bash
DAILY_SMS_LIMIT=5  # Solo 5 SMS/día para tus pruebas
Duración del crédito: ~1 año ✅
```

### Escenario 2: Lanzamiento Suave (pocos usuarios)
```bash
DAILY_SMS_LIMIT=20  # 20 SMS/día
Duración del crédito: ~3 meses ✅
Soporta: ~600 registros en 3 meses
```

### Escenario 3: Crecimiento (usuarios activos)
```bash
DAILY_SMS_LIMIT=50  # 50 SMS/día
Duración del crédito: ~38 días
Soporta: ~1,500 registros/mes
Después: Comprar plan de Twilio ($20-30/mes)
```

---

## 🎯 ESTRATEGIA RECOMENDADA

### Fase 1: Testing (Ahora)
```
✅ NO configures Twilio todavía
✅ Usa solo Email/Password + Google
✅ Guarda los $15.50 para producción
```

### Fase 2: Lanzamiento Beta
```
✅ Configura Twilio
✅ DAILY_SMS_LIMIT=10
✅ Invita solo usuarios de confianza
✅ Monitorea /api/admin/sms-stats diariamente
```

### Fase 3: Producción
```
✅ Aumenta a DAILY_SMS_LIMIT=20
✅ Monitorea semanalmente
✅ Cuando llegues a ~50 usuarios/día → Compra plan Twilio
```

---

## 🚨 ALERTAS AUTOMÁTICAS (Próximamente)

Puedes agregar alertas cuando:

```typescript
// lib/sms-limiter.ts - línea ~50
if (dailyCounter.count > DAILY_SMS_LIMIT * 0.8) {
  // Alerta: 80% del límite alcanzado
  // Enviar email/notificación al admin
}
```

---

## ⚡ ALTERNATIVAS SIN PAGO MENSUAL

Si NO quieres pagar número de teléfono mensual ($1.15/mes):

### Opción 1: Twilio Trial (Solo testing)
- No necesitas comprar número
- Puedes enviar SMS solo a números verificados
- Perfecto para desarrollo

### Opción 2: Desactivar Phone Auth
- Usa solo Email/Password + Google
- Sin costos mensuales
- Pierdes la comodidad de Phone Auth

### Opción 3: SMS virtuales gratuitos (NO recomendado)
- Servicios como Textbelt, SMSGateway
- Menos confiables
- Posibles problemas de deliverability

---

## 📊 COMPARACIÓN DE COSTOS

| Registros/mes | SMS/mes | Costo Twilio | Duración $15.50 |
|---------------|---------|--------------|-----------------|
| 10            | 10      | $0.08        | 194 meses (16 años) |
| 50            | 50      | $0.40        | 39 meses (3 años) |
| 100           | 100     | $0.79        | 20 meses |
| 200           | 200     | $1.58        | 10 meses |
| 500           | 500     | $3.95        | 4 meses |
| 1000          | 1000    | $7.90        | 2 meses |

**Conclusión:** Con límites adecuados, tu crédito gratis puede durar MESES.

---

## ✅ RESUMEN

**Protecciones implementadas:**
1. ✅ Límite global: 20 SMS/día
2. ✅ Límite por IP: 2 SMS/15min
3. ✅ Límite por número: 2 SMS/15min
4. ✅ Endpoint de monitoreo: /api/admin/sms-stats

**Duración estimada del crédito gratis:**
- Con 20 SMS/día: **~3 meses** ✅
- Con 10 SMS/día: **~6 meses** ✅
- Con 5 SMS/día: **~1 año** ✅

**Tu crédito está protegido contra:**
- ✅ Bots automatizados
- ✅ Atacantes maliciosos
- ✅ Spam masivo
- ✅ Abuso accidental

---

## 🚀 PRÓXIMOS PASOS

1. **No configures Twilio todavía** (guarda el crédito)
2. **Usa Email/Password + Google** para desarrollo
3. **Cuando tengas usuarios reales:**
   - Configura Twilio
   - Empieza con DAILY_SMS_LIMIT=5
   - Aumenta gradualmente según necesidad
4. **Monitorea uso** en `/api/admin/sms-stats`
5. **Cuando se acabe el crédito gratis:**
   - Compra plan Twilio ($20-30/mes)
   - O desactiva Phone Auth

---

**Tu crédito gratis está seguro.** 🛡️

Puedes configurar Twilio cuando estés listo, sin miedo a que abusen.

---

**Generado:** 2026-08-18  
**Archivos modificados:**
- ✅ `lib/sms-limiter.ts` (límite global)
- ✅ `lib/rate-limit.ts` (límites agresivos)
- ✅ `app/api/auth/phone/send-otp/route.ts` (3 capas)
- ✅ `app/api/admin/sms-stats/route.ts` (monitoreo)
- ✅ `.env.local` (DAILY_SMS_LIMIT)
