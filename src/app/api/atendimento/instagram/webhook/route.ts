import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('📩 Instagram Webhook recebido:', JSON.stringify(body, null, 2))

    // Estrutura padrão Chatwoot webhook
    const event = body?.event
    const conversation = body?.conversation
    const messages = body?.messages

    if (!event) {
      return NextResponse.json({ ok: true })
    }

    // Exemplo de eventos comuns
    switch (event) {
      case 'message_created':
        console.log('💬 Nova mensagem recebida')

        // Aqui depois vamos:
        // - salvar lead
        // - vincular conversa
        // - disparar automações

        break

      case 'conversation_created':
        console.log('🧩 Nova conversa criada')
        break

      case 'conversation_updated':
        console.log('🔄 Conversa atualizada')
        break

      default:
        console.log('📌 Evento não tratado:', event)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('❌ Erro webhook Instagram:', error)

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}