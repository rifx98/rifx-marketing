import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  readLimitedJsonObject,
} from '@/lib/request-guards';
import { createSupabaseAdmin } from '@/lib/supabase';

const KNOWLEDGE_BUCKET = 'knowledge-base';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 256 * 1024;
const MAX_CONTENT_CHARS = 50_000;
const MAX_STORED_CONTENT_CHARS = 51_024;
const MAX_LEGACY_INDEX_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTS = 500;
const DOCUMENT_ID_PATTERN = /^kb_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

interface KnowledgeDocumentRow {
  id: string;
  tenant_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | string;
  active: boolean;
  content: string;
  created_at: string;
  updated_at: string;
}

interface LegacyIndexEntry {
  id?: unknown;
  tenant_id?: unknown;
  file_name?: unknown;
  file_type?: unknown;
  active?: unknown;
  content?: unknown;
  created_at?: unknown;
}

interface LegacyStorageObject {
  name?: string;
  metadata?: { size?: number | string } | null;
}

interface CommittedDocument {
  document_id: string;
  document_created_at: string;
  document_updated_at: string;
  previous_storage_path: string | null;
  replacement_cleanup_id: string | null;
}

class KnowledgeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
    readonly code: string,
  ) {
    super(code);
    this.name = code;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function getAuthorizedTenantId(req: NextRequest): Promise<string | NextResponse> {
  const tenant = await getTenantFromRequest(req);
  if (!tenant?.tenantId) return jsonResponse({ error: 'Unauthorized' }, 401);
  const featureDenied = denyUnlessFeature(tenant, 'playground');
  return featureDenied || tenant.tenantId;
}

async function guardRateLimit(
  tenantId: string,
  operation: 'read' | 'write',
): Promise<NextResponse | null> {
  return enforceTenantRateLimit(
    `panel:knowledge:${operation}`,
    tenantId,
    operation === 'read' ? 60 : 20,
    60_000,
  );
}

async function readLimitedMultipartFormData(
  req: NextRequest,
): Promise<{ ok: true; formData: FormData } | { ok: false; response: NextResponse }> {
  const contentType = req.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/boundary=/i.test(contentType)) {
    return { ok: false, response: jsonResponse({ error: 'Se requiere multipart/form-data' }, 415) };
  }

  const declaredHeader = req.headers.get('content-length');
  if (declaredHeader !== null) {
    if (!/^\d+$/.test(declaredHeader)) {
      return { ok: false, response: jsonResponse({ error: 'Content-Length inválido' }, 400) };
    }
    const declaredLength = Number(declaredHeader);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > MAX_MULTIPART_BYTES) {
      return { ok: false, response: jsonResponse({ error: 'La solicitud excede el límite permitido' }, 413) };
    }
  }

  if (!req.body) {
    return { ok: false, response: jsonResponse({ error: 'Cuerpo multipart inválido' }, 400) };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MULTIPART_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, response: jsonResponse({ error: 'La solicitud excede el límite permitido' }, 413) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: jsonResponse({ error: 'Cuerpo multipart inválido' }, 400) };
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const formData = await new Response(body, {
      headers: { 'Content-Type': contentType },
    }).formData();
    return { ok: true, formData };
  } catch {
    return { ok: false, response: jsonResponse({ error: 'Cuerpo multipart inválido' }, 400) };
  }
}

function canonicalMime(fileType: string): string {
  if (fileType === 'txt' || fileType === 'text') return 'text/plain';
  if (fileType === 'csv') return 'text/csv';
  if (fileType === 'pdf') return 'application/pdf';
  if (fileType === 'doc') return 'application/msword';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function acceptedMimes(fileType: string): ReadonlySet<string> {
  const generic = 'application/octet-stream';
  if (fileType === 'txt' || fileType === 'text') return new Set(['', generic, 'text/plain']);
  if (fileType === 'csv') {
    return new Set([
      '', generic, 'text/csv', 'text/x-csv', 'application/csv',
      'application/x-csv',
    ]);
  }
  if (fileType === 'pdf') return new Set(['', generic, 'application/pdf']);
  if (fileType === 'doc') return new Set(['', generic, 'application/msword']);
  return new Set([
    '', generic,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);
}

function validateFileIdentity(file: File): {
  safeFileName: string;
  fileType: string;
  mimeType: string;
} {
  const baseName = path.basename(file.name.replace(/\\/g, '/'));
  const safeFileName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
  if (!safeFileName || safeFileName === '.' || safeFileName === '..') {
    throw new KnowledgeRequestError(400, 'Nombre de archivo no válido', 'invalid_file_name');
  }
  if (file.size < 1) {
    throw new KnowledgeRequestError(400, 'El archivo está vacío', 'empty_file');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new KnowledgeRequestError(413, 'El archivo excede el límite de 10 MB', 'file_too_large');
  }

  const fileType = safeFileName.split('.').pop()?.toLowerCase() || '';
  if (!['txt', 'text', 'csv', 'pdf', 'doc', 'docx'].includes(fileType)) {
    throw new KnowledgeRequestError(
      400,
      'Extensión no permitida. Usa txt, text, csv, pdf, doc o docx',
      'invalid_file_extension',
    );
  }

  const suppliedMime = file.type.split(';', 1)[0].trim().toLowerCase();
  if (!acceptedMimes(fileType).has(suppliedMime)) {
    throw new KnowledgeRequestError(400, 'El tipo MIME no coincide con el archivo', 'invalid_file_mime');
  }
  return { safeFileName, fileType, mimeType: canonicalMime(fileType) };
}

function validateFileSignature(buffer: Buffer, fileType: string): void {
  if (fileType === 'pdf') {
    const headerOffset = buffer.subarray(0, Math.min(buffer.length, 1024)).indexOf('%PDF-');
    if (headerOffset < 0) {
      throw new KnowledgeRequestError(422, 'El contenido no es un PDF válido', 'invalid_pdf_signature');
    }
    return;
  }

  if (fileType === 'doc') {
    const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    if (buffer.length < oleHeader.length || !buffer.subarray(0, oleHeader.length).equals(oleHeader)) {
      throw new KnowledgeRequestError(422, 'El contenido no es un DOC válido', 'invalid_doc_signature');
    }
    return;
  }

  if (fileType === 'docx') {
    const isZip = buffer.length >= 4
      && buffer[0] === 0x50
      && buffer[1] === 0x4b
      && [0x03, 0x05, 0x07].includes(buffer[2])
      && [0x04, 0x06, 0x08].includes(buffer[3]);
    if (!isZip) {
      throw new KnowledgeRequestError(422, 'El contenido no es un DOCX válido', 'invalid_docx_signature');
    }
  }
}

async function extractText(buffer: Buffer, fileName: string, fileType: string): Promise<string> {
  if (fileType === 'txt' || fileType === 'text' || fileType === 'csv') {
    if (buffer.includes(0)) {
      throw new KnowledgeRequestError(422, 'El archivo de texto contiene datos binarios', 'binary_text_file');
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new KnowledgeRequestError(422, 'El texto debe estar codificado en UTF-8', 'invalid_text_encoding');
    }
  }

  if (fileType === 'pdf') {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        if (!result.text.trim()) {
          throw new KnowledgeRequestError(422, 'El PDF no contiene texto extraíble', 'empty_pdf_text');
        }
        return result.text;
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (error) {
      if (error instanceof KnowledgeRequestError) throw error;
      throw new KnowledgeRequestError(422, 'No se pudo extraer texto del PDF', 'pdf_parse_failed');
    }
  }

  return `[Archivo Word: ${fileName} — convierte el documento a TXT o PDF para indexar su contenido completo]`;
}

function truncateContent(content: string): string {
  const normalized = content.trim();
  if (!normalized) {
    throw new KnowledgeRequestError(422, 'El documento no contiene texto utilizable', 'empty_extracted_content');
  }
  const stored = normalized.length > MAX_CONTENT_CHARS
    ? `${normalized.slice(0, MAX_CONTENT_CHARS)}\n\n[... contenido truncado por límite de tamaño ...]`
    : normalized;
  return stored.slice(0, MAX_STORED_CONTENT_CHARS);
}

function formatFileSize(value: number | string): string {
  const bytes = Number(value);
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isLegacyEntry(value: unknown): value is LegacyIndexEntry {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateLegacyEntry(
  entry: LegacyIndexEntry,
  tenantId: string,
  objectsByName: Map<string, LegacyStorageObject>,
): Record<string, unknown> {
  const id = typeof entry.id === 'string' ? entry.id : '';
  const fileName = typeof entry.file_name === 'string' ? entry.file_name : '';
  const fileType = typeof entry.file_type === 'string' ? entry.file_type.toLowerCase() : '';
  const content = typeof entry.content === 'string' ? entry.content : '';
  const active = typeof entry.active === 'boolean' ? entry.active : true;
  const legacyTenant = entry.tenant_id;

  if (!DOCUMENT_ID_PATTERN.test(id)
      || fileName.length < 1
      || fileName.length > 160
      || !/^[A-Za-z0-9._-]+$/.test(fileName)
      || fileName === '.'
      || fileName === '..'
      || !['txt', 'text', 'csv', 'pdf', 'doc', 'docx'].includes(fileType)
      || !fileName.toLowerCase().endsWith(`.${fileType}`)
      || content.length < 1
      || content.length > MAX_STORED_CONTENT_CHARS
      || new TextEncoder().encode(content).byteLength > 204_096
      || (legacyTenant !== undefined && legacyTenant !== tenantId)) {
    throw new Error('legacy_knowledge_entry_invalid');
  }

  const objectName = `${id}_${fileName}`;
  const storageObject = objectsByName.get(objectName);
  const fileSize = Number(storageObject?.metadata?.size);
  if (!storageObject || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_FILE_BYTES) {
    throw new Error('legacy_knowledge_object_missing_or_invalid');
  }

  const createdAt = typeof entry.created_at === 'string' ? new Date(entry.created_at) : new Date();
  if (Number.isNaN(createdAt.getTime()) || createdAt.getTime() > Date.now() + 5 * 60_000) {
    throw new Error('legacy_knowledge_timestamp_invalid');
  }

  return {
    id,
    file_name: fileName,
    file_type: fileType,
    mime_type: canonicalMime(fileType),
    file_size_bytes: fileSize,
    storage_path: `${tenantId}/files/${objectName}`,
    content,
    sha256: null,
    active,
    created_at: createdAt.toISOString(),
  };
}

async function listLegacyStorageObjects(
  supabase: SupabaseAdmin,
  tenantId: string,
): Promise<Map<string, LegacyStorageObject>> {
  const objects = new Map<string, LegacyStorageObject>();
  const pageSize = 1000;
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .list(`${tenantId}/files`, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
    if (error) throw new Error('legacy_knowledge_object_list_failed');
    for (const item of (data || []) as LegacyStorageObject[]) {
      if (typeof item.name === 'string') objects.set(item.name, item);
    }
    if (!data || data.length < pageSize) return objects;
  }
  throw new Error('legacy_knowledge_object_inventory_too_large');
}

async function importLegacyIndexOnce(
  supabase: SupabaseAdmin,
  tenantId: string,
): Promise<void> {
  const { data: receipt, error: receiptError } = await supabase
    .from('knowledge_index_imports')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (receiptError) throw new Error('knowledge_import_receipt_lookup_failed');
  if (receipt) return;

  const { data: listedFiles, error: listError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .list(tenantId, { limit: 10, search: 'index.json' });
  if (listError) throw new Error('legacy_knowledge_index_lookup_failed');
  const indexExists = (listedFiles || []).some((file: { name?: string }) => file.name === 'index.json');

  if (!indexExists) {
    const { error } = await supabase.rpc('import_legacy_knowledge_index', {
      p_tenant_id: tenantId,
      p_entries: [],
      p_source_index_found: false,
      p_source_sha256: null,
    });
    if (error) throw new Error('knowledge_empty_import_failed');
    return;
  }

  const { data: legacyBlob, error: downloadError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .download(`${tenantId}/index.json`);
  if (downloadError || !legacyBlob || legacyBlob.size > MAX_LEGACY_INDEX_BYTES) {
    throw new Error('legacy_knowledge_index_download_failed');
  }

  const rawIndex = await legacyBlob.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawIndex);
  } catch {
    throw new Error('legacy_knowledge_index_invalid_json');
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_DOCUMENTS || !parsed.every(isLegacyEntry)) {
    throw new Error('legacy_knowledge_index_invalid_shape');
  }

  const storageObjects = await listLegacyStorageObjects(supabase, tenantId);
  const ids = new Set<string>();
  const names = new Set<string>();
  const entries = parsed.map((entry) => {
    const normalized = validateLegacyEntry(entry, tenantId, storageObjects);
    const id = normalized.id as string;
    const fileName = normalized.file_name as string;
    if (ids.has(id) || names.has(fileName)) throw new Error('legacy_knowledge_index_duplicate');
    ids.add(id);
    names.add(fileName);
    return normalized;
  });

  const sourceSha256 = createHash('sha256').update(rawIndex, 'utf8').digest('hex');
  const { error: importError } = await supabase.rpc('import_legacy_knowledge_index', {
    p_tenant_id: tenantId,
    p_entries: entries,
    p_source_index_found: true,
    p_source_sha256: sourceSha256,
  });
  if (importError) throw new Error('legacy_knowledge_import_failed');
}

async function completeReplacementCleanup(
  supabase: SupabaseAdmin,
  tenantId: string,
  cleanupId: string,
  storagePath: string,
): Promise<boolean> {
  const { error: removeError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .remove([storagePath]);
  if (removeError) return false;

  const { data, error } = await supabase.rpc('complete_knowledge_storage_cleanup', {
    p_tenant_id: tenantId,
    p_cleanup_id: cleanupId,
  });
  return !error && data === true;
}

async function drainReplacementCleanup(
  supabase: SupabaseAdmin,
  tenantId: string,
  limit = 10,
): Promise<void> {
  const { data, error } = await supabase
    .from('knowledge_storage_cleanup')
    .select('id, storage_path')
    .eq('tenant_id', tenantId)
    .eq('reason', 'replace')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return;

  for (const item of data || []) {
    if (typeof item.id !== 'string' || typeof item.storage_path !== 'string') continue;
    await completeReplacementCleanup(supabase, tenantId, item.id, item.storage_path);
  }
}

async function drainPendingDeletionCleanup(
  supabase: SupabaseAdmin,
  tenantId: string,
  limit = 10,
): Promise<void> {
  const { data, error } = await supabase
    .from('knowledge_storage_cleanup')
    .select('id, document_id, storage_path')
    .eq('tenant_id', tenantId)
    .eq('reason', 'delete')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return;

  for (const item of data || []) {
    if (typeof item.id !== 'string'
        || typeof item.document_id !== 'string'
        || typeof item.storage_path !== 'string') continue;
    const { error: removeError } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .remove([item.storage_path]);
    if (removeError) continue;
    await supabase.rpc('complete_knowledge_document_delete', {
      p_tenant_id: tenantId,
      p_document_id: item.document_id,
      p_cleanup_id: item.id,
    });
  }
}

async function resolveCommittedDocument(
  supabase: SupabaseAdmin,
  tenantId: string,
  storagePath: string,
  rpcData: unknown,
): Promise<CommittedDocument | null> {
  if (Array.isArray(rpcData) && rpcData.length === 1) {
    const candidate = rpcData[0] as Partial<CommittedDocument>;
    if (typeof candidate.document_id === 'string'
        && typeof candidate.document_created_at === 'string'
        && typeof candidate.document_updated_at === 'string') {
      return {
        document_id: candidate.document_id,
        document_created_at: candidate.document_created_at,
        document_updated_at: candidate.document_updated_at,
        previous_storage_path: typeof candidate.previous_storage_path === 'string'
          ? candidate.previous_storage_path
          : null,
        replacement_cleanup_id: typeof candidate.replacement_cleanup_id === 'string'
          ? candidate.replacement_cleanup_id
          : null,
      };
    }
  }

  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('storage_path', storagePath)
    .eq('status', 'ready')
    .maybeSingle();
  if (error || !data) return null;
  return {
    document_id: data.id,
    document_created_at: data.created_at,
    document_updated_at: data.updated_at,
    previous_storage_path: null,
    replacement_cleanup_id: null,
  };
}

export async function GET(req: NextRequest) {
  const authorization = await getAuthorizedTenantId(req);
  if (authorization instanceof NextResponse) return authorization;
  const tenantId = authorization;
  const rateDenied = await guardRateLimit(tenantId, 'read');
  if (rateDenied) return rateDenied;

  try {
    const supabase = createSupabaseAdmin();
    await importLegacyIndexOnce(supabase, tenantId);
    await drainReplacementCleanup(supabase, tenantId);
    await drainPendingDeletionCleanup(supabase, tenantId);

    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('id, tenant_id, file_name, file_type, file_size_bytes, active, content, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(MAX_DOCUMENTS);
    if (error) throw new Error('knowledge_document_list_failed');

    const files = ((data || []) as KnowledgeDocumentRow[]).map((document) => ({
      id: document.id,
      tenant_id: document.tenant_id,
      file_name: document.file_name,
      file_type: document.file_type,
      file_size: formatFileSize(document.file_size_bytes),
      active: document.active,
      content: document.content,
      created_at: document.created_at,
      updated_at: document.updated_at,
    }));
    return jsonResponse({ files });
  } catch {
    console.error('Knowledge list failed');
    return jsonResponse({ error: 'Knowledge base unavailable' }, 503);
  }
}

export async function POST(req: NextRequest) {
  const authorization = await getAuthorizedTenantId(req);
  if (authorization instanceof NextResponse) return authorization;
  const tenantId = authorization;
  const rateDenied = await guardRateLimit(tenantId, 'write');
  if (rateDenied) return rateDenied;

  const formResult = await readLimitedMultipartFormData(req);
  if (!formResult.ok) return formResult.response;

  try {
    const suppliedFiles = formResult.formData.getAll('file');
    const fieldNames = [...new Set(Array.from(formResult.formData.keys()))];
    if (suppliedFiles.length !== 1 || fieldNames.some((field) => field !== 'file')) {
      throw new KnowledgeRequestError(400, 'Debes enviar exactamente un archivo', 'invalid_file_fields');
    }
    const file = suppliedFiles[0];
    if (!(file instanceof File)) {
      throw new KnowledgeRequestError(400, 'No se recibió un archivo', 'missing_file');
    }

    const { safeFileName, fileType, mimeType } = validateFileIdentity(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength !== file.size || buffer.byteLength > MAX_FILE_BYTES) {
      throw new KnowledgeRequestError(400, 'El tamaño del archivo es inválido', 'invalid_file_size');
    }
    validateFileSignature(buffer, fileType);
    const content = truncateContent(await extractText(buffer, safeFileName, fileType));
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const supabase = createSupabaseAdmin();
    await importLegacyIndexOnce(supabase, tenantId);
    await drainReplacementCleanup(supabase, tenantId);
    await drainPendingDeletionCleanup(supabase, tenantId);

    const candidateDocumentId = `kb_${randomUUID()}`;
    const storagePath = `${tenantId}/files/${randomUUID()}_${safeFileName}`;
    const { error: rawUploadError } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, buffer, {
        upsert: false,
        contentType: mimeType,
        cacheControl: '0',
      });
    if (rawUploadError) throw new Error('Knowledge file write failed');

    const { data: rpcData, error: metadataError } = await supabase.rpc(
      'upsert_knowledge_document',
      {
        p_tenant_id: tenantId,
        p_document_id: candidateDocumentId,
        p_file_name: safeFileName,
        p_file_type: fileType,
        p_mime_type: mimeType,
        p_file_size_bytes: buffer.byteLength,
        p_storage_path: storagePath,
        p_content: content,
        p_sha256: sha256,
      },
    );

    const committed = await resolveCommittedDocument(supabase, tenantId, storagePath, rpcData);
    if (!committed) {
      // Only compensate after a successful read proves that no metadata row
      // references the new object. An ambiguous database timeout must not
      // delete an object that may already be authoritative.
      const { data: referenced, error: verificationError } = await supabase
        .from('knowledge_documents')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('storage_path', storagePath)
        .maybeSingle();
      if (!verificationError && !referenced) {
        const { error: compensationError } = await supabase.storage
          .from(KNOWLEDGE_BUCKET)
          .remove([storagePath]);
        if (compensationError) console.error('Knowledge upload compensation failed');
      }

      if (metadataError?.message === 'knowledge_document_delete_in_progress'
          || metadataError?.message === 'knowledge_document_limit_reached') {
        throw new KnowledgeRequestError(409, 'La operación entra en conflicto con el estado actual', 'knowledge_conflict');
      }
      throw new Error('Knowledge metadata commit failed');
    }

    if (committed.replacement_cleanup_id && committed.previous_storage_path) {
      await completeReplacementCleanup(
        supabase,
        tenantId,
        committed.replacement_cleanup_id,
        committed.previous_storage_path,
      );
    }

    return jsonResponse({
      success: true,
      file: {
        id: committed.document_id,
        tenant_id: tenantId,
        file_name: safeFileName,
        file_type: fileType,
        file_size: formatFileSize(buffer.byteLength),
        active: true,
        created_at: committed.document_created_at,
        updated_at: committed.document_updated_at,
      },
      extractedChars: content.length,
    });
  } catch (error) {
    if (error instanceof KnowledgeRequestError) {
      return jsonResponse({ error: error.publicMessage }, error.status);
    }
    console.error('Knowledge upload failed');
    return jsonResponse({ error: 'Upload failed' }, 503);
  }
}

export async function PATCH(req: NextRequest) {
  const authorization = await getAuthorizedTenantId(req);
  if (authorization instanceof NextResponse) return authorization;
  const tenantId = authorization;
  const rateDenied = await guardRateLimit(tenantId, 'write');
  if (rateDenied) return rateDenied;

  const parsed = await readLimitedJsonObject(req, 4096);
  if (!parsed.ok) return parsed.response;
  const id = parsed.body.id;
  const active = parsed.body.active;
  if (typeof id !== 'string' || !DOCUMENT_ID_PATTERN.test(id) || typeof active !== 'boolean') {
    return jsonResponse({ error: 'Solicitud inválida' }, 400);
  }

  try {
    const supabase = createSupabaseAdmin();
    await importLegacyIndexOnce(supabase, tenantId);
    const { data, error } = await supabase.rpc('set_knowledge_document_active', {
      p_tenant_id: tenantId,
      p_document_id: id,
      p_active: active,
    });
    if (error) throw new Error('knowledge_document_update_failed');
    if (data !== true) return jsonResponse({ error: 'File not found' }, 404);
    return jsonResponse({ success: true });
  } catch {
    console.error('Knowledge update failed');
    return jsonResponse({ error: 'Update failed' }, 503);
  }
}

export async function DELETE(req: NextRequest) {
  const authorization = await getAuthorizedTenantId(req);
  if (authorization instanceof NextResponse) return authorization;
  const tenantId = authorization;
  const rateDenied = await guardRateLimit(tenantId, 'write');
  if (rateDenied) return rateDenied;

  const parsed = await readLimitedJsonObject(req, 4096);
  if (!parsed.ok) return parsed.response;
  const id = parsed.body.id;
  if (typeof id !== 'string' || !DOCUMENT_ID_PATTERN.test(id)) {
    return jsonResponse({ error: 'Solicitud inválida' }, 400);
  }

  try {
    const supabase = createSupabaseAdmin();
    await importLegacyIndexOnce(supabase, tenantId);
    const { data, error } = await supabase.rpc('begin_knowledge_document_delete', {
      p_tenant_id: tenantId,
      p_document_id: id,
    });
    if (error) throw new Error('knowledge_delete_begin_failed');
    const deletion = Array.isArray(data) ? data[0] : null;
    if (!deletion) return jsonResponse({ error: 'File not found' }, 404);
    if (typeof deletion.object_path !== 'string' || typeof deletion.cleanup_id !== 'string') {
      throw new Error('knowledge_delete_state_invalid');
    }

    const { error: removeError } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .remove([deletion.object_path]);
    if (removeError) throw new Error('Knowledge file delete failed');

    const { data: completed, error: completionError } = await supabase.rpc(
      'complete_knowledge_document_delete',
      {
        p_tenant_id: tenantId,
        p_document_id: id,
        p_cleanup_id: deletion.cleanup_id,
      },
    );
    if (completionError || completed !== true) throw new Error('knowledge_delete_completion_failed');
    return jsonResponse({ success: true });
  } catch {
    console.error('Knowledge delete failed');
    return jsonResponse({ error: 'Delete failed' }, 503);
  }
}
