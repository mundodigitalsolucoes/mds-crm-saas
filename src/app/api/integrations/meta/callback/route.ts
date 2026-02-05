import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET(req: Request) {
  const url = new URL(req.url);
  
  // Pega organizationId da URL: ?organizationId=xxx
  const organizationId = url.searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId é obrigatório' }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  
  if (!appId || !redirectUri) {
    return NextResponse.json({ error: 'META_APP_ID ou META_REDIRECT_URI não configurados' }, { status: 500 });
  }

  // State para CSRF + carregar organizationId no callback
  const nonce = randomBytes(16).toString('hex');
  const stateObj = { organizationId, nonce };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

  // Escopos para ads
  const scopes = ['ads_read', 'business_management', 'email'].join(',');

  // URL de autorização da Meta
  const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(authUrl.toString());
}
