import { useEffect } from 'react'

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

interface SeoOptions {
  title: string
  description?: string
  image?: string | null
  jsonLd?: Record<string, unknown> | null
  noindex?: boolean
}

/** عنوان ووصف خاصان بكل صفحة + Open Graph + بيانات منظمة اختيارية */
export function useSeo({ title, description, image, jsonLd, noindex }: SeoOptions) {
  useEffect(() => {
    document.title = title
    if (description) {
      setMeta('description', description)
      setMeta('og:description', description, 'property')
    }
    setMeta('og:title', title, 'property')
    setMeta('og:type', 'website', 'property')
    setMeta('og:locale', 'ar_DZ', 'property')
    if (image) setMeta('og:image', image, 'property')
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow')

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = window.location.origin + window.location.pathname

    const id = 'json-ld-page'
    document.getElementById(id)?.remove()
    if (jsonLd) {
      const s = document.createElement('script')
      s.type = 'application/ld+json'
      s.id = id
      s.text = JSON.stringify(jsonLd)
      document.head.appendChild(s)
    }
    return () => {
      document.getElementById(id)?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, image, noindex, JSON.stringify(jsonLd ?? null)])
}
