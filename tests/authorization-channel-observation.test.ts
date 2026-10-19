import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('widget GET and POST retain integration permissions before channel observation', () => {
  const source = readFileSync('src/app/api/atendimento/widget/route.ts', 'utf8');
  for (const [method, action] of [['GET', 'view'], ['POST', 'edit']] as const) {
    const start = source.indexOf(`export async function ${method}(`);
    assert.ok(start >= 0, `missing ${method}`);
    const block = source.slice(start, start + 550);
    const guard = block.indexOf(`checkPermission('integrations', '${action}')`);
    const reject = block.indexOf('if (!allowed) return errorResponse!');
    const observation = block.indexOf("observeChannelEntitlement(organizationId, 'site_widget')");
    assert.ok(guard >= 0 && reject > guard && observation > reject, `guard ordering: ${method}`);
  }
});

test('channel observation is nonblocking and does not log tenant identity', () => {
  const source = readFileSync('src/lib/authorization/channel-observation.ts', 'utf8');
  assert.match(source, /mode: 'observe_only'/);
  assert.doesNotMatch(source, /NextResponse|authorizationEffect|modeForOrganization/);
  assert.match(source, /select: \{ id: true, plan: true, features: true \}/);
  assert.match(source, /console\.info\('\[CHANNEL_ENTITLEMENT_OBSERVATION\]'/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{[^}]*organizationId/s);
});
