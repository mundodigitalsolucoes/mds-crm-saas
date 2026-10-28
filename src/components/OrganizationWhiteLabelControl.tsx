'use client';
import { useEffect, useState } from 'react';
import { resolveCommercialEntitlements } from '@/lib/entitlements/resolver';

/** Part of the existing MDS organization editor; never a tenant control. */
export default function OrganizationWhiteLabelControl({ organizationId }: { organizationId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/organizations/${organizationId}`).then(async response => {
      if (!response.ok) throw Error();
      const organization = await response.json();
      if (!cancelled) setEnabled(resolveCommercialEntitlements(organization).capabilities.includes('white_label'));
    }).catch(() => { if (!cancelled) setMessage('Não foi possível carregar White-Label.'); });
    return () => { cancelled = true; };
  }, [organizationId]);
  const toggle = async () => {
    if (enabled === null) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whiteLabel: !enabled }),
      });
      if (!response.ok) throw Error(response.status === 409 ? 'Contrato alterado ou inválido. Feche e reabra o editor para revisar.' : 'Falha ao alterar White-Label.');
      const updated = await response.json();
      setEnabled(updated.whiteLabel); setMessage('Capacidade comercial salva.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  };
  return <div className="rounded-lg border border-blue-900/30 p-3 text-sm text-gray-300">
    <p>White-Label: {enabled === null ? 'carregando' : enabled ? 'habilitado' : 'desabilitado'}</p>
    <button type="button" disabled={enabled === null || busy} onClick={toggle} className="my-2 rounded bg-blue-900 px-3 py-2 disabled:opacity-50">
      {busy ? 'Salvando…' : enabled ? 'Desabilitar White-Label' : 'Habilitar White-Label'}
    </button>
    <p className="text-xs">Controle exclusivo MDS. Não altera módulos. Sincronizar o plano abaixo pode substituir as capacidades pelo contrato do plano.</p>
    <p role="status">{message}</p>
  </div>;
}
