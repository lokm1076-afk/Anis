import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { useSettings } from '../lib/settings'
import { waLink } from '../lib/format'

export function Logo({ dark = false }: { dark?: boolean }) {
  const { settings } = useSettings()
  const g = settings.general
  return (
    <Link to="/" className="flex items-center gap-2" aria-label={g.store_name}>
      {g.logo_url ? (
        <img src={g.logo_url} alt={g.store_name} className="h-10 w-10 rounded-lg object-cover" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-xl font-black text-ink">
          ⬡
        </span>
      )}
      <span className={`text-lg font-extrabold leading-tight ${dark ? 'text-white' : 'text-ink'}`}>
        {g.store_name}
      </span>
    </Link>
  )
}

const NAV = [
  { to: '/', label: 'الرئيسية', end: true },
  { to: '/products', label: 'المنتجات' },
  { to: '/articles', label: 'مقالات تعليمية' },
  { to: '/track', label: 'تتبع طلبك' },
  { to: '/contact', label: 'تواصل معنا' },
]

function Header() {
  const [open, setOpen] = useState(false)
  const { count } = useCart()
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-white">
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Logo dark />
        <nav className="hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-bold transition hover:text-gold-300 ${isActive ? 'text-gold-400' : 'text-white/90'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/cart" className="btn-primary btn-sm relative" aria-label="السلة">
            🛒 السلة
            {count > 0 && (
              <span className="absolute -top-2 -left-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-xs font-black text-ink">
                {count}
              </span>
            )}
          </Link>
          <button
            className="btn btn-sm border border-white/30 text-white md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="القائمة"
          >
            ☰
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/10 bg-ink-800 md:hidden" aria-label="قائمة الهاتف">
          <div className="container-x flex flex-col py-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-bold text-white/90 hover:text-gold-300"
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}

function Footer() {
  const { settings } = useSettings()
  const g = settings.general
  const social = Object.entries(g.social).filter(([, v]) => v)
  const names: Record<string, string> = {
    facebook: 'فيسبوك',
    instagram: 'إنستغرام',
    tiktok: 'تيك توك',
    youtube: 'يوتيوب',
  }
  return (
    <footer className="mt-16 bg-ink text-white/80">
      <div className="container-x grid gap-8 py-10 md:grid-cols-3">
        <div>
          <Logo dark />
          <p className="mt-3 text-sm leading-7">{g.description}</p>
        </div>
        <div>
          <h3 className="mb-3 font-extrabold text-gold-400">روابط</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/products" className="hover:text-gold-300">المنتجات</Link></li>
            <li><Link to="/track" className="hover:text-gold-300">تتبع طلبك</Link></li>
            <li><Link to="/page/terms" className="hover:text-gold-300">شروط البيع والحجز</Link></li>
            <li><Link to="/page/cancellation" className="hover:text-gold-300">سياسة الإلغاء والاسترجاع</Link></li>
            <li><Link to="/page/privacy" className="hover:text-gold-300">سياسة الخصوصية</Link></li>
            <li><Link to="/page/delivery" className="hover:text-gold-300">معلومات التوصيل</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-extrabold text-gold-400">تواصل معنا</h3>
          <ul className="space-y-2 text-sm">
            {g.phone && <li dir="ltr" className="text-right">📞 {g.phone}</li>}
            {g.email && <li dir="ltr" className="text-right">✉️ {g.email}</li>}
            {g.address && <li>📍 {g.address}</li>}
            {social.map(([k, v]) => (
              <li key={k}>
                <a href={v} target="_blank" rel="noopener noreferrer" className="hover:text-gold-300">
                  {names[k] ?? k}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs">
        © {new Date().getFullYear()} {g.store_name}. جميع الحقوق محفوظة.
      </div>
    </footer>
  )
}

function WhatsAppFloat() {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const num = settings.general.whatsapp
  if (!num || pathname.startsWith('/admin')) return null
  return (
    <a
      href={waLink(num, `السلام عليكم، أريد الاستفسار عن ملكات النحل في ${settings.general.store_name}`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل عبر واتساب"
      className="fixed bottom-4 left-4 z-40 flex h-14 items-center gap-2 rounded-full bg-[#25D366] px-5 text-base font-extrabold text-white shadow-xl active:scale-95"
    >
      <span className="text-2xl">💬</span>
      <span>واتساب</span>
    </a>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  // العودة لأعلى الصفحة عند التنقل
  useScrollTop(pathname)
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  )
}

import { useEffect } from 'react'
function useScrollTop(key: string) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [key])
}
