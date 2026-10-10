import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { useSettings } from '../lib/settings'
import { QUEEN_TYPE_LABEL, STOCK_LABEL, waLink } from '../lib/format'
import type { StoreProduct } from '../lib/types'
import { PriceTag, useToast } from './ui'

export function ImagePlaceholder({ className = '' }: { className?: string }) {
  return (
    <div className={`hex-bg flex items-center justify-center text-5xl text-gold-400 ${className}`} aria-hidden>
      ⬡
    </div>
  )
}

export function stockBadgeClass(s: StoreProduct['stock_status']) {
  switch (s) {
    case 'available':
      return 'bg-emerald-100 text-emerald-800'
    case 'preorder':
      return 'bg-amber-100 text-amber-800'
    case 'closed':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-red-100 text-red-800'
  }
}

/** إضافة المنتج إلى السلة من الدفعة المتاحة حاليًا */
export function useAddToCart() {
  const cart = useCart()
  const toast = useToast()
  return (p: StoreProduct, qty = 1): boolean => {
    const b = p.orderable_batch
    if (!b) {
      toast('هذا المنتج غير متاح للطلب حاليًا', 'error')
      return false
    }
    const maxQty = Math.min(b.available_qty, p.max_per_order ?? Number.MAX_SAFE_INTEGER)
    const err = cart.add({
      batchId: b.id,
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: p.images[0]?.url ?? null,
      unitPrice: p.sale_price ?? p.price,
      qty,
      maxQty,
      queenType: p.queen_type,
      isPreorder: b.is_preorder,
      batchLabel: b.label,
    })
    if (err) {
      toast(err, 'error')
      return false
    }
    toast('تمت الإضافة إلى السلة')
    return true
  }
}

export default function ProductCard({ product: p }: { product: StoreProduct }) {
  const nav = useNavigate()
  const { settings } = useSettings()
  const add = useAddToCart()
  const canOrder = p.orderable_batch !== null
  const img = p.images[0]
  const wa = waLink(
    settings.general.whatsapp,
    `السلام عليكم، أريد الاستفسار عن: ${p.name}`,
  )

  return (
    <article className="card flex flex-col overflow-hidden">
      <Link to={`/products/${p.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-ink/5">
        {img ? (
          <img
            src={img.url}
            alt={img.alt_text || p.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition hover:scale-105"
          />
        ) : (
          <ImagePlaceholder className="h-full w-full" />
        )}
        <span className="badge absolute right-3 top-3 bg-ink text-gold-300">
          {QUEEN_TYPE_LABEL[p.queen_type]}
        </span>
        {p.sale_price != null && p.sale_price < p.price && (
          <span className="badge absolute left-3 top-3 bg-red-600 text-white">تخفيض</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold leading-snug">
            <Link to={`/products/${p.slug}`} className="hover:text-gold-700">
              {p.name}
            </Link>
          </h3>
          <span className={`badge shrink-0 ${stockBadgeClass(p.stock_status)}`}>
            {STOCK_LABEL[p.stock_status]}
          </span>
        </div>
        {p.short_description && (
          <p className="line-clamp-2 text-sm leading-6 text-ink-600">{p.short_description}</p>
        )}
        {p.breed && <p className="text-xs font-semibold text-ink-600">السلالة: {p.breed}</p>}
        <PriceTag price={p.price} sale={p.sale_price} className="mt-auto" />
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className="btn-primary"
            disabled={!canOrder}
            onClick={() => {
              if (add(p, 1)) nav('/checkout')
            }}
          >
            {canOrder ? (p.stock_status === 'preorder' ? 'احجز الآن' : 'اطلب الآن') : STOCK_LABEL[p.stock_status]}
          </button>
          {settings.general.whatsapp ? (
            <a className="btn-outline" href={wa} target="_blank" rel="noopener noreferrer">
              تواصل عبر واتساب
            </a>
          ) : (
            <Link className="btn-outline" to={`/products/${p.slug}`}>
              التفاصيل
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
