import { Link, useNavigate } from 'react-router-dom'
import { ConfirmButton, Empty, ErrorBox, Spinner, Switch, useToast } from '../components/ui'
import { ImagePlaceholder } from '../components/ProductCard'
import { formatDZD, QUEEN_TYPE_LABEL, slugify } from '../lib/format'
import { deleteImage } from '../lib/storage'
import { errMsg, supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { AdminBatch, Product, ProductImage } from '../lib/types'

interface Row extends Product {
  product_images: ProductImage[]
  product_batches: AdminBatch[]
}

async function load(): Promise<Row[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*), product_batches(*)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Row[]
}

export default function ProductsAdmin() {
  const toast = useToast()
  const nav = useNavigate()
  const { data, loading, error, reload } = useAsync(load, [])

  async function toggleActive(p: Row, v: boolean) {
    const { error: e } = await supabase.from('products').update({ is_active: v }).eq('id', p.id)
    if (e) return toast(errMsg(e), 'error')
    toast(v ? 'تم إظهار المنتج في المتجر' : 'تم إخفاء المنتج')
    void reload()
  }

  async function remove(p: Row) {
    const { error: e } = await supabase.from('products').delete().eq('id', p.id)
    if (e) return toast(errMsg(e), 'error')
    await Promise.all(p.product_images.map((i) => deleteImage(i.storage_path)))
    toast('تم حذف المنتج')
    void reload()
  }

  async function duplicate(p: Row) {
    try {
      const { id, created_at, product_images, product_batches, ...rest } = p
      void id
      void created_at
      const { data: np, error: e1 } = await supabase
        .from('products')
        .insert({
          ...rest,
          name: `${p.name} (نسخة)`,
          slug: `${slugify(p.name)}-${Date.now().toString(36)}`,
          is_active: false,
        })
        .select('id')
        .single()
      if (e1) throw e1
      const newId = (np as { id: string }).id
      if (product_batches.length > 0) {
        const { error: e2 } = await supabase.from('product_batches').insert(
          product_batches.map((b) => ({
            product_id: newId,
            label: b.label,
            batch_code: b.batch_code,
            hatch_date: b.hatch_date,
            mating_date: b.mating_date,
            production_date: b.production_date,
            total_qty: b.total_qty,
            is_preorder: b.is_preorder,
            preorder_start: b.preorder_start,
            preorder_end: b.preorder_end,
            expected_delivery_date: b.expected_delivery_date,
            deposit_amount: b.deposit_amount,
            cancellation_terms: b.cancellation_terms,
            is_open: b.is_open,
            is_active: b.is_active,
          })),
        )
        if (e2) throw e2
      }
      if (product_images.length > 0) {
        // نسخ الصور تشير إلى نفس الملفات؛ لا نخزن المسار كي لا يُحذف الملف المشترك عند حذف أحدهما
        const { error: e3 } = await supabase.from('product_images').insert(
          product_images.map((i) => ({
            product_id: newId,
            url: i.url,
            storage_path: null,
            alt_text: i.alt_text,
            sort_order: i.sort_order,
            is_primary: i.is_primary,
          })),
        )
        if (e3) throw e3
      }
      toast('تم نسخ المنتج (مخفي حتى تراجعه)')
      nav(`/admin/products/${newId}`)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const rows = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">المنتجات والمخزون</h1>
        <Link to="/admin/products/new" className="btn-primary">＋ إضافة منتج</Link>
      </div>

      {rows.length === 0 && <Empty>لا توجد منتجات بعد. ابدأ بإضافة أول منتج.</Empty>}

      <div className="space-y-3">
        {rows.map((p) => {
          const total = p.product_batches.reduce((s, b) => s + b.total_qty, 0)
          const available = p.product_batches.reduce((s, b) => s + Math.max(b.available_qty, 0), 0)
          const reserved = p.product_batches.reduce((s, b) => s + b.reserved_qty + b.manual_reserved_qty, 0)
          const img = [...p.product_images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]
          return (
            <div key={p.id} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink/5">
                {img ? <img src={img.url} alt="" className="h-full w-full object-cover" /> : <ImagePlaceholder className="h-full w-full" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold">{p.name}</p>
                <p className="text-sm text-ink-600">
                  {QUEEN_TYPE_LABEL[p.queen_type]} — {formatDZD(p.sale_price ?? p.price)}
                  {p.sale_price != null && <span className="mr-1 line-through">{formatDZD(p.price)}</span>}
                </p>
                <p className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="badge bg-emerald-100 text-emerald-800">متبقي {available}</span>
                  <span className="badge bg-amber-100 text-amber-800">محجوز {reserved}</span>
                  <span className="badge bg-ink/10">الإجمالي {total}</span>
                  <span className="badge bg-ink/10">{p.product_batches.length} دفعة</span>
                  {!p.is_active && <span className="badge bg-red-100 text-red-800">مخفي</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Switch checked={p.is_active} onChange={(v) => void toggleActive(p, v)} label={p.is_active ? 'ظاهر' : 'مخفي'} />
                <Link to={`/admin/products/${p.id}`} className="btn-dark btn-sm">تعديل</Link>
                <button className="btn-outline btn-sm" onClick={() => void duplicate(p)}>نسخ</button>
                <ConfirmButton message={`حذف المنتج «${p.name}» نهائيًا؟`} onConfirm={() => void remove(p)}>حذف</ConfirmButton>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
