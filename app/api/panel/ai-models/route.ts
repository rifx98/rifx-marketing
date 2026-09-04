import { NextResponse } from 'next/server';
import { verifyTenantAuth } from '@/lib/auth';
import OpenAI from 'openai';

export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    const tenant = await verifyTenantAuth();
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey } = await request.json();

    if (!apiKey || apiKey === '***') {
      return NextResponse.json({ error: 'Falta la API Key válida' }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey,
      timeout: 8000
    });

    const list = await openai.models.list();
    
    // Filtrar para mantener solo modelos de chat relevantes
    const validPrefixes = ['gpt-3.5', 'gpt-4', 'o1'];
    const chatModels = list.data
      .filter(m => validPrefixes.some(prefix => m.id.startsWith(prefix)))
      .map(m => m.id)
      .sort((a, b) => b.localeCompare(a));

    return NextResponse.json({ models: chatModels });
  } catch (error: any) {
    console.error('Error fetching AI models:', error);
    return NextResponse.json({ 
      error: 'Error al cargar modelos. Verifica que la API Key sea válida.' 
    }, { status: 500 });
  }
}
