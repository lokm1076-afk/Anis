import { useState } from 'react'
import type { FormEvent } from 'react'
import { ConfirmButton, Empty, ErrorBox, Field, Modal, Spinner, Switch, TextArea, TextInput, useToast } from '../components/ui'
import { DELIVERY_METHOD_LABEL, formatDZD } from '../lib/format'
import { errMsg, supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { Commune, DeliveryMethod, ShippingRate, Wilaya } from '../lib/types'

const METHODS: DeliveryMethod[] = ['home', 'office', 'pickup']

interface Data {
  wilayas: Wilaya[]
  rates: ShippingRate[]
}

async function load(): Promise<Data> {
  const [w, r] = await Promise.all([
    supabase.from('wilayas').select('*').order('id'),
    supabase.from('shipping_rates').select('*'),
  ])
  if (w.error) throw w.error
  if (r.error) throw r.error
  return { wilayas: (w.data ?? []) as Wilaya[], rates: (r.data ?? []) as ShippingRate[] }
}

function WilayaEditor({
  wilaya,
  rates,
  onClose,
  onSaved,
}: {
  wilaya: Wilaya
  rates: ShippingRate[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [f, setF] = useState({
    name_ar: wilaya.name_ar,
    is_active: wilaya.is_active,
    orders_paused: wilaya.orders_paused,
    delivery_time: wilaya.delivery_time ?? '',
    min_order: String(wilaya.min_order ?? 0),
    carriers: wilaya.carriers ?? '',
    notes: wilaya.notes ?? '',
  })
  const [rt, setRt] = useState<Record<DeliveryMethod, { price: string; enabled: boolean }>>(() => {
    const out = {} as Record<DeliveryMethod, { price: string; enabled: boolean }>
    for (const m of METHODS) {
      const r = rates.find((x) => x.method === m)
      out[m] = { price: String(r?.price ?? 0), enabled: r?.is_enabled ?? false }
    }
    return out
  })
  const [busy, setBusy] = useState(false)
  const communes = useAsync(async () => {
    const { data, error } = await supabase.from('communes').select('*').eq('wilaya_id', wilaya.id).order('name_ar')
    if (error) throw error
    return (data ?? []) as Commune[]
  }, [wilaya.id])
  const [bulk, setBulk] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    const minOrder = Number(f.min_order || 0)
    if (!f.name_ar.trim()) return toast('اسم الولاية مطلوب', 'error')
    if (!(minOrder >= 0)) return toast('الحد الأدنى للطلب غير صالح', 'error')
    for (const m of METHODS) {
      const p = Number(rt[m].price)
      if (!(p >= 0) || Number.isNaN(p)) return toast(`سعر ${DELIVERY_METHOD_LABEL[m]} غير صالح`, 'error')
    }
    if (f.is_active && !METHODS.some((m) => rt[m].enabled)) {
      return toast('فعّل طريقة توصيل واحدة على الأقل قبل تفعيل الولاية', 'error')
    }
    setBusy(true)
    try {
      const { error } = await supabase
        .from('wilayas')
        .update({
          name_ar: f.name_ar.trim(),
          is_active: f.is_active,
          orders_paused: f.orders_paused,
          delivery_time: f.delivery_time.trim() || null,
          min_order: minOrder,
          carriers: f.carriers.trim() || null,
          notes: f.notes.trim() || null,
        })
        .eq('id', wilaya.id)
      if (error) throw error
      const { error: e2 } = await supabase.from('shipping_rates').upsert(
        METHODS.map((m) => ({
          wilaya_id: wilaya.id,
          method: m,
          price: Number(rt[m].price),
          is_enabled: rt[m].enabled,
        })),
        { onConflict: 'wilaya_id,method' },
      )
      if (e2) throw e2
      toast('تم حفظ إعدادات الولاية')
      onSaved()
      onClose()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function addCommunes() {
    const names = Array.from(new Set(bulk.split(/[\n,،]/).map((s) => s.trim()).filter(Boolean)))
    if (names.length === 0) return
    const { error } = await supabase
      .from('communes')
      .upsert(names.map((n) => ({ wilaya_id: wilaya.id, name_ar: n, is_active: true })), {
        onConflict: 'wilaya_id,name_ar',
      })
    if (error) return toast(errMsg(error), 'error')
    setBulk('')
    toast(`تمت إضافة ${names.length} بلدية`)
    void communes.reload()
  }

  async function toggleCommune(c: Commune, v: boolean) {
    const { error } = await supabase.from('communes').update({ is_active: v }).eq('id', c.id)
    if (error) return toast(errMsg(error), 'error')
    void communes.reload()
  }

  async function removeCommune(c: Commune) {
    const { error } = await supabase.from('communes').delete().eq('id', c.id)
    if (error) return toast(errMsg(error), 'error')
    void communes.reload()
  }

  return (
    <Modal open onClose={onClose} title={`${wilaya.id} - ${wilaya.name_ar}`} wide>
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم الولاية"><TextInput value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></Field>
          <Field label="مدة التوصيل المتوقعة" hint="مثال: 2 إلى 4 أيام">
            <TextInput value={f.delivery_time} onChange={(e) => setF({ ...f, delivery_time: e.target.value })} />
          </Field>
          <Field label="الحد الأدنى للطلب (دج)" hint="0 = بدون حد أدنى">
            <TextInput type="number" min={0} inputMode="numeric" value={f.min_order} onChange={(e) => setF({ ...f, min_order: e.target.value })} />
          </Field>
          <Field label="شركات التوصيل المدعومة"><TextInput value={f.carriers} onChange={(e) => setF({ ...f, carriers: e.target.value })} /></Field>
        </div>
        <Field label="ملاحظات التوصيل (تظهر للعميل)">
          <TextArea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>

        <div className="flex flex-wrap gap-x-8">
          <Switch checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} label="التوصيل إلى هذه الولاية مفعّل" />
          <Switch checked={f.orders_paused} onChange={(v) => setF({ ...f, orders_paused: v })} label="إيقاف الطلبات مؤقتًا" />
        </div>

        <section className="space-y-3 rounded-xl border border-ink/10 p-4">
          <h3 className="font-extrabold">طرق التوصيل والأسعار</h3>
          {METHODS.map((m) => (
            <div key={m} className="grid items-end gap-3 sm:grid-cols-[1fr_160px]">
              <Switch
                checked={rt[m].enabled}
                onChange={(v) => setRt({ ...rt, [m]: { ...rt[m], enabled: v } })}
                label={DELIVERY_METHOD_LABEL[m]}
              />
              <Field label="السعر (دج)">
                <TextInput
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={rt[m].price}
                  onChange={(e) => setRt({ ...rt, [m]: { ...rt[m], price: e.target.value } })}
                />
              </Field>
            </div>
          ))}
        </section>

        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ الولاية'}</button>
      </form>

      <section className="mt-6 space-y-3 rounded-xl border border-ink/10 p-4">
        <h3 className="font-extrabold">البلديات المتاحة (اختياري)</h3>
        <p className="text-xs text-ink-600">
          إذا لم تُضف أي بلدية يكتب العميل اسم بلديته يدويًا. وإذا أضفت بلديات تظهر له كقائمة اختيار.
        </p>
        {communes.loading ? (
          <Spinner />
        ) : (
          <ul className="space-y-1">
            {communes.data?.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink/[0.04] px-3 py-1">
                <span className="font-bold">{c.name_ar}</span>
                <span className="flex items-center gap-2">
                  <Switch checked={c.is_active} onChange={(v) => void toggleCommune(c, v)} />
                  <ConfirmButton message={`حذف بلدية ${c.name_ar}؟`} onConfirm={() => void removeCommune(c)}>حذف</ConfirmButton>
                </span>
              </li>
            ))}
          </ul>
        )}
        <TextArea placeholder="أضف بلديات: اسم في كل سطر أو مفصولة بفاصلة" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <button type="button" className="btn-dark btn-sm" onClick={() => void addCommunes()}>إضافة البلديات</button>
      </section>
    </Modal>
  )
}

export default function ShippingAdmin() {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(load, [])
  const [editId, setEditId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [newW, setNewW] = useState({ id: '', name_ar: '' })
  const [filter, setFilter] = useState('')

  async function quickToggle(w: Wilaya, v: boolean) {
    if (v && !data?.rates.some((r) => r.wilaya_id === w.id && r.is_enabled)) {
      toast('حدّد سعر طريقة توصيل واحدة على الأقل ثم فعّلها داخل إعدادات الولاية', 'error')
      setEditId(w.id)
      return
    }
    const { error: e } = await supabase.from('wilayas').update({ is_active: v }).eq('id', w.id)
    if (e) return toast(errMsg(e), 'error')
    toast(v ? `تم تفعيل التوصيل إلى ${w.name_ar}` : `تم تعطيل التوصيل إلى ${w.name_ar}`)
    void reload()
  }

  async function addWilaya(e: FormEvent) {
    e.preventDefault()
    const id = Number(newW.id)
    if (!Number.isInteger(id) || id <= 0 || !newW.name_ar.trim()) return toast('أدخل رقم الولاية واسمها', 'error')
    const { error: e1 } = await supabase
      .from('wilayas')
      .insert({ id, name_ar: newW.name_ar.trim(), sort_order: id, is_active: false })
    if (e1) return toast(errMsg(e1), 'error')
    const { error: e2 } = await supabase
      .from('shipping_rates')
      .insert(METHODS.map((m) => ({ wilaya_id: id, method: m, price: 0, is_enabled: false })))
    if (e2) return toast(errMsg(e2), 'error')
    toast('تمت إضافة الولاية (معطّلة حتى تضبط أسعارها)')
    setAdding(false)
    setNewW({ id: '', name_ar: '' })
    void reload()
  }

  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorBox message={error ?? 'تعذر التحميل'} onRetry={reload} />

  const term = filter.trim()
  const list = data.wilayas.filter((w) => !term || w.name_ar.includes(term) || String(w.id) === term)
  const active = data.wilayas.filter((w) => w.is_active).length
  const edit = data.wilayas.find((w) => w.id === editId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">الولايات والتوصيل</h1>
          <p className="text-sm text-ink-600">مفعّلة: {active} من {data.wilayas.length}. الولايات المعطّلة لا يستطيع العميل الطلب إليها.</p>
        </div>
        <button className="btn-dark btn-sm" onClick={() => setAdding((v) => !v)}>＋ إضافة ولاية</button>
      </div>

      {adding && (
        <form onSubmit={addWilaya} className="card grid gap-3 p-4 sm:grid-cols-[120px_1fr_auto] sm:items-end">
          <Field label="رقم الولاية"><TextInput type="number" min={1} value={newW.id} onChange={(e) => setNewW({ ...newW, id: e.target.value })} /></Field>
          <Field label="اسم الولاية"><TextInput value={newW.name_ar} onChange={(e) => setNewW({ ...newW, name_ar: e.target.value })} /></Field>
          <button className="btn-primary">إضافة</button>
        </form>
      )}

      <TextInput placeholder="بحث عن ولاية بالاسم أو الرقم" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {list.length === 0 && <Empty>لا توجد نتائج.</Empty>}

      <div className="grid gap-2 lg:grid-cols-2">
        {list.map((w) => {
          const wr = data.rates.filter((r) => r.wilaya_id === w.id && r.is_enabled)
          return (
            <div key={w.id} className="card flex items-center justify-between gap-3 p-3">
              <button className="min-w-0 flex-1 text-right" onClick={() => setEditId(w.id)}>
                <p className="font-extrabold">{w.id} - {w.name_ar}{w.orders_paused && <span className="badge mr-2 bg-orange-100 text-orange-800">متوقفة مؤقتًا</span>}</p>
                <p className="truncate text-xs text-ink-600">
                  {wr.length === 0
                    ? 'لم تُضبط أسعار'
                    : wr.map((r) => `${DELIVERY_METHOD_LABEL[r.method].split(' ')[1] ?? ''} ${formatDZD(r.price)}`).join(' • ')}
                  {w.delivery_time ? ` — ${w.delivery_time}` : ''}
                </p>
              </button>
              <Switch checked={w.is_active} onChange={(v) => void quickToggle(w, v)} />
              <button className="btn-outline btn-sm" onClick={() => setEditId(w.id)}>تعديل</button>
            </div>
          )
        })}
      </div>

      {edit && (
        <WilayaEditor
          key={edit.id}
          wilaya={edit}
          rates={data.rates.filter((r) => r.wilaya_id === edit.id)}
          onClose={() => setEditId(null)}
          onSaved={() => void reload()}
        />
      )}
    </div>
  )
}
