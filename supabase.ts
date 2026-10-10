import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anon)

// المفتاح anon عام بطبيعته، والحماية الفعلية تأتي من سياسات RLS في قاعدة البيانات.
export const supabase = createClient(url || 'http://localhost:54321', anon || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const MEDIA_BUCKET = 'store-media'

/** رسالة خطأ مفهومة للمستخدم من خطأ Supabase */
export function errMsg(e: unknown): string {
  if (!e) return 'حدث خطأ غير متوقع'
  const any = e as { message?: string; code?: string }
  const m = any.message || ''
  if (any.code === '23514' || m.includes('chk_no_oversell')) {
    return 'الكمية غير كافية: لا يمكن أن يتجاوز المحجوز والمباع إجمالي الكمية'
  }
  if (any.code === '23505') return 'القيمة موجودة مسبقًا (تكرار)'
  if (any.code === '23503') {
    return 'لا يمكن الحذف لأن العنصر مرتبط بطلبات أو بيانات أخرى. يمكنك إخفاؤه بدلًا من ذلك'
  }
  if (any.code === '42501' || m.includes('row-level security')) return 'غير مصرح لك بهذه العملية'
  if (m === 'Failed to fetch') return 'تعذر الاتصال بالخادم، تحقق من الإنترنت'
  return m || 'حدث خطأ غير متوقع'
}
