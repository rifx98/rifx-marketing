#!/bin/bash

# Script para agregar variables de Upstash en Vercel
# Ejecutar después de obtener las credenciales de Upstash

echo "🔧 Configurando Upstash Redis en Vercel"
echo "========================================"
echo ""

echo "📋 Este script te ayudará a agregar las variables de entorno."
echo ""

# Solicitar URL
echo "1️⃣ Ingresa tu UPSTASH_REDIS_REST_URL:"
echo "   (formato: https://us1-xxxxx.upstash.io)"
read -p "URL: " REDIS_URL

# Solicitar TOKEN
echo ""
echo "2️⃣ Ingresa tu UPSTASH_REDIS_REST_TOKEN:"
echo "   (formato: AYxxx...xxx==)"
read -p "TOKEN: " REDIS_TOKEN

# Validar que no estén vacíos
if [ -z "$REDIS_URL" ] || [ -z "$REDIS_TOKEN" ]; then
    echo ""
    echo "❌ Error: URL o TOKEN vacío"
    exit 1
fi

echo ""
echo "✅ Variables capturadas. Agregando a Vercel..."
echo ""

# Agregar a production
echo "Agregando a PRODUCTION..."
echo "$REDIS_URL" | vercel env add UPSTASH_REDIS_REST_URL production
echo "$REDIS_TOKEN" | vercel env add UPSTASH_REDIS_REST_TOKEN production

# Agregar a preview
echo ""
echo "Agregando a PREVIEW..."
echo "$REDIS_URL" | vercel env add UPSTASH_REDIS_REST_URL preview
echo "$REDIS_TOKEN" | vercel env add UPSTASH_REDIS_REST_TOKEN preview

# Agregar a development
echo ""
echo "Agregando a DEVELOPMENT..."
echo "$REDIS_URL" | vercel env add UPSTASH_REDIS_REST_URL development
echo "$REDIS_TOKEN" | vercel env add UPSTASH_REDIS_REST_TOKEN development

echo ""
echo "✅ Variables agregadas exitosamente!"
echo ""
echo "📝 Verificar con:"
echo "   vercel env ls | grep UPSTASH"
echo ""
