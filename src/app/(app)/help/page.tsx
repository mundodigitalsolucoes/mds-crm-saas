'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, HelpCircle, Search, X } from 'lucide-react';
import { helpArticles, helpCategories, searchHelpArticles } from '@/lib/help-center';

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');

  const filteredArticles = useMemo(() => searchHelpArticles(search), [search]);

  const featuredArticles = filteredArticles.slice(0, search ? 12 : 8);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-indigo-600" />
            Central de Ajuda
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tutoriais em texto e vídeo para operar o MDS CRM.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar tutoriais..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-10 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!search && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Categorias</h2>
              <p className="text-sm text-gray-500">Escolha um módulo para encontrar tutoriais relacionados.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {helpCategories.map((category) => {
              const Icon = category.icon;
              const total = helpArticles.filter((article) => article.category === category.key).length;

              return (
                <div key={category.key} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">{category.title}</h3>
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{category.description}</p>
                      <p className="mt-3 text-xs font-medium text-indigo-600">
                        {total} {total === 1 ? 'tutorial' : 'tutoriais'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {search ? 'Resultado da busca' : 'Tutoriais principais'}
            </h2>
            <p className="text-sm text-gray-500">
              {search
                ? `${filteredArticles.length} tutorial(is) encontrado(s).`
                : 'Conteúdos essenciais para começar a operar.'}
            </p>
          </div>
        </div>

        {featuredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="p-5 rounded-2xl bg-gray-100">
              <BookOpen className="w-10 h-10 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-900">Nenhum tutorial encontrado</p>
              <p className="text-sm text-gray-500 mt-1">Tente buscar por outro termo.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {featuredArticles.map((article) => {
              const category = helpCategories.find((item) => item.key === article.category);
              const Icon = category?.icon ?? BookOpen;

              return (
                <Link
                  key={article.slug}
                  href={`/help/${article.slug}`}
                  className="group bg-white border border-gray-200 rounded-xl p-5 transition-all hover:border-indigo-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        {category && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            {category.title}
                          </span>
                        )}
                        {article.planHint && (
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                            Recurso por plano
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600">
                        {article.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 leading-relaxed">{article.description}</p>
                    </div>
                    <ArrowRight className="mt-1 w-4 h-4 text-gray-300 transition-colors group-hover:text-indigo-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
