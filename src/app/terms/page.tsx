// src/app/terms/page.tsx
// Termos de Uso — página pública (LGPD)

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              MD
            </div>
            <span className="font-semibold text-gray-900">MDS CRM</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
          <p className="text-gray-500 text-sm">Última atualização: 18 de fevereiro de 2026</p>
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta e utilizar a plataforma MDS CRM, operada pela <strong>Mundo Digital Soluções</strong>,
              você declara que leu, compreendeu e concorda com estes Termos de Uso e com a nossa{' '}
              <Link href="/privacy" className="text-indigo-600 hover:underline">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Descrição do serviço</h2>
            <p>
              O MDS CRM é uma plataforma SaaS (Software as a Service) multi-tenant de gerenciamento de relacionamento
              com clientes, voltada para equipes de vendas e marketing. O serviço inclui gestão de leads, projetos,
              tarefas, ordens de serviço, agenda e relatórios.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Conta do usuário</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Você é responsável por manter a confidencialidade da sua senha.</li>
              <li>Você é responsável por todas as atividades realizadas em sua conta.</li>
              <li>Notifique-nos imediatamente sobre qualquer uso não autorizado.</li>
              <li>Cada conta está vinculada a uma organização (tenant).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Uso aceitável</h2>
            <p>Você concorda em <strong>não</strong>:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Utilizar o serviço para fins ilegais ou não autorizados.</li>
              <li>Tentar acessar dados de outras organizações.</li>
              <li>Realizar engenharia reversa, descompilar ou modificar o software.</li>
              <li>Sobrecarregar intencionalmente os servidores (ataques DDoS, scraping abusivo).</li>
              <li>Armazenar conteúdo que viole direitos de terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Planos e pagamentos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>O período de teste gratuito é de 14 dias a partir do cadastro.</li>
              <li>Após o período de teste, o acesso pode ser limitado conforme o plano contratado.</li>
              <li>Preços e condições de pagamento são informados na plataforma ou por proposta comercial.</li>
              <li>Reservamo-nos o direito de alterar preços com aviso prévio de 30 dias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Propriedade dos dados</h2>
            <p>
              Os dados inseridos por você na plataforma pertencem a você e à sua organização. Nós atuamos
              como <strong>operadores</strong> dos dados conforme a LGPD. Você pode exportar ou solicitar a exclusão
              dos seus dados a qualquer momento conforme nossa{' '}
              <Link href="/privacy" className="text-indigo-600 hover:underline">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Disponibilidade do serviço</h2>
            <p>
              Nos esforçamos para manter o serviço disponível 24/7, mas não garantimos disponibilidade ininterrupta.
              Manutenções programadas serão comunicadas com antecedência quando possível. Não nos responsabilizamos
              por indisponibilidades causadas por fatores fora do nosso controle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitação de responsabilidade</h2>
            <p>
              Na extensão máxima permitida por lei, a Mundo Digital Soluções não se responsabiliza por danos
              indiretos, incidentais, especiais ou consequentes decorrentes do uso ou impossibilidade de uso
              do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Rescisão</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Você pode cancelar sua conta a qualquer momento em Configurações → Minha Conta.</li>
              <li>Reservamo-nos o direito de suspender contas que violem estes termos.</li>
              <li>Após exclusão, seus dados serão anonimizados conforme nossa Política de Privacidade.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Alterações nos termos</h2>
            <p>
              Podemos modificar estes termos a qualquer momento. Alterações significativas serão comunicadas
              por e-mail ou aviso na plataforma com pelo menos 15 dias de antecedência. O uso continuado do
              serviço após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Legislação aplicável</h2>
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da
              comarca de Piracicaba/SP para dirimir quaisquer controvérsias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contato</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p><strong>Mundo Digital Soluções</strong></p>
              <p>E-mail: <a href="mailto:contato@mundodigitalsolucoes.com.br" className="text-indigo-600 hover:underline">contato@mundodigitalsolucoes.com.br</a></p>
              <p>Website: <a href="https://mundodigitalsolucoes.com.br" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">mundodigitalsolucoes.com.br</a></p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <Link href="/privacy" className="text-indigo-600 hover:underline">Política de Privacidade</Link>
          {' · '}
          <Link href="/auth/login" className="text-indigo-600 hover:underline">Voltar ao Login</Link>
        </div>
      </div>
    </div>
  );
}
