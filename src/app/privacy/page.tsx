// src/app/privacy/page.tsx
// Política de Privacidade — página pública (LGPD)

import Link from 'next/link';

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
          <p className="text-gray-500 text-sm">Última atualização: 18 de fevereiro de 2026</p>
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introdução</h2>
            <p>
              A <strong>Mundo Digital Soluções</strong> (&quot;nós&quot;, &quot;nosso&quot;) opera a plataforma MDS CRM
              (disponível em crm.mundodigitalsolucoes.com.br). Esta Política de Privacidade descreve como coletamos,
              usamos, armazenamos e protegemos seus dados pessoais, em conformidade com a{' '}
              <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Dados que coletamos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, nome da empresa, senha (armazenada com hash criptográfico).</li>
              <li><strong>Dados de uso:</strong> leads, tarefas, projetos, ordens de serviço e demais registros criados por você na plataforma.</li>
              <li><strong>Dados técnicos:</strong> endereço IP, data/hora de acesso, tipo de navegador.</li>
              <li><strong>Dados de consentimento:</strong> data, hora e IP em que você aceitou esta política.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Finalidade do tratamento</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Fornecer e manter o serviço MDS CRM.</li>
              <li>Autenticar e proteger sua conta.</li>
              <li>Enviar notificações relevantes sobre o serviço.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Base legal</h2>
            <p>
              O tratamento de seus dados é realizado com base no seu <strong>consentimento explícito</strong> (Art. 7°, I da LGPD),
              fornecido no momento do cadastro, e na <strong>execução de contrato</strong> (Art. 7°, V) para prestação do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Compartilhamento de dados</h2>
            <p>
              Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing.
              Seus dados podem ser compartilhados apenas com:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Provedores de infraestrutura:</strong> para hospedagem e operação do serviço.</li>
              <li><strong>Serviço de e-mail transacional:</strong> para envio de notificações do sistema.</li>
              <li><strong>Autoridades legais:</strong> quando exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Seus direitos (LGPD Art. 18)</h2>
            <p>Você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Acesso:</strong> consultar quais dados pessoais tratamos sobre você.</li>
              <li><strong>Exportação:</strong> solicitar uma cópia dos seus dados em formato legível (JSON).</li>
              <li><strong>Correção:</strong> solicitar a atualização de dados incompletos ou incorretos.</li>
              <li><strong>Eliminação:</strong> solicitar a exclusão dos seus dados pessoais.</li>
              <li><strong>Revogação do consentimento:</strong> retirar seu consentimento a qualquer momento.</li>
            </ul>
            <p className="mt-2">
              Esses direitos podem ser exercidos diretamente na plataforma, em{' '}
              <strong>Configurações → Minha Conta</strong>, ou por e-mail para{' '}
              <a href="mailto:contato@mundodigitalsolucoes.com.br" className="text-indigo-600 hover:underline">
                contato@mundodigitalsolucoes.com.br
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Armazenamento e segurança</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Senhas armazenadas com hash bcrypt (nunca em texto plano).</li>
              <li>Comunicação via HTTPS com certificado SSL.</li>
              <li>Dados de integração criptografados com AES-256-GCM.</li>
              <li>Acesso restrito por autenticação e controle de permissões granular.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Retenção de dados</h2>
            <p>
              Seus dados são mantidos enquanto sua conta estiver ativa. Ao solicitar exclusão, seus dados pessoais
              serão anonimizados em até 30 dias. Dados necessários para cumprimento de obrigações legais podem ser
              retidos pelo prazo exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Alterações significativas serão comunicadas por e-mail
              ou aviso na plataforma. A data da última atualização estará sempre indicada no topo desta página.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contato</h2>
            <p>
              Para dúvidas sobre esta política ou sobre o tratamento dos seus dados pessoais, entre em contato:
            </p>
            <div className="mt-2 bg-gray-50 rounded-lg p-4">
              <p><strong>Mundo Digital Soluções</strong></p>
              <p>E-mail: <a href="mailto:contato@mundodigitalsolucoes.com.br" className="text-indigo-600 hover:underline">contato@mundodigitalsolucoes.com.br</a></p>
              <p>Website: <a href="https://mundodigitalsolucoes.com.br" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">mundodigitalsolucoes.com.br</a></p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <Link href="/terms" className="text-indigo-600 hover:underline">Termos de Uso</Link>
          {' · '}
          <Link href="/auth/login" className="text-indigo-600 hover:underline">Voltar ao Login</Link>
        </div>
      </div>
    </div>
  );
}
