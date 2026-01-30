# 🚀 START - Guia Completo de Deploy

## ✅ Status do Projeto

Seu projeto MDS CRM está **pronto para subir no GitHub e deploy no Coolify**.

### Domínios Configurados:
- **CRM:** crm.mundodigitalsolucoes.com.br
- **Chatwoot:** app.mundodigitalsolucoes.com.br

---

## 📦 O que está incluído

```
mds-crm-nextjs/
├── src/                           # Código-fonte
│   ├── app/                       # Next.js App Router
│   │   ├── (landing)/page.tsx     # ✅ Landing page completa
│   │   ├── api/
│   │   │   └── webhooks/chatwoot/ # ✅ Webhook Chatwoot
│   │   └── layout.tsx             # ✅ Layout principal
│   └── types/                     # TypeScript types
├── prisma/
│   └── schema.prisma              # ✅ Schema completo multi-tenant
├── public/
│   └── images/                    # ✅ Logos Mundo Digital
├── .env.example                   # ✅ Template de variáveis
├── .gitignore                     # ✅ Arquivos ignorados
├── Dockerfile                     # ✅ Docker configurado
├── docker-compose.yml             # ✅ Docker Compose
├── package.json                   # ✅ Dependências
├── README-GITHUB.md               # ✅ README para GitHub
├── DEPLOY-COOLIFY.md              # ✅ Guia de deploy
├── GIT-COMMANDS.md                # ✅ Comandos Git
├── setup.sh                       # ✅ Script de setup
└── coolify.json                   # ✅ Config Coolify
```

---

## 🎯 PASSO A PASSO RÁPIDO

### 1️⃣ Preparar para GitHub (5 minutos)

```bash
cd mds-crm-nextjs

# Inicializar Git
git init

# Adicionar arquivos
git add .

# Primeiro commit
git commit -m "feat: Initial commit - MDS CRM SaaS"
```

### 2️⃣ Criar Repositório no GitHub (2 minutos)

1. Acesse: https://github.com/new
2. Nome: **mds-crm-saas**
3. Tipo: **Private** (recomendado)
4. Clique em "Create repository"

### 3️⃣ Push para GitHub (1 minuto)

```bash
# Adicionar remote (substitua SEU-USUARIO)
git remote add origin https://github.com/SEU-USUARIO/mds-crm-saas.git

# Renomear branch
git branch -M main

# Push
git push -u origin main
```

✅ **Código no GitHub!**

### 4️⃣ Configurar PostgreSQL no Coolify (3 minutos)

1. Coolify → Resources → + New → Database
2. Selecione: **PostgreSQL 15**
3. Configure:
   - Name: **mds-crm-postgres**
   - Database: **mds_crm**
   - User: **mdscrm**
   - Password: **[gerar senha forte]**
4. Salvar e copiar Connection String

### 5️⃣ Criar Aplicação no Coolify (5 minutos)

1. Coolify → Resources → + New → Application
2. Public Repository
3. URL: `https://github.com/SEU-USUARIO/mds-crm-saas.git`
4. Branch: **main**
5. Framework: **Next.js**
6. Configure:
   - Build Pack: **nixpacks**
   - Install: `npm install`
   - Build: `npm run build`
   - Start: `npm run start`
   - Port: **3000**

### 6️⃣ Adicionar Variáveis de Ambiente (5 minutos)

No Coolify → Environment Variables:

```env
NODE_ENV=production
DATABASE_URL=postgresql://mdscrm:SENHA@mds-crm-postgres:5432/mds_crm
NEXTAUTH_SECRET=GERAR_COM_OPENSSL_RAND_BASE64_32
NEXTAUTH_URL=https://crm.mundodigitalsolucoes.com.br
CHATWOOT_API_URL=https://app.mundodigitalsolucoes.com.br/api/v1
CHATWOOT_API_KEY=SUA_CHATWOOT_API_KEY
CHATWOOT_ACCOUNT_ID=1
```

**Gerar NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 7️⃣ Configurar Domínio (2 minutos)

1. Coolify → Domains → Add Domain
2. Digite: **crm.mundodigitalsolucoes.com.br**
3. SSL será gerado automaticamente

**Configurar DNS:**
```
Tipo: A
Host: crm
Valor: [IP da VPS]
TTL: 3600
```

### 8️⃣ Deploy! (5-10 minutos)

1. Coolify → Deploy
2. Aguarde build e deploy
3. Acompanhe logs
4. Status esperado: ✅ Success

### 9️⃣ Executar Migrations (2 minutos)

No Coolify → Terminal:

```bash
npx prisma generate
npx prisma db push
```

### 🔟 Configurar Webhook Chatwoot (3 minutos)

1. Obter API Key:
   - Chatwoot → Settings → Integrations → API
   - Create new access token
   - Copiar token

2. Adicionar no Coolify:
   - Environment Variables
   - `CHATWOOT_API_KEY=token_copiado`
   - Restart

3. Configurar Webhook:
   - Chatwoot → Settings → Webhooks → Add new
   - URL: `https://crm.mundodigitalsolucoes.com.br/api/webhooks/chatwoot`
   - Events: ✅ All
   - Save

---

## ✅ CHECKLIST FINAL

- [ ] Código no GitHub
- [ ] PostgreSQL criado no Coolify
- [ ] Aplicação criada no Coolify
- [ ] Variáveis de ambiente configuradas
- [ ] Domínio adicionado
- [ ] DNS configurado
- [ ] Deploy executado com sucesso
- [ ] Prisma migrations executadas
- [ ] Webhook Chatwoot configurado
- [ ] SSL ativo (https)
- [ ] Aplicação acessível

---

## 🎉 PRONTO!

Acesse: **https://crm.mundodigitalsolucoes.com.br**

### Primeiro Acesso:
1. Clique em "Criar conta"
2. Preencha dados da empresa
3. Será criado como Owner
4. Começe a usar!

---

## 📚 Documentação Completa

- **README-GITHUB.md** - Documentação completa do projeto
- **DEPLOY-COOLIFY.md** - Guia detalhado de deploy
- **GIT-COMMANDS.md** - Comandos Git úteis
- **ANALISE-PROJETO-CRM.md** - Análise e roadmap
- **GUIA-IMPLEMENTACAO.md** - Implementar funcionalidades

---

## 🆘 Troubleshooting Rápido

### Build falhou?
- Verificar logs no Coolify
- Verificar variáveis de ambiente
- Testar build local: `npm run build`

### Deploy falhou?
- Verificar PORT (deve ser 3000)
- Verificar start command
- Verificar DATABASE_URL

### Não conecta no banco?
- Verificar connection string
- Host deve ser nome do serviço (mds-crm-postgres)
- Verificar senha

### SSL não ativa?
- Aguardar propagação DNS (até 48h)
- Verificar porta 80 e 443 abertas
- Forçar renovação no Coolify

### Webhook não funciona?
- Verificar URL do webhook
- Verificar logs do Coolify
- Testar manualmente com curl

---

## 📞 Suporte

- **Logs:** Sempre verificar primeiro no Coolify
- **Docs Coolify:** https://coolify.io/docs
- **Email:** suporte@mundodigitalsolucoes.com.br

---

## 🚀 Próximas Implementações

Depois do deploy, siga o **GUIA-IMPLEMENTACAO.md** para:

1. ✅ Implementar autenticação completa
2. ✅ Criar dashboard de KPIs (já criado!)
3. ✅ CRUD de Leads com Kanban
4. ✅ Sistema de tarefas
5. ✅ Projetos de marketing
6. ✅ Integração Gemini AI
7. ✅ Sistema de billing

---

## ⏱️ Tempo Total Estimado

- Preparar Git: 5 min
- GitHub: 2 min
- Coolify Setup: 15 min
- Deploy: 10 min
- Configurações finais: 5 min

**Total: ~35-40 minutos** ⚡

---

**Boa sorte com o deploy! 🎉**

Qualquer dúvida, consulte a documentação detalhada nos arquivos `.md` ou entre em contato.
