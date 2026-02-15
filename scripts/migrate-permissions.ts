// scripts/migrate-permissions.ts
// Script para popular permissões dos usuários existentes
// Executar: npx tsx scripts/migrate-permissions.ts

import { PrismaClient } from '@prisma/client';
import { getDefaultPermissions, serializePermissions } from '../src/lib/permissions';
import type { UserRole } from '../src/types/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando migração de permissões...\n');

  // Buscar todos os usuários
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      organization: { select: { name: true } },
    },
  });

  console.log(`📊 Total de usuários: ${users.length}\n`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    // Verificar se já tem permissões no novo formato
    try {
      const parsed = JSON.parse(user.permissions);
      if (typeof parsed === 'object' && parsed !== null && 'leads' in parsed) {
        console.log(`⏭️  ${user.name} (${user.email}) — já migrado`);
        skipped++;
        continue;
      }
    } catch {
      // JSON inválido, precisa migrar
    }

    // Gerar permissões padrão baseadas no role
    const role = user.role as UserRole;
    const permissions = getDefaultPermissions(role);
    const serialized = serializePermissions(permissions);

    await prisma.user.update({
      where: { id: user.id },
      data: { permissions: serialized },
    });

    console.log(`✅ ${user.name} (${user.email}) — role: ${role} — migrado`);
    migrated++;
  }

  console.log(`\n🎉 Migração concluída!`);
  console.log(`   ✅ Migrados: ${migrated}`);
  console.log(`   ⏭️  Já migrados: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro na migração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
