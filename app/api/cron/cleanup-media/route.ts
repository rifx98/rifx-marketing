import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

// GET: Limpiar imágenes antiguas de Supabase Storage
// Se llama silenciosamente desde el frontend al iniciar sesión.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret) {
        console.error('❌ CRON_SECRET is missing in production env variables.');
        return NextResponse.json({ error: 'Internal Server Error: Cron is not configured' }, { status: 500 });
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    } else {
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    const supabase = createSupabaseAdmin();
    
    // Obtener configuración de días de retención
    const { data: config } = await supabase.from('config').select('media_retention_days').limit(1).single();
    
    const retentionDays = config?.media_retention_days || 0;
    
    if (retentionDays <= 0) {
      return NextResponse.json({ success: true, message: 'Limpieza inactiva (Días de retención = 0)' });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = cutoffDate.getTime();

    let deletedFilesCount = 0;
    let updatedMessagesCount = 0;

    // 1. LIMPIEZA DE BUCKET (STORAGE)
    // Listar todos los archivos y borrar los más antiguos al cutoffTimestamp
    const { data: files, error: filesError } = await supabase.storage.from('chat_media').list();
    if (files && !filesError) {
      const filesToDelete = files.filter(f => {
        // Extraer el timestamp del nombre del archivo (ej: 1715467000000_imagen.jpg)
        const tsMatch = f.name.match(/^(\d+)_/);
        if (tsMatch) {
          const ts = parseInt(tsMatch[1]);
          return ts < cutoffTimestamp;
        }
        return false;
      }).map(f => f.name);

      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage.from('chat_media').remove(filesToDelete);
        if (!deleteError) {
          deletedFilesCount = filesToDelete.length;
        } else {
          console.error('❌ Error eliminando archivos de storage:', deleteError.message);
        }
      }
    }

    // 2. ACTUALIZACIÓN DE MENSAJES EN BASE DE DATOS
    // Buscar mensajes antiguos con formato markdown ![...] para quitar la imagen y evitar errores 404 en el chat
    const { data: messages, error: msgsError } = await supabase
      .from('messages')
      .select('id, content')
      .lt('created_at', cutoffDate.toISOString())
      .like('content', '%![%');

    if (messages && !msgsError) {
      for (const msg of messages) {
        // Extraer texto adicional
        const imgMatch = msg.content?.match(/^!\[.*\]\((.*)\)(?:\n([\s\S]*))?/);
        if (imgMatch) {
          const textContent = imgMatch[2] || '';
          
          // Reemplazar con mensaje de caducidad
          const newContent = textContent 
            ? `[Imagen adjunta caducada]\n${textContent}` 
            : '[Imagen adjunta caducada]';
          
          await supabase.from('messages').update({ content: newContent }).eq('id', msg.id);
          updatedMessagesCount++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Limpieza completada.`,
      stats: {
        filesDeleted: deletedFilesCount,
        messagesUpdated: updatedMessagesCount,
        retentionDays
      }
    });

  } catch (error: any) {
    console.error('❌ Error en cleanup-media:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
