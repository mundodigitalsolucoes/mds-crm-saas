'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Users, TrendingUp, Calendar, MessageSquare, BarChart3, Zap, Shield, Globe } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image 
                src="/images/favicon.png" 
                alt="Mundo Digital" 
                width={40} 
                height={40}
                className="w-10 h-10"
              />
              <div>
                <div className="text-xl font-bold text-md-primary-800">MUNDO DIGITAL</div>
                <div className="text-xs text-md-secondary-600">Soluções em Marketing e Vendas</div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <Link href="#recursos" className="text-gray-700 hover:text-md-primary transition">
                Recursos
              </Link>
              <Link href="#planos" className="text-gray-700 hover:text-md-primary transition">
                Planos
              </Link>
              <Link href="#sobre" className="text-gray-700 hover:text-md-primary transition">
                Sobre
              </Link>
              <Link 
                href="/auth/login" 
                className="text-md-primary hover:text-md-primary-700 font-medium transition"
              >
                Entrar
              </Link>
              <Link 
                href="/auth/signup" 
                className="bg-md-primary hover:bg-md-primary-700 text-white px-6 py-2 rounded-lg font-medium transition shadow-md hover:shadow-lg"
              >
                Começar Grátis
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block bg-md-primary-50 text-md-primary-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              🚀 Plataforma SaaS de CRM
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-md-primary-900 mb-6 leading-tight">
              Transforme Leads em <span className="text-md-secondary-600">Clientes</span> com Inteligência
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Sistema completo de CRM com integração nativa ao Chatwoot, IA para análise de leads e gestão visual de projetos de marketing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/auth/signup"
                className="bg-md-primary hover:bg-md-primary-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition shadow-lg hover:shadow-xl text-center"
              >
                Teste Grátis por 14 dias
              </Link>
              <Link 
                href="#demo"
                className="border-2 border-md-primary text-md-primary hover:bg-md-primary-50 px-8 py-4 rounded-lg font-semibold text-lg transition text-center"
              >
                Ver Demo
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Sem cartão de crédito
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Cancele quando quiser
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-md-primary to-md-secondary-600 rounded-2xl p-1 shadow-2xl">
              <div className="bg-white rounded-xl p-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Novo lead capturado!</div>
                      <div className="text-sm text-gray-600">João Silva - via Chatwoot</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-md-primary">248</div>
                      <div className="text-sm text-gray-600">Leads Ativos</div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">68%</div>
                      <div className="text-sm text-gray-600">Taxa Conversão</div>
                    </div>
                  </div>
                  <div className="h-32 bg-gradient-to-t from-md-primary-100 to-transparent rounded-lg"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-md-primary text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">5.000+</div>
              <div className="text-md-primary-200">Empresas Ativas</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">50K+</div>
              <div className="text-md-primary-200">Leads Gerenciados</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">98%</div>
              <div className="text-md-primary-200">Satisfação</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">24/7</div>
              <div className="text-md-primary-200">Suporte</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-md-primary-900 mb-4">
            Tudo que você precisa para crescer
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Funcionalidades completas para gestão de leads, projetos de marketing e vendas
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Users className="w-8 h-8" />,
              title: "Gestão de Leads",
              description: "Pipeline visual, scoring automático com IA e sincronização com Chatwoot",
              color: "from-blue-500 to-cyan-500"
            },
            {
              icon: <TrendingUp className="w-8 h-8" />,
              title: "Projetos de Marketing",
              description: "Controle de campanhas, orçamento, ROI e métricas em tempo real",
              color: "from-purple-500 to-pink-500"
            },
            {
              icon: <Calendar className="w-8 h-8" />,
              title: "Kanban Boards",
              description: "Gestão visual de tarefas com drag-and-drop e colaboração em equipe",
              color: "from-orange-500 to-red-500"
            },
            {
              icon: <MessageSquare className="w-8 h-8" />,
              title: "Integração Chatwoot",
              description: "Capture leads automaticamente de conversas e centralize comunicações",
              color: "from-green-500 to-emerald-500"
            },
            {
              icon: <BarChart3 className="w-8 h-8" />,
              title: "Relatórios Avançados",
              description: "Dashboards personalizáveis, exportação e análise de performance",
              color: "from-indigo-500 to-blue-500"
            },
            {
              icon: <Zap className="w-8 h-8" />,
              title: "Automações com IA",
              description: "Scoring de leads, sugestões inteligentes e análise preditiva",
              color: "from-yellow-500 to-orange-500"
            },
          ].map((feature, i) => (
            <div key={i} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition border border-gray-100">
              <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center text-white mb-6`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-md-primary-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-md-primary-900 mb-4">
              Planos para todos os tamanhos
            </h2>
            <p className="text-xl text-gray-600">
              Comece grátis e escale conforme sua necessidade
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                name: "Starter",
                price: "R$ 99",
                description: "Perfeito para começar",
                features: [
                  "Até 5 usuários",
                  "100 leads",
                  "10 projetos",
                  "Integração Chatwoot",
                  "Relatórios básicos",
                  "Suporte por email"
                ]
              },
              {
                name: "Professional",
                price: "R$ 299",
                description: "Para equipes em crescimento",
                features: [
                  "Até 20 usuários",
                  "1.000 leads",
                  "50 projetos",
                  "IA avançada",
                  "Relatórios completos",
                  "Suporte prioritário",
                  "Automações ilimitadas",
                  "API access"
                ],
                popular: true
              },
              {
                name: "Enterprise",
                price: "Customizado",
                description: "Para grandes empresas",
                features: [
                  "Usuários ilimitados",
                  "Leads ilimitados",
                  "Projetos ilimitados",
                  "White label",
                  "Onboarding dedicado",
                  "Gerente de conta",
                  "SLA garantido",
                  "Infraestrutura dedicada"
                ]
              }
            ].map((plan, i) => (
              <div 
                key={i} 
                className={`bg-white rounded-xl shadow-lg p-8 ${plan.popular ? 'ring-2 ring-md-primary scale-105' : ''}`}
              >
                {plan.popular && (
                  <div className="bg-md-primary text-white text-sm font-semibold px-4 py-1 rounded-full inline-block mb-4">
                    Mais Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-md-primary-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-md-primary">{plan.price}</span>
                  {plan.price !== "Customizado" && <span className="text-gray-600">/mês</span>}
                </div>
                <p className="text-gray-600 mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link 
                  href="/auth/signup"
                  className={`block text-center py-3 px-6 rounded-lg font-semibold transition ${
                    plan.popular 
                      ? 'bg-md-primary text-white hover:bg-md-primary-700' 
                      : 'bg-gray-100 text-md-primary hover:bg-gray-200'
                  }`}
                >
                  {plan.price === "Customizado" ? "Falar com Vendas" : "Começar Agora"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-md-primary to-md-secondary-600 rounded-2xl p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">
            Pronto para transformar suas vendas?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Junte-se a milhares de empresas que já usam o MDS CRM para crescer
          </p>
          <Link 
            href="/auth/signup"
            className="inline-block bg-white text-md-primary hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition shadow-lg"
          >
            Começar Teste Grátis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-md-primary-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image src="/images/logo-light.png" alt="Mundo Digital" width={150} height={40} />
              </div>
              <p className="text-md-primary-200 text-sm">
                Soluções completas em Marketing e Vendas
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-md-primary-200 text-sm">
                <li><Link href="#recursos" className="hover:text-white transition">Recursos</Link></li>
                <li><Link href="#planos" className="hover:text-white transition">Planos</Link></li>
                <li><Link href="#" className="hover:text-white transition">Integrações</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-md-primary-200 text-sm">
                <li><Link href="#" className="hover:text-white transition">Sobre</Link></li>
                <li><Link href="#" className="hover:text-white transition">Blog</Link></li>
                <li><Link href="#" className="hover:text-white transition">Contato</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-md-primary-200 text-sm">
                <li><Link href="#" className="hover:text-white transition">Central de Ajuda</Link></li>
                <li><Link href="#" className="hover:text-white transition">Documentação</Link></li>
                <li><Link href="#" className="hover:text-white transition">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-md-primary-700 pt-8 text-center text-md-primary-300 text-sm">
            <p>© 2025 Mundo Digital. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
