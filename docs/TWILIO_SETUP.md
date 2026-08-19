# 📱 CONFIGURACIÓN DE TWILIO PARA PHONE AUTH

## ⚠️ PROBLEMA DETECTADO

Phone Auth no funciona porque Twilio no está configurado:

```bash
TWILIO_ACCOUNT_SID=    # ← VACÍO
TWILIO_AUTH_TOKEN=     # ← VACÍO  
TWILIO_PHONE_NUMBER=   # ← VACÍO
```

---

## 🚀 SOLUCIÓN RÁPIDA: Configurar Twilio (20 min)

### Paso 1: Crear cuenta en Twilio (5 min)

1. Ve a: https://www.twilio.com/try-twilio
2. Click en **"Sign up and start building"**
3. Completa el registro:
   - Email
   - Contraseña
   - Verificar número de teléfono personal

4. **Recibes $15.50 USD en créditos gratis** ✅

---

### Paso 2: Obtener credenciales (2 min)

1. Una vez dentro del dashboard de Twilio
2. Ve a: https://console.twilio.com
3. En la página principal verás:

   ```
   Account Info
   ├── Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   └── Auth Token: [Show] ← Click para ver
   ```

4. **Copia ambos valores**

---

### Paso 3: Comprar número de teléfono (5 min)

1. Ve a: https://console.twilio.com/us1/develop/phone-numbers/manage/search

2. **Buscar número:**
   - Country: **Ecuador** 🇪🇨
   - Capabilities: **SMS** ✓ (debe estar marcado)
   
3. Click en **"Search"**

4. Verás lista de números disponibles:
   ```
   +593 2 xxx xxxx    $1.15/month    [Buy]
   +593 9 xxx xxxx    $1.15/month    [Buy]
   ```

5. Click en **"Buy"** en cualquier número

6. Confirma la compra

7. **Copia el número** (formato: +593xxxxxxxxx)

---

### Paso 4: Agregar en .env.local (2 min)

Abre `.env.local` y reemplaza las líneas vacías con tus valores reales:

```bash
# -- Phone Authentication (SMS OTP via Twilio) --
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+593xxxxxxxxx
```

**Guarda el archivo** (Ctrl+S / Cmd+S)

---

### Paso 5: Configurar en Supabase Dashboard (5 min)

1. Ve a: https://supabase.com/dashboard/project/enbezuxcljmdsmtzqktp

2. Click en **Authentication** → **Providers** (menú izquierdo)

3. Busca **Phone** en la lista

4. Click en **Phone** para expandir

5. **Enable Phone Provider:**
   - Toggle: **Enabled** ✓

6. **Configure Twilio:**
   ```
   Twilio Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Twilio Auth Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Twilio Message Service SID: (dejar vacío por ahora)
   ```

7. Click en **"Save"**

---

### Paso 6: Reiniciar servidor (1 min)

```bash
# Detener el servidor (Ctrl+C)
# Reiniciar
npm run dev
```

---

### Paso 7: Probar Phone Auth (2 min)

1. Ve a: http://localhost:3000/panel

2. Click en **"Número de teléfono"**

3. Ingresa tu número:
   - Formato 1: `0984123456`
   - Formato 2: `+593984123456`

4. Click en **"Enviar código"**

5. **Deberías recibir SMS en ~5-10 segundos** ✅

6. Ingresa el código de 6 dígitos

7. Si funciona → ¡Phone Auth configurado correctamente! 🎉

---

## 💰 COSTOS DE TWILIO

### Créditos iniciales
- **$15.50 USD gratis** al registrarte
- Suficiente para ~1,900 SMS

### Costos mensuales
```
Número de teléfono:  $1.15 USD/mes
SMS (Ecuador):       $0.0079 USD/mensaje

Ejemplo: 100 registros/mes
= $1.15 + (100 × $0.0079)
= $1.15 + $0.79
= $1.94 USD/mes
```

### Alternativas más baratas
Si quieres ahorrar en el futuro:
- **AWS SNS:** $0.00645/SMS
- **MessageBird:** $0.0063/SMS
- **Vonage:** $0.0059/SMS

---

## 🐛 TROUBLESHOOTING

### SMS no llega

**1. Verificar saldo:**
- https://console.twilio.com/us1/billing/manage-billing/billing-overview
- Debe tener crédito disponible

**2. Ver logs de SMS:**
- https://console.twilio.com/us1/monitor/logs/sms
- Buscar errores en entregas

**3. Verificar número:**
- Formato correcto: `+593984123456`
- Ecuador requiere 9 dígitos después del código de país

**4. Revisar logs del servidor:**
```bash
# En la terminal donde corre npm run dev
# Buscar errores como:
# "Supabase OTP send failed: provider_error"
```

### Error: "Servicio temporalmente no disponible"

**Causa:** Rate limiting sin Redis (pero ya lo tienes configurado ✅)

### Error: "No se pudo enviar el código"

**Causas posibles:**
1. Twilio no configurado en Supabase Dashboard
2. Credenciales incorrectas
3. Sin saldo en Twilio
4. Número de teléfono no comprado

---

## ✅ CHECKLIST RÁPIDO

- [ ] Cuenta de Twilio creada
- [ ] Account SID copiado
- [ ] Auth Token copiado
- [ ] Número de teléfono comprado (+593...)
- [ ] Variables agregadas en .env.local
- [ ] Phone provider habilitado en Supabase Dashboard
- [ ] Credenciales de Twilio agregadas en Supabase
- [ ] Servidor reiniciado (npm run dev)
- [ ] Test exitoso (SMS recibido)

---

## 🚀 ALTERNATIVA: Desactivar Phone Auth temporalmente

Si no quieres configurar Twilio ahora, puedes:

1. **Usar solo Email/Password + Google Auth** (ya funcionan)
2. Configurar Twilio cuando estés listo para producción

Para desactivar Phone Auth temporalmente, necesitarías ocultar el botón en la UI.

---

**¿Qué prefieres?**
- A) Configurar Twilio ahora (20 min, $1.94/mes) ✅
- B) Desactivar Phone Auth temporalmente y usar solo Email/Google ⏸️

---

**Siguiente paso:** Configurar Twilio siguiendo esta guía paso a paso.

**Tiempo estimado:** 20 minutos  
**Costo mensual:** ~$2 USD
