import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { denyUnlessFeature } from '@/lib/feature-access';
import { saveTenantKnowledge, BrainKnowledgeItem } from '@/lib/brain-knowledge-store';

export const dynamic = 'force-dynamic';

async function resolveTenant(req: NextRequest) {
  let tenant = await getTenantFromRequest(req);
  if (!tenant) {
    if (process.env.NODE_ENV !== 'production') {
      const supabase = createSupabaseAdmin();
      const { data: firstTenant } = await supabase.from('tenants').select('id, email, plan').limit(1).maybeSingle();
      if (firstTenant) {
        tenant = { tenantId: firstTenant.id, email: firstTenant.email, plan: 'master', planStatus: 'active', isAdmin: true };
      }
    }
  }
  return tenant;
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Only administrators can upload information/knowledge to the Brain
    if (!tenant.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso restringido: Solo administradores pueden inyectar información al Cerebro IA' },
        { status: 403 }
      );
    }

    const featureDenied = denyUnlessFeature(tenant, 'crm');
    if (featureDenied) return featureDenied;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const categoryParam = (formData.get('category') as string) || 'general';
    const customTitle = (formData.get('title') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Debes seleccionar un archivo para subir' }, { status: 400 });
    }

    const fileName = file.name || 'documento-asimilado.txt';
    const ext = fileName.toLowerCase().split('.').pop() || '';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = '';

    if (ext === 'pdf') {
      try {
        const pdfParseModule = await import('pdf-parse');
        // Handle commonjs or esm export shape
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || '';
      } catch (pdfErr: any) {
        console.error('[brain-upload] Error parsing PDF:', pdfErr);
        return NextResponse.json(
          { error: `No se pudo extraer el texto del PDF: ${pdfErr.message || 'formato incompatible'}` },
          { status: 422 }
        );
      }
    } else if (['txt', 'md', 'markdown', 'csv', 'json'].includes(ext)) {
      extractedText = buffer.toString('utf8');
      if (ext === 'json') {
        try {
          const parsed = JSON.parse(extractedText);
          extractedText = JSON.stringify(parsed, null, 2);
        } catch {
          // Keep raw string if malformed json
        }
      }
    } else {
      // Fallback text decoding for plain text / unknown format
      extractedText = buffer.toString('utf8');
    }

    // Clean up excessive whitespace
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!extractedText || extractedText.length < 5) {
      return NextResponse.json(
        { error: 'El archivo está vacío o no contiene texto legible para la red neuronal' },
        { status: 400 }
      );
    }

    // Cap at 32,000 characters per document to fit safely in token windows and db
    const cleanContent = extractedText.length > 32000 ? extractedText.slice(0, 32000) + '\n\n[...Texto truncado por extensión]' : extractedText;

    const finalTitle = customTitle.trim() || fileName.replace(/\.[^/.]+$/, '');
    const validCategory = (categoryParam as BrainKnowledgeItem['category']) || 'general';

    const saved = await saveTenantKnowledge(tenant.tenantId, {
      title: finalTitle,
      content: cleanContent,
      category: validCategory,
    });

    return NextResponse.json({
      success: true,
      item: saved,
      fileName,
      characterCount: cleanContent.length,
      message: `¡Archivo "${fileName}" asimilado con éxito! La red neuronal lo indexó y ya está activo en WhatsApp y llamadas.`,
    });
  } catch (error: any) {
    console.error('[brain-upload] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar y asimilar el archivo' },
      { status: 500 }
    );
  }
}
