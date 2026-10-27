'use client';
import { useEffect, useState } from 'react';
type Status = { status: string; provisioned: boolean; lastError: string | null; recoveryAvailable: boolean; inspectionRequired: boolean; phase: string | null };
const labels: Record<string,string> = { ready:'Atendimento configurado', awaiting_owner:'Aguardando proprietário', awaiting_provisioning:'Aguardando provisionamento', provisioning:'Provisionando', recovery_required:'Falha ou provisionamento incompleto — recuperação disponível' };
export default function OrganizationChatwootOnboarding({organizationId}:{organizationId:string}) {
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[inspected,setInspected]=useState(false);
 const endpoint=`/api/admin/orgs/${organizationId}/provision-chatwoot`;
 useEffect(()=>{let live=true;fetch(endpoint,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Não foi possível consultar o Atendimento');return r.json();}).then(data=>{if(live)setStatus(data);}).catch(()=>{if(live)setMessage('Não foi possível consultar o Atendimento');});return()=>{live=false;};},[endpoint]);
 useEffect(()=>{if(status?.status!=='provisioning')return;let live=true;const timer=setInterval(()=>{fetch(endpoint,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(live&&data)setStatus(data);}).catch(()=>{});},3000);return()=>{live=false;clearInterval(timer);};},[endpoint,status?.status]);
 async function recover(){setBusy(true);setMessage('');try{
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({force:false,inspectionAcknowledged:inspected})});
  const data=await response.json();if(data.onboarding)setStatus(data.onboarding);
  setMessage(data.success?'Vínculo e sessão automática validados. Cadastre inboxes e conecte os canais separadamente.':data.error||'Recuperação pendente');
 }catch{setMessage('Verifique o estado antes de repetir; nenhuma sobrescrita forçada será executada.');}finally{setBusy(false);}}
 return <section className="space-y-2 rounded border border-gray-700 p-3 text-sm text-gray-200">
  <h4 className="font-semibold">Onboarding do Atendimento</h4>
  <p>{busy?'Provisionando…':status?labels[status.status]||'Revisão administrativa necessária':'Consultando…'}</p>
  {status?.lastError&&<p>Motivo: {status.lastError}</p>}
  <p className="text-xs">Organização criada ≠ Atendimento configurado ≠ WhatsApp conectado ≠ operação homologada.</p>
  {status?.inspectionRequired&&<label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={inspected} onChange={e=>setInspected(e.target.checked)}/>Inspecionei os vínculos CRM/Chatwoot e autorizo a tentativa segura. Se houver conta externa ambígua, interromper para revisão.</label>}
  {!status?.provisioned&&<button type="button" disabled={busy||!status?.recoveryAvailable||!!status.inspectionRequired&&!inspected} onClick={recover} className="rounded border px-3 py-2 disabled:opacity-50">Consultar e recuperar provisionamento</button>}
  <p role="status" className="text-xs">{message}</p>
 </section>;
}
