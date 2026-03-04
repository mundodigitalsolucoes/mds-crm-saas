// scripts/provision-chatwoot-org.ts
//
// Script CLI para provisionar Chatwoot manualmente para uma org existente.
// Útil quando o signup ocorreu antes das variáveis estarem configuradas.
//
// Uso:
//   npx tsx scripts/provision-chatwoot-org.ts --slug mundo-digital
//   npx tsx scripts/provision-chatwoot-org.ts --slug mundo-digital --force
//   npx tsx scripts/provision-chatwoot-org.ts --list-pending

import { PrismaClient } from '@prisma/client'
import { provisionChatwootForOrg } from '../src/lib/integrations/chatwoot-provision'

const prisma = new PrismaClient()

const args  = process.argv.slice(2)
const slug  = args[args.indexOf('--slug') + 1]
const force = args.includes('--force')
const list  = args.includes('--list-pending')

async function listPending() {
  console.log('\n📋 Organizações sem Chatwoot provisionado:\n')

  const orgs = await prisma.organization.findMany({
    where: {
      connectedAccounts: {
        none: { provider: 'chatwoot', isActive: true },
      },
    },
    select: {
      id: true, name: true, slug: true, plan: true, chatwootAccountId: true,
      users: { where: { role: 'owner' }, take: 1, select: { email: true } },
    },
    orderBy: { id: 'asc' },
  })

  if (!orgs.length) {
    console.log('  ✅ Todas as orgs já estão provisionadas.')
    return
  }

  orgs.forEach((o) => {
    console.log(`  • [${o.plan.padEnd(14)}] ${o.slug.padEnd(30)} owner: ${o.users[0]?.email ?? '???'}`)
  })

  console.log(`\nTotal: ${orgs.length} org(s) pendente(s)`)
  console.log('\nPara provisionar uma específica:')
  console.log('  npx tsx scripts/provision-chatwoot-org.ts --slug <slug>\n')
}

async function provisionOne(orgSlug: string) {
  const org = await prisma.organization.findUnique({
    where:   { slug: orgSlug },
    include: {
      users: {
        where:  { role: 'owner' },
        take:   1,
        select: { id: true, name: true, email: true },
      },
      connectedAccounts: {
        where: { provider: 'chatwoot', isActive: true },
      },
    },
  })

  if (!org) {
    console.error(`❌ Organização com slug "${orgSlug}" não encontrada.`)
    process.exit(1)
  }

  if (org.connectedAccounts.length > 0 && !force) {
    console.log(`⚠️  Org "${orgSlug}" já possui Chatwoot provisionado.`)
    console.log(`   Account ID: ${org.chatwootAccountId}`)
    console.log('   Use --force para re-provisionar.')
    process.exit(0)
  }

  const owner = org.users[0]
  if (!owner) {
    console.error(`❌ Nenhum owner encontrado para a org "${orgSlug}".`)
    process.exit(1)
  }

  console.log(`\n🔧 Provisionando Chatwoot para: ${org.name} (${orgSlug})`)
  console.log(`   Owner: ${owner.email}`)

  // Senha temporária — o owner não usa senha para login no iframe (SSO via token)
  const tempPassword = `Tmp@${crypto.randomUUID().slice(0, 8)}!`

  const result = await provisionChatwootForOrg({
    organizationId: org.id,
    orgName:        org.name,
    orgSlug:        org.slug,
    ownerUserId:    owner.id,
    ownerName:      owner.name,
    ownerEmail:     owner.email,
    ownerPassword:  tempPassword,
  })

  if (result.success) {
    console.log(`\n✅ Provisionamento concluído!`)
    console.log(`   Chatwoot Account ID : ${result.chatwootAccountId}`)
    console.log(`   Chatwoot User ID    : ${result.chatwootUserId}`)
    console.log(`   Org slug            : ${orgSlug}\n`)
  } else {
    console.error(`\n❌ Falha no provisionamento: ${result.error}`)
    console.error('   Verifique as variáveis CHATWOOT_SUPER_ADMIN_EMAIL e CHATWOOT_SUPER_ADMIN_PASSWORD\n')
    process.exit(1)
  }
}

async function main() {
  if (list) {
    await listPending()
  } else if (slug) {
    await provisionOne(slug)
  } else {
    console.log('\nUso:')
    console.log('  npx tsx scripts/provision-chatwoot-org.ts --slug <org-slug>')
    console.log('  npx tsx scripts/provision-chatwoot-org.ts --slug <org-slug> --force')
    console.log('  npx tsx scripts/provision-chatwoot-org.ts --list-pending\n')
    process.exit(1)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())