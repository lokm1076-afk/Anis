import { Link } from 'react-router-dom'
import { ImagePlaceholder } from '../components/ProductCard'
import { Empty } from '../components/ui'
import { useCart } from '../lib/cart'
import { formatDZD, QUEEN_TYPE_LABEL } from '../lib/format'
import { useSeo } from '../lib/seo'

export default function Cart() {
  const { items, subtotal, setQty, remove, clear } = useCart()
  useSeo({ title: 'سلة المشتريات', noindex: true })

  if (items.length === 0) {
    return (
      <div className="container-x py-12">
        <Empty>
          <p className="text-lg font-bold">سلتك فارغة</p>
          <Link to="/products" className="btn-primary mt-4">تصفح المنتجات</Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="container-x py-8">
      <h1 className="mb-5 text-3xl font-black">سلة المشتريات</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.batchId} className="card flex gap-3 p-3">
              <Link to={`/products/${i.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink/5">
                {i.image ? (
                  <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                ) : (
                  <ImagePlaceholder className="h-full w-full" />
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to={`/products/${i.slug}`} className="font-extrabold hover:text-gold-700">{i.name}</Link>
                    <p className="text-xs text-ink-600">
                      {QUEEN_TYPE_LABEL[i.queenType]} — {i.batchLabel}
                      {i.isPreorder ? ' — حجز مسبق' : ''}
                    </p>
                  </div>
                  <button className="text-sm font-bold text-red-600" onClick={() => remove(i.batchId)} aria-label="حذف">
                    حذف
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-xl border border-ink/20">
                    <button className="h-10 w-10 text-lg font-black" onClick={() => setQty(i.batchId, i.qty - 1)} aria-label="إنقاص">−</button>
                    <span className="w-9 text-center font-extrabold">{i.qty}</span>
                    <button className="h-10 w-10 text-lg font-black" onClick={() => setQty(i.batchId, i.qty + 1)} aria-label="زيادة" disabled={i.qty >= i.maxQty}>＋</button>
                  </div>
                  <span className="font-extrabold text-gold-700">{formatDZD(i.unitPrice * i.qty)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold">ملخص الطلب</h2>
          <div className="flex justify-between text-sm">
            <span>مجموع المنتجات</span>
            <span className="font-bold">{formatDZD(subtotal)}</span>
          </div>
          <p className="text-xs leading-6 text-ink-600">
            تُحسب تكلفة التوصيل والخصم والمبلغ الإجمالي النهائي من الخادم في صفحة إتمام الطلب بعد اختيار الولاية.
          </p>
          <Link to="/checkout" className="btn-primary w-full">إتمام الطلب</Link>
          <Link to="/products" className="btn-outline w-full">متابعة التسوق</Link>
          <button className="w-full text-sm font-bold text-red-600" onClick={() => window.confirm('إفراغ السلة؟') && clear()}>
            إفراغ السلة
          </button>
        </aside>
      </div>
    </div>
  )
}
