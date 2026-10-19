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
