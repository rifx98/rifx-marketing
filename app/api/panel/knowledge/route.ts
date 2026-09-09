import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import {
  getKnowledgeDocuments,
  saveKnowledgeDocument,
  toggleKnowledgeDocument,
  deleteKnowledgeDocument,
  extractDocumentText,
  formatFileSize,
  MAX_FILE_BYTES,
} from '@/lib/knowledge-base';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const files = await getKnowledgeDocuments(supabase, tenant.tenantId);

    return NextResponse.json(
      { files },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    console.error('Knowledge GET error:', err);
    return NextResponse.json({ error: 'Error al consultar la base de conocimiento' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
    }

    if (file.size < 1) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'El archivo excede el límite de 10 MB' }, { status: 413 });
    }

    const fileType = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'csv', 'txt', 'text'].includes(fileType)) {
      return NextResponse.json(
        { error: 'Extensión no permitida. Por favor sube archivos PDF, CSV o TXT' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text content from PDF, CSV or TXT
    let content = '';
    try {
      content = await extractDocumentText(buffer, file.name, fileType);
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: parseErr.message || 'No se pudo extraer el texto del archivo' },
        { status: 422 },
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'El documento no contiene texto legible' },
        { status: 422 },
      );
    }

    const supabase = createSupabaseAdmin();
    const savedDoc = await saveKnowledgeDocument(supabase, tenant.tenantId, {
      fileName: file.name,
      fileType: (fileType === 'text' ? 'txt' : fileType) as any,
      fileSize: formatFileSize(file.size),
      content,
      buffer,
    });

    return NextResponse.json({
      success: true,
      file: savedDoc,
      extractedChars: content.length,
    });
  } catch (err: any) {
    console.error('Knowledge POST error:', err);
    return NextResponse.json(
      { error: err.message || 'Error al procesar el archivo en la base de conocimiento' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, active } = body;

    if (!id || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const ok = await toggleKnowledgeDocument(supabase, tenant.tenantId, id, active);

    if (!ok) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Knowledge PATCH error:', err);
    return NextResponse.json({ error: 'Error al actualizar el documento' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const ok = await deleteKnowledgeDocument(supabase, tenant.tenantId, id);

    if (!ok) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Knowledge DELETE error:', err);
    return NextResponse.json({ error: 'Error al eliminar el documento' }, { status: 500 });
  }
}
