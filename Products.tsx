import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { Empty, ErrorBox, Spinner } from '../components/ui'
import { fetchProducts } from '../lib/api'
import { useSettings } from '../lib/settings'
import { useSeo } from '../lib/seo'
import { useAsync } from '../lib/useAsync'

type Tab = 'all' | 'virgin' | 'mated' | 'offers'

export default function Products() {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('type') as Tab) || 'all'
  const { data, loading, error, reload } = useAsync(fetchProducts, [])

  useSeo({
    title: `ملكات النحل العذراء والملقحة | ${settings.general.store_name}`,
    description: 'تصفح ملكات النحل العذراء والملقحة المتاحة للطلب والحجز المسبق مع السعر بالدينار الجزائري.',
  })

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'virgin', label: 'ملكات نحل عذراء' },
    { id: 'mated', label: 'ملكات نحل ملقحة' },
  ]
  if (settings.flags.offers_enabled) tabs.push({ id: 'offers', label: 'عروض خاصة' })

  const list = (data ?? []).filter((p) => {
    if (tab === 'virgin') return p.queen_type === 'virgin'
    if (tab === 'mated') return p.queen_type === 'mated'
    if (tab === 'offers') return p.is_offer
    return true
  })

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">المنتجات</h1>
      <p className="mt-1 text-ink-600">ملكات نحل عذراء وملقحة، مع الكمية المتاحة وحالة كل دفعة.</p>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'all' ? {} : { type: t.id })}
            className={`btn shrink-0 ${tab === t.id ? 'bg-ink text-gold-300' : 'border-2 border-ink/15 bg-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading && <Spinner />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!loading && !error && list.length === 0 && <Empty>لا توجد منتجات في هذا التصنيف حاليًا.</Empty>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  )
}
