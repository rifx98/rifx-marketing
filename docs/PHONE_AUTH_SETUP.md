# 📱 Guía de Implementación: Verificación por Teléfono en Supabase

## 🎯 Objetivo
Habilitar autenticación por SMS para evitar que se creen múltiples cuentas con el mismo número de teléfono.

## 📋 Pasos de Configuración

### 1. Configurar Twilio (Proveedor de SMS)

1. **Crear cuenta en Twilio**
   - Ve a: https://www.twilio.com/try-twilio
   - Regístrate (recibes $15.50 USD gratis)

2. **Obtener credenciales**
   - Ve a: https://console.twilio.com
   - Copia:
     - **Account SID** (ej: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
     - **Auth Token** (ej: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

3. **Comprar un número de teléfono**
   - Ve a: https://console.twilio.com/us1/develop/phone-numbers/manage/search
   - Filtra por país: **Ecuador (+593)**
   - Marca la capacidad: **SMS**
   - Compra un número (~$1.15 USD/mes)
   - Copia el número (formato: `+593xxxxxxxxx`)

### 2. Configurar Supabase Phone Auth

1. **Ir al Dashboard de Supabase**
   - URL: https://supabase.com/dashboard/project/enbezuxcljmdsmtzqktp

2. **Habilitar Phone Provider**
   - Ve a: **Authentication** → **Providers**
   - Busca **Phone** y haz clic en **Enable**

3. **Configurar Twilio**
   ```
   SMS Provider: Twilio
   Twilio Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Twilio Auth Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Twilio Message Service SID: (Opcional)
   ```

4. **Guardar configuración**

### 3. Configurar Variables de Entorno

Agrega las credenciales de Twilio en `.env.local`:

```bash
# -- Phone Authentication (SMS OTP via Twilio) --
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+593xxxxxxxxx
```

### 4. Ejecutar Migración de Base de Datos

Aplica la migración para agregar campos de teléfono:

```bash
# Opción 1: Usando Supabase CLI (recomendado)
npx supabase migration up

# Opción 2: Ejecutar SQL manualmente en Supabase Dashboard
# Ve a: SQL Editor → New Query
# Copia y ejecuta el contenido de: supabase/migrations/add_phone_auth.sql
```

### 5. Modificar la Página de Registro

Reemplaza el formulario actual con el nuevo componente:

```tsx
// app/register/page.tsx
import PhoneAuthForm from '@/components/PhoneAuthForm';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <PhoneAuthForm mode="register" />
      </div>
    </div>
  );
}
```

### 6. Modificar la Página de Login (Opcional)

Si también quieres login por teléfono:

```tsx
// app/login/page.tsx
import PhoneAuthForm from '@/components/PhoneAuthForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <PhoneAuthForm mode="login" />
      </div>
    </div>
  );
}
```

## 🧪 Testing

### Probar localmente

1. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

2. **Abrir la página de registro**
   - http://localhost:3000/register

3. **Ingresar un número de teléfono**
   - Formato: `0984123456` o `+593984123456`

4. **Verificar que llegó el SMS**
   - Debe llegar un código de 6 dígitos

5. **Ingresar el código**
   - Si es correcto, se crea la cuenta automáticamente

### Testing sin gastar créditos (DEV MODE)

Durante desarrollo, puedes ver el código OTP en los logs del servidor:

```bash
# En la terminal donde corre npm run dev
OTP sent to +593984123456: 123456 (DEV MODE - remove in production)
```

También puedes consultar el código con:
```bash
curl http://localhost:3000/api/auth/phone/send-otp?phone=0984123456
```

**⚠️ IMPORTANTE:** Elimina el endpoint GET antes de ir a producción.

## 🔒 Política de Seguridad

### Prevención de múltiples cuentas

1. **A nivel de base de datos**
   - Campo `phone` tiene constraint `UNIQUE`
   - No se pueden crear dos cuentas con el mismo número

2. **Rate limiting**
   - Máximo 3 SMS por 5 minutos (por número)
   - Máximo 5 intentos de verificación por 10 minutos
   - Previene spam y abuso

3. **Validación de formato**
   - Solo acepta números válidos en formato E.164
   - Normaliza automáticamente formatos locales

## 📊 Costos Aproximados

### Twilio
- **SMS salientes (Ecuador):** $0.0079 USD por mensaje
- **Número de teléfono:** $1.15 USD/mes
- **Ejemplo:** 1000 registros/mes = $7.90 USD + $1.15 = ~$9 USD/mes

### Alternativas más baratas
- **AWS SNS:** $0.00645 USD por SMS
- **MessageBird:** $0.0063 USD por SMS
- **Vonage:** $0.0059 USD por SMS

## 🚀 Deploy a Producción

### 1. Agregar variables en Vercel

```bash
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
vercel env add TWILIO_PHONE_NUMBER
```

### 2. Verificar Supabase en producción

- Asegúrate de que Phone Auth esté habilitado en el proyecto de producción

### 3. Eliminar endpoints de testing

Comenta o elimina:
- El método GET en `app/api/auth/phone/send-otp/route.ts`
- Los console.logs que imprimen códigos OTP

### 4. Habilitar Redis para rate limiting

Para producción, configura Upstash Redis:

```bash
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxx
```

## ✅ Checklist Final

- [ ] Twilio configurado y número comprado
- [ ] Supabase Phone Auth habilitado
- [ ] Variables de entorno configuradas
- [ ] Migración de base de datos ejecutada
- [ ] Componente PhoneAuthForm integrado
- [ ] Testing local exitoso
- [ ] Endpoints de testing eliminados
- [ ] Deploy a producción
- [ ] Verificar que SMS lleguen en producción

## 🐛 Troubleshooting

### El SMS no llega

1. **Verificar saldo de Twilio**
   - https://console.twilio.com/us1/billing/manage-billing/billing-overview

2. **Revisar logs de Twilio**
   - https://console.twilio.com/us1/monitor/logs/sms

3. **Verificar número de destino**
   - Debe estar en formato E.164: `+593984123456`

### Error: "Código incorrecto o expirado"

- Los códigos OTP expiran en 10 minutos
- Solo se permiten 5 intentos fallidos
- Después debe solicitar un nuevo código

### Error: "Este número ya está registrado"

- El número ya tiene una cuenta verificada
- Usar la opción "Iniciar sesión" en vez de "Registrarse"

## 📚 Recursos Adicionales

- [Supabase Phone Auth Docs](https://supabase.com/docs/guides/auth/phone-login)
- [Twilio SMS Docs](https://www.twilio.com/docs/sms)
- [E.164 Phone Format](https://en.wikipedia.org/wiki/E.164)
