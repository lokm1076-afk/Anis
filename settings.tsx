import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'

export interface GeneralSettings {
  store_name: string
  tagline: string
  description: string
  phone: string
  whatsapp: string
  email: string
  address: string
  logo_url: string
  primary_color: string
  social: { facebook: string; instagram: string; tiktok: string; youtube: string }
}

export interface HomeSettings {
  hero_title: string
  hero_text: string
  hero_cta: string
  hero_image_url: string
  about_title: string
  about_text: string
  featured_title: string
  virgin_title: string
  mated_title: string
  best_title: string
  features_title: string
  steps_title: string
  faq_title: string
  contact_title: string
  features: { title: string; text: string }[]
  steps: { title: string; text: string }[]
  show_featured: boolean
  show_virgin: boolean
  show_mated: boolean
  show_best: boolean
  show_features: boolean
  show_steps: boolean
  show_faq: boolean
}

export interface PolicySettings {
  terms: string
  cancellation: string
  privacy: string
  delivery_info: string
  order_confirmation: string
}

export interface PaymentMethod {
  id: string
  label: string
  enabled: boolean
  instructions: string
}

export interface FlagSettings {
  offers_enabled: boolean
}

export interface Settings {
  general: GeneralSettings
  home: HomeSettings
  policies: PolicySettings
  payment_methods: PaymentMethod[]
  flags: FlagSettings
}

export const DEFAULT_SETTINGS: Settings = {
  general: {
    store_name: 'مناحل انيس بن دحمان',
    tagline: 'ملكات نحل عذراء وملقحة',
    description: 'متجر متخصص في بيع ملكات النحل العذراء والملقحة في الجزائر.',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    logo_url: '',
    primary_color: '#d4a017',
    social: { facebook: '', instagram: '', tiktok: '', youtube: '' },
  },
  home: {
    hero_title: 'ملكات نحل مختارة بعناية لتطوير طوائفك',
    hero_text:
      'نوفر ملكات نحل عذراء وملقحة مع معلومات واضحة عن كل دفعة، وطلب سهل وتوصيل إلى الولايات المتاحة.',
    hero_cta: 'اكتشف منتجاتنا',
    hero_image_url: '',
    about_title: 'عن مناحل انيس بن دحمان',
    about_text: '',
    featured_title: 'الملكات المميزة',
    virgin_title: 'الملكات العذراء',
    mated_title: 'الملكات الملقحة',
    best_title: 'الأكثر طلبًا',
    features_title: 'لماذا نحن؟',
    steps_title: 'كيف تطلب؟',
    faq_title: 'الأسئلة الشائعة',
    contact_title: 'تواصل معنا',
    features: [
      { title: 'معلومات واضحة لكل دفعة', text: 'نعرض تفاصيل الدفعة وتواريخها كما يدخلها المتجر.' },
      { title: 'حجز مسبق للدفعات القادمة', text: 'احجز ملكاتك من دفعة مستقبلية بتاريخ تسليم متوقع.' },
      { title: 'توصيل إلى الولايات المتاحة', text: 'سعر التوصيل ومدته يظهران بوضوح قبل تأكيد الطلب.' },
      { title: 'تواصل مباشر عبر واتساب', text: 'اسأل واستشر قبل الطلب في أي وقت.' },
    ],
    steps: [
      { title: 'اختر الملكة', text: 'تصفح الملكات العذراء والملقحة المتوفرة.' },
      { title: 'أكمل الطلب', text: 'أضف إلى السلة واملأ بياناتك دون إنشاء حساب.' },
      { title: 'نؤكد طلبك', text: 'نتواصل معك لتأكيد الطلب وترتيب التسليم.' },
      { title: 'استلم طلبك', text: 'يصلك الطلب عبر شركة التوصيل وتتابعه برقم الطلب.' },
    ],
    show_featured: true,
    show_virgin: true,
    show_mated: true,
    show_best: true,
    show_features: true,
    show_steps: true,
    show_faq: true,
  },
  policies: {
    terms: '',
    cancellation: '',
    privacy: '',
    delivery_info: '',
    order_confirmation: 'شكرًا لطلبك! سنتواصل معك قريبًا لتأكيده.',
  },
  payment_methods: [
    { id: 'cod', label: 'الدفع عند الاستلام', enabled: true, instructions: '' },
  ],
  flags: { offers_enabled: false },
}

type Json = Record<string, unknown>

function merge<T>(defaults: T, override: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(override) ? override : defaults) as T
  }
  if (defaults && typeof defaults === 'object') {
    const out: Json = { ...(defaults as Json) }
    if (override && typeof override === 'object' && !Array.isArray(override)) {
      for (const k of Object.keys(override as Json)) {
        out[k] = k in (defaults as Json) ? merge((defaults as Json)[k], (override as Json)[k]) : (override as Json)[k]
      }
    }
    return out as T
  }
  return (override === undefined || override === null ? defaults : override) as T
}

interface Ctx {
  settings: Settings
  loading: boolean
  refresh: () => Promise<void>
}

const SettingsContext = createContext<Ctx>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  refresh: async () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('store_settings').select('key, value')
    const map: Json = {}
    for (const r of (data ?? []) as { key: string; value: unknown }[]) map[r.key] = r.value
    setSettings({
      general: merge(DEFAULT_SETTINGS.general, map.general),
      home: merge(DEFAULT_SETTINGS.home, map.home),
      policies: merge(DEFAULT_SETTINGS.policies, map.policies),
      payment_methods: merge(DEFAULT_SETTINGS.payment_methods, map.payment_methods),
      flags: merge(DEFAULT_SETTINGS.flags, map.flags),
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const c = settings.general.primary_color
    if (/^#[0-9a-fA-F]{6}$/.test(c)) document.documentElement.style.setProperty('--brand', c)
  }, [settings.general.primary_color])

  const value = useMemo(() => ({ settings, loading, refresh }), [settings, loading, refresh])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}

/** حفظ مفتاح إعدادات (للمسؤول) */
export async function saveSetting(key: string, value: unknown) {
  const { error } = await supabase
    .from('store_settings')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) throw error
}
