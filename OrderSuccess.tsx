import { Link, useLocation, useParams } from 'react-router-dom'
import { DELIVERY_METHOD_LABEL, formatDate, formatDZD, ORDER_STATUS_LABEL, waLink } from '../lib/format'
import { useSettings } from '../lib/settings'
import { useSeo } from '../lib/seo'
import type { PlacedOrder } from '../lib/types'

export default function OrderSuccess() {
  const { number = '' } = useParams()
  const location = useLocation()
  const { settings } = useSettings()
  const order = (location.state as { order?: PlacedOrder } | null)?.order
  useSeo({ title: 'تم استلام طلبك', noindex: true })

  const pay = settings.payment_methods.find((m) => m.id === order?.payment_method)
  const msg = `السلام عليكم، لقد قمت بطلب رقم ${number} من ${settings.general.store_name}.`

  return (
    <div className="container-x max-w-2xl py-10">
      <div className="card p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h1 className="mt-3 text-2xl font-black">تم استلام طلبك</h1>
        <p className="mt-1 text-ink-600">رقم طلبك</p>
        <p dir="ltr" className="mt-1 text-3xl font-black tracking-wide text-gold-700">{number}</p>
        <p className="mt-3 whitespace-pre-line leading-8">{settings.policies.order_confirmation}</p>
        <p className="mt-2 text-sm text-ink-600">احتفظ برقم الطلب ورقم هاتفك لتتبع الطلب لاحقًا.</p>
      </div>

      {order ? (
        <div className="card mt-5 space-y-3 p-5">
          <h2 className="text-lg font-extrabold">ملخص الطلب</h2>
          <p className="text-sm text-ink-600">الحالة: <b>{ORDER_STATUS_LABEL[order.status]}</b></p>
          <ul className="divide-y divide-ink/10 text-sm">
            {order.lines.map((l) => (
              <li key={l.batch_id} className="flex justify-between py-2">
                <span>{l.product_name} × {l.qty}{l.is_preorder ? ' (حجز مسبق)' : ''}</span>
                <b>{formatDZD(l.line_total)}</b>
              </li>
            ))}
          </ul>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>مجموع المنتجات</dt><dd className="font-bold">{formatDZD(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>التوصيل ({DELIVERY_METHOD_LABEL[order.delivery_method]} — {order.wilaya_name})</dt><dd className="font-bold">{formatDZD(order.shipping)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>الخصم</dt><dd className="font-bold">- {formatDZD(order.discount)}</dd></div>}
            <div className="flex justify-between border-t border-ink/10 pt-2 text-lg font-black"><dt>الإجمالي</dt><dd className="text-gold-700">{formatDZD(order.total)}</dd></div>
            {order.deposit > 0 && <div className="flex justify-between text-amber-800"><dt>العربون المطلوب</dt><dd className="font-bold">{formatDZD(order.deposit)}</dd></div>}
          </dl>
          {order.delivery_time && <p className="text-sm">⏱ مدة التوصيل المتوقعة: {order.delivery_time}</p>}
          {order.lines.filter((l) => l.is_preorder && l.expected_delivery_date).map((l) => (
            <p key={l.batch_id} className="text-sm">التسليم المتوقع لـ «{l.product_name}»: {formatDate(l.expected_delivery_date)}</p>
          ))}
          {pay && (
            <div className="rounded-xl bg-gold-50 p-3 text-sm leading-7">
              <p className="font-extrabold">طريقة الدفع: {pay.label}</p>
              {pay.instructions && <p className="whitespace-pre-line">{pay.instructions}</p>}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-5 text-center text-sm text-ink-600">يمكنك متابعة حالة طلبك من صفحة «تتبع طلبك».</p>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link to="/track" className="btn-dark">تتبع طلبك</Link>
        {settings.general.whatsapp ? (
          <a className="btn-primary" href={waLink(settings.general.whatsapp, msg)} target="_blank" rel="noopener noreferrer">
            💬 أرسل رقم الطلب عبر واتساب
          </a>
        ) : (
          <Link to="/products" className="btn-primary">متابعة التسوق</Link>
        )}
      </div>
    </div>
  )
}
