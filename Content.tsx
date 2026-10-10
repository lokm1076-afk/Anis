import { Link, useParams } from 'react-router-dom'
import { Empty, ErrorBox, Spinner } from '../components/ui'
import { fetchArticle, fetchArticles } from '../lib/api'
import { formatDate, waLink } from '../lib/format'
import { useSettings } from '../lib/settings'
import { useSeo } from '../lib/seo'
import { useAsync } from '../lib/useAsync'

export function Articles() {
  const { settings } = useSettings()
  const { data, loading, error, reload } = useAsync(fetchArticles, [])
  useSeo({
    title: `مقالات تعليمية عن تربية النحل | ${settings.general.store_name}`,
    description: 'مقالات تعليمية عن تربية النحل والملكات.',
  })
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">مقالات تعليمية</h1>
      <div className="mt-6">
        {loading && <Spinner />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!loading && !error && (data?.length ?? 0) === 0 && <Empty>لا توجد مقالات منشورة بعد.</Empty>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((a) => (
            <Link key={a.id} to={`/articles/${a.slug}`} className="card overflow-hidden transition hover:-translate-y-1">
              {a.cover_url && <img src={a.cover_url} alt={a.title} loading="lazy" className="aspect-video w-full object-cover" />}
              <div className="p-4">
                <h2 className="font-extrabold">{a.title}</h2>
                {a.excerpt && <p className="mt-1 line-clamp-3 text-sm leading-7 text-ink-600">{a.excerpt}</p>}
                <p className="mt-2 text-xs text-ink-600">{formatDate(a.created_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ArticleDetail() {
  const { slug = '' } = useParams()
  const { settings } = useSettings()
  const { data, loading, error, reload } = useAsync(() => fetchArticle(slug), [slug])
  useSeo({
    title: data ? `${data.title} | ${settings.general.store_name}` : settings.general.store_name,
    description: data?.excerpt || undefined,
    image: data?.cover_url,
  })
  if (loading) return <Spinner />
  if (error) return <div className="container-x py-8"><ErrorBox message={error} onRetry={reload} /></div>
  if (!data) return <div className="container-x py-16 text-center"><h1 className="text-2xl font-black">المقال غير موجود</h1></div>
  return (
    <article className="container-x max-w-3xl py-8">
      <Link to="/articles" className="text-sm font-bold text-gold-700">← كل المقالات</Link>
      <h1 className="mt-3 text-3xl font-black leading-snug">{data.title}</h1>
      <p className="mt-1 text-sm text-ink-600">{formatDate(data.created_at)}</p>
      {data.cover_url && <img src={data.cover_url} alt={data.title} className="mt-5 w-full rounded-2xl object-cover" />}
      <div className="mt-6 whitespace-pre-line text-lg leading-9">{data.body}</div>
    </article>
  )
}

const PAGES: Record<string, { title: string; key: 'terms' | 'cancellation' | 'privacy' | 'delivery_info' }> = {
  terms: { title: 'شروط البيع والحجز', key: 'terms' },
  cancellation: { title: 'سياسة الإلغاء والاسترجاع', key: 'cancellation' },
  privacy: { title: 'سياسة الخصوصية', key: 'privacy' },
  delivery: { title: 'معلومات التوصيل', key: 'delivery_info' },
}

export function StaticPage() {
  const { id = '' } = useParams()
  const { settings } = useSettings()
  const page = PAGES[id]
  useSeo({ title: `${page?.title ?? 'صفحة'} | ${settings.general.store_name}` })
  if (!page) return <NotFound />
  const text = settings.policies[page.key]
  return (
    <div className="container-x max-w-3xl py-8">
      <h1 className="text-3xl font-black">{page.title}</h1>
      {text ? (
        <div className="mt-5 whitespace-pre-line text-lg leading-9">{text}</div>
      ) : (
        <Empty>لم يُضف المتجر هذا المحتوى بعد.</Empty>
      )}
    </div>
  )
}

export function Contact() {
  const { settings } = useSettings()
  const g = settings.general
  useSeo({ title: `تواصل معنا | ${g.store_name}`, description: `معلومات الاتصال بـ ${g.store_name}` })
  const rows: [string, string | undefined, string?][] = [
    ['الهاتف', g.phone, g.phone ? `tel:${g.phone}` : undefined],
    ['واتساب', g.whatsapp, g.whatsapp ? waLink(g.whatsapp) : undefined],
    ['البريد الإلكتروني', g.email, g.email ? `mailto:${g.email}` : undefined],
    ['العنوان', g.address],
  ]
  const social = Object.entries(g.social).filter(([, v]) => v)
  return (
    <div className="container-x max-w-2xl py-8">
      <h1 className="text-3xl font-black">تواصل معنا</h1>
      <p className="mt-1 text-ink-600">{g.description}</p>
      <div className="card mt-5 divide-y divide-ink/10">
        {rows.filter(([, v]) => v).map(([label, value, href]) => (
          <div key={label} className="flex items-center justify-between gap-3 p-4">
            <span className="font-semibold text-ink-600">{label}</span>
            {href ? (
              <a href={href} dir="ltr" target="_blank" rel="noopener noreferrer" className="font-extrabold hover:text-gold-700">{value}</a>
            ) : (
              <span className="font-extrabold">{value}</span>
            )}
          </div>
        ))}
        {social.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 p-4">
            <span className="font-semibold text-ink-600">{k}</span>
            <a href={v} target="_blank" rel="noopener noreferrer" className="font-extrabold hover:text-gold-700">زيارة الصفحة</a>
          </div>
        ))}
        {rows.every(([, v]) => !v) && social.length === 0 && (
          <p className="p-4 text-ink-600">لم تُضف معلومات الاتصال بعد.</p>
        )}
      </div>
    </div>
  )
}

export function NotFound() {
  useSeo({ title: 'الصفحة غير موجودة', noindex: true })
  return (
    <div className="container-x py-20 text-center">
      <h1 className="text-5xl font-black text-gold-500">404</h1>
      <p className="mt-2 text-lg font-bold">الصفحة غير موجودة</p>
      <Link to="/" className="btn-primary mt-5">العودة إلى الرئيسية</Link>
    </div>
  )
}
