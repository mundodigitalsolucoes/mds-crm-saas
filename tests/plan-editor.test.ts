import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlanEditorForm, planFeaturesNeedReview, submitPlanEditor, type EditablePlan,
} from '../src/lib/plans/editor';

const legacyPlan: EditablePlan = {
  id: 'plan-test',
  name: 'legacy-plan',
  displayName: 'Plano legado',
  description: 'Descrição anterior',
  price: 49,
  interval: 'month',
  maxUsers: 5,
  maxWhatsappInstances: -1,
  maxLeads: 100,
  maxProjects: 10,
  maxOs: 20,
  features: '["vendas","future_extension","financeiro"]',
  _count: { organizations: 7 },
};

function requests() {
  const calls: { url: string; options: RequestInit; body: Record<string, unknown> }[] = [];
  return {
    calls,
    request: async (url: string, options: RequestInit) => {
      calls.push({ url, options, body: JSON.parse(String(options.body)) });
      return new Response('{}', { status: 200 });
    },
  };
}

test('new, edited and reopened editor forms always start with propagation off', () => {
  const initial = createPlanEditorForm();
  const edit = createPlanEditorForm(legacyPlan);
  assert.equal(initial.propagateToOrgs, false);
  assert.equal(edit.propagateToOrgs, false);
  edit.propagateToOrgs = true;
  edit.features.push('marketing');
  const reopened = createPlanEditorForm(legacyPlan);
  assert.equal(reopened.propagateToOrgs, false);
  assert.equal(reopened.features.includes('marketing'), false);
  assert.equal(createPlanEditorForm().propagateToOrgs, false);
});

test('create cannot propagate even when stale form data carries an opt-in', async () => {
  const form = createPlanEditorForm();
  form.propagateToOrgs = true;
  const capture = requests();
  await submitPlanEditor(form, null, {
    ...capture,
    confirm: () => assert.fail('Creation must not prompt to propagate'),
  });
  assert.equal(capture.calls.length, 1);
  assert.equal(capture.calls[0].url, '/api/admin/plans');
  assert.equal(capture.calls[0].options.method, 'POST');
  assert.equal(capture.calls[0].body.propagateToOrgs, false);
});

test('ordinary edit sends propagation false without asking for confirmation', async () => {
  const form = createPlanEditorForm(legacyPlan);
  form.price = '59';
  const capture = requests();
  await submitPlanEditor(form, legacyPlan, {
    ...capture,
    confirm: () => assert.fail('An ordinary edit must not request propagation confirmation'),
  });
  assert.equal(capture.calls.length, 1);
  assert.equal(capture.calls[0].options.method, 'PUT');
  assert.equal(capture.calls[0].body.price, '59');
  assert.equal(capture.calls[0].body.propagateToOrgs, false);
});

test('canceling propagation prevents the request entirely', async () => {
  const form = createPlanEditorForm(legacyPlan);
  form.propagateToOrgs = true;
  const capture = requests();
  let confirmations = 0;
  const result = await submitPlanEditor(form, legacyPlan, {
    ...capture,
    confirm: () => { confirmations++; return false; },
  });
  assert.equal(result, null);
  assert.equal(confirmations, 1);
  assert.equal(capture.calls.length, 0);
});

test('propagation requires explicit confirmation with name, estimated impact and replacement scope', async () => {
  const form = createPlanEditorForm(legacyPlan);
  form.propagateToOrgs = true;
  const capture = requests();
  const events: string[] = [];
  const response = await submitPlanEditor(form, legacyPlan, {
    confirm: (message) => {
      events.push('confirm');
      assert.ok(message.includes(legacyPlan.displayName));
      assert.match(message, /estimado: 7 organização/);
      assert.match(message, /limites e as features/);
      assert.match(message, /substituindo suas configurações atuais/);
      assert.match(message, /total pode mudar/);
      return true;
    },
    request: async (url, options) => {
      events.push('request');
      return capture.request(url, options);
    },
  });
  assert.deepEqual(events, ['confirm', 'request']);
  assert.equal(response?.status, 200);
  assert.equal(capture.calls[0].url, `/api/admin/plans/${legacyPlan.id}`);
  assert.equal(capture.calls[0].body.propagateToOrgs, true);
});

test('saving preserves unknown and previously listed planned features as opaque legacy identifiers', async () => {
  const form = createPlanEditorForm(legacyPlan);
  const capture = requests();
  await submitPlanEditor(form, legacyPlan, { ...capture, confirm: () => false });
  assert.deepEqual(JSON.parse(String(capture.calls[0].body.features)), [
    'vendas', 'financeiro', 'future_extension', 'whatsapp',
  ]);
  assert.equal(legacyPlan.features, '["vendas","future_extension","financeiro"]');
  assert.equal(planFeaturesNeedReview(legacyPlan), false);
});

test('legacy broken features allow price and description edits without overwriting JSON or channels', async () => {
  for (const raw of ['{', '', '["vendas",2]', '{}']) {
    const plan = { ...legacyPlan, features: raw };
    const form = createPlanEditorForm(plan);
    form.price = '79';
    form.description = 'Descrição revisada';
    // Defense against stale or manually changed form state while controls are disabled.
    form.features = ['marketing'];
    form.maxWhatsappInstances = '0';
    form.propagateToOrgs = true;
    const capture = requests();
    assert.equal(planFeaturesNeedReview(plan), true);
    await submitPlanEditor(form, plan, {
      ...capture,
      confirm: () => assert.fail('A broken legacy configuration must not propagate'),
    });
    const { body } = capture.calls[0];
    assert.equal(body.price, '79');
    assert.equal(body.description, 'Descrição revisada');
    assert.equal(Object.hasOwn(body, 'features'), false);
    assert.equal(Object.hasOwn(body, 'maxWhatsappInstances'), false);
    assert.equal(body.propagateToOrgs, false);
    assert.equal(plan.features, raw);
    assert.equal(plan.maxWhatsappInstances, -1);
  }
});

test('the editor retains legacy -1 and zero WhatsApp values without translating them into channel contracts', async () => {
  for (const maxWhatsappInstances of [-1, 0, 2]) {
    const plan = { ...legacyPlan, maxWhatsappInstances, features: '["vendas","whatsapp"]' };
    const form = createPlanEditorForm(plan);
    const capture = requests();
    assert.equal(form.maxWhatsappInstances, String(maxWhatsappInstances));
    await submitPlanEditor(form, plan, { ...capture, confirm: () => false });
    const { body } = capture.calls[0];
    assert.equal(body.maxWhatsappInstances, String(maxWhatsappInstances));
    assert.equal(JSON.parse(String(body.features)).includes('whatsapp'), maxWhatsappInstances !== 0);
    assert.equal(Object.hasOwn(body, 'channels'), false);
  }
});
