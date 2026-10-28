// Next discovers middleware beside src/app. Delegate to the existing guard; no parallel auth engine.
import type { NextRequest } from 'next/server';
import existingMiddleware from '../middleware';
export default function middleware(request: NextRequest) { return existingMiddleware(request); }
export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static).*)'],
};
