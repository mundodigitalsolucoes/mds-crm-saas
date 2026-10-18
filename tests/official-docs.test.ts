import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const directory = fileURLToPath(new URL('../docs/oficiais/', import.meta.url));
const index = readFileSync(join(directory, 'LEIA-ME-PACOTE.md'), 'utf8');
const entries = [...index.matchAll(/\| `([^`]+)` \| (\d+) \| `([a-f0-9]{64})` \|/g)];

test('official documents: all twelve original sizes and hashes match the received index', () => {
  assert.equal(createHash('sha256').update(readFileSync(join(directory, 'LEIA-ME-PACOTE.md'))).digest('hex'),
    '63ff6a451e997abb4f334b1b2b27144547ea91fa6ba9d96963be691331a54b55');
  assert.equal(entries.length, 12);
  for (const [, name, bytes, expected] of entries) {
    assert.equal(name.includes('/'), false);
    const content = readFileSync(join(directory, name));
    assert.equal(content.byteLength, Number(bytes), name);
    assert.equal(createHash('sha256').update(content).digest('hex'), expected, name);
  }
  assert.deepEqual(readdirSync(directory).sort(), [...entries.map((entry) => entry[1]), 'LEIA-ME-PACOTE.md', 'ORIGEM.md'].sort());
});

test('official documents: provenance records source archive and obvious credential values are absent', () => {
  const origin = readFileSync(join(directory, 'ORIGEM.md'), 'utf8');
  assert.match(origin, /7616dee9f074087b42d71858577cc455d832e9bb8b658363a9e3f66addcddb2f/);
  for (const [, name] of entries) {
    const text = readFileSync(join(directory, name), 'utf8');
    assert.equal(/-----BEGIN .*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9_]{20,}|\bsk_(?:live|test)_[A-Za-z0-9]{12,}/.test(text), false, name);
  }
});
