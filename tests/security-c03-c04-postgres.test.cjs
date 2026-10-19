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
