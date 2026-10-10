import { useState } from 'react'
import type { FormEvent } from 'react'
import { Field, TextInput } from '../components/ui'
import { trackOrder } from '../lib/api'
import type { TrackedOrder } from '../lib/api'
import { formatDateTime, formatDZD, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '../lib/format'
import { useSeo } from '../lib/seo'
import { errMsg } from '../lib/supabase'

export default function Track() {
  useSeo({ title: 'تتبع طلبك', description: 'تابع حالة طلبك برقم الطلب ورقم الهاتف.' })
  const [number, setNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [order, setOrder] = useState<TrackedOrder | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setOrder(null)
    try {
      setOrder(await trackOrder(number, phone))
    } catch (e2) {
      setErr(errMsg(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-x max-w-xl py-10">
      <h1 className="text-3xl font-black">تتبع طلبك</h1>
      <p className="mt-1 text-ink-600">أدخل رقم الطلب ورقم الهاتف المستخدم عند الطلب.</p>
      <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
        <Field label="رقم الطلب">
          <TextInput dir="ltr" placeholder="AB-261010-1001" value={number} onChange={(e) => setNumber(e.target.value)} required />
        </Field>
        <Field label="رقم الهاتف">
          <TextInput dir="ltr" inputMode="tel" placeholder="0555123456" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارٍ البحث...' : 'تتبع'}</button>
      </form>

      {order && (
        <div className="card mt-5 space-y-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span dir="ltr" className="font-black">{order.order_number}</span>
            <span className={`badge ${ORDER_STATUS_COLOR[order.status]}`}>{ORDER_STATUS_LABEL[order.status]}</span>
          </div>
          {order.tracking_number && (
            <p className="text-sm">رقم التتبع{order.carrier ? ` (${order.carrier})` : ''}: <b dir="ltr">{order.tracking_number}</b></p>
          )}
          <ul className="divide-y divide-ink/10 text-sm">
            {order.items.map((i, k) => (
              <li key={k} className="flex justify-between py-2"><span>{i.product_name} × {i.qty}</span><b>{formatDZD(i.line_total)}</b></li>
            ))}
          </ul>
          <p className="flex justify-between text-lg font-black"><span>الإجمالي</span><span className="text-gold-700">{formatDZD(order.total)}</span></p>
          <h2 className="pt-2 font-extrabold">مراحل الطلب</h2>
          <ol className="space-y-2 border-r-2 border-gold-300 pr-4 text-sm">
            {order.history.map((h, i) => (
              <li key={i}><b>{ORDER_STATUS_LABEL[h.to_status]}</b> <span className="text-ink-600">— {formatDateTime(h.created_at)}</span></li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
