import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { ErrorBox, Spinner } from '../components/ui'
import { fetchFaqs, fetchProducts } from '../lib/api'
import { useSettings } from '../lib/settings'
import { useSeo } from '../lib/seo'
import { useAsync } from '../lib/useAsync'
import { waLink } from '../lib/format'
import type { StoreProduct } from '../lib/types'

function Section({
  title,
  products,
  to,
}: {
  title: string
  products: StoreProduct[]
  to?: string
}) {
  if (products.length === 0) return null
  return (
    <section className="container-x mt-14">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2 className="text-2xl font-black sm:text-3xl">
          <span className="ml-2 text-gold-500">⬡</span>
          {title}
        </h2>
        {to && (
          <Link to={to} className="text-sm font-bold text-gold-700 hover:underline">
            عرض الكل ←
          </Link>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.slice(0, 6).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const { settings } = useSettings()
  const { home: h, general: g } = settings
  const products = useAsync(fetchProducts, [])
  const faqs = useAsync(fetchFaqs, [])

  useSeo({
    title: `${g.store_name} | ${g.tagline}`,
    description: g.description,
    image: h.hero_image_url || null,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: g.store_name,
      description: g.description,
      telephone: g.phone || undefined,
      email: g.email || undefined,
      address: g.address || undefined,
      areaServed: 'DZ',
      image: h.hero_image_url || g.logo_url || undefined,
    },
  })

  const list = products.data ?? []
  const featured = list.filter((p) => p.is_featured)
  const virgin = list.filter((p) => p.queen_type === 'virgin')
  const mated = list.filter((p) => p.queen_type === 'mated')
  const best = list.filter((p) => p.is_best_seller)

  return (
    <>
      {/* Hero */}
      <section className="hex-bg relative overflow-hidden text-white">
        {h.hero_image_url && (
          <img
            src={h.hero_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
            fetchPriority="high"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-l from-ink/90 via-ink/70 to-ink/30" />
        <div className="container-x relative py-16 sm:py-24">
          <p className="mb-3 inline-block rounded-full border border-gold-400/50 px-4 py-1 text-sm font-bold text-gold-300">
            {g.store_name}
          </p>
          <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-5xl sm:leading-[1.25]">
            {h.hero_title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-white/85 sm:text-lg">{h.hero_text}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/products" className="btn-primary px-8 text-lg">
              {h.hero_cta}
            </Link>
            {g.whatsapp && (
              <a
                href={waLink(g.whatsapp, 'السلام عليكم، أريد الاستفسار عن ملكات النحل')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn border-2 border-white/40 text-white hover:border-white"
              >
                تواصل عبر واتساب
              </a>
            )}
          </div>
        </div>
      </section>

      {products.loading && <Spinner />}
      {products.error && (
        <div className="container-x mt-10">
          <ErrorBox message={products.error} onRetry={products.reload} />
        </div>
      )}

      {h.show_featured && <Section title={h.featured_title} products={featured} to="/products" />}
      {h.show_virgin && <Section title={h.virgin_title} products={virgin} to="/products?type=virgin" />}
      {h.show_mated && <Section title={h.mated_title} products={mated} to="/products?type=mated" />}
      {h.show_best && <Section title={h.best_title} products={best} to="/products" />}

      {!products.loading && !products.error && list.length === 0 && (
        <div className="container-x mt-12">
          <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-ink-600">
            لا توجد منتجات معروضة حاليًا. تابعنا قريبًا.
          </div>
        </div>
      )}

      {h.about_text && (
        <section className="container-x mt-14">
          <div className="card p-6 sm:p-8">
            <h2 className="mb-3 text-2xl font-black">{h.about_title}</h2>
            <p className="whitespace-pre-line leading-8 text-ink-600">{h.about_text}</p>
          </div>
        </section>
      )}

      {h.show_features && h.features.length > 0 && (
        <section className="container-x mt-14">
          <h2 className="mb-5 text-2xl font-black sm:text-3xl">
            <span className="ml-2 text-gold-500">⬡</span>
            {h.features_title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {h.features.map((f, i) => (
              <div key={i} className="card p-5">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-xl font-black text-gold-400">
                  {i + 1}
                </div>
                <h3 className="font-extrabold">{f.title}</h3>
                <p className="mt-1 text-sm leading-7 text-ink-600">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {h.show_steps && h.steps.length > 0 && (
        <section className="mt-14 bg-gold-50 py-10">
          <div className="container-x">
            <h2 className="mb-6 text-2xl font-black sm:text-3xl">{h.steps_title}</h2>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {h.steps.map((s, i) => (
                <li key={i} className="rounded-2xl bg-white p-5 shadow-card">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand font-black">
                    {i + 1}
                  </span>
                  <h3 className="font-extrabold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-ink-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {h.show_faq && (faqs.data?.length ?? 0) > 0 && (
        <section className="container-x mt-14">
          <h2 className="mb-5 text-2xl font-black sm:text-3xl">{h.faq_title}</h2>
          <div className="space-y-3">
            {faqs.data!.map((f) => (
              <details key={f.id} className="card group p-4">
                <summary className="cursor-pointer list-none font-extrabold">
                  <span className="ml-2 text-gold-500 group-open:hidden">＋</span>
                  <span className="ml-2 hidden text-gold-500 group-open:inline">－</span>
                  {f.question}
                </summary>
                <p className="mt-3 whitespace-pre-line leading-8 text-ink-600">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="container-x mt-14">
        <div className="hex-bg rounded-2xl p-8 text-white">
          <h2 className="text-2xl font-black">{h.contact_title}</h2>
          <div className="mt-4 grid gap-3 text-white/90 sm:grid-cols-3">
            {g.phone && (
              <a href={`tel:${g.phone}`} dir="ltr" className="text-right font-bold hover:text-gold-300">
                📞 {g.phone}
              </a>
            )}
            {g.email && (
              <a href={`mailto:${g.email}`} dir="ltr" className="text-right font-bold hover:text-gold-300">
                ✉️ {g.email}
              </a>
            )}
            {g.address && <span className="font-bold">📍 {g.address}</span>}
            {!g.phone && !g.email && !g.address && (
              <span className="text-white/70">ستظهر معلومات الاتصال هنا بعد إدخالها من لوحة التحكم.</span>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
