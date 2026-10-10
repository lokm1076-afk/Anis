import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Field, Spinner, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { isConfigured } from '../lib/supabase'
import { useSeo } from '../lib/seo'

const LINKS = [
  { to: '/admin', label: 'الإحصائيات', icon: '📊', end: true },
  { to: '/admin/products', label: 'المنتجات والمخزون', icon: '🐝' },
  { to: '/admin/orders', label: 'الطلبات', icon: '📦' },
  { to: '/admin/shipping', label: 'الولايات والتوصيل', icon: '🚚' },
  { to: '/admin/coupons', label: 'الخصومات', icon: '🏷️' },
  { to: '/admin/content', label: 'المحتوى', icon: '📝' },
  { to: '/admin/settings', label: 'إعدادات المتجر', icon: '⚙️' },
]

export function AdminLogin() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useSeo({ title: 'دخول المسؤول', noindex: true })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(await signIn(email.trim(), password))
    setBusy(false)
  }

  return (
    <div className="hex-bg flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-2xl font-black">⬡</div>
          <h1 className="mt-3 text-xl font-black">لوحة التحكم</h1>
          <p className="text-sm text-ink-600">دخول المسؤول فقط</p>
        </div>
        {!isConfigured && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
            لم يتم ضبط اتصال Supabase بعد. راجع ملف README (متغيرات VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY).
          </p>
        )}
        <Field label="البريد الإلكتروني">
          <TextInput dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="كلمة المرور">
          <TextInput dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارٍ الدخول...' : 'دخول'}</button>
        <Link to="/" className="block text-center text-sm font-bold text-ink-600 hover:text-gold-700">← العودة إلى المتجر</Link>
      </form>
    </div>
  )
}

export default function AdminLayout() {
  const { session, isAdmin, loading, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  useSeo({ title: 'لوحة التحكم', noindex: true })

  if (loading) return <Spinner />
  if (!session) return <AdminLogin />
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md space-y-3 p-6 text-center">
          <h1 className="text-xl font-black">ليس لديك صلاحية الدخول</h1>
          <p className="text-ink-600">هذا الحساب غير مسجَّل كمسؤول. راجع خطوة تعيين المسؤول في README.</p>
          <button className="btn-dark w-full" onClick={() => void signOut()}>تسجيل الخروج</button>
          <Link to="/" className="btn-outline w-full">العودة إلى المتجر</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink/[0.03]">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-ink px-4 text-white">
        <div className="flex items-center gap-3">
          <button className="btn btn-sm border border-white/30 text-white lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="القائمة">☰</button>
          <span className="font-extrabold text-gold-400">⬡ لوحة التحكم</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" target="_blank" className="btn btn-sm border border-white/30 text-white">المتجر ↗</Link>
          <button className="btn btn-sm bg-white/10 text-white" onClick={() => void signOut()}>خروج</button>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl">
        <aside
          className={`${open ? 'block' : 'hidden'} fixed inset-x-0 top-14 z-30 border-b border-ink/10 bg-white p-3 shadow-lg lg:static lg:block lg:min-h-[calc(100vh-3.5rem)] lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-l lg:shadow-none`}
        >
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3 font-bold ${isActive ? 'bg-ink text-gold-300' : 'hover:bg-ink/5'}`
                }
              >
                <span>{l.icon}</span>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
