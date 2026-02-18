// src/app/api/integrations/meta/connect/route.ts
// Inicia OAuth com Meta/Facebook - requer permissão integrations.edit
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { checkPermission } from '@/lib/checkPermission';

export async function GET() {
  try {
    // ✅ Permissão granular: integrations.edit (conectar = configurar)
    const { allowed, session, errorResponse } = await checkPermission('integrations', 'edit');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_REDIRECT_URI;

    if (!appId || !redirectUri) {
      return NextResponse.json(
        { error: 'META_APP_ID ou META_REDIRECT_URI não configurados' },
        { status: 500 }
      );
    }

    const nonce = randomBytes(16).toString('hex');
    const stateObj = { organizationId, nonce, odataUserId: session!.user.id };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

    const scopes = [
      'ads_read',
      'ads_management',
      'business_management',
      'read_insights',
      'email',
    ].join(',');

    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Erro ao iniciar OAuth Meta:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
