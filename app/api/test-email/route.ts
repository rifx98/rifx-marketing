export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sendAdminEscalationEmail } from '@/lib/email';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || process.env.GMAIL_USER;
    if (!email) return NextResponse.json({ error: 'No email provided' });
    
    const success = await sendAdminEscalationEmail(email, 'Test User', '593999999999', 'Prueba de alerta urgente');
    return NextResponse.json({ success, email });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
