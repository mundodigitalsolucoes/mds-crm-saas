# 🚀 Deploy no Coolify - Guia Completo

## Pré-requisitos

- ✅ Coolify instalado na VPS Hostinger
- ✅ Chatwoot instalado e rodando em `app.mundodigitalsolucoes.com.br`
- ✅ Repositório no GitHub
- ✅ Domínio `crm.mundodigitalsolucoes.com.br` configurado

---

## PASSO 1: Preparar Repositório GitHub

### 1.1 Inicializar Git (se ainda não estiver)

\`\`\`bash
cd mds-crm-nextjs

# Inicializar Git
git init

# Adicionar todos os arquivos
git add .

# Commit inicial
git commit -m "feat: Initial commit - MDS CRM SaaS"
\`\`\`

### 1.2 Criar repositório no GitHub

1. Acesse: https://github.com/new
2. Nome: **mds-crm-saas**
3. Descrição: **Sistema completo de CRM SaaS com integração Chatwoot**
4. Visibilidade: **Private** (recomendado)
5. Clique em **"Create repository"**

### 1.3 Fazer push para GitHub

\`\`\`bash
# Adicionar remote
git remote add origin https://github.com/SEU-USUARIO/mds-crm-saas.git

# Renomear branch para main
git branch -M main

# Push
git push -u origin main
\`\`\`

---

## PASSO 2: Configurar PostgreSQL no Coolify

### 2.1 Adicionar Database

1. No painel Coolify, clique em **"Resources"**
2. Clique em **"+ New"** → **"Database"**
3. Selecione **"PostgreSQL"**

### 2.2 Configurar PostgreSQL

\`\`\`
Name: mds-crm-postgres
Version: 15 (ou latest)
Database Name: mds_crm
Username: mdscrm
Password: [gerar senha forte - mínimo 16 caracteres]
Port: 5432
\`\`\`

### 2.3 Anotar Connection String

Após criar, Coolify mostrará a connection string. Copie algo como:

\`\`\`
postgresql://mdscrm:senha_gerada@mds-crm-postgres:5432/mds_crm
\`\`\`

---

## PASSO 3: Configurar Aplicação Next.js no Coolify

### 3.1 Adicionar Aplicação

1. No painel Coolify, clique em **"Resources"**
2. Clique em **"+ New"** → **"Application"**
3. Selecione **"Public Repository"**

### 3.2 Configurar Repositório

\`\`\`
Source: Public Repository
Git Repository URL: https://github.com/SEU-USUARIO/mds-crm-saas.git
Branch: main
\`\`\`

### 3.3 Configurar Build

\`\`\`
Build Pack: nixpacks
Framework: Next.js
Install Command: npm install
Build Command: npm run build
Start Command: npm run start
Port: 3000
\`\`\`

---

## PASSO 4: Configurar Variáveis de Ambiente

No Coolify, vá em **"Environment Variables"** e adicione:

### Variáveis Essenciais

\`\`\`env
# Database
DATABASE_URL=postgresql://mdscrm:SUA_SENHA@mds-crm-postgres:5432/mds_crm

# NextAuth (gerar com: openssl rand -base64 32)
NEXTAUTH_SECRET=COLE_AQUI_O_SECRET_GERADO
NEXTAUTH_URL=https://crm.mundodigitalsolucoes.com.br

# Chatwoot
CHATWOOT_API_URL=https://app.mundodigitalsolucoes.com.br/api/v1
CHATWOOT_API_KEY=SUA_CHATWOOT_API_KEY
CHATWOOT_ACCOUNT_ID=1

# Environment
NODE_ENV=production
\`\`\`

### Variáveis Opcionais (adicionar depois)

\`\`\`env
# Google Gemini AI
GEMINI_API_KEY=sua_gemini_key

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@mundodigitalsolucoes.com.br
SMTP_PASSWORD=sua_senha_app
SMTP_FROM=noreply@mundodigitalsolucoes.com.br
\`\`\`

### Como adicionar no Coolify:

1. Clique em **"Add Variable"**
2. Key: \`DATABASE_URL\`
3. Value: \`postgresql://mdscrm:senha@mds-crm-postgres:5432/mds_crm\`
4. Repita para cada variável

---

## PASSO 5: Configurar Domínio

### 5.1 Adicionar Domínio no Coolify

1. Vá em **"Domains"**
2. Clique em **"Add Domain"**
3. Digite: \`crm.mundodigitalsolucoes.com.br\`
4. Clique em **"Add"**

### 5.2 Configurar DNS

No painel de DNS do seu domínio (ex: Registro.br ou Cloudflare):

**Tipo A:**
\`\`\`
Host: crm
Tipo: A
Valor: [IP da sua VPS Hostinger]
TTL: 3600
\`\`\`

**Ou se usar proxy Cloudflare:**
\`\`\`
Host: crm
Tipo: CNAME
Valor: seu-servidor.hostinger.com
Proxy: Ativado (laranja)
TTL: Auto
\`\`\`

### 5.3 SSL Automático

O Coolify gerará o certificado SSL automaticamente via Let's Encrypt. Aguarde 1-5 minutos.

---

## PASSO 6: Deploy

### 6.1 Fazer Deploy

1. No Coolify, clique em **"Deploy"**
2. Aguarde o processo (5-10 minutos)
3. Acompanhe os logs em **"Build Logs"**

### 6.2 Verificar Status

Status esperado:
- ✅ Build: Success
- ✅ Deploy: Success
- ✅ Health Check: Passing
- ✅ SSL: Active

---

## PASSO 7: Executar Migrations

### 7.1 Acessar Console

No Coolify, vá em **"Terminal"** ou **"Execute Command"**

### 7.2 Executar Prisma

\`\`\`bash
# Gerar Prisma Client
npx prisma generate

# Aplicar schema no banco
npx prisma db push

# (Opcional) Visualizar dados
npx prisma studio
\`\`\`

---

## PASSO 8: Configurar Webhook do Chatwoot

### 8.1 Obter API Key do Chatwoot

1. Acesse: https://app.mundodigitalsolucoes.com.br
2. Login como admin
3. Vá em **Settings → Integrations → API**
4. Clique em **"Create new access token"**
5. Copie o token gerado

### 8.2 Adicionar no Coolify

Volte nas **Environment Variables** do Coolify e atualize:

\`\`\`
CHATWOOT_API_KEY=cole_aqui_o_token_real
\`\`\`

Clique em **"Restart"** para aplicar

### 8.3 Configurar Webhook no Chatwoot

1. No Chatwoot, vá em **Settings → Integrations → Webhooks**
2. Clique em **"Add new webhook"**
3. Configure:

\`\`\`
URL: https://crm.mundodigitalsolucoes.com.br/api/webhooks/chatwoot
Events (marcar):
  ✅ conversation_created
  ✅ conversation_status_changed
  ✅ message_created
  ✅ contact_created
\`\`\`

4. Clique em **"Save"**

### 8.4 Testar Webhook

1. Envie uma mensagem de teste no Chatwoot
2. Verifique nos logs do Coolify se recebeu o webhook
3. Verifique se o lead foi criado no CRM

---

## PASSO 9: Configurar Backup Automático

### 9.1 Backup do PostgreSQL

No Coolify, configure backup automático:

1. Vá no PostgreSQL → **"Backup"**
2. Configure:
   - Frequência: Diária
   - Hora: 03:00 AM
   - Retenção: 7 dias
   - Destino: S3/Spaces (recomendado)

### 9.2 Snapshot da Aplicação

Configure snapshot semanal da aplicação completa.

---

## PASSO 10: Monitoramento

### 10.1 Logs

Acompanhar logs em tempo real:

\`\`\`bash
# No Coolify, vá em "Logs" e mantenha aberto
\`\`\`

### 10.2 Health Checks

Configure alertas:
- Email quando aplicação cair
- Telegram/Slack para notificações

### 10.3 Métricas

Monitore:
- CPU usage
- Memory usage
- Database connections
- Response time

---

## ✅ Checklist Pós-Deploy

- [ ] Aplicação acessível em https://crm.mundodigitalsolucoes.com.br
- [ ] SSL ativo (cadeado verde)
- [ ] Login funcionando
- [ ] Registro de novo usuário funcionando
- [ ] Dashboard carregando
- [ ] PostgreSQL conectado
- [ ] Webhook Chatwoot configurado e testado
- [ ] Backup automático configurado
- [ ] Domínio com DNS propagado
- [ ] Variáveis de ambiente corretas

---

## 🔧 Troubleshooting

### Erro de Build

\`\`\`bash
# Verificar logs de build
# Geralmente relacionado a:
# - Dependências faltando
# - Variáveis de ambiente incorretas
# - Erro no código TypeScript
\`\`\`

**Solução:**
1. Verificar package.json
2. Verificar build localmente: \`npm run build\`
3. Corrigir erros e fazer novo push

### Erro de Deploy

\`\`\`bash
# Aplicação buildou mas não iniciou
# Verificar:
# - PORT correto (3000)
# - Start command: npm run start
# - DATABASE_URL correto
\`\`\`

### Erro de Conexão Database

\`\`\`bash
# Verificar connection string
# Deve ser algo como:
postgresql://mdscrm:senha@mds-crm-postgres:5432/mds_crm

# Atenção:
# - Host é o nome do serviço no Coolify (não localhost)
# - Senha sem caracteres especiais problemáticos
\`\`\`

### SSL não ativando

\`\`\`bash
# Verificar:
# - DNS propagado (pode levar até 48h)
# - Porta 80 e 443 abertas no firewall
# - Domínio apontando para IP correto
\`\`\`

**Forçar renovação SSL:**
1. No Coolify → Domains → Regenerate SSL

### Webhook não funcionando

\`\`\`bash
# Verificar:
# - URL do webhook correta
# - Aplicação rodando
# - Logs do Coolify para ver se chegou a request
\`\`\`

**Testar webhook manualmente:**
\`\`\`bash
curl -X POST https://crm.mundodigitalsolucoes.com.br/api/webhooks/chatwoot \
  -H "Content-Type: application/json" \
  -d '{"event":"conversation_created"}'
\`\`\`

---

## 🚀 Updates e Redeploy

### Deploy de novas versões

\`\`\`bash
# 1. Fazer mudanças no código
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 2. No Coolify, aguardar auto-deploy ou clicar em "Deploy"
\`\`\`

### Rollback

Se algo der errado:

1. No Coolify → **"Deployments"**
2. Encontre o deploy anterior que funcionava
3. Clique em **"Redeploy"**

---

## 📊 Performance

### Otimizações recomendadas:

1. **Cache Redis** (opcional)
   - Adicionar Redis no Coolify
   - Configurar cache de sessões

2. **CDN** (recomendado)
   - Cloudflare para assets estáticos
   - Reduz latência

3. **Horizontal Scaling**
   - Adicionar mais instâncias se necessário
   - Load balancer automático

---

## 🎯 Próximos Passos

Após deploy bem-sucedido:

1. ✅ Criar primeiro usuário admin
2. ✅ Configurar integração Chatwoot completa
3. ✅ Configurar Google Gemini para IA
4. ✅ Configurar Stripe/Pagar.me para pagamentos
5. ✅ Customizar branding (logos, cores)
6. ✅ Importar leads existentes (se houver)
7. ✅ Treinar equipe

---

## 📞 Suporte

Problemas no deploy?

- **Logs do Coolify:** Sempre verificar primeiro
- **Documentação Coolify:** https://coolify.io/docs
- **GitHub Issues:** Criar issue no repositório
- **Email:** suporte@mundodigitalsolucoes.com.br

---

**Status esperado após deploy completo:**

✅ **CRM:** https://crm.mundodigitalsolucoes.com.br  
✅ **Chatwoot:** https://app.mundodigitalsolucoes.com.br  
✅ **SSL:** Ativo  
✅ **Database:** Conectado  
✅ **Webhook:** Funcionando  

🎉 **Parabéns! Seu CRM está no ar!**
