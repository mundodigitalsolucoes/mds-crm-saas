// Executes the same advisory-lock SQL as forgot-password against disposable PostgreSQL.
// No application tables, migrations or production credentials are required.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')

test('Prisma decodes the per-email transaction advisory lock projection', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must target disposable PostgreSQL')
  const prisma = new PrismaClient()
  try {
    const email = 'block2-reset-lock@example.invalid'
    const result = await prisma.$transaction(async (tx) => {
      return tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtextextended(${email}, 0))`
    })
    assert.equal(result.length, 1)
    assert.equal(result[0].acquired, 1)
  } finally {
    await prisma.$disconnect()
  }
})

test('same-email advisory locks serialize concurrent Prisma transactions', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must target disposable PostgreSQL')
  const prisma = new PrismaClient()
  const email = 'block2-concurrent-lock@example.invalid'
  let signalLocked
  const locked = new Promise((resolve) => { signalLocked = resolve })
  let releaseFirst
  const release = new Promise((resolve) => { releaseFirst = resolve })
  let secondAcquired = false

  try {
    const first = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtextextended(${email}, 0))`
      signalLocked()
      await release
    }, { timeout: 10000 })

    await locked
    const second = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtextextended(${email}, 0))`
      secondAcquired = true
    }, { timeout: 10000 })

    // Observe the second connection waiting on the same PostgreSQL advisory
    // lock rather than relying only on an elapsed-time assertion.
    const { Client } = require('pg')
    const observer = new Client({ connectionString: process.env.DATABASE_URL })
    await observer.connect()
    try {
      let waiting = false
      for (let attempt = 0; attempt < 40; attempt++) {
        const result = await observer.query(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND wait_event = 'advisory') AS waiting"
        )
        if (result.rows[0].waiting) { waiting = true; break }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      assert.equal(waiting, true, 'second transaction should wait on the first advisory lock')
      assert.equal(secondAcquired, false)
    } finally {
      releaseFirst()
      await observer.end()
    }
    await Promise.all([first, second])
    assert.equal(secondAcquired, true)
  } finally {
    releaseFirst()
    await prisma.$disconnect()
  }
})

test('different-email advisory locks do not block each other', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must target disposable PostgreSQL')
  const prisma = new PrismaClient()
  let signalLocked
  const locked = new Promise((resolve) => { signalLocked = resolve })
  let releaseFirst
  const release = new Promise((resolve) => { releaseFirst = resolve })
  try {
    const first = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtextextended(${'block2-lock-a@example.invalid'}, 0))`
      signalLocked()
      await release
    }, { timeout: 10000 })
    await locked
    // The second transaction should acquire a different email lock while
    // the first transaction remains open.
    const second = prisma.$transaction(async (tx) => {
      return tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtextextended(${'block2-lock-b@example.invalid'}, 0))`
    }, { timeout: 5000 })
    const rows = await second
    assert.equal(rows[0].acquired, 1)
    releaseFirst()
    await first
  } finally {
    releaseFirst()
    await prisma.$disconnect()
  }
})

test('PostgreSQL CAS permits only one concurrent inbox reservation per tenant', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must target disposable PostgreSQL')
  const { Client } = require('pg')
  const setup = new Client({ connectionString: process.env.DATABASE_URL })
  const first = new Client({ connectionString: process.env.DATABASE_URL })
  const second = new Client({ connectionString: process.env.DATABASE_URL })
  await Promise.all([setup.connect(), first.connect(), second.connect()])
  try {
    // Disposable table models the same tenant + deletedAt + settings equality
    // predicate used by organization.updateMany; no application migration.
    // A shared disposable table allows two independent PostgreSQL connections to race.
    await setup.query('CREATE TABLE block2_inbox_cas_probe (tenant_id text PRIMARY KEY, deleted_at timestamptz, settings text)')
    await setup.query("INSERT INTO block2_inbox_cas_probe VALUES ('tenant-a', NULL, 'original')")
    const sql = "UPDATE block2_inbox_cas_probe SET settings = $1 WHERE tenant_id = 'tenant-a' AND deleted_at IS NULL AND settings = 'original'"
    const results = await Promise.all([
      first.query(sql, ['pending-first']),
      second.query(sql, ['pending-second']),
    ])
    assert.deepEqual(results.map((r) => r.rowCount).sort(), [0, 1])
    const saved = await setup.query("SELECT settings FROM block2_inbox_cas_probe WHERE tenant_id = 'tenant-a'")
    assert.ok(['pending-first', 'pending-second'].includes(saved.rows[0].settings))
  } finally {
    await setup.query('DROP TABLE IF EXISTS block2_inbox_cas_probe')
    await Promise.all([setup.end(), first.end(), second.end()])
  }
})

test('Inbox reservation CAS cannot mutate another tenant or a deleted tenant', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must target disposable PostgreSQL')
  const { Client } = require('pg')
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query('CREATE TABLE block2_inbox_tenant_probe (tenant_id text PRIMARY KEY, deleted_at timestamptz, settings text)')
    await db.query("INSERT INTO block2_inbox_tenant_probe VALUES ('tenant-a', NULL, 'original'), ('tenant-b', NULL, 'original'), ('tenant-deleted', NOW(), 'original')")
    const update = "UPDATE block2_inbox_tenant_probe SET settings = 'pending' WHERE tenant_id = $1 AND deleted_at IS NULL AND settings = 'original'"
    assert.equal((await db.query(update, ['tenant-a'])).rowCount, 1)
    assert.equal((await db.query(update, ['tenant-a'])).rowCount, 0)
    assert.equal((await db.query(update, ['tenant-deleted'])).rowCount, 0)
    const rows = await db.query('SELECT tenant_id, settings FROM block2_inbox_tenant_probe ORDER BY tenant_id')
    assert.deepEqual(rows.rows, [
      { tenant_id: 'tenant-a', settings: 'pending' },
      { tenant_id: 'tenant-b', settings: 'original' },
      { tenant_id: 'tenant-deleted', settings: 'original' },
    ])
  } finally {
    await db.query('DROP TABLE IF EXISTS block2_inbox_tenant_probe')
    await db.end()
  }
})

test('Remote inbox success followed by stale local completion cannot overwrite concurrent tenant changes', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must target disposable PostgreSQL')
  const { Client } = require('pg')
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    await db.query('CREATE TABLE block2_inbox_completion_probe (tenant_id text PRIMARY KEY, deleted_at timestamptz, settings text)')
    await db.query("INSERT INTO block2_inbox_completion_probe VALUES ('tenant-a', NULL, 'initial'), ('tenant-b', NULL, 'initial')")
    const reserve = await db.query(
      "UPDATE block2_inbox_completion_probe SET settings = 'pending' WHERE tenant_id = 'tenant-a' AND deleted_at IS NULL AND settings = 'initial'"
    )
    assert.equal(reserve.rowCount, 1)
    // Model a concurrent settings writer after a successful remote Chatwoot POST.
    await db.query("UPDATE block2_inbox_completion_probe SET settings = 'newer-settings' WHERE tenant_id = 'tenant-a'")
    const completion = await db.query(
      "UPDATE block2_inbox_completion_probe SET settings = 'created-inbox' WHERE tenant_id = 'tenant-a' AND deleted_at IS NULL AND settings = 'pending'"
    )
    assert.equal(completion.rowCount, 0)
    const staleError = await db.query(
      "UPDATE block2_inbox_completion_probe SET settings = 'reconciliation_required' WHERE tenant_id = 'tenant-a' AND deleted_at IS NULL AND settings = 'pending'"
    )
    assert.equal(staleError.rowCount, 0)
    const rows = await db.query('SELECT tenant_id, settings FROM block2_inbox_completion_probe ORDER BY tenant_id')
    assert.deepEqual(rows.rows, [
      { tenant_id: 'tenant-a', settings: 'newer-settings' },
      { tenant_id: 'tenant-b', settings: 'initial' },
    ])
  } finally {
    await db.query('DROP TABLE IF EXISTS block2_inbox_completion_probe')
    await db.end()
  }
})
