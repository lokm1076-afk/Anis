// يولّد public/sitemap.xml قبل البناء من المنتجات والمقالات المنشورة في Supabase.
// المتغيرات: SITE_URL (رابط الموقع النهائي)، VITE_SUPABASE_URL، VITE_SUPABASE_ANON_KEY
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

const site = (process.env.SITE_URL || '').replace(/\/+$/, '')
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!site) {
  console.warn('[sitemap] SITE_URL غير مضبوط: لن يُنشأ sitemap.xml. اضبطه مثل https://example.dz')
  process.exit(0)
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const entries = ['/', '/products', '/articles', '/contact', '/track'].map((p) => ({ loc: site + p }))

async function rows(table, select, filter) {
  if (!url || !key) return []
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}&${filter}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(String(res.status))
    return await res.json()
  } catch (e) {
    console.warn(`[sitemap] تعذر جلب ${table}:`, e.message)
    return []
  }
}

for (const p of await rows('products', 'slug,updated_at', 'is_active=eq.true'))
  entries.push({ loc: `${site}/products/${encodeURIComponent(p.slug)}`, lastmod: p.updated_at })
for (const a of await rows('articles', 'slug,updated_at', 'is_published=eq.true'))
  entries.push({ loc: `${site}/articles/${encodeURIComponent(a.slug)}`, lastmod: a.updated_at })

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  entries
    .map((e) => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`)
    .join('\n') +
  '\n</urlset>\n'
writeFileSync('public/sitemap.xml', xml)
writeFileSync('public/robots.txt', `User-agent: *\nDisallow: /admin\nSitemap: ${site}/sitemap.xml\n`)
console.log(`[sitemap] ${entries.length} رابطًا → public/sitemap.xml`)
