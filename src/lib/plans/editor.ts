import { parseCommercialFeatures } from '../entitlements/features';

export interface EditablePlan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  price: number;
  interval: string;
  maxUsers: number;
  maxWhatsappInstances: number;
  maxLeads: number;
  maxProjects: number;
  maxOs?: number;
  features: string;
  _count: { organizations: number };
}

export interface PlanEditorForm {
  name: string;
  displayName: string;
  description: string;
  price: string;
  interval: string;
  maxUsers: string;
  maxWhatsappInstances: string;
  maxLeads: string;
  maxProjects: string;
  maxOs: string;
  features: string[];
  propagateToOrgs: boolean;
}

export function planFeaturesNeedReview(plan: EditablePlan | null) {
  if (!plan) return false;
  const { status } = parseCommercialFeatures(plan.features);
  return status === 'invalid' || status === 'missing';
}

/** A new form on every opening prevents a previous propagation opt-in from leaking. */
export function createPlanEditorForm(plan: EditablePlan | null = null): PlanEditorForm {
  const parsed = parseCommercialFeatures(plan?.features);
  return {
    name: plan?.name ?? '',
    displayName: plan?.displayName ?? '',
    description: plan?.description ?? '',
    price: String(plan?.price ?? 0),
    interval: plan?.interval ?? 'month',
    maxUsers: String(plan?.maxUsers ?? 2),
    maxWhatsappInstances: String(plan?.maxWhatsappInstances ?? 1),
    maxLeads: String(plan?.maxLeads ?? 1000),
    maxProjects: String(plan?.maxProjects ?? 20),
    maxOs: String(plan?.maxOs ?? 20),
    // Unknown legacy identifiers remain opaque data, never new operational grants.
    features: [...parsed.features, ...parsed.unknown],
    propagateToOrgs: false,
  };
}

/** The same submission boundary is used by the UI and regression tests; no implicit requests. */
export async function submitPlanEditor(
  form: PlanEditorForm,
  plan: EditablePlan | null,
  dependencies: {
    confirm: (message: string) => boolean;
    request: (url: string, options: RequestInit) => Promise<Response>;
  },
): Promise<Response | null> {
  const needsReview = planFeaturesNeedReview(plan);
  const propagateToOrgs = !!plan && !needsReview && form.propagateToOrgs;

  if (propagateToOrgs && !dependencies.confirm(
    `Propagar alterações do plano "${plan.displayName}"?\n\n` +
    `Impacto estimado: ${plan._count.organizations} organização(ões), conforme a última listagem. ` +
    'O total pode mudar até o envio.\n\n' +
    'Os limites e as features do plano serão copiados para todas as organizações que usam este plano, ' +
    'substituindo suas configurações atuais. Confirma a propagação?',
  )) return null;

  const features = [...form.features];
  // Existing administrative convention: -1 remains unlimited; zero removes the channel feature.
  const waCount = Number(form.maxWhatsappInstances);
  if (waCount !== 0 && !features.includes('whatsapp')) features.push('whatsapp');
  if (waCount === 0 && features.includes('whatsapp')) features.splice(features.indexOf('whatsapp'), 1);

  return dependencies.request(plan ? `/api/admin/plans/${plan.id}` : '/api/admin/plans', {
    method: plan ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.name,
      displayName: form.displayName,
      description: form.description,
      price: form.price,
      interval: form.interval,
      maxUsers: form.maxUsers,
      maxLeads: form.maxLeads,
      maxProjects: form.maxProjects,
      maxOs: form.maxOs,
      // Preserve the exact stored legacy value; scalar edits never silently replace broken JSON.
      ...(!needsReview ? {
        maxWhatsappInstances: form.maxWhatsappInstances,
        features: JSON.stringify(features),
      } : {}),
      propagateToOrgs,
    }),
  });
}
