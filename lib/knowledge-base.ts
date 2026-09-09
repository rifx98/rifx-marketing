import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

export const KNOWLEDGE_BUCKET = 'knowledge-base';
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_CONTENT_CHARS = 50_000;
export const MAX_DOCUMENTS = 50;

export interface KnowledgeDocument {
  id: string;
  tenant_id: string;
  file_name: string;
  file_type: 'pdf' | 'csv' | 'txt' | 'doc' | 'docx';
  file_size: string;
  storage_path: string;
  content: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Format bytes to readable string (e.g. 45 KB, 2.1 MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Extract clean readable text from file buffer
 */
export async function extractDocumentText(
  buffer: Buffer,
  fileName: string,
  fileType: string,
): Promise<string> {
  const normType = fileType.toLowerCase().replace('.', '');

  if (normType === 'txt' || normType === 'text' || normType === 'csv') {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    } catch {
      return buffer.toString('utf-8');
    }
  }

  if (normType === 'pdf') {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        const extracted = (result?.text || '').trim();
        if (!extracted) {
          throw new Error('El PDF no contiene texto extraíble o es una imagen escaneada');
        }
        return extracted;
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      throw new Error(err.message || 'No se pudo procesar el archivo PDF');
    }
  }

  if (normType === 'doc' || normType === 'docx') {
    // Basic text extraction or notice
    return `[Documento Word: ${fileName}]`;
  }

  throw new Error(`Tipo de archivo no compatible: ${fileType}. Usa PDF, CSV o TXT.`);
}

/**
 * Get all knowledge documents for a tenant from storage index
 */
export async function getKnowledgeDocuments(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<KnowledgeDocument[]> {
  try {
    const indexPath = `${tenantId}/index.json`;
    const { data, error } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .download(indexPath);

    if (error || !data) {
      return [];
    }

    const text = await data.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed as KnowledgeDocument[];
  } catch (err) {
    console.error(`Error loading knowledge docs for tenant ${tenantId}:`, err);
    return [];
  }
}

/**
 * Save / Add a knowledge document to storage
 */
export async function saveKnowledgeDocument(
  supabase: SupabaseClient,
  tenantId: string,
  docData: {
    fileName: string;
    fileType: 'pdf' | 'csv' | 'txt' | 'doc' | 'docx';
    fileSize: string;
    content: string;
    buffer: Buffer;
  },
): Promise<KnowledgeDocument> {
  const existing = await getKnowledgeDocuments(supabase, tenantId);

  if (existing.length >= MAX_DOCUMENTS) {
    throw new Error(`Límite máximo de ${MAX_DOCUMENTS} documentos alcanzado.`);
  }

  const docId = `kb_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const cleanFileName = path.basename(docData.fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const fileStoragePath = `${tenantId}/files/${docId}_${cleanFileName}`;

  // 1. Upload original file to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(fileStoragePath, docData.buffer, {
      upsert: true,
      contentType:
        docData.fileType === 'pdf'
          ? 'application/pdf'
          : docData.fileType === 'csv'
          ? 'text/csv'
          : 'text/plain',
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error('Error al guardar el archivo en almacenamiento.');
  }

  // 2. Prepare new document object
  const now = new Date().toISOString();
  const truncatedContent = docData.content.length > MAX_CONTENT_CHARS
    ? `${docData.content.slice(0, MAX_CONTENT_CHARS)}\n\n[... Contenido truncado por límite de tamaño ...]`
    : docData.content;

  const newDoc: KnowledgeDocument = {
    id: docId,
    tenant_id: tenantId,
    file_name: cleanFileName,
    file_type: docData.fileType,
    file_size: docData.fileSize,
    storage_path: fileStoragePath,
    content: truncatedContent,
    active: true,
    created_at: now,
    updated_at: now,
  };

  // 3. Update index.json in storage
  const updatedDocs = [newDoc, ...existing];
  const { error: indexError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(`${tenantId}/index.json`, Buffer.from(JSON.stringify(updatedDocs, null, 2)), {
      upsert: true,
      contentType: 'application/json',
    });

  if (indexError) {
    console.error('Index save error:', indexError);
    throw new Error('Error al actualizar el índice de documentos.');
  }

  return newDoc;
}

/**
 * Toggle active status of a document
 */
export async function toggleKnowledgeDocument(
  supabase: SupabaseClient,
  tenantId: string,
  docId: string,
  active: boolean,
): Promise<boolean> {
  const existing = await getKnowledgeDocuments(supabase, tenantId);
  const target = existing.find((d) => d.id === docId);
  if (!target) return false;

  target.active = active;
  target.updated_at = new Date().toISOString();

  const { error } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(`${tenantId}/index.json`, Buffer.from(JSON.stringify(existing, null, 2)), {
      upsert: true,
      contentType: 'application/json',
    });

  return !error;
}

/**
 * Delete a document from knowledge base
 */
export async function deleteKnowledgeDocument(
  supabase: SupabaseClient,
  tenantId: string,
  docId: string,
): Promise<boolean> {
  const existing = await getKnowledgeDocuments(supabase, tenantId);
  const target = existing.find((d) => d.id === docId);
  if (!target) return false;

  // 1. Remove file from storage
  if (target.storage_path) {
    await supabase.storage.from(KNOWLEDGE_BUCKET).remove([target.storage_path]).catch(() => undefined);
  }

  // 2. Remove from index list
  const filtered = existing.filter((d) => d.id !== docId);

  const { error } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(`${tenantId}/index.json`, Buffer.from(JSON.stringify(filtered, null, 2)), {
      upsert: true,
      contentType: 'application/json',
    });

  return !error;
}

/**
 * Retrieve active knowledge base formatted text to inject into AI context
 */
export async function getActiveKnowledgeContext(
  supabase: SupabaseClient,
  tenantId: string,
  maxChars = 30000,
): Promise<string> {
  if (!tenantId) return '';

  try {
    const docs = await getKnowledgeDocuments(supabase, tenantId);
    const activeDocs = docs.filter((d) => d.active && d.content && d.content.trim().length > 0);

    if (activeDocs.length === 0) return '';

    let context = '\n\n[BASE DE CONOCIMIENTO — Usa esta información oficial para responder las consultas del cliente]:\n';
    let currentChars = 0;

    for (const doc of activeDocs) {
      const header = `\n--- DOCUMENTO: ${doc.file_name} ---\n`;
      const availableChars = maxChars - currentChars - header.length;
      if (availableChars <= 100) break;

      const docText = doc.content.length > availableChars
        ? `${doc.content.slice(0, availableChars)}...\n[Fin de extracto]`
        : doc.content;

      context += `${header}${docText}\n`;
      currentChars += header.length + docText.length;
    }

    return context;
  } catch (err) {
    console.warn(`Error generating active knowledge context for tenant ${tenantId}:`, err);
    return '';
  }
}
