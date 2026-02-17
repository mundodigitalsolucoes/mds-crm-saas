import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendPasswordResetEmailParams {
  to: string
  userName: string
  resetLink: string
}

/**
 * Envia email de recuperação de senha
 */
export async function sendPasswordResetEmail({
  to,
  userName,
  resetLink,
}: SendPasswordResetEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'MDS CRM <noreply@mundodigitalsolucoes.com.br>',
      to: [to],
      subject: 'Recuperação de Senha - MDS CRM',
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);padding:32px 40px;text-align:center;">
                      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">MDS CRM</h1>
                      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Recuperação de Senha</p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <p style="color:#18181b;font-size:16px;margin:0 0 8px;">Olá, <strong>${userName}</strong>!</p>
                      <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                        Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
                      </p>

                      <!-- Button -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="padding:8px 0 32px;">
                            <a href="${resetLink}" 
                               target="_blank"
                               style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                              Redefinir Minha Senha
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 16px;">
                        Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                      </p>
                      <p style="background-color:#f4f4f5;padding:12px 16px;border-radius:8px;word-break:break-all;margin:0 0 24px;">
                        <a href="${resetLink}" style="color:#3b82f6;font-size:12px;text-decoration:none;">${resetLink}</a>
                      </p>

                      <div style="border-top:1px solid #e4e4e7;padding-top:20px;margin-top:8px;">
                        <p style="color:#a1a1aa;font-size:12px;line-height:1.5;margin:0;">
                          ⏱️ Este link expira em <strong>1 hora</strong>.<br>
                          🔒 Se você não solicitou esta recuperação, ignore este email. Sua senha permanecerá inalterada.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color:#fafafa;padding:24px 40px;text-align:center;border-top:1px solid #e4e4e7;">
                      <p style="color:#a1a1aa;font-size:11px;margin:0;">
                        © ${new Date().getFullYear()} Mundo Digital Soluções — Todos os direitos reservados.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    })

    if (error) {
      console.error('[Email] Erro ao enviar email de recuperação:', error)
      return { success: false, error }
    }

    console.log('[Email] Email de recuperação enviado com sucesso:', data?.id)
    return { success: true, data }
  } catch (error) {
    console.error('[Email] Erro inesperado ao enviar email:', error)
    return { success: false, error }
  }
}
