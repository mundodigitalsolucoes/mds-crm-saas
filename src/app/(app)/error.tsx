'use client';

/** Keep failures inside the existing tenant shell; never render server errors/data. */
export default function AppError({ reset }: { reset: () => void }) {
  return <section role="alert" className="space-y-4 p-6">
    <h1 className="text-2xl font-bold">Não foi possível carregar esta tela</h1>
    <p>Tente novamente. Se o problema continuar, entre em contato com o suporte.</p>
    <button type="button" onClick={reset} className="rounded bg-primary px-4 py-2">Tentar novamente</button>
  </section>;
}
