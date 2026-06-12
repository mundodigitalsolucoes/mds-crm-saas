'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, HelpCircle, PlayCircle, Search, X } from 'lucide-react';
import {
  getSubCategoriesByCategory,
  helpArticles,
  helpCategories,
  type HelpCategoryKey,
  searchHelpArticles,
} from '@/lib/help-center';

const welcomeVideoUrl = '';

function getYoutubeEmbedUrl(url?: string) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();

    if (!videoId) return null;

    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategoryKey | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  const welcomeEmbedUrl = getYoutubeEmbedUrl(welcomeVideoUrl);

  const selectedCategoryData = selectedCategory
    ? helpCategories.find((category) => category.key === selectedCategory)
    : null;

  const subCategories = useMemo(() => {
    if (!selectedCategory) return [];
    return getSubCategoriesByCategory(selectedCategory);
  }, [selectedCategory]);

  const filteredArticles = useMemo(() => {
    const articles = searchHelpArticles(search);

    return articles.filter((article) => {
      if (selectedCategory && article.category !== selectedCategory) return false;
      if (selectedSubCategory && article.subCategory !== selectedSubCategory) return false;
      return true;
    });
  }, [search, selectedCategory, selectedSubCategory]);

  const featuredArticles = filteredArticles.slice(0, search || selectedCategory ? 24 : 8);

  const handleSelectCategory = (category: HelpCategoryKey) => {
    setSelectedCategory(category);
    setSelectedSubCategory(null);
    setSearch('');
  };

  const handleSelectSubCategory = (subCategory: string) => {
    setSelectedSubCategory(subCategory);
    setSearch('');
  };

  const handleBackToCategories = () => {
    setSearch('');
    setSelectedCategory(null);
    setSelectedSubCategory(null);
  };

  const handleBackToSubCategories = () => {
    setSearch('');
    setSelectedSubCategory(null);
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategory(null);
    setSelectedSubCategory(null);
  };

  const showCategories = !search && !selectedCategory;
  const showSubCategories = !search && selectedCategory && !selectedSubCategory;
  const showArticles = search || !selectedCategory || selectedSubCategory;

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

      {showCategories && (
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-indigo-100 bg-white lg:grid-cols-[1fr_420px]">
          <div className="flex flex-col justify-center p-6 lg:p-8">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
              <PlayCircle className="h-4 w-4" />
              Comece por aqui
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Boas-vindas à Central de Ajuda</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500">
              Assista à visão geral do MDS CRM antes de navegar pelos tutoriais. Este vídeo deve apresentar os módulos principais, a lógica da operação e o melhor caminho para começar.
            </p>
          </div>

          <div className="bg-gray-50 p-4 lg:p-5">
            {welcomeEmbedUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl bg-gray-100">
                <iframe
                  src={welcomeEmbedUrl}
                  title="Comece por aqui"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 text-center">
                <div className="mb-3 rounded-2xl bg-indigo-50 p-4 text-indigo-600">
                  <PlayCircle className="h-9 w-9" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Vídeo em breve</h3>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-gray-500">
                  Aqui ficará o vídeo de boas-vindas da Central de Ajuda.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
          {(search || selectedCategory || selectedSubCategory) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Limpar filtros"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {(selectedCategoryData || selectedSubCategory) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Você está em:</span>
            <button type="button" onClick={handleBackToCategories} className="font-medium text-gray-500 hover:text-indigo-600">
              Categorias
            </button>
            {selectedCategoryData && (
              <>
                <span>/</span>
                <button
                  type="button"
                  onClick={handleBackToSubCategories}
                  className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-600 hover:bg-indigo-100"
                >
                  {selectedCategoryData.title}
                </button>
              </>
            )}
            {selectedSubCategory && (
              <>
                <span>/</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
                  {selectedSubCategory}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {showCategories && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Categorias</h2>
              <p className="text-sm text-gray-500">Clique em um módulo para encontrar tutoriais relacionados.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {helpCategories.map((category) => {
              const Icon = category.icon;
              const total = helpArticles.filter((article) => article.category === category.key).length;

              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => handleSelectCategory(category.key)}
                  className="group bg-white border border-gray-200 rounded-xl p-4 text-left transition-all hover:border-indigo-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600">{category.title}</h3>
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{category.description}</p>
                      <p className="mt-3 text-xs font-medium text-indigo-600">
                        {total} {total === 1 ? 'tutorial' : 'tutoriais'}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 w-4 h-4 text-gray-300 transition-colors group-hover:text-indigo-500" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showSubCategories && selectedCategoryData && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{selectedCategoryData.title}</h2>
              <p className="text-sm text-gray-500">Escolha um tema para visualizar os artigos disponíveis.</p>
            </div>

            <button
              type="button"
              onClick={handleBackToCategories}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
            >
              <ArrowLeft className="w-4 h-4" />
              Categorias
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subCategories.map((subCategory) => {
              const total = helpArticles.filter(
                (article) => article.category === selectedCategory && article.subCategory === subCategory
              ).length;

              return (
                <button
                  key={subCategory}
                  type="button"
                  onClick={() => handleSelectSubCategory(subCategory)}
                  className="group bg-white border border-gray-200 rounded-xl p-5 text-left transition-all hover:border-indigo-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600">{subCategory}</h3>
                      <p className="mt-2 text-xs text-gray-500">
                        {total} {total === 1 ? 'artigo disponível' : 'artigos disponíveis'}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 w-4 h-4 text-gray-300 transition-colors group-hover:text-indigo-500" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showArticles && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {search
                  ? 'Resultado da busca'
                  : selectedSubCategory
                    ? selectedSubCategory
                    : 'Tutoriais principais'}
              </h2>
              <p className="text-sm text-gray-500">
                {search || selectedCategory || selectedSubCategory
                  ? `${filteredArticles.length} tutorial(is) encontrado(s).`
                  : 'Conteúdos essenciais para começar a operar.'}
              </p>
            </div>

            {(search || selectedCategory || selectedSubCategory) && (
              <button
                type="button"
                onClick={selectedSubCategory ? handleBackToSubCategories : handleClearFilters}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              >
                <ArrowLeft className="w-4 h-4" />
                {selectedSubCategory ? 'Temas' : 'Ver todos'}
              </button>
            )}
          </div>

          {featuredArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="p-5 rounded-2xl bg-gray-100">
                <BookOpen className="w-10 h-10 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-gray-900">Nenhum tutorial encontrado</p>
                <p className="text-sm text-gray-500 mt-1">Tente buscar por outro termo ou limpe os filtros.</p>
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
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                            {article.subCategory}
                          </span>
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
      )}
    </div>
  );
}
