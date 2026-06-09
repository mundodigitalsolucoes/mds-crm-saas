import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, HelpCircle, PlayCircle, Sparkles } from 'lucide-react';
import {
  getArticleBySlug,
  getArticlesByCategory,
  getCategoryByKey,
  helpArticles,
} from '@/lib/help-center';

interface HelpArticlePageProps {
  params: {
    slug: string;
  };
}

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

export function generateStaticParams() {
  return helpArticles.map((article) => ({ slug: article.slug }));
}

export default function HelpArticlePage({ params }: HelpArticlePageProps) {
  const article = getArticleBySlug(params.slug);

  if (!article) {
    notFound();
  }

  const category = getCategoryByKey(article.category);
  const CategoryIcon = category?.icon ?? BookOpen;
  const embedUrl = getYoutubeEmbedUrl(article.videoUrl);
  const relatedArticles = getArticlesByCategory(article.category)
    .filter((item) => item.slug !== article.slug)
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div>
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Central de Ajuda
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600">
            <CategoryIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-2 flex-wrap">
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
            <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">{article.description}</p>
          </div>
        </div>
      </div>

      {article.planHint && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-indigo-900">Recurso relacionado ao plano</h2>
            <p className="mt-1 text-sm text-indigo-700 leading-relaxed">{article.planHint}</p>
          </div>
        </div>
      )}

      {embedUrl ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Vídeo tutorial</h2>
          </div>
          <div className="aspect-video overflow-hidden rounded-xl bg-gray-100">
            <iframe
              src={embedUrl}
              title={article.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-gray-900">Passo a passo</h2>
        </div>

        <ol className="space-y-4">
          {article.steps.map((step, index) => (
            <li key={`${article.slug}-step-${index}`} className="flex gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <p className="pt-1 text-sm text-gray-600 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {article.faqs?.length ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Dúvidas relacionadas</h2>
          </div>

          <div className="space-y-3">
            {article.faqs.map((faq) => (
              <div key={faq.question} className="rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{faq.question}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {relatedArticles.length ? (
        <div>
          <div className="mb-3">
            <h2 className="text-base font-semibold text-gray-900">Tutoriais relacionados</h2>
            <p className="text-sm text-gray-500">Outros conteúdos da categoria {category?.title ?? 'selecionada'}.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedArticles.map((related) => (
              <Link
                key={related.slug}
                href={`/help/${related.slug}`}
                className="group bg-white border border-gray-200 rounded-xl p-4 transition-all hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600">
                      {related.title}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{related.description}</p>
                  </div>
                  <ArrowRight className="mt-1 w-4 h-4 text-gray-300 transition-colors group-hover:text-indigo-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
