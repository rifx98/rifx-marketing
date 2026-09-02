import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('rifx_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(0),
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"');
  return response;
}
