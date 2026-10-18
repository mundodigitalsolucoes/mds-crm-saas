import { Client } from 'pg';
import { diagnoseOrganization, readInventory, type InventoryRow } from '../src/lib/authorization/inventory';

async function main() {
  if (process.argv.includes('--fixtures')) {
    const fixtures: InventoryRow[] = [
      { id: 'synthetic-a', plan: 'synthetic-plan', planStatus: 'active', features: '["marketing"]', planFound: true, planFeatures: '["marketing"]' },
      { id: 'synthetic-b', plan: 'synthetic-plan', planStatus: 'active', features: '[]', planFound: true, planFeatures: '["marketing"]' },
      { id: 'synthetic-c', plan: 'synthetic-legacy', planStatus: 'past_due', features: '{', planFound: false, planFeatures: null },
    ];
    console.log(JSON.stringify({ source: 'fixtures', productionInventory: 'não executado', organizations: fixtures.map(diagnoseOrganization) }, null, 2));
    return;
  }
  if (!process.argv.includes('--database') || !process.env.DATABASE_URL) {
    throw new Error('Use --fixtures or --database with DATABASE_URL configured securely.');
  }
  // Credentials stay in the process binding. No dotenv import, automatic probing or CLI URL.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log(JSON.stringify({ source: 'database_read_only', organizations: await readInventory(client) }, null, 2));
  } finally { await client.end(); }
}

main().catch(() => {
  console.error('Diagnóstico não concluído. Verifique argumentos, binding e acesso read-only; detalhes de conexão omitidos.');
  process.exitCode = 1;
});
