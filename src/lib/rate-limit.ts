// src/lib/rate-limit.ts
// Rate Limiter in-memory para API routes (Node.js runtime)
// Utiliza Map global com cleanup automático — adequado para single instance (Coolify)

import { NextRequest, NextResponse } from 'next/server';

/**
 * Configuração de limite por tipo de rota
 */
export interface RateLimitConfig {
  /** Número máximo de requisições na janela */
  limit: number;
  /** Janela de tempo em milissegundos */
  windowMs: number;
}

/**
 * Registro de requisições de um identificador
 */
interface RateLimitEntry {
  /** Contagem de requisições na janela atual */
  count: number;
  /** Timestamp de início da janela */
  windowStart: number;
}

// ============================================
// STORE GLOBAL (persiste entre requests no Node.js)
// ============================================

const globalStore = globalThis as unknown as {
  __rateLimitStore?: Map<string, RateLimitEntry>;
  __rateLimitCleanup?: ReturnType<typeof setInterval>;
};

if (!globalStore.__rateLimitStore) {
  globalStore.__rateLimitStore = new Map<string, RateLimitEntry>();
}

const store = globalStore.__rateLimitStore;

/** Cleanup automático a cada 60s para evitar memory leak */
if (!globalStore.__rateLimitCleanup) {
  globalStore.__rateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > 120_000) {
        store.delete(key);
      }
    }
  }, 60_000);

  if (
    globalStore.__rateLimitCleanup &&
    typeof globalStore.__rateLimitCleanup === 'object' &&
    'unref' in globalStore.__rateLimitCleanup
  ) {
    globalStore.__rateLimitCleanup.unref();
  }
}

// ============================================
// PRESETS DE LIMITES POR TIPO DE ROTA
// ============================================

/** Rotas de autenticação: 5 req/min (proteção contra brute-force) */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowMs: 60_000,
};

/** Rotas de API gerais: 60 req/min */
export const API_RATE_LIMIT: RateLimitConfig = {
  limit: 60,
  windowMs: 60_000,
};

/** Rotas do SuperAdmin: 30 req/min */
export const ADMIN_RATE_LIMIT: RateLimitConfig = {
  limit: 30,
  windowMs: 60_000,
};

/** Rotas de webhook (externas): 120 req/min */
export const WEBHOOK_RATE_LIMIT: RateLimitConfig = {
  limit: 120,
  windowMs: 60_000,
};

// ============================================
// RESULTADO DO RATE LIMIT
// ============================================

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

// ============================================
// EXTRAIR IP DO CLIENT
// ============================================

/**
 * Extrai o IP real da requisição considerando proxies (Coolify/Nginx).
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;

  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return '127.0.0.1';
}

// ============================================
// FUNÇÃO PRINCIPAL DE RATE LIMITING
// ============================================

/**
 * Verifica e contabiliza uma requisição no rate limiter.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  // Nova janela
  if (!entry || now - entry.windowStart >= config.windowMs) {
    store.set(identifier, { count: 1, windowStart: now });
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt: now + config.windowMs,
      retryAfterSeconds: 0,
    };
  }

  // Janela ativa — incrementa
  entry.count += 1;
  const resetAt = entry.windowStart + config.windowMs;
  const remaining = Math.max(0, config.limit - entry.count);
  const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);

  if (entry.count > config.limit) {
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    limit: config.limit,
    remaining,
    resetAt,
    retryAfterSeconds: 0,
  };
}

// ============================================
// RESPONSE 429
// ============================================

/**
 * Cria NextResponse 429 Too Many Requests com headers padrão.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Muitas requisições. Tente novamente em alguns instantes.',
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.resetAt.toString(),
        'Retry-After': result.retryAfterSeconds.toString(),
      },
    }
  );
}

// ============================================
// HELPER PARA USAR NAS API ROUTES
// ============================================

/**
 * Aplica rate limiting em uma API route.
 * Retorna NextResponse 429 se excedeu o limite, ou null se permitido.
 *
 * @example
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const blocked = applyRateLimit(req, 'auth', AUTH_RATE_LIMIT);
 *   if (blocked) return blocked;
 *   // ... resto da lógica
 * }
 * ```
 */
export function applyRateLimit(
  req: NextRequest | Request,
  prefix: string,
  config: RateLimitConfig
): NextResponse | null {
  const ip = getClientIp(req);
  const key = `${ip}:${prefix}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return rateLimitResponse(result);
  }

  return null;
}

/**
 * Aplica rate limiting com identificador customizado (ex: IP + userId).
 * Útil para limitar por usuário autenticado.
 *
 * @example
 * ```ts
 * const blocked = applyRateLimitByKey(`${userId}:leads`, API_RATE_LIMIT);
 * if (blocked) return blocked;
 * ```
 */
export function applyRateLimitByKey(
  key: string,
  config: RateLimitConfig
): NextResponse | null {
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return rateLimitResponse(result);
  }

  return null;
}
