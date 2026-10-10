import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, ErrorBox, Field, Select, Spinner, TextArea, TextInput, useToast } from '../components/ui'
import {
  fetchCommunes,
  fetchDeliveryWilayas,
  fetchRates,
  placeOrder,
  quoteOrder,
} from '../lib/api'
import { useCart } from '../lib/cart'
import { DELIVERY_METHOD_LABEL, formatDate, formatDZD } from '../lib/format'
import { useSettings } from '../lib/settings'
import { useSeo } from '../lib/seo'
import { errMsg } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { Commune, DeliveryMethod, Quote, ShippingRate } from '../lib/types'

const PHONE_RE = /^(?:0|\+213|00213)[567][0-9]{8}$/

export default function Checkout() {
  const nav = useNavigate()
  const toast = useToast()
  const cart = useCart()
  const { settings } = useSettings()
  useSeo({ title: 'إتمام الطلب', noindex: true })

  const wilayasQ = useAsync(fetchDeliveryWilayas, [])
  const methods = settings.payment_methods.filter((m) => m.enabled)

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    whatsapp: '',
    wilaya_id: 0,
    commune: '',
    address: '',
    delivery_method: '' as DeliveryMethod | '',
    payment_method: '',
    notes: '',
  })
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState('')
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [communes, setCommunes] = useState<Commune[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteErr, setQuoteErr] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const wilaya = wilayasQ.data?.find((w) => w.id === form.wilaya_id) ?? null
  const items = useMemo(
    () => cart.items.map((i) => ({ batch_id: i.batchId, qty: i.qty })),
    [cart.items],
  )

  // اختيار طريقة دفع افتراضية
  useEffect(() => {
    if (!form.payment_method && methods.length > 0) set('payment_method', methods[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods.length])

  // عند تغيير الولاية: جلب أسعار التوصيل والبلديات
  useEffect(() => {
    setRates([])
    setCommunes([])
    setQuote(null)
    setQuoteErr(null)
    if (!form.wilaya_id) return
    let alive = true
    void (async () => {
      try {
        const [r, c] = await Promise.all([fetchRates(form.wilaya_id), fetchCommunes(form.wilaya_id)])
        if (!alive) return
        setRates(r)
        setCommunes(c)
        setForm((f) => ({
          ...f,
          commune: '',
          delivery_method: r.length === 1 ? r[0].method : r.some((x) => x.method === f.delivery_method) ? f.delivery_method : '',
        }))
      } catch (e) {
        if (alive) setQuoteErr(errMsg(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [form.wilaya_id])

  // عرض السعر من الخادم كلما تغيّر شيء
  useEffect(() => {
    setQuote(null)
    setQuoteErr(null)
    if (!form.wilaya_id || !form.delivery_method || items.length === 0) return
    let alive = true
    setQuoting(true)
    quoteOrder(items, form.wilaya_id, form.delivery_method, coupon || null)
      .then((q) => alive && setQuote(q))
      .catch((e) => alive && setQuoteErr(errMsg(e)))
      .finally(() => alive && setQuoting(false))
    return () => {
      alive = false
    }
  }, [items, form.wilaya_id, form.delivery_method, coupon])

  if (cart.items.length === 0) {
    return (
      <div className="container-x py-12">
        <Empty>
          <p className="text-lg font-bold">سلتك فارغة</p>
          <Link to="/products" className="btn-primary mt-4">تصفح المنتجات</Link>
        </Empty>
      </div>
    )
  }
  if (wilayasQ.loading) return <Spinner />
  if (wilayasQ.error) {
    return <div className="container-x py-8"><ErrorBox message={wilayasQ.error} onRetry={wilayasQ.reload} /></div>
  }

  const wilayas = wilayasQ.data ?? []
  const selectedPay = methods.find((m) => m.id === form.payment_method)

  function validate(): string | null {
    if (form.customer_name.trim().length < 3) return 'يرجى إدخال الاسم واللقب'
    if (!PHONE_RE.test(form.phone.replace(/[\s-]/g, ''))) return 'رقم الهاتف غير صالح (مثال: 0555123456)'
    if (form.whatsapp && !PHONE_RE.test(form.whatsapp.replace(/[\s-]/g, ''))) return 'رقم واتساب غير صالح'
    if (!form.wilaya_id) return 'يرجى اختيار الولاية'
    if (!form.delivery_method) return 'يرجى اختيار طريقة الاستلام'
    if (form.commune.trim().length < 2) return 'يرجى اختيار أو إدخال البلدية'
    if (form.address.trim().length < 5) return 'يرجى إدخال العنوان بالتفصيل'
    if (!form.payment_method) return 'يرجى اختيار طريقة الدفع'
    if (!quote) return quoteErr || 'تعذر حساب السعر، حاول مجددًا'
    return null
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = validate()
    setFormErr(v)
    if (v) {
      toast(v, 'error')
      return
    }
    setSubmitting(true)
    try {
      const placed = await placeOrder({
        items,
        customer_name: form.customer_name,
        phone: form.phone,
        whatsapp: form.whatsapp,
        wilaya_id: form.wilaya_id,
        commune: form.commune,
        address: form.address,
        delivery_method: form.delivery_method as DeliveryMethod,
        payment_method: form.payment_method,
        notes: form.notes,
        coupon,
      })
      cart.clear()
      nav(`/order/${placed.order_number}`, { state: { order: placed } })
    } catch (e2) {
      const m = errMsg(e2)
      setFormErr(m)
      toast(m, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container-x py-8">
      <h1 className="mb-5 text-3xl font-black">إتمام الطلب</h1>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]" noValidate>
        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            <h2 className="text-lg font-extrabold">بيانات العميل</h2>
            <Field label="الاسم واللقب *">
              <TextInput value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} autoComplete="name" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رقم الهاتف *">
                <TextInput dir="ltr" inputMode="tel" placeholder="0555123456" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" required />
              </Field>
              <Field label="رقم واتساب (إن كان مختلفًا)">
                <TextInput dir="ltr" inputMode="tel" placeholder="0555123456" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="card space-y-4 p-5">
            <h2 className="text-lg font-extrabold">التوصيل</h2>
            {wilayas.length === 0 ? (
              <p className="rounded-xl bg-amber-50 p-3 font-bold text-amber-800">
                لا توجد ولايات مفعّلة للتوصيل حاليًا. يرجى التواصل معنا عبر واتساب.
              </p>
            ) : (
              <Field label="الولاية *">
                <Select value={form.wilaya_id || ''} onChange={(e) => set('wilaya_id', Number(e.target.value))} required>
                  <option value="">اختر الولاية</option>
                  {wilayas.map((w) => (
                    <option key={w.id} value={w.id} disabled={w.orders_paused}>
                      {String(w.id).padStart(2, '0')} - {w.name_ar}
                      {w.orders_paused ? ' (الطلبات متوقفة مؤقتًا)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <p className="text-xs text-ink-600">
              نوصّل فقط إلى الولايات المعروضة في القائمة. إذا لم تجد ولايتك فهي غير مدعومة حاليًا.
            </p>

            {wilaya && (
              <div className="rounded-xl bg-gold-50 p-3 text-sm leading-7">
                {wilaya.delivery_time && <p>⏱ مدة التوصيل المتوقعة: <b>{wilaya.delivery_time}</b></p>}
                {wilaya.min_order > 0 && <p>الحد الأدنى للطلب: <b>{formatDZD(wilaya.min_order)}</b></p>}
                {wilaya.notes && <p className="whitespace-pre-line">{wilaya.notes}</p>}
              </div>
            )}

            {wilaya && rates.length === 0 && !quoteErr && (
              <p className="rounded-xl bg-red-50 p-3 font-bold text-red-800">
                لا توجد طريقة توصيل مفعّلة لهذه الولاية حاليًا.
              </p>
            )}

            {rates.length > 0 && (
              <Field label="طريقة الاستلام *">
                <div className="grid gap-2">
                  {rates.map((r) => (
                    <label
                      key={r.id}
                      className={`flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-3 ${form.delivery_method === r.method ? 'border-gold-500 bg-gold-50' : 'border-ink/15'}`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="delivery_method"
                          checked={form.delivery_method === r.method}
                          onChange={() => set('delivery_method', r.method)}
                        />
                        <span className="font-bold">{DELIVERY_METHOD_LABEL[r.method]}</span>
                      </span>
                      <span className="font-extrabold text-gold-700">{formatDZD(r.price)}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}

            {wilaya && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="البلدية *">
                  {communes.length > 0 ? (
                    <Select value={form.commune} onChange={(e) => set('commune', e.target.value)} required>
                      <option value="">اختر البلدية</option>
                      {communes.map((c) => (
                        <option key={c.id} value={c.name_ar}>{c.name_ar}</option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput value={form.commune} onChange={(e) => set('commune', e.target.value)} placeholder="اسم البلدية" required />
                  )}
                </Field>
              </div>
            )}
            <Field label="العنوان بالتفصيل *">
              <TextArea value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="الحي، الشارع، رقم المنزل أو أقرب معلم" rows={2} required />
            </Field>
            <Field label="ملاحظات إضافية">
              <TextArea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
            </Field>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="text-lg font-extrabold">طريقة الدفع</h2>
            {methods.length === 0 ? (
              <p className="rounded-xl bg-red-50 p-3 font-bold text-red-800">لا توجد طريقة دفع متاحة حاليًا.</p>
            ) : (
              <div className="grid gap-2">
                {methods.map((m) => (
                  <label
                    key={m.id}
                    className={`flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border-2 px-3 ${form.payment_method === m.id ? 'border-gold-500 bg-gold-50' : 'border-ink/15'}`}
                  >
                    <input type="radio" name="payment" checked={form.payment_method === m.id} onChange={() => set('payment_method', m.id)} />
                    <span className="font-bold">{m.label}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedPay?.instructions && (
              <p className="whitespace-pre-line rounded-xl bg-ink/5 p-3 text-sm leading-7">{selectedPay.instructions}</p>
            )}
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-3 p-5">
            <h2 className="text-lg font-extrabold">ملخص الطلب</h2>
            <ul className="space-y-2 text-sm">
              {cart.items.map((i) => (
                <li key={i.batchId} className="flex justify-between gap-2">
                  <span>{i.name} × {i.qty}</span>
                  <span className="font-bold">{formatDZD(i.unitPrice * i.qty)}</span>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <TextInput dir="ltr" placeholder="رمز الخصم" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
              <button type="button" className="btn-outline btn-sm shrink-0" onClick={() => setCoupon(couponInput.trim())}>تطبيق</button>
            </div>
            {coupon && (
              <button type="button" className="text-xs font-bold text-red-600" onClick={() => { setCoupon(''); setCouponInput('') }}>
                إزالة رمز الخصم
              </button>
            )}

            <hr className="border-ink/10" />
            {quoting && <p className="text-sm text-ink-600">جارٍ حساب السعر...</p>}
            {quoteErr && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700">{quoteErr}</p>}
            {quote && (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt>مجموع المنتجات</dt><dd className="font-bold">{formatDZD(quote.subtotal)}</dd></div>
                <div className="flex justify-between"><dt>مصاريف التوصيل</dt><dd className="font-bold">{formatDZD(quote.shipping)}</dd></div>
                {quote.discount > 0 && (
                  <div className="flex justify-between text-emerald-700"><dt>الخصم ({quote.coupon_code})</dt><dd className="font-bold">- {formatDZD(quote.discount)}</dd></div>
                )}
                <div className="flex justify-between border-t border-ink/10 pt-2 text-lg font-black">
                  <dt>الإجمالي</dt><dd className="text-gold-700">{formatDZD(quote.total)}</dd>
                </div>
                {quote.deposit > 0 && (
                  <div className="flex justify-between text-amber-800"><dt>العربون المطلوب (حجز مسبق)</dt><dd className="font-bold">{formatDZD(quote.deposit)}</dd></div>
                )}
                {quote.lines.filter((l) => l.is_preorder && l.expected_delivery_date).map((l) => (
                  <p key={l.batch_id} className="text-xs text-ink-600">التسليم المتوقع لـ «{l.product_name}»: {formatDate(l.expected_delivery_date)}</p>
                ))}
              </dl>
            )}
            {!quote && !quoting && !quoteErr && (
              <p className="text-xs text-ink-600">اختر الولاية وطريقة الاستلام لعرض مصاريف التوصيل والإجمالي.</p>
            )}

            {formErr && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700">{formErr}</p>}
            <button className="btn-primary w-full text-lg" disabled={submitting || quoting || !quote}>
              {submitting ? 'جارٍ إرسال الطلب...' : 'تأكيد الطلب'}
            </button>
            <p className="text-center text-xs text-ink-600">لا حاجة لإنشاء حساب. الأسعار تُحسب وتُتحقق من الخادم.</p>
          </div>
        </aside>
      </form>
    </div>
  )
}
