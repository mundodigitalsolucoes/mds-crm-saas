import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server.js'
import { getToken } from 'next-auth/jwt'

test('NextAuth: malformed Bearer headers fail closed without throwing URI errors', async () => {
  for (const authorization of ['Bearer %', 'Bearer %E0%A4%A', 'Bearer', 'Basic invalid', 'Bearer not-a-jwt']) {
    const req = new NextRequest('http://localhost/dashboard', { headers: { authorization } })
    assert.equal(await getToken({ req, secret: 'isolated-regression-test-secret' }), null)
  }
})
