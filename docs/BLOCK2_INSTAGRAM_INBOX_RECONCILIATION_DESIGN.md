# Bloco 02 — Reconciliação segura da inbox Instagram/Chatwoot

Status: **proposta técnica; não implementada nem homologada**.

## Problema confirmado no código

A rota `src/app/api/atendimento/instagram/create-inbox/route.ts` faz POST/PATCH no Chatwoot antes de persistir `chatwootInboxId` em `Organization.settings`. A gravação local usa CAS (`updateMany` com `deletedAt: null` e igualdade de `settings`), protegendo contra sobrescrita concorrente. Se o POST remoto criar uma inbox e o CAS falhar, a inbox pode existir no Chatwoot sem referência local. Um novo POST pode duplicá-la.

Timeout, erro de rede e resposta inválida após o POST também têm resultado remoto indeterminado. A atualização de erro local por CAS não demonstra que o Chatwoot reverteu a operação.

## Contrato de segurança proposto

1. A operação sempre usa `organizationId` da sessão autorizada (`integrations:edit`) e a conta Chatwoot ativa vinculada à mesma organização. Nunca aceitar accountId, inboxId ou token do cliente como autoridade.
2. Antes de criar, consultar as inboxes da **conta Chatwoot vinculada** e reconciliar uma identidade persistente verificável. **Nome da inbox isoladamente não prova identidade** e não deve ser usado para adotar uma inbox.
3. Introduzir um identificador de operação estável por organização + canal + conta Chatwoot, persistido **antes** do POST, com exclusão mútua/estado durável e expiração recuperável. Exige desenho de schema/migração ou store transacional aprovado; não introduzir tabela ou migration neste ciclo sem autorização.
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

## Gate

Aprovação de desenho de persistência/lock e homologação funcional com Chatwoot isolado são pré-requisitos para considerar a reconciliação concluída. Este documento **não** representa implementação, teste funcional ou autorização de deploy.
