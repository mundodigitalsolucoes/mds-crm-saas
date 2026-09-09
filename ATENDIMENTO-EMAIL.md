# Atendimento — Canal de E-mail

## Objetivo

Conectar caixas do Google Workspace ou Gmail ao Atendimento pelo CRM, usando
OAuth do Google para autorizar IMAP e SMTP.

O primeiro canal previsto para homologação é:

- `contato@mundodigitalsolucoes.com.br`

## Configuração pelo CRM

1. No CRM, acesse **Configurações do Atendimento → Canais**.
2. Clique em **Adicionar E-mail**.
3. Clique em **Conectar com Google**.
4. Entre com a conta que será usada no Atendimento.
5. Autorize o acesso solicitado pelo Google.

## Configuração técnica aplicada

| Função | Servidor | Porta | Segurança |
|---|---|---:|---|
| Recebimento | `imap.gmail.com` | 993 | SSL |
| Envio | `smtp.gmail.com` | 587 | STARTTLS |

O CRM não recebe nem persiste a senha da Conta Google. A autorização OAuth é
entregue pelo Google diretamente ao Atendimento.

## Configuração única da infraestrutura

1. Crie um cliente OAuth 2.0 do tipo **Aplicativo da Web** no projeto Google
   Cloud da MDS.
2. Cadastre a URI autorizada:
   `https://app.mundodigitalsolucoes.com.br/google/callback`.
3. Configure no serviço do Atendimento no Coolify:
   `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET`.
4. Faça o redeploy do serviço do Atendimento.

As credenciais OAuth são segredos de infraestrutura e não devem ser incluídas
no código, no GitHub ou na interface do CRM.

A conexão é homologada pelo teste de recebimento e resposta descrito abaixo.
Isso evita manter uma requisição web aberta enquanto o servidor testa IMAP e
SMTP, situação que pode ser encerrada pelo proxy antes de receber uma resposta.

## Escopo de arquivos

O canal permite receber na conversa do Atendimento:

- PDF;
- DOC e DOCX;
- imagens;
- áudio;
- outros anexos aceitos pela infraestrutura atual do Atendimento.

Vídeos grandes devem continuar sendo enviados por link. Esta etapa não cria
storage, GED ou repositório próprio de arquivos no CRM.

## Fluxo dos briefings

O desenho de produto permanece:

**Briefing → respostas estruturadas no CRM → documento consolidado + materiais
enviados por e-mail → Inbox do Atendimento.**

Nesta etapa, apenas o canal de E-mail e o transporte dos anexos pelo Atendimento
são homologados.

## Validação após deploy

1. Enviar um e-mail externo com texto e um PDF pequeno.
2. Confirmar a criação da conversa na inbox correta.
3. Confirmar que o remetente aparece como contato e lead no tenant correto.
4. Abrir e baixar o PDF pela conversa.
5. Responder pela inbox e confirmar a entrega pelo mesmo endereço.
6. Repetir com DOCX, imagem e áudio.
7. Confirmar que outro tenant não lista nem administra a inbox.

## Rollback

Em erro de autorização, use **Conectar com Google** novamente em
**Configurações do Atendimento → Canais**.

A remoção do canal não apaga as mensagens existentes na caixa do Google.
