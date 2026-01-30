# 🚀 Guia de Deploy no Coolify (Hostinger VPS)

## Pré-requisitos

- ✅ VPS Hostinger com Coolify instalado
- ✅ Chatwoot rodando na VPS
- ✅ Domínio configurado
- ✅ Código no GitHub/GitLab

## Passo 1: Preparar o Repositório

### 1.1 Criar repositório no GitHub

```bash
cd mds-crm-nextjs
git init
git add .
git commit -m "Initial commit: MDS CRM"
git branch -M main
git remote add origin https://github.com/seu-usuario/mds-crm.git
git push -u origin main
```

### 1.2 Verificar arquivos essenciais

Certifique-se que os seguintes arquivos estão no repositório:
- ✅ `Dockerfile`
- ✅ `docker-compose.yml`
- ✅ `.env.example`
- ✅ `package.json`
- ✅ `prisma/schema.prisma`

## Passo 2: Configurar no Coolify

### 2.1 Acessar Coolify

Acesse o painel do Coolify: `https://coolify.seudominio.com`

### 2.2 Criar Novo Projeto

1. Clique em "**+ New Project**"
2. Nome: `MDS CRM`
3. Clique em "**Create**"

### 2.3 Adicionar Aplicação

1. Dentro do projeto, clique em "**+ New Resource**"
2. Selecione "**Application**"
3. Escolha "**Public Repository**" ou conecte seu GitHub
4. Cole a URL: `https://github.com/seu-usuario/mds-crm.git`
5. Branch: `main`
6. Tipo: **Docker Compose** ou **Dockerfile**

## Passo 3: Configurar Banco de Dados

### 3.1 Adicionar PostgreSQL

1. No mesmo projeto, clique em "**+ New Resource**"
2. Selecione "**Database**"
3. Escolha "**PostgreSQL 15**"
4. Nome: `mds-crm-db`
5. Configure:
   - Database: `mds_crm`
   - Username: `mdscrm`
   - Password: `[Gerar senha forte]`
6. Clique em "**Create**"

### 3.2 Adicionar Redis (Opcional)

1. "**+ New Resource**" → "**Database**"
2. Escolha "**Redis**"
3. Nome: `mds-crm-cache`
4. Clique em "**Create**"

## Passo 4: Configurar Variáveis de Ambiente

### 4.1 Na aplicação, vá em "**Environment Variables**"

Adicione as seguintes variáveis:

```env
# Database
DATABASE_URL=postgresql://mdscrm:[SENHA_DO_POSTGRES]@mds-crm-db:5432/mds_crm?schema=public

# Redis (se configurado)
REDIS_URL=redis://mds-crm-cache:6379

# NextAuth
NEXTAUTH_URL=https://crm.seudominio.com
NEXTAUTH_SECRET=[GERAR_COM_COMANDO_ABAIXO]

# Chatwoot
CHATWOOT_API_URL=https://chatwoot.seudominio.com/api/v1
CHATWOOT_API_KEY=[SUA_API_KEY_DO_CHATWOOT]
CHATWOOT_ACCOUNT_ID=[SEU_ACCOUNT_ID]

# App
NEXT_PUBLIC_APP_URL=https://crm.seudominio.com
NEXT_PUBLIC_APP_NAME=MDS CRM
```

### 4.2 Gerar NEXTAUTH_SECRET

No terminal da VPS:

```bash
openssl rand -base64 32
```

Copie o resultado e cole em `NEXTAUTH_SECRET`

## Passo 5: Configurar Domínio

### 5.1 No Coolify

1. Vá na aplicação → "**Domains**"
2. Adicione: `crm.seudominio.com`
3. Habilite: "**Generate Let's Encrypt Certificate**"
4. Salve

### 5.2 Configurar DNS

No painel da Hostinger (ou onde seu domínio está):

1. Adicione um registro:
   - Tipo: **A** ou **CNAME**
   - Nome: `crm`
   - Valor: `IP_DA_VPS` ou `seudominio.com`
   - TTL: 3600

Aguarde propagação (5min - 24h)

## Passo 6: Deploy

### 6.1 Fazer primeiro deploy

1. Vá na aplicação no Coolify
2. Clique em "**Deploy**"
3. Aguarde o build (3-5 minutos)
4. Verifique os logs

### 6.2 Executar Migrations

Após o primeiro deploy, execute:

1. No Coolify, vá em "**Terminal**"
2. Execute:

```bash
npx prisma db push
```

## Passo 7: Configurar Webhook do Chatwoot

### 7.1 No Chatwoot

1. Acesse: Settings → Integrations → Webhooks
2. Clique em "**Add Webhook**"
3. Configure:
   - **URL:** `https://crm.seudominio.com/api/webhooks/chatwoot`
   - **Eventos:** Selecione todos
4. Salve

### 7.2 Testar Integração

1. Envie uma mensagem de teste no Chatwoot
2. Verifique se o lead foi criado no CRM
3. Acesse: `https://crm.seudominio.com/leads`

## Passo 8: Configurar Backups

### 8.1 Backup do PostgreSQL

No Coolify:
1. Vá no banco `mds-crm-db`
2. Configure "**Scheduled Backups**"
3. Frequência: Diária
4. Retenção: 7 dias

### 8.2 Backup Manual (via SSH)

```bash
ssh root@seu-vps
docker exec mds-crm-db pg_dump -U mdscrm mds_crm > backup-$(date +%Y%m%d).sql
```

## Passo 9: Monitoramento

### 9.1 Health Checks no Coolify

1. Na aplicação → "**Health Checks**"
2. Configure:
   - Endpoint: `/api/health`
   - Intervalo: 60s

### 9.2 Verificar Logs

```bash
# No Coolify, acesse "Logs" ou via SSH:
docker logs -f mds-crm-app
```

## Passo 10: Criar Usuário Admin

### 10.1 Via Prisma Studio

No terminal do Coolify:

```bash
npx prisma studio
```

Acesse: `http://IP_VPS:5555`

### 10.2 Ou via SQL direto

```bash
docker exec -it mds-crm-db psql -U mdscrm -d mds_crm
```

```sql
INSERT INTO users (id, email, name, password_hash, role)
VALUES (
  gen_random_uuid(),
  'admin@mds.com.br',
  'Administrador',
  '$2a$10$[HASH_GERADO]',
  'admin'
);
```

## Troubleshooting

### Build falha

```bash
# Limpar cache do Docker no Coolify
docker system prune -a
# Fazer rebuild
```

### Erro de conexão com banco

Verifique:
- ✅ DATABASE_URL está correto
- ✅ PostgreSQL está rodando
- ✅ Migrations foram executadas

### SSL não funciona

- Aguarde até 24h para propagação DNS
- Verifique se porta 443 está aberta
- Tente forçar renovação no Coolify

### Webhook do Chatwoot não funciona

- Verifique URL do webhook
- Teste endpoint: `curl https://crm.seudominio.com/api/webhooks/chatwoot`
- Veja logs de erro no Coolify

## Comandos Úteis

```bash
# Ver logs em tempo real
docker logs -f mds-crm-app

# Reiniciar aplicação
docker restart mds-crm-app

# Acessar banco
docker exec -it mds-crm-db psql -U mdscrm -d mds_crm

# Executar migrations
docker exec mds-crm-app npx prisma db push

# Backup do banco
docker exec mds-crm-db pg_dump -U mdscrm mds_crm > backup.sql
```

## Próximos Passos

1. ✅ Acessar o CRM: `https://crm.seudominio.com`
2. ✅ Fazer login com usuário admin
3. ✅ Configurar usuários da equipe
4. ✅ Testar integração com Chatwoot
5. ✅ Customizar campos de leads
6. ✅ Criar projetos de marketing

---

🎉 **Parabéns! Seu CRM está no ar!**

Suporte: suporte@mundodigital.com.br
