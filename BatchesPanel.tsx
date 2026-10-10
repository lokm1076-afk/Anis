import { useState } from 'react'
import type { FormEvent } from 'react'
import { ConfirmButton, Field, Modal, Switch, TextArea, TextInput, useToast } from '../components/ui'
import { formatDate, isoToLocalInput, localInputToIso } from '../lib/format'
import { errMsg, supabase } from '../lib/supabase'
import type { AdminBatch } from '../lib/types'

interface Draft {
  id?: string
  label: string
  batch_code: string
  hatch_date: string
  mating_date: string
  production_date: string
  total_qty: string
  manual_reserved_qty: string
  is_preorder: boolean
  preorder_start: string
  preorder_end: string
  expected_delivery_date: string
  deposit_amount: string
  cancellation_terms: string
  is_open: boolean
  is_active: boolean
  // للعرض فقط
  reserved_qty?: number
  sold_qty?: number
}

const blank: Draft = {
  label: 'الدفعة الحالية',
  batch_code: '',
  hatch_date: '',
  mating_date: '',
  production_date: '',
  total_qty: '0',
  manual_reserved_qty: '0',
  is_preorder: false,
  preorder_start: '',
  preorder_end: '',
  expected_delivery_date: '',
  deposit_amount: '0',
  cancellation_terms: '',
  is_open: true,
  is_active: true,
}

function toDraft(b: AdminBatch): Draft {
  return {
    id: b.id,
    label: b.label,
    batch_code: b.batch_code ?? '',
    hatch_date: b.hatch_date ?? '',
    mating_date: b.mating_date ?? '',
    production_date: b.production_date ?? '',
    total_qty: String(b.total_qty),
    manual_reserved_qty: String(b.manual_reserved_qty),
    is_preorder: b.is_preorder,
    preorder_start: isoToLocalInput(b.preorder_start),
    preorder_end: isoToLocalInput(b.preorder_end),
    expected_delivery_date: b.expected_delivery_date ?? '',
    deposit_amount: String(b.deposit_amount ?? 0),
    cancellation_terms: b.cancellation_terms ?? '',
    is_open: b.is_open,
    is_active: b.is_active,
    reserved_qty: b.reserved_qty,
    sold_qty: b.sold_qty,
  }
}

export default function BatchesPanel({
  productId,
  batches,
  onChanged,
}: {
  productId: string
  batches: AdminBatch[]
  onChanged: () => void
}) {
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    const total = Number(draft.total_qty)
    const manual = Number(draft.manual_reserved_qty)
    if (!Number.isInteger(total) || total < 0) return toast('الكمية الإجمالية غير صالحة', 'error')
    if (!Number.isInteger(manual) || manual < 0) return toast('الحجز اليدوي غير صالح', 'error')
    if (draft.is_preorder && draft.preorder_start && draft.preorder_end &&
        new Date(draft.preorder_end) < new Date(draft.preorder_start)) {
      return toast('تاريخ انتهاء الحجز قبل تاريخ بدايته', 'error')
    }
    const payload = {
      product_id: productId,
      label: draft.label.trim() || 'الدفعة',
      batch_code: draft.batch_code.trim() || null,
      hatch_date: draft.hatch_date || null,
      mating_date: draft.mating_date || null,
      production_date: draft.production_date || null,
      total_qty: total,
      manual_reserved_qty: manual,
      is_preorder: draft.is_preorder,
      preorder_start: draft.is_preorder ? localInputToIso(draft.preorder_start) : null,
      preorder_end: draft.is_preorder ? localInputToIso(draft.preorder_end) : null,
      expected_delivery_date: draft.expected_delivery_date || null,
      deposit_amount: Number(draft.deposit_amount) || 0,
      cancellation_terms: draft.cancellation_terms.trim() || null,
      is_open: draft.is_open,
      is_active: draft.is_active,
    }
    setSaving(true)
    const { error } = draft.id
      ? await supabase.from('product_batches').update(payload).eq('id', draft.id)
      : await supabase.from('product_batches').insert(payload)
    setSaving(false)
    if (error) return toast(errMsg(error), 'error')
    toast('تم حفظ الدفعة')
    setDraft(null)
    onChanged()
  }

  async function toggleOpen(b: AdminBatch) {
    const { error } = await supabase.from('product_batches').update({ is_open: !b.is_open }).eq('id', b.id)
    if (error) return toast(errMsg(error), 'error')
    toast(b.is_open ? 'تم إغلاق الطلبات على هذه الدفعة' : 'تمت إعادة فتح الطلبات')
    onChanged()
  }

  async function remove(b: AdminBatch) {
    const { error } = await supabase.from('product_batches').delete().eq('id', b.id)
    if (error) return toast(errMsg(error), 'error')
    toast('تم حذف الدفعة')
    onChanged()
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">الدفعات والمخزون والحجز المسبق</h2>
          <p className="text-sm text-ink-600">المتبقي = الإجمالي − المحجوز (طلبات) − المباع − الحجز اليدوي. يُحسب تلقائيًا.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setDraft({ ...blank })}>＋ دفعة</button>
      </div>

      {batches.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink/20 p-4 text-ink-600">لا توجد دفعات. أضف دفعة ليظهر المخزون ويصبح الطلب ممكنًا.</p>
      )}

      <div className="space-y-3">
        {batches.map((b) => (
          <div key={b.id} className="rounded-xl border border-ink/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold">
                {b.label}
                {b.batch_code && <span className="mr-2 text-sm font-normal text-ink-600">({b.batch_code})</span>}
              </p>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                {b.is_preorder && <span className="badge bg-amber-100 text-amber-800">حجز مسبق</span>}
                <span className={`badge ${b.is_open ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  {b.is_open ? 'الطلبات مفتوحة' : 'الطلبات مغلقة'}
                </span>
                {!b.is_active && <span className="badge bg-red-100 text-red-800">مخفية</span>}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5">
              <div className="rounded-lg bg-ink/5 p-2"><p className="text-xs text-ink-600">الإجمالي</p><b>{b.total_qty}</b></div>
              <div className="rounded-lg bg-amber-50 p-2"><p className="text-xs text-ink-600">محجوز (طلبات)</p><b>{b.reserved_qty}</b></div>
              <div className="rounded-lg bg-amber-50 p-2"><p className="text-xs text-ink-600">حجز يدوي</p><b>{b.manual_reserved_qty}</b></div>
              <div className="rounded-lg bg-ink/5 p-2"><p className="text-xs text-ink-600">مباع/مشحون</p><b>{b.sold_qty}</b></div>
              <div className={`rounded-lg p-2 ${b.available_qty <= 0 ? 'bg-red-50' : 'bg-emerald-50'}`}><p className="text-xs text-ink-600">المتبقي</p><b>{b.available_qty}</b></div>
            </div>
            <p className="mt-2 text-xs text-ink-600">
              {[
                b.hatch_date && `فقس: ${formatDate(b.hatch_date)}`,
                b.mating_date && `تلقيح: ${formatDate(b.mating_date)}`,
                b.production_date && `إنتاج: ${formatDate(b.production_date)}`,
                b.is_preorder && b.expected_delivery_date && `تسليم متوقع: ${formatDate(b.expected_delivery_date)}`,
              ].filter(Boolean).join(' • ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-dark btn-sm" onClick={() => setDraft(toDraft(b))}>تعديل</button>
              <button className="btn-outline btn-sm" onClick={() => void toggleOpen(b)}>
                {b.is_open ? 'إغلاق الطلبات' : 'إعادة فتح الطلبات'}
              </button>
              <ConfirmButton message="حذف هذه الدفعة؟ لا يمكن حذف دفعة لها طلبات." onConfirm={() => void remove(b)}>حذف</ConfirmButton>
            </div>
          </div>
        ))}
      </div>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'تعديل الدفعة' : 'إضافة دفعة'} wide>
        {draft && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم الدفعة"><TextInput value={draft.label} onChange={(e) => set('label', e.target.value)} required /></Field>
              <Field label="رمز الدفعة (اختياري)"><TextInput value={draft.batch_code} onChange={(e) => set('batch_code', e.target.value)} /></Field>
              <Field label="تاريخ الفقس"><TextInput type="date" value={draft.hatch_date} onChange={(e) => set('hatch_date', e.target.value)} /></Field>
              <Field label="تاريخ التلقيح"><TextInput type="date" value={draft.mating_date} onChange={(e) => set('mating_date', e.target.value)} /></Field>
              <Field label="تاريخ الإنتاج"><TextInput type="date" value={draft.production_date} onChange={(e) => set('production_date', e.target.value)} /></Field>
              <Field label="إجمالي عدد الملكات في الدفعة"><TextInput type="number" inputMode="numeric" min={0} value={draft.total_qty} onChange={(e) => set('total_qty', e.target.value)} required /></Field>
              <Field label="حجز يدوي (ملكات محجوزة خارج الموقع)" hint="يُخصم من المتاح دون إنشاء طلب">
                <TextInput type="number" inputMode="numeric" min={0} value={draft.manual_reserved_qty} onChange={(e) => set('manual_reserved_qty', e.target.value)} />
              </Field>
            </div>
            {draft.id && (
              <p className="rounded-xl bg-ink/5 p-3 text-sm">
                محجوز من الطلبات: <b>{draft.reserved_qty}</b> — مباع/مشحون: <b>{draft.sold_qty}</b> (يُحدَّثان تلقائيًا من حالات الطلبات)
              </p>
            )}
            <div className="flex flex-wrap gap-6">
              <Switch checked={draft.is_open} onChange={(v) => set('is_open', v)} label="الطلبات مفتوحة" />
              <Switch checked={draft.is_active} onChange={(v) => set('is_active', v)} label="الدفعة ظاهرة" />
              <Switch checked={draft.is_preorder} onChange={(v) => set('is_preorder', v)} label="حجز مسبق لدفعة مستقبلية" />
            </div>

            {draft.is_preorder && (
              <div className="grid gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2">
                <Field label="بداية الحجز"><TextInput type="datetime-local" value={draft.preorder_start} onChange={(e) => set('preorder_start', e.target.value)} /></Field>
                <Field label="نهاية الحجز"><TextInput type="datetime-local" value={draft.preorder_end} onChange={(e) => set('preorder_end', e.target.value)} /></Field>
                <Field label="تاريخ التسليم المتوقع"><TextInput type="date" value={draft.expected_delivery_date} onChange={(e) => set('expected_delivery_date', e.target.value)} /></Field>
                <Field label="العربون لكل ملكة (دج)"><TextInput type="number" inputMode="decimal" min={0} value={draft.deposit_amount} onChange={(e) => set('deposit_amount', e.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <Field label="شروط إلغاء الحجز">
                    <TextArea value={draft.cancellation_terms} onChange={(e) => set('cancellation_terms', e.target.value)} rows={3} />
                  </Field>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الدفعة'}</button>
              <button type="button" className="btn-outline" onClick={() => setDraft(null)}>إلغاء</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  )
}
