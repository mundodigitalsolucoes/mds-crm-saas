'use client';
import { useEffect, useState } from 'react';
interface View { hostname: string | null; eligible: boolean; status: string; error: string | null; verifiedUntil: string | null; dns: { txtName: string; txtValue: string; cnameTarget: string } | null }
const labels: Record<string, string> = { unconfigured: 'Não configurado', awaiting_dns: 'Aguardando DNS', awaiting_https: 'Aguardando HTTPS', verified: 'Verificado', active: 'Ativo', disabled: 'Desativado', error: 'Erro' };
export default function OrganizationDomainEditor({ organizationId }: { organizationId: string }) {
  return <Editor key={organizationId} organizationId={organizationId} />;
}
function Editor({ organizationId }: { organizationId: string }) {
  const [view, setView] = useState<View | null>(null), [hostname, setHostname] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const endpoint = `/api/admin/organizations/${organizationId}/domain`;
  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: 'no-store' }).then(async response => { if (!response.ok) throw Error('Falha ao carregar domínio'); return response.json(); })
      .then(data => { if (active) { setView(data); setHostname(data.hostname || ''); } })
      .catch(error => { if (active) setStatus(error.message); });
    return () => { active = false; };
  }, [endpoint]);
  const command = async (action: string, extra = {}) => {
    setBusy(true); setStatus('');
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Falha na operação');
      setView(data); setHostname(data.hostname || ''); setStatus('Operação registrada. DNS, HTTPS e roteamento não são configurados automaticamente.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha na operação'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded border border-gray-700 p-3 text-sm text-gray-200">
    <h4 className="font-semibold">Domínio próprio — controle MDS</h4>
    {view && <>
      <p>Status: {labels[view.status] || 'Erro'} {view.error ? `(${view.error})` : ''}</p>
      <button type="button" disabled={busy} onClick={() => command('grant', { enabled: !view.eligible })} className="rounded border px-3 py-2">{view.eligible ? 'Revogar Domínio próprio' : 'Conceder Domínio próprio'}</button>
      <label className="block">Hostname do cliente<input className="mt-1 w-full rounded bg-gray-900 p-2" value={hostname} onChange={event => setHostname(event.target.value)} placeholder="crm.suaempresa.com.br" /></label>
      <button type="button" disabled={busy || !view.eligible} onClick={() => command('configure', { hostname })} className="rounded border px-3 py-2">Configurar / substituir domínio</button>
      {view.dns && <div className="space-y-1 break-all rounded bg-gray-900 p-3 text-xs">
        <p>CNAME {view.hostname} → {view.dns.cnameTarget}</p>
        <p>TXT {view.dns.txtName} → {view.dns.txtValue}</p>
        <p>Configure o proxy HTTPS e o encaminhamento confiável antes de verificar. A concessão comercial não ativa o domínio.</p>
      </div>}
      <div className="flex flex-wrap gap-2">{(['verify', 'activate', 'deactivate', 'remove'] as const).map((action, index) => <button key={action} type="button" disabled={busy || !view.hostname} onClick={() => command(action)} className="rounded border px-3 py-2">{['Verificar DNS / HTTPS', 'Ativar domínio verificado', 'Desativar', 'Remover configuração'][index]}</button>)}</div>
      {view.verifiedUntil && <p className="text-xs">Verificação válida até {new Date(view.verifiedUntil).toLocaleString('pt-BR')}. Revalidação periódica obrigatória.</p>}
    </>}
    <p role="status" className="text-xs">{status || (!view ? 'Carregando...' : '')}</p>
  </section>;
}
