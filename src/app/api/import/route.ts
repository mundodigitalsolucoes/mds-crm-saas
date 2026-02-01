import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    const { leads } = await request.json();

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    let sucesso = 0;
    let falhas = 0;

    for (const lead of leads) {
      try {
        await sql`
          INSERT INTO leads (nome, email, telefone, empresa, status, origem, data_criacao)
          VALUES (${lead.nome}, ${lead.email}, ${lead.telefone}, ${lead.empresa}, ${lead.status}, ${lead.origem}, NOW())
        `;
        sucesso++;
      } catch (error) {
        console.error('Erro ao inserir lead:', error);
        falhas++;
      }
    }

    return NextResponse.json({
      sucesso,
      falhas,
      total: leads.length,
      message: `${sucesso} leads importados com sucesso, ${falhas} falharam`
    });

  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json({ error: 'Erro ao importar leads' }, { status: 500 });
  }
}
