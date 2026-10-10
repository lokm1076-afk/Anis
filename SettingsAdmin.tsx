import { useEffect, useState } from 'react'
import SingleImageField from '../components/SingleImageField'
import { Field, Switch, TextArea, TextInput, useToast } from '../components/ui'
import { saveSetting, useSettings } from '../lib/settings'
import type { GeneralSettings, PaymentMethod, PolicySettings } from '../lib/settings'
import { errMsg } from '../lib/supabase'

type Tab = 'general' | 'payment' | 'policies'
const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'معلومات المتجر' },
  { id: 'payment', label: 'طرق الدفع' },
  { id: 'policies', label: 'السياسات والرسائل' },
]

const PHONE_RE = /^(\+?213|0)[567][0-9]{8}$/

function General() {
  const { settings, refresh } = useSettings()
  const toast = useToast()
  const [g, setG] = useState<GeneralSettings>(settings.general)
  const [offers, setOffers] = useState(settings.flags.offers_enabled)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setG(settings.general)
    setOffers(settings.flags.offers_enabled)
  }, [settings.general, settings.flags])

  async function save() {
    const clean = (s: string) => s.replace(/[\s.-]/g, '')
    if (g.whatsapp && !PHONE_RE.test(clean(g.whatsapp))) return toast('رقم واتساب غير صالح (مثال: 0555123456)', 'error')
    if (g.phone && !PHONE_RE.test(clean(g.phone))) return toast('رقم الهاتف غير صالح (مثال: 0555123456)', 'error')
    if (!/^#[0-9a-fA-F]{6}$/.test(g.primary_color)) return toast('اللون يجب أن يكون بصيغة #d4a017', 'error')
    if (!g.store_name.trim()) return toast('اسم المتجر مطلوب', 'error')
    setBusy(true)
    try {
      await saveSetting('general', { ...g, phone: clean(g.phone), whatsapp: clean(g.whatsapp) })
      await saveSetting('flags', { ...settings.flags, offers_enabled: offers })
      await refresh()
      toast('تم حفظ إعدادات المتجر')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const set = <K extends keyof GeneralSettings>(k: K, v: GeneralSettings[K]) => setG({ ...g, [k]: v })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المتجر"><TextInput value={g.store_name} onChange={(e) => set('store_name', e.target.value)} /></Field>
        <Field label="عبارة قصيرة تحت الاسم"><TextInput value={g.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
        <SingleImageField label="الشعار" value={g.logo_url} onChange={(v) => set('logo_url', v)} folder="branding" />
        <Field label="اللون الأساسي" hint="يُستخدم في الأزرار والشعار">
          <div className="flex items-center gap-2">
            <input type="color" aria-label="اختيار اللون" value={/^#[0-9a-fA-F]{6}$/.test(g.primary_color) ? g.primary_color : '#d4a017'} onChange={(e) => set('primary_color', e.target.value)} className="h-11 w-14 rounded-lg border border-ink/20" />
            <TextInput dir="ltr" value={g.primary_color} onChange={(e) => set('primary_color', e.target.value)} />
          </div>
        </Field>
        <Field label="رقم الهاتف"><TextInput dir="ltr" inputMode="tel" value={g.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="رقم واتساب" hint="يُستخدم للزر العائم وأزرار التواصل"><TextInput dir="ltr" inputMode="tel" value={g.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></Field>
        <Field label="البريد الإلكتروني"><TextInput dir="ltr" type="email" value={g.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="العنوان"><TextInput value={g.address} onChange={(e) => set('address', e.target.value)} /></Field>
      </div>
      <Field label="وصف المتجر"><TextArea value={g.description} onChange={(e) => set('description', e.target.value)} /></Field>

      <h3 className="font-extrabold">روابط التواصل الاجتماعي</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['facebook', 'instagram', 'tiktok', 'youtube'] as const).map((k) => (
          <Field key={k} label={{ facebook: 'فيسبوك', instagram: 'إنستغرام', tiktok: 'تيك توك', youtube: 'يوتيوب' }[k]}>
            <TextInput dir="ltr" placeholder="https://..." value={g.social[k]} onChange={(e) => set('social', { ...g.social, [k]: e.target.value })} />
          </Field>
        ))}
      </div>

      <Switch checked={offers} onChange={setOffers} label="تفعيل قسم «عروض خاصة» في المتجر" />
      <button className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</button>
    </div>
  )
}

function Payment() {
  const { settings, refresh } = useSettings()
  const toast = useToast()
  const [list, setList] = useState<PaymentMethod[]>(settings.payment_methods)
  const [busy, setBusy] = useState(false)
  useEffect(() => setList(settings.payment_methods), [settings.payment_methods])

  const upd = (i: number, patch: Partial<PaymentMethod>) => setList(list.map((m, j) => (j === i ? { ...m, ...patch } : m)))

  async function save() {
    if (!list.some((m) => m.enabled)) return toast('فعّل طريقة دفع واحدة على الأقل', 'error')
    for (const m of list) {
      if (m.enabled && m.id !== 'cod' && !m.instructions.trim()) {
        return toast(`أضف تعليمات الدفع لطريقة «${m.label}» (رقم الحساب/CCP...) قبل تفعيلها`, 'error')
      }
    }
    setBusy(true)
    try {
      await saveSetting('payment_methods', list)
      await refresh()
      toast('تم حفظ طرق الدفع')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {list.map((m, i) => (
        <div key={m.id} className="card space-y-3 p-4">
          <Switch checked={m.enabled} onChange={(v) => upd(i, { enabled: v })} label={m.label} />
          <Field label={m.id === 'cod' ? 'ملاحظة للعميل (اختياري)' : 'تعليمات الدفع التي تظهر للعميل (رقم الحساب، الاسم...)'}>
            <TextArea value={m.instructions} onChange={(e) => upd(i, { instructions: e.target.value })} />
          </Field>
        </div>
      ))}
      <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
        الدفع الإلكتروني (بطاقة الذهبية/CIB وغيرها) غير مفعّل. يمكن إضافته لاحقًا عبر مزوّد دفع يدعم الجزائر بعد فتح حساب تاجر ودمج واجهته البرمجية واختبارها.
      </p>
      <button className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</button>
    </div>
  )
}

function Policies() {
  const { settings, refresh } = useSettings()
  const toast = useToast()
  const [p, setP] = useState<PolicySettings>(settings.policies)
  const [busy, setBusy] = useState(false)
  useEffect(() => setP(settings.policies), [settings.policies])

  async function save() {
    setBusy(true)
    try {
      await saveSetting('policies', p)
      await refresh()
      toast('تم حفظ السياسات')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const rows: [keyof PolicySettings, string][] = [
    ['terms', 'شروط البيع والحجز'],
    ['cancellation', 'سياسة الإلغاء والاسترجاع'],
    ['privacy', 'سياسة الخصوصية'],
    ['delivery_info', 'معلومات التوصيل'],
    ['order_confirmation', 'رسالة تأكيد الطلب (تظهر بعد إتمام الطلب)'],
  ]
  return (
    <div className="space-y-4">
      {rows.map(([k, label]) => (
        <Field key={k} label={label}>
          <TextArea className="min-h-[140px]" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
        </Field>
      ))}
      <button className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</button>
    </div>
  )
}

export default function SettingsAdmin() {
  const [tab, setTab] = useState<Tab>('general')
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">إعدادات المتجر</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'btn-dark btn-sm' : 'btn-outline btn-sm'}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="card p-4 sm:p-6">
        {tab === 'general' && <General />}
        {tab === 'payment' && <Payment />}
        {tab === 'policies' && <Policies />}
      </div>
    </div>
  )
}
