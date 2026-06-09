import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = process.env.FACEBOOK_APP_SECRET || '';
  const length = secret.length;
  const start = secret.substring(0, 4);
  const end = secret.substring(secret.length - 4);
  
  return NextResponse.json({
    hasSecret: !!secret,
    length,
    start,
    end,
    nodeEnv: process.env.NODE_ENV
  });
}
