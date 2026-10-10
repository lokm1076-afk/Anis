import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorBox, Field, Select, Spinner, Switch, TextArea, TextInput, useToast } from '../components/ui'
import { slugify } from '../lib/format'
import { deleteImage, uploadImage } from '../lib/storage'
import { errMsg, supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { AdminBatch, Product, ProductImage } from '../lib/types'
import BatchesPanel from './BatchesPanel'

interface ImgDraft {
  id?: string
  url: string
  storage_path: string | null
  alt_text: string
  is_primary: boolean
}

interface Form {
  name: string
  slug: string
  queen_type: 'virgin' | 'mated'
  is_offer: boolean
  breed: string
  short_description: string
  description: string
  price: string
  sale_price: string
  max_per_order: string
  delivery_notes: string
  is_active: boolean
  is_featured: boolean
  is_best_seller: boolean
  sort_order: string
  seo_title: string
  seo_description: string
  // للمنتج الجديد فقط: الدفعة الأولى
  first_qty: string
  first_hatch: string
  first_mating: string
}

const blank: Form = {
  name: '',
  slug: '',
  queen_type: 'mated',
  is_offer: false,
  breed: '',
  short_description: '',
  description: '',
  price: '',
  sale_price: '',
  max_per_order: '10',
  delivery_notes: '',
  is_active: true,
  is_featured: false,
  is_best_seller: false,
  sort_order: '0',
  seo_title: '',
  seo_description: '',
  first_qty: '0',
  first_hatch: '',
  first_mating: '',
}

interface Loaded {
  product: Product | null
  images: ProductImage[]
  batches: AdminBatch[]
}

async function loadAll(id: string | undefined): Promise<Loaded> {
  if (!id) return { product: null, images: [], batches: [] }
  const [p, i, b] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('product_images').select('*').eq('product_id', id),
    supabase.from('product_batches').select('*').eq('product_id', id).order('created_at'),
  ])
  if (p.error) throw p.error
  if (i.error) throw i.error
  if (b.error) throw b.error
  return { product: (p.data as Product | null) ?? null, images: (i.data ?? []) as ProductImage[], batches: (b.data ?? []) as AdminBatch[] }
}

async function loadBatches(id: string | undefined): Promise<AdminBatch[]> {
  if (!id) return []
  const { data, error } = await supabase.from('product_batches').select('*').eq('product_id', id).order('created_at')
  if (error) throw error
  return (data ?? []) as AdminBatch[]
}

export default function ProductEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const isNew = !id || id === 'new'
  const realId = isNew ? undefined : id
  const { data, loading, error, reload } = useAsync(() => loadAll(realId), [realId])
  // الدفعات تُحمَّل بشكل مستقل حتى لا تضيع تعديلات النموذج غير المحفوظة عند تغيير دفعة
  const batchesQ = useAsync(() => loadBatches(realId), [realId])

  const [form, setForm] = useState<Form>(blank)
  const [images, setImages] = useState<ImgDraft[]>([])
  const [removed, setRemoved] = useState<ImgDraft[]>([])
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!data) return
    const p = data.product
    if (p) {
      setForm({
        ...blank,
        name: p.name,
        slug: p.slug,
        queen_type: p.queen_type,
        is_offer: p.is_offer,
        breed: p.breed ?? '',
        short_description: p.short_description ?? '',
        description: p.description ?? '',
        price: String(p.price),
        sale_price: p.sale_price != null ? String(p.sale_price) : '',
        max_per_order: p.max_per_order != null ? String(p.max_per_order) : '',
        delivery_notes: p.delivery_notes ?? '',
        is_active: p.is_active,
        is_featured: p.is_featured,
        is_best_seller: p.is_best_seller,
        sort_order: String(p.sort_order),
        seo_title: p.seo_title ?? '',
        seo_description: p.seo_description ?? '',
      })
      setSlugTouched(true)
    }
    setImages(
      [...data.images]
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
        .map((i) => ({ id: i.id, url: i.url, storage_path: i.storage_path, alt_text: i.alt_text ?? '', is_primary: i.is_primary })),
    )
    setRemoved([])
  }, [data])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const added: ImgDraft[] = []
      for (const f of Array.from(files)) {
        const up = await uploadImage(f, 'products')
        added.push({ url: up.url, storage_path: up.path, alt_text: '', is_primary: false })
      }
      setImages((prev) => {
        const next = [...prev, ...added]
        if (!next.some((i) => i.is_primary) && next.length > 0) next[0] = { ...next[0], is_primary: true }
        return next
      })
      toast('تم رفع الصور. اضغط «حفظ» لتثبيتها في المنتج')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function makePrimary(idx: number) {
    setImages((prev) => prev.map((i, k) => ({ ...i, is_primary: k === idx })))
  }

  function removeImage(idx: number) {
    setImages((prev) => {
      const target = prev[idx]
      setRemoved((r) => [...r, target])
      const next = prev.filter((_, k) => k !== idx)
      if (target.is_primary && next.length > 0) next[0] = { ...next[0], is_primary: true }
      return next
    })
  }

  function move(idx: number, dir: -1 | 1) {
    setImages((prev) => {
      const j = idx + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  function validate(): string | null {
    if (form.name.trim().length < 2) return 'اسم المنتج مطلوب'
    if (!form.slug.trim()) return 'الرابط مطلوب'
    const price = Number(form.price)
    if (form.price === '' || Number.isNaN(price) || price < 0) return 'السعر غير صالح'
    if (form.sale_price !== '') {
      const sp = Number(form.sale_price)
      if (Number.isNaN(sp) || sp < 0) return 'سعر التخفيض غير صالح'
      if (sp >= price) return 'سعر التخفيض يجب أن يكون أقل من السعر الأصلي'
    }
    if (form.max_per_order !== '' && (!Number.isInteger(Number(form.max_per_order)) || Number(form.max_per_order) < 1)) {
      return 'الحد الأقصى للكمية غير صالح'
    }
    if (isNew && (!Number.isInteger(Number(form.first_qty)) || Number(form.first_qty) < 0)) return 'الكمية المتوفرة غير صالحة'
    return null
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) return toast(v, 'error')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        queen_type: form.queen_type,
        is_offer: form.is_offer,
        breed: form.breed.trim() || null,
        short_description: form.short_description.trim() || null,
        description: form.description.trim() || null,
        price: Number(form.price),
        sale_price: form.sale_price === '' ? null : Number(form.sale_price),
        max_per_order: form.max_per_order === '' ? null : Number(form.max_per_order),
        delivery_notes: form.delivery_notes.trim() || null,
        is_active: form.is_active,
        is_featured: form.is_featured,
        is_best_seller: form.is_best_seller,
        sort_order: Number(form.sort_order) || 0,
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
      }

      let productId = realId
      if (isNew) {
        const { data: created, error: e1 } = await supabase.from('products').insert(payload).select('id').single()
        if (e1) throw e1
        productId = (created as { id: string }).id
        const { error: e2 } = await supabase.from('product_batches').insert({
          product_id: productId,
          label: 'الدفعة الأولى',
          total_qty: Number(form.first_qty) || 0,
          hatch_date: form.first_hatch || null,
          mating_date: form.first_mating || null,
        })
        if (e2) throw e2
      } else {
        const { error: e1 } = await supabase.from('products').update(payload).eq('id', productId!)
        if (e1) throw e1
      }

      // مزامنة الصور
      const gone = removed.filter((r) => r.id)
      if (gone.length > 0) {
        const { error: eDel } = await supabase.from('product_images').delete().in('id', gone.map((g) => g.id!))
        if (eDel) throw eDel
        await Promise.all(gone.map((g) => deleteImage(g.storage_path)))
      }
      for (let k = 0; k < images.length; k++) {
        const im = images[k]
        const row = { alt_text: im.alt_text.trim() || null, sort_order: k, is_primary: im.is_primary }
        if (im.id) {
          const { error: eU } = await supabase.from('product_images').update(row).eq('id', im.id)
          if (eU) throw eU
        } else {
          const { error: eI } = await supabase
            .from('product_images')
            .insert({ ...row, product_id: productId, url: im.url, storage_path: im.storage_path })
          if (eI) throw eI
        }
      }

      toast('تم حفظ المنتج')
      if (isNew) nav(`/admin/products/${productId}`, { replace: true })
      else void reload()
    } catch (err) {
      const m = errMsg(err)
      toast(m.includes('duplicate') || m.includes('تكرار') ? 'الرابط مستخدم لمنتج آخر، غيّره' : m, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!isNew && !data?.product) return <ErrorBox message="المنتج غير موجود" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">{isNew ? 'إضافة منتج' : 'تعديل المنتج'}</h1>
        <Link to="/admin/products" className="btn-outline btn-sm">← رجوع</Link>
      </div>

      <form onSubmit={save} className="space-y-5">
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-extrabold">المعلومات الأساسية</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم المنتج *">
              <TextInput
                value={form.name}
                onChange={(e) => {
                  set('name', e.target.value)
                  if (!slugTouched) set('slug', slugify(e.target.value))
                }}
                required
              />
            </Field>
            <Field label="رابط المنتج (يُنشأ تلقائيًا)">
              <TextInput dir="ltr" value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }} required />
            </Field>
            <Field label="نوع الملكة *">
              <Select value={form.queen_type} onChange={(e) => set('queen_type', e.target.value as Form['queen_type'])}>
                <option value="virgin">ملكة عذراء</option>
                <option value="mated">ملكة ملقحة</option>
              </Select>
            </Field>
            <Field label="السلالة / الأصل الوراثي" hint="اكتب فقط ما تؤكده. لن يُعرض شيء عن السلالة إن تُرك فارغًا.">
              <TextInput value={form.breed} onChange={(e) => set('breed', e.target.value)} />
            </Field>
            <Field label="السعر (دج) *">
              <TextInput type="number" inputMode="decimal" min={0} value={form.price} onChange={(e) => set('price', e.target.value)} required />
            </Field>
            <Field label="سعر التخفيض (دج) — اختياري">
              <TextInput type="number" inputMode="decimal" min={0} value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} />
            </Field>
            <Field label="الحد الأقصى للكمية في الطلب الواحد" hint="اتركه فارغًا لعدم التحديد">
              <TextInput type="number" inputMode="numeric" min={1} value={form.max_per_order} onChange={(e) => set('max_per_order', e.target.value)} />
            </Field>
            <Field label="ترتيب العرض (الأصغر أولًا)">
              <TextInput type="number" inputMode="numeric" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
            </Field>
          </div>
          <Field label="وصف مختصر">
            <TextInput value={form.short_description} onChange={(e) => set('short_description', e.target.value)} maxLength={200} />
          </Field>
          <Field label="الوصف التفصيلي">
            <TextArea rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="ملاحظات النقل والتسليم الخاصة بهذا المنتج">
            <TextArea rows={3} value={form.delivery_notes} onChange={(e) => set('delivery_notes', e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-x-6">
            <Switch checked={form.is_active} onChange={(v) => set('is_active', v)} label="ظاهر في المتجر" />
            <Switch checked={form.is_featured} onChange={(v) => set('is_featured', v)} label="ملكة مميزة" />
            <Switch checked={form.is_best_seller} onChange={(v) => set('is_best_seller', v)} label="الأكثر طلبًا" />
            <Switch checked={form.is_offer} onChange={(v) => set('is_offer', v)} label="ضمن العروض الخاصة" />
          </div>
        </section>

        {isNew && (
          <section className="card space-y-4 p-5">
            <h2 className="text-lg font-extrabold">الدفعة الأولى (المخزون)</h2>
            <p className="text-sm text-ink-600">يمكنك لاحقًا إضافة دفعات أخرى وتفعيل الحجز المسبق بعد حفظ المنتج.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="عدد الملكات المتوفرة"><TextInput type="number" inputMode="numeric" min={0} value={form.first_qty} onChange={(e) => set('first_qty', e.target.value)} /></Field>
              <Field label="تاريخ الفقس"><TextInput type="date" value={form.first_hatch} onChange={(e) => set('first_hatch', e.target.value)} /></Field>
              <Field label="تاريخ التلقيح"><TextInput type="date" value={form.first_mating} onChange={(e) => set('first_mating', e.target.value)} /></Field>
            </div>
          </section>
        )}

        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">الصور</h2>
            <button type="button" className="btn-dark btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? 'جارٍ الرفع...' : '＋ رفع صور'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />
          </div>
          {images.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/20 p-4 text-ink-600">لا توجد صور. ارفع صورًا من الهاتف أو الحاسوب.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((im, idx) => (
                <li key={im.url} className="rounded-xl border border-ink/10 p-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-ink/5">
                    <img src={im.url} alt="" className="h-full w-full object-cover" />
                    {im.is_primary && <span className="badge absolute right-2 top-2 bg-brand text-ink">الرئيسية</span>}
                  </div>
                  <TextInput className="mt-2" placeholder="نص بديل للصورة (SEO)" value={im.alt_text} onChange={(e) => setImages((p) => p.map((x, k) => (k === idx ? { ...x, alt_text: e.target.value } : x)))} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!im.is_primary && <button type="button" className="btn-outline btn-sm" onClick={() => makePrimary(idx)}>جعلها رئيسية</button>}
                    <button type="button" className="btn-outline btn-sm" onClick={() => move(idx, -1)} aria-label="تقديم">→</button>
                    <button type="button" className="btn-outline btn-sm" onClick={() => move(idx, 1)} aria-label="تأخير">←</button>
                    <button type="button" className="btn-danger btn-sm" onClick={() => removeImage(idx)}>حذف</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-extrabold">محركات البحث (SEO)</h2>
          <Field label="عنوان الصفحة"><TextInput value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} maxLength={70} /></Field>
          <Field label="وصف الصفحة"><TextArea rows={2} value={form.seo_description} onChange={(e) => set('seo_description', e.target.value)} maxLength={170} /></Field>
        </section>

        <div className="sticky bottom-3 z-10">
          <button className="btn-primary w-full shadow-lg" disabled={saving || uploading}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ المنتج'}
          </button>
        </div>
      </form>

      {!isNew && realId && (
        <BatchesPanel productId={realId} batches={batchesQ.data ?? []} onChanged={() => void batchesQ.reload()} />
      )}
    </div>
  )
}
