import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ImagePlaceholder, stockBadgeClass } from '../components/ProductCard'
import { ErrorBox, PriceTag, Spinner, useToast } from '../components/ui'
import { batchOrderable, fetchDeliveryWilayas, fetchProductBySlug } from '../lib/api'
import { useCart } from '../lib/cart'
import { formatDate, formatDZD, QUEEN_TYPE_LABEL, STOCK_LABEL, waLink } from '../lib/format'
import { useSettings } from '../lib/settings'
import { useSeo } from '../lib/seo'
import { useAsync } from '../lib/useAsync'

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 border-b border-ink/10 py-2.5 text-sm last:border-0">
      <dt className="font-semibold text-ink-600">{label}</dt>
      <dd className="text-left font-bold">{value}</dd>
    </div>
  )
}

export default function ProductDetail() {
  const { slug = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const cart = useCart()
  const { settings } = useSettings()
  const { data: p, loading, error, reload } = useAsync(() => fetchProductBySlug(slug), [slug])
  const wilayas = useAsync(fetchDeliveryWilayas, [])
  const [imgIdx, setImgIdx] = useState(0)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    setImgIdx(0)
    setQty(1)
    setBatchId(p?.orderable_batch?.id ?? null)
  }, [p])

  const orderableBatches = useMemo(() => (p ? p.batches.filter((b) => batchOrderable(b)) : []), [p])
  const batch = useMemo(
    () => (p ? p.batches.find((b) => b.id === batchId) ?? p.orderable_batch ?? p.batches[0] ?? null : null),
    [p, batchId],
  )

  const maxQty = p && batch ? Math.max(1, Math.min(batch.available_qty, p.max_per_order ?? 9999)) : 1
  const canOrder = Boolean(p && batch && batchOrderable(batch))

  useSeo({
    title: p ? p.seo_title || `${p.name} | ${settings.general.store_name}` : settings.general.store_name,
    description: p ? p.seo_description || p.short_description || undefined : undefined,
    image: p?.images[0]?.url ?? null,
    jsonLd: p
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.name,
          description: p.short_description || p.description || undefined,
          image: p.images.map((i) => i.url),
          brand: { '@type': 'Brand', name: settings.general.store_name },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'DZD',
            price: p.sale_price ?? p.price,
            availability:
              p.stock_status === 'available'
                ? 'https://schema.org/InStock'
                : p.stock_status === 'preorder'
                  ? 'https://schema.org/PreOrder'
                  : 'https://schema.org/OutOfStock',
          },
        }
      : null,
  })

  if (loading) return <Spinner />
  if (error) return <div className="container-x py-8"><ErrorBox message={error} onRetry={reload} /></div>
  if (!p) {
    return (
      <div className="container-x py-16 text-center">
        <h1 className="text-2xl font-black">المنتج غير موجود</h1>
        <Link to="/products" className="btn-primary mt-5">العودة إلى المنتجات</Link>
      </div>
    )
  }

  function addToCart(goCheckout: boolean) {
    if (!p || !batch || !canOrder) return
    const err = cart.add({
      batchId: batch.id,
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: p.images[0]?.url ?? null,
      unitPrice: p.sale_price ?? p.price,
      qty,
      maxQty,
      queenType: p.queen_type,
      isPreorder: batch.is_preorder,
      batchLabel: batch.label,
    })
    if (err) return toast(err, 'error')
    toast('تمت الإضافة إلى السلة')
    if (goCheckout) nav('/checkout')
  }

  const status = batch && canOrder ? (batch.is_preorder ? 'preorder' : 'available') : p.stock_status
  const wa = waLink(settings.general.whatsapp, `السلام عليكم، أريد الاستفسار عن: ${p.name}`)
  const img = p.images[imgIdx]
  const activeWilayas = wilayas.data ?? []

  return (
    <div className="container-x py-6">
      <nav className="mb-4 text-sm text-ink-600" aria-label="مسار التنقل">
        <Link to="/" className="hover:text-gold-700">الرئيسية</Link> /{' '}
        <Link to="/products" className="hover:text-gold-700">المنتجات</Link> / <span className="font-bold">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl border border-ink/10 bg-ink/5">
            {img ? (
              <img src={img.url} alt={img.alt_text || p.name} className="h-full w-full object-cover" />
            ) : (
              <ImagePlaceholder className="h-full w-full text-8xl" />
            )}
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {p.images.map((im, i) => (
                <button
                  key={im.id}
                  onClick={() => setImgIdx(i)}
                  aria-label={`صورة ${i + 1}`}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === imgIdx ? 'border-gold-500' : 'border-transparent'}`}
                >
                  <img src={im.url} alt={im.alt_text || ''} loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-ink text-gold-300">{QUEEN_TYPE_LABEL[p.queen_type]}</span>
            <span className={`badge ${stockBadgeClass(status)}`}>{STOCK_LABEL[status]}</span>
          </div>
          <h1 className="mt-3 text-3xl font-black leading-snug">{p.name}</h1>
          <PriceTag price={p.price} sale={p.sale_price} className="mt-2 [&>span:first-child]:text-3xl" />
          {p.short_description && <p className="mt-3 leading-8 text-ink-600">{p.short_description}</p>}

          {/* اختيار الدفعة إذا تعددت */}
          {orderableBatches.length > 1 && (
            <div className="mt-4">
              <span className="label">اختر الدفعة</span>
              <div className="flex flex-wrap gap-2">
                {orderableBatches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setBatchId(b.id)
                      setQty(1)
                    }}
                    className={`btn btn-sm ${batch?.id === b.id ? 'bg-ink text-gold-300' : 'border-2 border-ink/15'}`}
                  >
                    {b.label}
                    {b.is_preorder ? ' (حجز مسبق)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <dl className="mt-5 rounded-2xl border border-ink/10 px-4">
            <InfoRow label="نوع الملكة" value={QUEEN_TYPE_LABEL[p.queen_type]} />
            <InfoRow label="السلالة / الأصل الوراثي" value={p.breed} />
            <InfoRow label="الدفعة" value={batch ? [batch.label, batch.batch_code].filter(Boolean).join(' — ') : null} />
            <InfoRow label="تاريخ الفقس" value={formatDate(batch?.hatch_date)} />
            <InfoRow label="تاريخ التلقيح" value={formatDate(batch?.mating_date)} />
            <InfoRow label="تاريخ الإنتاج" value={formatDate(batch?.production_date)} />
            <InfoRow
              label="الكمية المتاحة"
              value={batch ? (batch.available_qty > 0 ? `${batch.available_qty}` : 'نفدت') : null}
            />
            {batch?.is_preorder && (
              <>
                <InfoRow label="تاريخ التسليم المتوقع" value={formatDate(batch.expected_delivery_date)} />
                <InfoRow label="العربون المطلوب (لكل ملكة)" value={batch.deposit_amount > 0 ? formatDZD(batch.deposit_amount) : null} />
                <InfoRow label="بداية الحجز" value={formatDate(batch.preorder_start)} />
                <InfoRow label="نهاية الحجز" value={formatDate(batch.preorder_end)} />
              </>
            )}
          </dl>

          {canOrder ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="label !mb-0">الكمية</span>
                <div className="flex items-center rounded-xl border border-ink/20">
                  <button className="h-11 w-11 text-xl font-black" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="إنقاص">−</button>
                  <span className="w-10 text-center font-extrabold">{qty}</span>
                  <button className="h-11 w-11 text-xl font-black" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="زيادة">＋</button>
                </div>
                {p.max_per_order != null && (
                  <span className="text-xs text-ink-600">الحد الأقصى للطلب: {p.max_per_order}</span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="btn-primary" onClick={() => addToCart(false)}>إضافة إلى السلة</button>
                <button className="btn-dark" onClick={() => addToCart(true)}>
                  {batch?.is_preorder ? 'احجز وأكمل الطلب' : 'إتمام الطلب'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-800">
              {STOCK_LABEL[p.stock_status]}
            </div>
          )}
          {settings.general.whatsapp && (
            <a className="btn-outline mt-3 w-full" href={wa} target="_blank" rel="noopener noreferrer">
              💬 تواصل عبر واتساب
            </a>
          )}
        </div>
      </div>

      {(p.description || batch?.cancellation_terms) && (
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          {p.description && (
            <div className="card p-5">
              <h2 className="mb-2 text-xl font-black">الوصف</h2>
              <p className="whitespace-pre-line leading-8 text-ink-600">{p.description}</p>
            </div>
          )}
          {batch?.is_preorder && batch.cancellation_terms && (
            <div className="card p-5">
              <h2 className="mb-2 text-xl font-black">شروط إلغاء الحجز</h2>
              <p className="whitespace-pre-line leading-8 text-ink-600">{batch.cancellation_terms}</p>
            </div>
          )}
        </section>
      )}

      <section className="card mt-6 p-5">
        <h2 className="mb-2 text-xl font-black">النقل والتسليم</h2>
        {p.delivery_notes && <p className="mb-3 whitespace-pre-line leading-8 text-ink-600">{p.delivery_notes}</p>}
        {settings.policies.delivery_info && (
          <p className="mb-3 whitespace-pre-line leading-8 text-ink-600">{settings.policies.delivery_info}</p>
        )}
        <h3 className="mb-2 font-extrabold">الولايات المتاحة للتوصيل حاليًا</h3>
        {activeWilayas.length === 0 ? (
          <p className="text-sm text-ink-600">لم تُفعَّل ولايات للتوصيل بعد. تواصل معنا للاستفسار.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeWilayas.map((w) => (
              <span
                key={w.id}
                className={`badge ${w.orders_paused ? 'bg-slate-200 text-slate-600' : 'bg-gold-100 text-gold-800'}`}
              >
                {w.name_ar}
                {w.orders_paused ? ' (متوقف مؤقتًا)' : ''}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
