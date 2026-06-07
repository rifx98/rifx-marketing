import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

// ============================================
// KNOWLEDGE BASE API — Gestión de archivos de conocimiento
// ============================================

interface KBEntry {
  id: string;
  tenant_id: string;
  file_name: string;
  file_type: string;
  file_size: string;
  active: boolean;
  content: string; // extracted text content
  created_at: string;
}

// Helper: Get tenant_id from auth token (verified signature — VULN-10 fix)
async function getTenantId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = await verifyToken(token);
    return payload?.tenantId || null;
  } catch {
    return null;
  }
}

// Helper: Get KB index from storage
async function getKBIndex(supabase: any, tenantId: string): Promise<KBEntry[]> {
  const path = `${tenantId}/index.json`;
  const { data, error } = await supabase.storage
    .from('knowledge-base')
    .download(path);
  
  if (error || !data) return [];
  
  try {
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// Helper: Save KB index to storage
async function saveKBIndex(supabase: any, tenantId: string, entries: KBEntry[]) {
  const path = `${tenantId}/index.json`;
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  
  // Upsert the index file
  await supabase.storage
    .from('knowledge-base')
    .upload(path, blob, { upsert: true, contentType: 'application/json' });
}

// Helper: Extract text from file
async function extractText(buffer: Buffer, fileName: string, fileType: string): Promise<string> {
  const ext = fileType.toLowerCase();
  
  if (ext === 'txt' || ext === 'text') {
    return buffer.toString('utf-8');
  }
  
  if (ext === 'csv') {
    return buffer.toString('utf-8');
  }
  
  if (ext === 'pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default as any;
      const result = await pdfParse(buffer);
      return result.text;
    } catch (err) {
      console.error('Error parsing PDF:', err);
      return `[Error al extraer texto del PDF: ${fileName}]`;
    }
  }
  
  // For doc/docx, just return a placeholder (would need mammoth.js)
  if (ext === 'doc' || ext === 'docx') {
    return `[Archivo Word: ${fileName} — Para mejor soporte, sube el contenido como TXT o PDF]`;
  }
  
  return buffer.toString('utf-8');
}

// GET: List KB entries for tenant
export async function GET(req: NextRequest) {
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = createSupabaseAdmin();
  const entries = await getKBIndex(supabase, tenantId);
  
  return NextResponse.json({ files: entries });
}

// POST: Upload a new KB file
export async function POST(req: NextRequest) {
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate size (Max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo excede el tamaño máximo permitido de 10MB.' }, { status: 400 });
    }

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = ['txt', 'text', 'csv', 'pdf', 'doc', 'docx'];
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Extensión de archivo no permitida. Use txt, csv, pdf, doc o docx.' }, { status: 400 });
    }

    // Validate MIME type
    const allowedMimes = [
      'text/plain',
      'text/csv',
      'text/x-csv',
      'application/csv',
      'application/x-csv',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream'
    ];
    if (file.type && !allowedMimes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo (MIME) no permitido.' }, { status: 400 });
    }
    
    const supabase = createSupabaseAdmin();
    
    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Extract text content
    const textContent = await extractText(buffer, file.name, ext);
    
    // Limit content size (max ~50KB of text to avoid huge prompts)
    const maxContentLength = 50000;
    const truncatedContent = textContent.length > maxContentLength
      ? textContent.substring(0, maxContentLength) + '\n\n[... contenido truncado por límite de tamaño ...]'
      : textContent;
    
    // Format file size
    const size = file.size > 1048576 
      ? `${(file.size / 1048576).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;
    
    // Update index
    const entries = await getKBIndex(supabase, tenantId);
    
    // Check if a file with the same name already exists in the KB index
    const existingIndex = entries.findIndex(e => e.file_name === file.name);
    
    let entryToSave: KBEntry;
    
    if (existingIndex > -1) {
      // Overwrite existing entry
      const existingEntry = entries[existingIndex];
      const rawPath = `${tenantId}/files/${existingEntry.id}_${file.name}`;
      
      // Upload with upsert: true
      await supabase.storage
        .from('knowledge-base')
        .upload(rawPath, buffer, { upsert: true, contentType: file.type || 'application/octet-stream' });
        
      existingEntry.content = truncatedContent;
      existingEntry.file_size = size;
      existingEntry.active = true; // reactivate if disabled
      existingEntry.created_at = new Date().toISOString();
      
      entryToSave = existingEntry;
      await saveKBIndex(supabase, tenantId, entries);
      console.log(`📚 KB: Archivo "${file.name}" sobrescrito para tenant ${tenantId} (${truncatedContent.length} chars extraídos)`);
    } else {
      // Generate unique ID
      const id = `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store raw file in storage
      const rawPath = `${tenantId}/files/${id}_${file.name}`;
      await supabase.storage
        .from('knowledge-base')
        .upload(rawPath, buffer, { contentType: file.type || 'application/octet-stream' });
      
      // Create KB entry
      const newEntry: KBEntry = {
        id,
        tenant_id: tenantId,
        file_name: file.name,
        file_type: ext,
        file_size: size,
        active: true,
        content: truncatedContent,
        created_at: new Date().toISOString(),
      };
      
      entries.push(newEntry);
      entryToSave = newEntry;
      await saveKBIndex(supabase, tenantId, entries);
      console.log(`📚 KB: Archivo "${file.name}" subido para tenant ${tenantId} (${truncatedContent.length} chars extraídos)`);
    }
    
    return NextResponse.json({ 
      success: true, 
      file: { ...entryToSave, content: undefined }, // Don't send content back to client
      extractedChars: truncatedContent.length,
    });
  } catch (error: any) {
    console.error('❌ Error al subir archivo KB:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

// PATCH: Toggle active status of a KB entry
export async function PATCH(req: NextRequest) {
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { id, active } = await req.json();
    
    const supabase = createSupabaseAdmin();
    const entries = await getKBIndex(supabase, tenantId);
    
    const entry = entries.find(e => e.id === id);
    if (!entry) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    entry.active = active;
    await saveKBIndex(supabase, tenantId, entries);
    
    console.log(`📚 KB: "${entry.file_name}" ${active ? 'activado' : 'desactivado'} para tenant ${tenantId}`);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a KB entry
export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { id } = await req.json();
    
    const supabase = createSupabaseAdmin();
    const entries = await getKBIndex(supabase, tenantId);
    
    const entry = entries.find(e => e.id === id);
    if (!entry) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Remove raw file from storage
    const rawPath = `${tenantId}/files/${id}_${entry.file_name}`;
    await supabase.storage.from('knowledge-base').remove([rawPath]);
    
    // Update index
    const newEntries = entries.filter(e => e.id !== id);
    await saveKBIndex(supabase, tenantId, newEntries);
    
    console.log(`📚 KB: "${entry.file_name}" eliminado para tenant ${tenantId}`);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
