import { useState } from 'react'
import type { FormEvent } from 'react'
import { ConfirmButton, Empty, ErrorBox, Field, Modal, Select, Spinner, Switch, TextInput, useToast } from '../components/ui'
import { formatDateTime, formatDZD, isoToLocalInput, localInputToIso } from '../lib/format'
import { errMsg, supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { Coupon } from '../lib/types'

async function load(): Promise<Coupon[]> {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Coupon[]
}

interface Form {
  id?: string
  code: string
  discount_type: 'fixed' | 'percent'
  value: string
  starts_at: string
  ends_at: string
  min_order: string
  max_uses: string
  is_active: boolean
}

const EMPTY: Form = {
  code: '',
  discount_type: 'fixed',
  value: '',
  starts_at: '',
  ends_at: '',
  min_order: '0',
  max_uses: '',
  is_active: true,
}

export default function CouponsAdmin() {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(load, [])
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)

  function edit(c: Coupon) {
    setForm({
      id: c.id,
      code: c.code,
      discount_type: c.discount_type,
      value: String(c.value),
      starts_at: isoToLocalInput(c.starts_at),
      ends_at: isoToLocalInput(c.ends_at),
      min_order: String(c.min_order),
      max_uses: c.max_uses == null ? '' : String(c.max_uses),
      is_active: c.is_active,
    })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const code = form.code.trim().toUpperCase().replace(/\s+/g, '')
    const value = Number(form.value)
    if (code.length < 3) return toast('رمز الخصم قصير (3 أحرف على الأقل)', 'error')
    if (!(value > 0)) return toast('قيمة الخصم يجب أن تكون أكبر من 0', 'error')
    if (form.discount_type === 'percent' && value > 100) return toast('النسبة لا تتجاوز 100%', 'error')
    const starts = localInputToIso(form.starts_at)
    const ends = localInputToIso(form.ends_at)
    if (starts && ends && new Date(ends) <= new Date(starts)) return toast('تاريخ النهاية يجب أن يكون بعد البداية', 'error')
    const maxUses = form.max_uses.trim() === '' ? null : Number(form.max_uses)
    if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses > 0)) return toast('عدد مرات الاستخدام غير صالح', 'error')

    const payload = {
      code,
      discount_type: form.discount_type,
      value,
      starts_at: starts,
      ends_at: ends,
      min_order: Number(form.min_order || 0),
      max_uses: maxUses,
      is_active: form.is_active,
    }
    setBusy(true)
    const { error: err } = form.id
      ? await supabase.from('coupons').update(payload).eq('id', form.id)
      : await supabase.from('coupons').insert(payload)
    setBusy(false)
    if (err) return toast(errMsg(err), 'error')
    toast('تم حفظ القسيمة')
    setForm(null)
    void reload()
  }

  async function toggle(c: Coupon, v: boolean) {
    const { error: err } = await supabase.from('coupons').update({ is_active: v }).eq('id', c.id)
    if (err) return toast(errMsg(err), 'error')
    void reload()
  }

  async function remove(c: Coupon) {
    const { error: err } = await supabase.from('coupons').delete().eq('id', c.id)
    if (err) return toast(errMsg(err), 'error')
    toast('تم حذف القسيمة')
    void reload()
  }

  if (loading && !data) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">الخصومات والقسائم</h1>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}>＋ قسيمة جديدة</button>
      </div>

      {(data?.length ?? 0) === 0 && <Empty>لا توجد قسائم. الخصومات اختيارية.</Empty>}

      <div className="space-y-3">
        {data?.map((c) => (
          <div key={c.id} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black" dir="ltr">{c.code}</p>
              <p className="text-sm text-ink-600">
                {c.discount_type === 'percent' ? `${c.value}%` : formatDZD(c.value)}
                {c.min_order > 0 && ` — حد أدنى ${formatDZD(c.min_order)}`}
                {' — '}استُخدمت {c.used_count}{c.max_uses ? ` من ${c.max_uses}` : ''}
              </p>
              {(c.starts_at || c.ends_at) && (
                <p className="text-xs text-ink-600">
                  {c.starts_at && `من ${formatDateTime(c.starts_at)} `}
                  {c.ends_at && `إلى ${formatDateTime(c.ends_at)}`}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Switch checked={c.is_active} onChange={(v) => void toggle(c, v)} label={c.is_active ? 'مفعّلة' : 'معطّلة'} />
              <button className="btn-dark btn-sm" onClick={() => edit(c)}>تعديل</button>
              <ConfirmButton message={`حذف القسيمة ${c.code}؟`} onConfirm={() => void remove(c)}>حذف</ConfirmButton>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'تعديل القسيمة' : 'قسيمة جديدة'}>
        {form && (
          <form onSubmit={save} className="space-y-3">
            <Field label="رمز الخصم"><TextInput dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نوع الخصم">
                <Select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'fixed' | 'percent' })}>
                  <option value="fixed">مبلغ ثابت (دج)</option>
                  <option value="percent">نسبة مئوية (%)</option>
                </Select>
              </Field>
              <Field label="قيمة الخصم"><TextInput type="number" min={0} step="any" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
              <Field label="بداية الصلاحية"><TextInput type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
              <Field label="نهاية الصلاحية"><TextInput type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></Field>
              <Field label="الحد الأدنى للطلب (دج)"><TextInput type="number" min={0} value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} /></Field>
              <Field label="عدد مرات الاستخدام" hint="اتركه فارغًا لعدد غير محدود"><TextInput type="number" min={1} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></Field>
            </div>
            <Switch checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="القسيمة مفعّلة" />
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
