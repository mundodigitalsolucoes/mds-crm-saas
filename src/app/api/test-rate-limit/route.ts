// src/app/api/test-rate-limit/route.ts
// Rota temporária para testar rate limiting — REMOVER DEPOIS
import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';

const TEST_LIMIT = {
  limit: 3,
  windowMs: 60_000,
};

export async function GET(req: NextRequest) {
  const blocked = applyRateLimit(req, 'test', TEST_LIMIT);
  if (blocked) return blocked;

  return NextResponse.json({ 
    message: 'OK - requisição permitida',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req, 'test-post', TEST_LIMIT);
  if (blocked) return blocked;

  return NextResponse.json({ 
    message: 'OK - POST permitido',
    timestamp: new Date().toISOString(),
  });
}
