import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// POST: Subir imagen para anuncio (solo admin)
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó imagen' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF.' }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen no puede exceder 5MB' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `announcements/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      // Try creating the bucket first
      await supabase.storage.createBucket('uploads', { public: true });
      const { data: data2, error: error2 } = await supabase.storage
        .from('uploads')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });
      
      if (error2) {
        console.error('❌ Error subiendo imagen:', error2);
        return NextResponse.json({ error: 'Error al subir imagen: ' + error2.message }, { status: 500 });
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    return NextResponse.json({ 
      success: true, 
      imageUrl: urlData.publicUrl 
    });
  } catch (error: any) {
    console.error('❌ Error subiendo imagen:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
