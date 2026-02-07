import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/integrations/crypto';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    if (error) {
      const errorDescription = url.searchParams.get('error_description') || 'Erro desconhecido';
      console.error('Erro OAuth Meta:', error, errorDescription);
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?error=${encodeURIComponent(errorDescription)}`
      );
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?error=Parâmetros inválidos`
      );
    }

    let stateObj: { organizationId: string; odataUserId?: string; nonce: string };
    try {
      const decoded = Buffer.from(stateParam, 'base64url').toString('utf8');
      stateObj = JSON.parse(decoded);
    } catch {
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?error=State inválido`
      );
    }

    const { organizationId, odataUserId } = stateObj;

    // Trocar code por access_token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', process.env.META_APP_ID!);
    tokenUrl.searchParams.set('redirect_uri', process.env.META_REDIRECT_URI!);
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('Erro ao trocar code por token:', tokenData.error);
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?error=${encodeURIComponent(tokenData.error.message)}`
      );
    }

    const { access_token, expires_in } = tokenData;

    // Trocar por long-lived token (60 dias)
    const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', process.env.META_APP_ID!);
    longLivedUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
    longLivedUrl.searchParams.set('fb_exchange_token', access_token);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    const finalToken = longLivedData.access_token || access_token;
    const finalExpiresIn = longLivedData.expires_in || expires_in;

    // Buscar contas de anúncio
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,currency,account_status&access_token=${finalToken}`
    );
    const adAccountsData = await adAccountsRes.json();

    const accessTokenEnc = encryptToken(finalToken);

    const expiresAt = finalExpiresIn
      ? new Date(Date.now() + finalExpiresIn * 1000)
      : null;

    await prisma.connectedAccount.upsert({
      where: {
        provider_organizationId: {
          provider: 'meta',
          organizationId,
        },
      },
      update: {
        accessTokenEnc,
        expiresAt,
        connectedById: odataUserId || null,
        data: JSON.stringify({
          adAccounts: adAccountsData.data || [],
          selectedAdAccountId: null,
          connectedAt: new Date().toISOString(),
        }),
        updatedAt: new Date(),
      },
      create: {
        provider: 'meta',
        organizationId,
        connectedById: odataUserId || null,
        accessTokenEnc,
        expiresAt,
        data: JSON.stringify({
          adAccounts: adAccountsData.data || [],
          selectedAdAccountId: null,
          connectedAt: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?success=Meta conectado com sucesso`
    );
  } catch (error) {
    console.error('Erro no callback Meta:', error);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?error=Erro ao processar callback`
    );
  }
}
