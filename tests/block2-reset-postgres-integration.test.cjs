// PostgreSQL integration proof for concurrent reset-token rotation.
// Uses only an isolated CI database; never point DATABASE_URL at production.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');

test('same-email concurrent issuance leaves exactly one valid reset token', async () => {
  const url = process.env.BLOCK2_TEST_DATABASE_URL;
  assert.ok(url, 'BLOCK2_TEST_DATABASE_URL is required; use a disposable PostgreSQL database');
  const pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 5000 });
  const table = 'block2_reset_test_' + process.pid;
  const email = 'fixture-' + process.pid + '@example.invalid';
  const client = await pool.connect();
  try {
    await client.query('CREATE TABLE "' + table + '" (token TEXT PRIMARY KEY, email TEXT NOT NULL, used BOOLEAN NOT NULL DEFAULT false)');
  } finally {
    client.release();
  }
  async function issue(token, delayMs = 0) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [email]);
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      await db.query('UPDATE "' + table + '" SET used = true WHERE email = $1 AND used = false', [email]);
      await db.query('INSERT INTO "' + table + '" (token, email) VALUES ($1, $2)', [token, email]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  try {
    await Promise.all([issue('first', 150), issue('second')]);
    const result = await pool.query('SELECT token, used FROM "' + table + '" ORDER BY token');
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows.filter(row => !row.used).length, 1);
    assert.equal(result.rows.filter(row => row.used).length, 1);
  } finally {
    await pool.query('DROP TABLE IF EXISTS "' + table + '"');
    await pool.end();
  }
});
