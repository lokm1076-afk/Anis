import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Empty, ErrorBox, Field, Modal, Select, Spinner, TextArea, TextInput, useToast } from '../components/ui'
import {
  DELIVERY_METHOD_LABEL,
  formatDateTime,
  formatDZD,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  waLink,
} from '../lib/format'
import { useSettings } from '../lib/settings'
import { errMsg, supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { Order, OrderItem, OrderStatus, StatusHistory } from '../lib/types'

async function loadOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []) as Order[]
}

function StatusBadge({ s }: { s: OrderStatus }) {
  return <span className={`badge ${ORDER_STATUS_COLOR[s]}`}>{ORDER_STATUS_LABEL[s]}</span>
}

function OrderDetails({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const { settings } = useSettings()
  const { data, loading, reload } = useAsync(async () => {
    const [items, hist] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', order.id),
      supabase.from('order_status_history').select('*').eq('order_id', order.id).order('created_at'),
    ])
    if (items.error) throw items.error
    if (hist.error) throw hist.error
    return { items: (items.data ?? []) as OrderItem[], history: (hist.data ?? []) as StatusHistory[] }
  }, [order.id])

  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [note, setNote] = useState('')
  const [tracking, setTracking] = useState(order.tracking_number ?? '')
  const [carrier, setCarrier] = useState(order.carrier ?? '')
  const [internal, setInternal] = useState(order.internal_notes ?? '')
  const [busy, setBusy] = useState(false)

  const payLabel = settings.payment_methods.find((m) => m.id === order.payment_method)?.label ?? order.payment_method

  async function saveStatus() {
    if (status === order.status) return toast('الحالة لم تتغير', 'info')
    setBusy(true)
    const { error } = await supabase.rpc('admin_set_order_status', {
      p_order_id: order.id,
      p_status: status,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) return toast(errMsg(error), 'error')
    toast('تم تحديث حالة الطلب والمخزون')
    setNote('')
    onChanged()
    void reload()
  }

  async function saveDetails() {
    setBusy(true)
    const { error } = await supabase
      .from('orders')
      .update({
        tracking_number: tracking.trim() || null,
        carrier: carrier.trim() || null,
        internal_notes: internal.trim() || null,
      })
      .eq('id', order.id)
    setBusy(false)
    if (error) return toast(errMsg(error), 'error')
    toast('تم حفظ بيانات التتبع والملاحظات')
    onChanged()
  }

  const waNum = order.whatsapp || order.phone
  const msg = `السلام عليكم ${order.customer_name}، بخصوص طلبك رقم ${order.order_number} من ${settings.general.store_name}.`

  return (
    <Modal open onClose={onClose} title={`الطلب ${order.order_number}`} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge s={order.status} />
          <span className="text-sm text-ink-600">{formatDateTime(order.created_at)}</span>
        </div>

        <section className="grid gap-3 rounded-xl bg-ink/[0.04] p-4 text-sm sm:grid-cols-2">
          <p><b>العميل:</b> {order.customer_name}</p>
          <p dir="ltr" className="text-right"><b>الهاتف:</b> <a className="underline" href={`tel:${order.phone}`}>{order.phone}</a></p>
          <p><b>الولاية:</b> {order.wilaya_name}</p>
          <p><b>البلدية:</b> {order.commune_name}</p>
          <p className="sm:col-span-2"><b>العنوان:</b> {order.address}</p>
          <p><b>طريقة التوصيل:</b> {DELIVERY_METHOD_LABEL[order.delivery_method]}</p>
          <p><b>طريقة الدفع:</b> {payLabel}</p>
          {order.notes && <p className="sm:col-span-2"><b>ملاحظات العميل:</b> {order.notes}</p>}
          <div className="sm:col-span-2">
            <a className="btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={waLink(waNum, msg)}>
              💬 مراسلة العميل عبر واتساب
            </a>
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-extrabold">المنتجات</h3>
          {loading ? (
            <Spinner />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-ink/10">
              <table className="w-full min-w-[460px] text-sm">
                <thead className="bg-ink/5 text-right">
                  <tr><th className="p-2">المنتج</th><th className="p-2">السعر</th><th className="p-2">الكمية</th><th className="p-2">المجموع</th></tr>
                </thead>
                <tbody>
                  {data?.items.map((i) => (
                    <tr key={i.id} className="border-t border-ink/10">
                      <td className="p-2 font-bold">{i.product_name}{i.is_preorder && <span className="badge mr-1 bg-amber-100 text-amber-800">حجز مسبق</span>}</td>
                      <td className="p-2">{formatDZD(i.unit_price)}</td>
                      <td className="p-2">{i.qty}</td>
                      <td className="p-2">{formatDZD(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt>المنتجات</dt><dd>{formatDZD(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>التوصيل</dt><dd>{formatDZD(order.shipping_cost)}</dd></div>
            {order.discount_total > 0 && (
              <div className="flex justify-between text-emerald-700"><dt>خصم {order.coupon_code && `(${order.coupon_code})`}</dt><dd>- {formatDZD(order.discount_total)}</dd></div>
            )}
            <div className="flex justify-between border-t border-ink/10 pt-1 text-base font-black"><dt>الإجمالي</dt><dd>{formatDZD(order.total)}</dd></div>
            {order.deposit_total > 0 && (
              <div className="flex justify-between text-amber-800"><dt>عربون الحجز المسبق</dt><dd>{formatDZD(order.deposit_total)}</dd></div>
            )}
          </dl>
        </section>

        <section className="space-y-3 rounded-xl border border-ink/10 p-4">
          <h3 className="font-extrabold">تغيير حالة الطلب</h3>
          <p className="text-xs text-ink-600">
            التأكيد/التحضير يُبقي الكمية محجوزة. «تم الشحن» و«تم التسليم» يحوّلان الحجز إلى مباع (مرة واحدة فقط).
            «ملغى» و«تعذر التسليم» يعيدان الكمية إلى المخزون.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="الحالة الجديدة">
              <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
              </Select>
            </Field>
            <Field label="ملاحظة على التغيير (اختياري)">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => void saveStatus()}>حفظ الحالة</button>
        </section>

        <section className="space-y-3 rounded-xl border border-ink/10 p-4">
          <h3 className="font-extrabold">التتبع والملاحظات الداخلية</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رقم التتبع"><TextInput dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
            <Field label="شركة التوصيل"><TextInput value={carrier} onChange={(e) => setCarrier(e.target.value)} /></Field>
          </div>
          <Field label="ملاحظات داخلية (لا تظهر للعميل)">
            <TextArea value={internal} onChange={(e) => setInternal(e.target.value)} />
          </Field>
          <button className="btn-dark" disabled={busy} onClick={() => void saveDetails()}>حفظ</button>
        </section>

        <section>
          <h3 className="mb-2 font-extrabold">سجل تغييرات الحالة</h3>
          <ul className="space-y-2 text-sm">
            {data?.history.map((h) => (
              <li key={h.id} className="rounded-lg bg-ink/[0.04] p-2">
                <span className="font-bold">
                  {h.from_status ? `${ORDER_STATUS_LABEL[h.from_status as OrderStatus] ?? h.from_status} ← ` : ''}
                  {ORDER_STATUS_LABEL[h.to_status as OrderStatus] ?? h.to_status}
                </span>
                <span className="mr-2 text-ink-600">{formatDateTime(h.created_at)}</span>
                {h.note && <p className="text-ink-600">{h.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  )
}

export default function OrdersAdmin() {
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload } = useAsync(loadOrders, [])
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const statusFilter = params.get('status') ?? ''

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data ?? []).filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false
      if (!term) return true
      return [o.order_number, o.customer_name, o.phone, o.wilaya_name, o.commune_name]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [data, q, statusFilter])

  const open = (data ?? []).find((o) => o.id === openId) ?? null

  if (loading && !data) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">الطلبات</h1>
        <button className="btn-outline btn-sm" onClick={() => void reload()}>تحديث</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput placeholder="بحث: رقم الطلب، الاسم، الهاتف، الولاية..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value
            setParams(v ? { status: v } : {})
          }}
        >
          <option value="">كل الحالات</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
        </Select>
      </div>

      {rows.length === 0 && <Empty>لا توجد طلبات مطابقة.</Empty>}

      {/* هاتف: بطاقات */}
      <div className="space-y-3 md:hidden">
        {rows.map((o) => (
          <button key={o.id} onClick={() => setOpenId(o.id)} className="card block w-full p-3 text-right">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black" dir="ltr">{o.order_number}</span>
              <StatusBadge s={o.status} />
            </div>
            <p className="mt-1 font-bold">{o.customer_name}</p>
            <p className="text-sm text-ink-600">{o.wilaya_name} — {o.commune_name}</p>
            <p className="mt-1 flex justify-between text-sm"><span>{formatDateTime(o.created_at)}</span><b>{formatDZD(o.total)}</b></p>
          </button>
        ))}
      </div>

      {/* حاسوب: جدول */}
      {rows.length > 0 && (
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-right">
              <tr>
                {['رقم الطلب', 'العميل', 'الهاتف', 'الولاية / البلدية', 'التوصيل', 'الإجمالي', 'التاريخ', 'الحالة'].map((h) => (
                  <th key={h} className="p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} onClick={() => setOpenId(o.id)} className="cursor-pointer border-t border-ink/10 hover:bg-gold-50">
                  <td className="p-3 font-black" dir="ltr">{o.order_number}</td>
                  <td className="p-3 font-bold">{o.customer_name}</td>
                  <td className="p-3" dir="ltr">{o.phone}</td>
                  <td className="p-3">{o.wilaya_name} / {o.commune_name}</td>
                  <td className="p-3">{formatDZD(o.shipping_cost)}</td>
                  <td className="p-3 font-bold">{formatDZD(o.total)}</td>
                  <td className="p-3">{formatDateTime(o.created_at)}</td>
                  <td className="p-3"><StatusBadge s={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <OrderDetails order={open} onClose={() => setOpenId(null)} onChanged={() => void reload()} />}
    </div>
  )
}
