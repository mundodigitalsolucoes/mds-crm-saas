import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const docker = readFileSync('Dockerfile', 'utf8');
test('image starts Next directly without npm lifecycle or an intervening shell', () => {
  const command = JSON.parse(docker.match(/^CMD (\[.*\])$/m)[1]);
  assert.deepEqual(command, ['node', 'node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0']);
  assert.match(docker, /^ENV PORT=3000$/m);
  for (const path of ['node_modules', '.next', 'public', 'prisma', 'next.config.js']) {
    assert.ok(docker.includes(`COPY --from=builder /app/${path} ./`));
  }
});
test('npm start remains usable without implicit migrations; explicit migration commands remain', () => {
  assert.equal(pkg.scripts.start, 'next start');
  assert.equal(pkg.scripts.prestart, undefined);
  assert.equal(pkg.scripts.poststart, undefined);
  assert.equal(pkg.scripts['migrate:deploy'], 'prisma migrate deploy');
  assert.equal(pkg.scripts.postinstall, 'prisma generate');
});
