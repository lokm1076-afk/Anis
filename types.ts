export type QueenType = 'virgin' | 'mated'
export type DeliveryMethod = 'home' | 'office' | 'pickup'
export type OrderStatus =
  | 'new'
  | 'pending_customer'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'undeliverable'

export interface ProductImage {
  id: string
  product_id: string
  url: string
  storage_path: string | null
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

export interface Product {
  id: string
  slug: string
  name: string
  short_description: string | null
  description: string | null
  queen_type: QueenType
  is_offer: boolean
  breed: string | null
  price: number
  sale_price: number | null
  max_per_order: number | null
  delivery_notes: string | null
  is_active: boolean
  is_featured: boolean
  is_best_seller: boolean
  sort_order: number
  seo_title: string | null
  seo_description: string | null
  created_at: string
}

/** الدفعة كما يراها الزائر (من العرض public_batches) */
export interface PublicBatch {
  id: string
  product_id: string
  label: string
  batch_code: string | null
  hatch_date: string | null
  mating_date: string | null
  production_date: string | null
  available_qty: number
  is_preorder: boolean
  preorder_start: string | null
  preorder_end: string | null
  expected_delivery_date: string | null
  deposit_amount: number
  cancellation_terms: string | null
  is_open: boolean
}

/** الدفعة كاملة (للمسؤول) */
export interface AdminBatch extends Omit<PublicBatch, 'available_qty'> {
  total_qty: number
  reserved_qty: number
  sold_qty: number
  manual_reserved_qty: number
  available_qty: number
  is_active: boolean
}

export type StockStatus = 'available' | 'preorder' | 'out_of_stock' | 'closed'

export interface StoreProduct extends Product {
  images: ProductImage[]
  batches: PublicBatch[]
  stock_status: StockStatus
  available_total: number
  /** الدفعة التي يمكن الطلب منها الآن (إن وجدت) */
  orderable_batch: PublicBatch | null
}

export interface Wilaya {
  id: number
  name_ar: string
  name_fr: string | null
  is_active: boolean
  orders_paused: boolean
  delivery_time: string | null
  min_order: number
  carriers: string | null
  notes: string | null
  sort_order: number
}

export interface ShippingRate {
  id: number
  wilaya_id: number
  method: DeliveryMethod
  price: number
  is_enabled: boolean
}

export interface Commune {
  id: number
  wilaya_id: number
  name_ar: string
  is_active: boolean
}

export interface Coupon {
  id: string
  code: string
  discount_type: 'fixed' | 'percent'
  value: number
  starts_at: string | null
  ends_at: string | null
  min_order: number
  max_uses: number | null
  used_count: number
  is_active: boolean
}

export interface Order {
  id: string
  order_number: string
  status: OrderStatus
  customer_name: string
  phone: string
  whatsapp: string | null
  wilaya_id: number
  wilaya_name: string
  commune_name: string
  address: string
  delivery_method: DeliveryMethod
  payment_method: string
  notes: string | null
  subtotal: number
  shipping_cost: number
  discount_total: number
  total: number
  deposit_total: number
  coupon_code: string | null
  tracking_number: string | null
  carrier: string | null
  internal_notes: string | null
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_name: string
  batch_label: string | null
  queen_type: string | null
  is_preorder: boolean
  unit_price: number
  qty: number
  line_total: number
}

export interface StatusHistory {
  id: number
  order_id: string
  from_status: string | null
  to_status: string
  note: string | null
  created_at: string
}

export interface Faq {
  id: string
  question: string
  answer: string
  sort_order: number
  is_active: boolean
}

export interface Article {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body: string | null
  cover_url: string | null
  is_published: boolean
  created_at: string
}

export interface QuoteLine {
  product_id: string
  batch_id: string
  product_name: string
  batch_label: string
  queen_type: QueenType
  is_preorder: boolean
  unit_price: number
  qty: number
  line_total: number
  expected_delivery_date: string | null
}

export interface Quote {
  lines: QuoteLine[]
  subtotal: number
  shipping: number
  discount: number
  total: number
  deposit: number
  coupon_code: string | null
  wilaya_name: string
  delivery_time: string | null
}

export interface PlacedOrder extends Quote {
  order_number: string
  status: OrderStatus
  payment_method: string
  delivery_method: DeliveryMethod
  customer_name: string
}
