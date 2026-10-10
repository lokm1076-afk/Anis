import { supabase } from './supabase'
import type {
  Article,
  DeliveryMethod,
  Faq,
  PlacedOrder,
  Product,
  ProductImage,
  PublicBatch,
  Quote,
  ShippingRate,
  StockStatus,
  StoreProduct,
  Wilaya,
  Commune,
} from './types'

/** هل يمكن الطلب من هذه الدفعة الآن؟ (التحقق النهائي يتم على الخادم) */
export function batchOrderable(b: PublicBatch, now = Date.now()): boolean {
  if (!b.is_open || b.available_qty <= 0) return false
  if (b.is_preorder) {
    if (b.preorder_start && now < new Date(b.preorder_start).getTime()) return false
    if (b.preorder_end && now > new Date(b.preorder_end).getTime()) return false
  }
  return true
}

export function decorateProduct(
  p: Product,
  images: ProductImage[],
  batches: PublicBatch[],
): StoreProduct {
  const sortedImages = [...images].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  )
  const orderable = batches.filter((b) => batchOrderable(b))
  const regular = orderable.find((b) => !b.is_preorder)
  const pre = orderable.find((b) => b.is_preorder)
  const available_total = batches.reduce((s, b) => s + Math.max(b.available_qty, 0), 0)
  let stock_status: StockStatus
  if (regular) stock_status = 'available'
  else if (pre) stock_status = 'preorder'
  else if (available_total > 0) stock_status = 'closed'
  else stock_status = 'out_of_stock'
  return {
    ...p,
    images: sortedImages,
    batches,
    stock_status,
    available_total,
    orderable_batch: regular ?? pre ?? null,
  }
}

async function attach(products: Product[]): Promise<StoreProduct[]> {
  if (products.length === 0) return []
  const ids = products.map((p) => p.id)
  const [imgs, bats] = await Promise.all([
    supabase.from('product_images').select('*').in('product_id', ids),
    supabase.from('public_batches').select('*').in('product_id', ids),
  ])
  if (imgs.error) throw imgs.error
  if (bats.error) throw bats.error
  const imgMap = new Map<string, ProductImage[]>()
  for (const i of (imgs.data ?? []) as ProductImage[]) {
    imgMap.set(i.product_id, [...(imgMap.get(i.product_id) ?? []), i])
  }
  const batMap = new Map<string, PublicBatch[]>()
  for (const b of (bats.data ?? []) as PublicBatch[]) {
    batMap.set(b.product_id, [...(batMap.get(b.product_id) ?? []), b])
  }
  return products.map((p) => decorateProduct(p, imgMap.get(p.id) ?? [], batMap.get(p.id) ?? []))
}

export async function fetchProducts(): Promise<StoreProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return attach((data ?? []) as Product[])
}

export async function fetchProductBySlug(slug: string): Promise<StoreProduct | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const [p] = await attach([data as Product])
  return p ?? null
}

export async function fetchDeliveryWilayas(): Promise<Wilaya[]> {
  const { data, error } = await supabase
    .from('wilayas')
    .select('*')
    .eq('is_active', true)
    .order('id')
  if (error) throw error
  return (data ?? []) as Wilaya[]
}

export async function fetchAllWilayasPublic(): Promise<Wilaya[]> {
  const { data, error } = await supabase.from('wilayas').select('*').order('id')
  if (error) throw error
  return (data ?? []) as Wilaya[]
}

export async function fetchRates(wilayaId: number): Promise<ShippingRate[]> {
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('*')
    .eq('wilaya_id', wilayaId)
    .eq('is_enabled', true)
  if (error) throw error
  return (data ?? []) as ShippingRate[]
}

export async function fetchCommunes(wilayaId: number): Promise<Commune[]> {
  const { data, error } = await supabase
    .from('communes')
    .select('*')
    .eq('wilaya_id', wilayaId)
    .eq('is_active', true)
    .order('name_ar')
  if (error) throw error
  return (data ?? []) as Commune[]
}

export async function fetchFaqs(): Promise<Faq[]> {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as Faq[]
}

export async function fetchArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Article[]
}

export async function fetchArticle(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  if (error) throw error
  return (data as Article | null) ?? null
}

export interface CartLinePayload {
  batch_id: string
  qty: number
}

export async function quoteOrder(
  items: CartLinePayload[],
  wilayaId: number,
  method: DeliveryMethod,
  coupon: string | null,
): Promise<Quote> {
  const { data, error } = await supabase.rpc('quote_order', {
    p_items: items,
    p_wilaya: wilayaId,
    p_method: method,
    p_coupon: coupon && coupon.trim() ? coupon.trim() : null,
  })
  if (error) throw error
  return data as Quote
}

export interface PlaceOrderInput {
  items: CartLinePayload[]
  customer_name: string
  phone: string
  whatsapp: string
  wilaya_id: number
  commune: string
  address: string
  delivery_method: DeliveryMethod
  payment_method: string
  notes: string
  coupon: string
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const { data, error } = await supabase.rpc('place_order', { p_order: input })
  if (error) throw error
  return data as PlacedOrder
}

export interface TrackedOrder {
  order_number: string
  status: import('./types').OrderStatus
  created_at: string
  wilaya_name: string
  subtotal: number
  shipping_cost: number
  discount_total: number
  total: number
  deposit_total: number
  tracking_number: string | null
  carrier: string | null
  items: { product_name: string; qty: number; line_total: number }[]
  history: { to_status: import('./types').OrderStatus; created_at: string }[]
}

export async function trackOrder(orderNumber: string, phone: string): Promise<TrackedOrder> {
  const { data, error } = await supabase.rpc('track_order', {
    p_order_number: orderNumber,
    p_phone: phone,
  })
  if (error) throw error
  return data as TrackedOrder
}
