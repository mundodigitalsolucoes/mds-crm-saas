// src/lib/email.ts
// Serviço de email do MDS CRM via Resend
// Funções: recuperação de senha, convite de membro

import { Resend } from 'resend';

const CRM_URL = process.env.NEXTAUTH_URL || 'https://crm.mundodigitalsolucoes.com.br';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY não configurada');
    return null;
  }

  return new Resend(apiKey);
}

// ============================================
// EMAIL DE RECUPERAÇÃO DE SENHA
// ============================================

interface SendPasswordResetEmailParams {
  to: string;
  userName: string;
  resetLink: string;
}

export async function sendPasswordResetEmail({
  to,
  userName,
  resetLink,
}: SendPasswordResetEmailParams) {
  const resend = getResendClient();

  if (!resend) {
    return {
      success: false,
      error: 'RESEND_API_KEY not configured',
    };
  }

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
                  <tr>
                    <td style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);padding:32px 40px;text-align:center;">
                      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">MDS CRM</h1>
                      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Recuperação de Senha</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <p style="color:#18181b;font-size:16px;margin:0 0 8px;">Olá, <strong>${userName}</strong>!</p>
                      <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                        Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
                      </p>
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
    });

    if (error) {
      console.error('[Email] Erro ao enviar email de recuperação:', error);
      return { success: false, error };
    }

    console.log('[Email] Email de recuperação enviado com sucesso:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[Email] Erro inesperado ao enviar email:', error);
    return { success: false, error };
  }
}

// ============================================
// EMAIL DE CONVITE DE MEMBRO
// ============================================

interface SendInviteEmailParams {
  to: string;
  userName: string;
  password: string;
  role: string;
  invitedBy: string;
  organizationName?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuário',
};

export async function sendInviteEmail({
  to,
  userName,
  password,
  role,
  invitedBy,
  organizationName,
}: SendInviteEmailParams) {
  const resend = getResendClient();

  if (!resend) {
    return {
      success: false,
      error: 'RESEND_API_KEY not configured',
    };
  }

  const loginUrl = `${CRM_URL}/auth/login`;
  const roleLabel = ROLE_LABELS[role] || role;
  const orgDisplay = organizationName || 'sua organização';

  try {
    const { data, error } = await resend.emails.send({
      from: 'MDS CRM <noreply@mundodigitalsolucoes.com.br>',
      to: [to],
      subject: `Você foi convidado para o MDS CRM — ${orgDisplay}`,
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

                  <tr>
                    <td style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);padding:32px 40px;text-align:center;">
                      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">MDS CRM</h1>
                      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Bem-vindo à equipe! 🎉</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:40px;">
                      <p style="color:#18181b;font-size:16px;margin:0 0 8px;">
                        Olá, <strong>${userName}</strong>!
                      </p>
                      <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                        <strong>${invitedBy}</strong> convidou você para fazer parte da equipe
                        <strong>${orgDisplay}</strong> no MDS CRM como <strong>${roleLabel}</strong>.
                      </p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                        <tr>
                          <td style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;">
                            <p style="color:#0369a1;font-size:13px;font-weight:600;margin:0 0 12px;">
                              🔑 Suas credenciais de acesso:
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0;font-weight:600;">Email:</td>
                                <td style="color:#18181b;font-size:13px;padding:4px 0;">${to}</td>
                              </tr>
                              <tr>
                                <td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0;font-weight:600;">Senha:</td>
                                <td style="color:#18181b;font-size:13px;padding:4px 0;font-family:monospace;letter-spacing:1px;">${password}</td>
                              </tr>
                              <tr>
                                <td style="color:#64748b;font-size:13px;padding:4px 12px 4px 0;font-weight:600;">Cargo:</td>
                                <td style="color:#18181b;font-size:13px;padding:4px 0;">${roleLabel}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="padding:8px 0 32px;">
                            <a href="${loginUrl}"
                               target="_blank"
                               style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                              Acessar o CRM
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 16px;">
                        Ou acesse diretamente pelo link:
                      </p>
                      <p style="background-color:#f4f4f5;padding:12px 16px;border-radius:8px;word-break:break-all;margin:0 0 24px;">
                        <a href="${loginUrl}" style="color:#3b82f6;font-size:12px;text-decoration:none;">${loginUrl}</a>
                      </p>

                      <div style="border-top:1px solid #e4e4e7;padding-top:20px;margin-top:8px;">
                        <p style="color:#a1a1aa;font-size:12px;line-height:1.5;margin:0;">
                          🔒 Recomendamos que você altere sua senha após o primeiro acesso em <strong>Minha Conta</strong>.<br>
                          📧 Se você não esperava este convite, entre em contato com ${invitedBy}.
                        </p>
                      </div>
                    </td>
                  </tr>

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
    });

    if (error) {
      console.error('[Email] Erro ao enviar convite:', error);
      return { success: false, error };
    }

    console.log('[Email] Convite enviado com sucesso para:', to, '| ID:', data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('[Email] Erro inesperado ao enviar convite:', error);
    return { success: false, error };
  }
}