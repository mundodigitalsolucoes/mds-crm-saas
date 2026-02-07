import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/integrations/crypto';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const organizationId = (session.user as any).organizationId;

    const connection = await prisma.connectedAccount.findUnique({
      where: {
        provider_organizationId: {
          provider: 'meta',
          organizationId,
        },
      },
    });

    if (!connection) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    if (connection.expiresAt && new Date() > connection.expiresAt) {
      return NextResponse.json({ 
        connected: true, 
        expired: true,
        error: 'Token expirado, reconecte' 
      }, { status: 200 });
    }

    const accessToken = decryptToken(connection.accessTokenEnc);
    const connectionData = JSON.parse(connection.data || '{}');
    const adAccountId = connectionData.selectedAdAccountId;

    if (!adAccountId) {
      return NextResponse.json({
        connected: true,
        adAccounts: connectionData.adAccounts || [],
        needsSelection: true,
      });
    }

    // Buscar parâmetros de período
    const url = new URL(req.url);
    const datePreset = url.searchParams.get('date_preset') || 'last_30d';
    
    // Se for período customizado
    const timeRangeStart = url.searchParams.get('start');
    const timeRangeEnd = url.searchParams.get('end');

    // Montar URL de insights
    const insightsUrl = new URL(`https://graph.facebook.com/v19.0/${adAccountId}/insights`);
    insightsUrl.searchParams.set('access_token', accessToken);
    insightsUrl.searchParams.set(
      'fields',
      'impressions,reach,clicks,spend,cpc,cpm,ctr,actions,cost_per_action_type'
    );
    insightsUrl.searchParams.set('level', 'account');

    // Período customizado ou preset
    if (timeRangeStart && timeRangeEnd) {
      insightsUrl.searchParams.set('time_range', JSON.stringify({
        since: timeRangeStart,
        until: timeRangeEnd,
      }));
    } else {
      insightsUrl.searchParams.set('date_preset', datePreset);
    }

    const insightsRes = await fetch(insightsUrl.toString());
    const insightsData = await insightsRes.json();

    if (insightsData.error) {
      console.error('Erro ao buscar insights:', insightsData.error);
      return NextResponse.json(
        { connected: true, error: insightsData.error.message },
        { status: 200 }
      );
    }

    const insights = insightsData.data?.[0] || {};
    const actions = insights.actions || [];
    
    // Extrair leads e mensagens
    const leads = actions.find((a: any) => a.action_type === 'lead')?.value || 0;
    const messages = actions.find((a: any) => 
      a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
      a.action_type === 'onsite_conversion.messaging_first_reply'
    )?.value || 0;

    return NextResponse.json({
      connected: true,
      adAccountId,
      adAccountName: connectionData.selectedAdAccountName || '',
      metrics: {
        impressions: parseInt(insights.impressions || '0'),
        reach: parseInt(insights.reach || '0'),
        clicks: parseInt(insights.clicks || '0'),
        spend: parseFloat(insights.spend || '0'),
        cpc: parseFloat(insights.cpc || '0'),
        cpm: parseFloat(insights.cpm || '0'),
        ctr: parseFloat(insights.ctr || '0'),
        leads: parseInt(leads),
        messages: parseInt(messages),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar insights Meta:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
