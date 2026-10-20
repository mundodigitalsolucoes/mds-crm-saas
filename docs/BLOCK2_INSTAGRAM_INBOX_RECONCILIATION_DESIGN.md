# Bloco 02 — Reconciliação segura da inbox Instagram/Chatwoot

Status: **reserva CAS pré-POST parcialmente implementada e validada em testes de banco; reconciliação remota não implementada nem homologada**.

## Problema confirmado no código

A rota `src/app/api/atendimento/instagram/create-inbox/route.ts` reserva agora o estado `pending` em `Organization.settings` por CAS (`updateMany` com `id`, `deletedAt: null` e igualdade de `settings`) **antes do POST de criação** no Chatwoot. Se outra operação vencer a reserva, não envia o POST. A confirmação e a gravação de erro também usam CAS contra o estado reservado. `pending` e `reconciliation_required` bloqueiam novo POST sem reconciliação. Isso reduz a duplicação por concorrência direta, mas **não resolve** a recuperação após sucesso remoto e falha de persistência, nem garante que outras rotas de configuração preservem a reserva. O PATCH de inbox existente não usa essa reserva prévia.

Timeout, erro de rede e resposta inválida após o POST também têm resultado remoto indeterminado. A atualização de erro local por CAS não demonstra que o Chatwoot reverteu a operação.

## Contrato de segurança proposto

1. A operação sempre usa `organizationId` da sessão autorizada (`integrations:edit`) e a conta Chatwoot ativa vinculada à mesma organização. Nunca aceitar accountId, inboxId ou token do cliente como autoridade.
2. Antes de criar, consultar as inboxes da **conta Chatwoot vinculada** e reconciliar uma identidade persistente verificável. **Nome da inbox isoladamente não prova identidade** e não deve ser usado para adotar uma inbox.
3. Evoluir a reserva CAS já implementada para um identificador de operação estável por organização + canal + conta Chatwoot, persistido **antes** do POST, com exclusão mútua/estado durável e expiração recuperável. A reserva atual é apenas um estado JSON `pending`, sem ID correlacionável ou recuperação automática; o desenho robusto exige schema/migração ou store transacional aprovado. Não introduzir tabela ou migration neste ciclo sem autorização.
4. Usar uma chave de correlação que possa ser verificada na inbox remota (ex.: webhook URL com marcador assinado e específico da organização, se suportado e validado no fluxo real). Não usar somente o webhook genérico atual, pois ele é compartilhado.
5. Estados explícitos: `pending`, `remote_unknown`, `reconciled`, `completed`, `failed_before_remote`. Após timeout, resposta inválida ou falha de CAS, **não repetir POST automaticamente**; exigir consulta remota segura e reconciliação.
6. Se a consulta remota não comprovar uma única inbox pertencente à operação e ao tenant, manter `remote_unknown` e solicitar intervenção autorizada. Nunca associar inbox de outra organização.
7. O resultado da reconciliação deve registrar evidência auditável sem tokens, respostas brutas ou segredos, e proteger contra dois operadores concorrentes.
8. Não alterar a regra comercial `observe_only`, os adapters de provider, o CORE protegido ou a integração existente sem homologação isolada.

## Cenários obrigatórios de homologação

- Duas organizações, contas Chatwoot distintas, mesmos nomes de inbox: nunca cruzar referências.
- Duas requisições simultâneas na mesma organização: no máximo um POST remoto.
- POST remoto bem-sucedido + CAS local falha: recuperar sem duplicar inbox.
- Timeout após criação remota: consultar e reconciliar, sem novo POST cego.
- Falha antes de enviar POST: retry seguro.
- Organização excluída ou conta Chatwoot desativada durante a operação: bloquear persistência e adoção.
- Resposta remota com id ausente, múltiplas candidatas ou identidade inconsistente: não adotar.
- Logs e respostas HTTP sem tokens e sem payload bruto do provedor.

## Evidência e limitações da implementação parcial

- Reserva pré-POST, rejeição de conflitos, estado `pending` e bloqueio de retry cego estão implementados na rota de criação.
- Testes estáticos: `tests/authorization-instagram-sync-tenant.test.cjs`; workflow Block 2 Authorization Regression aprovado na execução `39356429202`.
- Testes reais com PostgreSQL descartável: `tests/security-c03-c04-postgres.test.cjs` exercita CAS concorrente, isolamento por tenant, soft-delete e rejeição de confirmação/erro com estado obsoleto. Workflow C03-C04 Security Regression aprovado nas execuções `39356706660`, `39356859802` e `39357025461`.
- Esses testes de banco usam tabelas descartáveis e SQL equivalente ao predicado de CAS; **não são testes HTTP end-to-end da rota nem simulação do Chatwoot**.
- Auditoria das 13 rotas em `src/app/api/atendimento/instagram/`: as sete rotas de gravação de configurações (`route.ts`, `callback`, `exchange-token`, `select-account`, `sync-account`, `subscribe-page`, `create-inbox`) agora possuem proteção específica de reserva/reconciliação; as seis restantes (`accounts`, `connect`, `debug-business-pages`, `debug-pages`, `debug-token`, `webhook`) não executam escrita direta de `Organization.settings` nesta revisão. A regressão das rotas OAuth passou na execução `39358010138`. **Este inventário é restrito a esse diretório**, não prova ausência de escritores indiretos ou externos.
- Risco remanescente: outros escritores de `Organization.settings` fora dessas rotas podem invalidar a reserva; um POST remoto pode ter sido concluído e a referência local perdida. Sem identidade remota verificável e fluxo de reconciliação, não repetir POST cegamente.
- Recuperação de `pending` abandonado após queda do processo ainda requer intervenção operacional segura; não há TTL de desbloqueio automático. Nunca limpar `pending` apenas por idade sem verificar o resultado remoto.

## Gate

Aprovação de desenho de persistência/lock e homologação funcional com Chatwoot isolado são pré-requisitos para considerar a reconciliação concluída. Este documento registra **implementação parcial e testes de banco**, mas **não** representa reconciliação remota concluída, homologação funcional ou autorização de deploy.
