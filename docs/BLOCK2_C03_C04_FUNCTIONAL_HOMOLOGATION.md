# Bloco 2 — Plano de homologação funcional C03/C04

**Branch candidata:** `feature/modular-plans-entitlements`  
**Última evidência de build:** [GitHub Actions #39178620953](https://github.com/mundodigitalsolucoes/mds-crm-saas/actions/runs/39178620953), sucesso no commit `972e4a6`.

## Pré-condições e limites

- Executar **somente** em uma instalação de homologação isolada, com banco descartável e usuários fictícios; nunca apontar `DATABASE_URL` para produção.
- Sem deploy, merge, migração, provisionamento real de providers, envio de e-mail real, alteração de segredos do Coolify ou dados de clientes.
- `ADMIN_JWT_SECRET` fictício de >=32 caracteres no ambiente isolado. O segredo real existente no Coolify **não deve ser copiado**.
- Chatwoot/Evolution/Meta Cloud devem ser substituídos por mocks ou bloqueados por rede. Não acionar o fluxo real de criação de contas Chatwoot.
- O `prestart` do package.json executa `prisma migrate deploy`: não usar `npm start` conectado a qualquer banco real; validar inicialização isolada com atenção ao comando.

## Matriz de cenários

| ID | Cenário | Resultado esperado |
| --- | --- | --- |
| C03-01 | Login admin com credenciais válidas e segredo forte | Cookie HttpOnly; GET /api/admin/auth autenticado |
| C03-02 | Senha admin inválida | 401, nenhum cookie autenticado |
| C03-03 | Segredo ausente, curto ou fallback conhecido | Login falha fechado; nenhum JWT emitido |
| C03-04 | JWT adulterado, expirado, algoritmo não permitido ou papel diferente | Acesso negado |
| C03-05 | JWT válido de admin removido do banco | GET admin e APIs sensíveis negados |
| C03-06 | JWT válido de admin com e-mail alterado no banco | Acesso negado |
| C03-07 | Logout | Cookie removido; chamadas subsequentes negadas |
| C03-08 | GET/POST provision-chatwoot sem admin autorizado | 401 antes de consultar organização ou acionar provider |
| C04-01 | Novo usuário e organização fictícios | Cadastro criado uma vez, sem efeitos reais em providers |
| C04-02 | E-mail de usuário ativo | 400, usuário e organização intactos |
| C04-03 | E-mail de usuário soft-deleted | 400, sem reativação nem promoção owner |
| C04-04 | E-mail de usuário de organização soft-deleted | 400, tenant permanece excluído |
| C04-05 | Duas requisições simultâneas com mesmo e-mail | Uma criação no máximo; segunda 400/409; nenhum tenant órfão |
| C04-06 | Convite e recuperação legítimos | Funcionam conforme política existente, sem abrir reativação via signup |
| C04-07 | Recuperação de usuário excluído | **Revisar política separadamente**: o código de forgot-password atualmente procura por e-mail sem filtro deletedAt; não tratar como corrigido por C04 |

## Procedimento de evidência

1. Confirmar SHA exato do candidato e estado dos workflows; registrar URL das execuções e logs.
2. Preparar banco **novo e descartável** com dados fictícios e dependências simuladas. Não usar credenciais reais.
3. Executar cenários acima, capturar status HTTP, efeitos no banco e ausência de chamadas aos providers.
4. Verificar invariantes: role, passwordHash, deletedAt, organizationId, planStatus e registros de ConnectedAccount antes/depois dos casos negativos.
5. Registrar PASS/FAIL/SKIP com motivo e evidência, incluindo falhas de configuração.
6. Não promover para produção até revisão independente, rollback preparado e autorização explícita.

## Situação atual

**Plano preparado, homologação funcional NÃO executada.** Os testes estáticos e o build aprovados não substituem os cenários autenticados acima. C01/C02 permanecem fora de escopo.

## Additional read-only auth review

- `src/lib/auth.ts`: Credentials authorize returns null for soft-deleted users or organizations. Its JWT callback refreshes these flags, but on DB exceptions preserves current token; investigate fail-closed behavior in a separate authorized security scope.
- `src/app/api/auth/forgot-password/route.ts`: user lookup filters by email only; it may issue and email reset tokens for soft-deleted users or tenants.
- `src/app/api/auth/reset-password/route.ts`: token validation and user lookup do not check `user.deletedAt` or `organization.deletedAt`. This can change a deleted user's password hash; it does not by itself demonstrate successful login.
- **Decision pending:** define whether deleted users/tenants may recover credentials, and implement a fail-closed policy consistently in both recovery endpoints, including tokens issued before deletion. Do not silently change this business behavior without approval.
- Added two source-regression tests for existing login deletion guard and separation of recovery from signup; these tests do **not** prove recovery is safe.

## CI evidence update — 2026-10-19

- [C03-C04 Security Regression workflow](https://github.com/mundodigitalsolucoes/mds-crm-saas/actions/workflows/security-c03-c04.yml): run #4, commit `9718fed`, **success**, 7s. Includes the added source-level guard for password recovery endpoints.
- [C03-C04 Build Validation workflow](https://github.com/mundodigitalsolucoes/mds-crm-saas/actions/workflows/security-c03-c04-build.yml): run #3, commit `08206ab`, **success**, 1m11s. Includes both password-recovery route changes.
- These statuses were verified in the GitHub Actions workflow listings. Authenticated end-to-end tests remain outstanding.

## Pre-commercial pilot clarification

- The user confirmed there are **no paying subscribers yet**; only the operator uses the CRM.
- The ten-day delinquency policy is a **future commercialization requirement**, not an instruction to suspend the current pilot or activate billing.
- Do not assume any existing `Organization` is exempt solely because it is the only one or belongs to a particular email. An explicit internal-account classification must be designed and approved before billing enforcement.
- Prioritize C03/C04 functional staging tests and the remaining C01/C02 security audit. Do not modify provider lifecycle, plan enforcement, Coolify, production data or subscription statuses.
