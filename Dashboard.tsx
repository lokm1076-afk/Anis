import { Link } from 'react-router-dom'
import { ErrorBox, Spinner } from '../components/ui'
import { formatDZD, ORDER_STATUS_LABEL, ORDER_STATUSES } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'

interface Stats {
  orders_total: number
  by_status: Record<string, number>
  sales_total: number
  delivered_sales: number
  available_qty: number
  reserved_qty: number
  low_stock: { product: string; batch: string; available: number }[]
}

async function loadStats(): Promise<Stats> {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) throw error
  return data as Stats
}

function Stat({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-ink-600">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(loadStats, [])
  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox message={error ?? 'تعذر تحميل الإحصائيات'} onRetry={reload} />
  const s = data.by_status

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">الإحصائيات</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="إجمالي الطلبات" value={data.orders_total} />
        <Stat label="إجمالي المبيعات (دون الملغاة)" value={formatDZD(data.sales_total)} tone="text-gold-700" />
        <Stat label="مبيعات مسلَّمة" value={formatDZD(data.delivered_sales)} tone="text-emerald-700" />
        <Stat label="ملكات متوفرة" value={data.available_qty} />
        <Stat label="ملكات محجوزة" value={data.reserved_qty} tone="text-amber-700" />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">الطلبات حسب الحالة</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ORDER_STATUSES.map((st) => (
            <Link key={st} to={`/admin/orders?status=${st}`} className="card p-4 transition hover:border-gold-400">
              <p className="text-sm font-semibold text-ink-600">{ORDER_STATUS_LABEL[st]}</p>
              <p className="mt-1 text-2xl font-black">{s[st] ?? 0}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">منتجات أوشكت على النفاد (5 أو أقل)</h2>
        {data.low_stock.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 p-4 text-ink-600">لا توجد منتجات قاربت على النفاد.</p>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {data.low_stock.map((l, i) => (
              <li key={i} className="flex items-center justify-between p-3">
                <span className="font-bold">{l.product} <span className="text-sm font-normal text-ink-600">— {l.batch}</span></span>
                <span className={`badge ${l.available <= 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                  {l.available <= 0 ? 'نفد' : `المتبقي ${l.available}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
