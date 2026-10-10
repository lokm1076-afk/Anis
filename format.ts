import type { DeliveryMethod, OrderStatus, QueenType, StockStatus } from './types'

export function formatDZD(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  const rounded = Math.round(v * 100) / 100
  const s = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(rounded)
  return `${s} دج`
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-DZ-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-DZ-u-nu-latn', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const QUEEN_TYPE_LABEL: Record<QueenType, string> = {
  virgin: 'ملكة عذراء',
  mated: 'ملكة ملقحة',
}

export const STOCK_LABEL: Record<StockStatus, string> = {
  available: 'متوفر',
  preorder: 'الحجز المسبق',
  out_of_stock: 'نفد المخزون',
  closed: 'الطلب مغلق حاليًا',
}

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  home: 'توصيل إلى المنزل',
  office: 'توصيل إلى المكتب (مكتب شركة التوصيل)',
  pickup: 'استلام من نقطة الاستلام',
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'طلب جديد',
  pending_customer: 'بانتظار تأكيد العميل',
  confirmed: 'مؤكد',
  preparing: 'قيد التحضير',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
  undeliverable: 'تعذر التسليم',
}

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  pending_customer: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  preparing: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
  undeliverable: 'bg-orange-100 text-orange-800',
}

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]

/** رابط واتساب من رقم جزائري (0555123456 أو +213555123456) */
export function waLink(number: string | undefined, text?: string): string {
  const digits = (number || '').replace(/[^0-9]/g, '')
  let intl = digits
  if (digits.startsWith('00')) intl = digits.slice(2)
  else if (digits.startsWith('0')) intl = '213' + digits.slice(1)
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${intl}${q}`
}

export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^؀-ۿa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `item-${Date.now().toString(36)}`
}

export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function localInputToIso(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
