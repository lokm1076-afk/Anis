import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { QueenType } from './types'

export interface CartItem {
  batchId: string
  productId: string
  slug: string
  name: string
  image: string | null
  unitPrice: number // للعرض فقط؛ السعر النهائي يحسبه الخادم
  qty: number
  maxQty: number // أقصى كمية يمكن طلبها (المتاح والحد الأقصى للطلب)
  queenType: QueenType
  isPreorder: boolean
  batchLabel: string
}

interface CartCtx {
  items: CartItem[]
  count: number
  subtotal: number
  add: (item: CartItem) => string | null
  setQty: (batchId: string, qty: number) => void
  remove: (batchId: string) => void
  clear: () => void
}

const KEY = 'anis-cart-v1'
const Ctx = createContext<CartCtx | null>(null)

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      /* التخزين غير متاح: تبقى السلة في الذاكرة فقط */
    }
  }, [items])

  const value = useMemo<CartCtx>(() => {
    return {
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.unitPrice * i.qty, 0),
      add: (item) => {
        const existing = items.find((i) => i.batchId === item.batchId)
        const nextQty = (existing?.qty ?? 0) + item.qty
        if (nextQty > item.maxQty) {
          return `الحد الأقصى للكمية المتاحة لك هو ${item.maxQty}`
        }
        setItems((prev) =>
          existing
            ? prev.map((i) => (i.batchId === item.batchId ? { ...item, qty: nextQty } : i))
            : [...prev, item],
        )
        return null
      },
      setQty: (batchId, qty) =>
        setItems((prev) =>
          prev.map((i) =>
            i.batchId === batchId ? { ...i, qty: Math.max(1, Math.min(qty, i.maxQty)) } : i,
          ),
        ),
      remove: (batchId) => setItems((prev) => prev.filter((i) => i.batchId !== batchId)),
      clear: () => setItems([]),
    }
  }, [items])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart(): CartCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart must be used inside CartProvider')
  return c
}
