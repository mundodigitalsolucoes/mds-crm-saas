# Atendimento — Canal de E-mail

## Objetivo

Conectar caixas do Google Workspace ou Gmail ao Atendimento pelo CRM, usando
IMAP para recebimento e SMTP para envio.

O primeiro canal previsto para homologação é:

- `contato@mundodigitalsolucoes.com.br`

## Configuração pelo CRM

1. Ative a verificação em duas etapas na Conta Google da caixa de e-mail.
2. Gere uma senha de app de 16 caracteres para uso no Atendimento.
3. No CRM, acesse **Configurações do Atendimento → Canais**.
4. Clique em **Adicionar E-mail**.
5. Informe o nome do canal, o endereço de e-mail e a senha de app.
6. Clique em **Conectar e salvar**.

A senha comum da Conta Google não deve ser usada.

## Configuração técnica aplicada

| Função | Servidor | Porta | Segurança |
|---|---|---:|---|
| Recebimento | `imap.gmail.com` | 993 | SSL |
| Envio | `smtp.gmail.com` | 587 | STARTTLS |

O CRM não persiste nem devolve a senha de app. A credencial é enviada somente
ao Atendimento durante a ativação do canal.

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

Em erro de IMAP ou SMTP durante a homologação, use **Remover canal** em
**Configurações do Atendimento → Canais**, confira a senha de app e conecte
novamente.

A remoção do canal não apaga as mensagens existentes na caixa do Google.
