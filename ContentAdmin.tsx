import { useEffect, useState } from 'react'
import SingleImageField from '../components/SingleImageField'
import { ConfirmButton, Empty, ErrorBox, Field, Modal, Spinner, Switch, TextArea, TextInput, useToast } from '../components/ui'
import { slugify } from '../lib/format'
import { saveSetting, useSettings } from '../lib/settings'
import type { HomeSettings } from '../lib/settings'
import { errMsg, supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { Article, Faq } from '../lib/types'

type Tab = 'home' | 'faq' | 'articles'

function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string
  items: { title: string; text: string }[]
  onChange: (v: { title: string; text: string }[]) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold">{label}</h3>
        <button type="button" className="btn-outline btn-sm" onClick={() => onChange([...items, { title: '', text: '' }])}>＋ إضافة</button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-ink/10 p-3">
          <TextInput placeholder="العنوان" value={it.title} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <TextArea placeholder="النص" value={it.text} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <button type="button" className="btn-danger btn-sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>حذف</button>
        </div>
      ))}
    </div>
  )
}

function HomeEditor() {
  const { settings, refresh } = useSettings()
  const toast = useToast()
  const [h, setH] = useState<HomeSettings>(settings.home)
  const [busy, setBusy] = useState(false)
  useEffect(() => setH(settings.home), [settings.home])
  const set = <K extends keyof HomeSettings>(k: K, v: HomeSettings[K]) => setH({ ...h, [k]: v })

  async function save() {
    setBusy(true)
    try {
      await saveSetting('home', h)
      await refresh()
      toast('تم حفظ محتوى الصفحة الرئيسية')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const titles: [keyof HomeSettings, string, keyof HomeSettings | null][] = [
    ['featured_title', 'عنوان قسم الملكات المميزة', 'show_featured'],
    ['virgin_title', 'عنوان قسم الملكات العذراء', 'show_virgin'],
    ['mated_title', 'عنوان قسم الملكات الملقحة', 'show_mated'],
    ['best_title', 'عنوان قسم الأكثر طلبًا', 'show_best'],
    ['features_title', 'عنوان قسم المميزات', 'show_features'],
    ['steps_title', 'عنوان قسم طريقة الطلب', 'show_steps'],
    ['faq_title', 'عنوان قسم الأسئلة الشائعة', 'show_faq'],
    ['contact_title', 'عنوان قسم الاتصال', null],
  ]

  return (
    <div className="space-y-5">
      <SingleImageField label="الصورة الرئيسية (ملكة على إطار حضنة)" value={h.hero_image_url} onChange={(v) => set('hero_image_url', v)} folder="home" />
      <Field label="العنوان الرئيسي"><TextInput value={h.hero_title} onChange={(e) => set('hero_title', e.target.value)} /></Field>
      <Field label="الوصف المختصر"><TextArea value={h.hero_text} onChange={(e) => set('hero_text', e.target.value)} /></Field>
      <Field label="نص الزر"><TextInput value={h.hero_cta} onChange={(e) => set('hero_cta', e.target.value)} /></Field>
      <Field label="عنوان قسم «عن المتجر»"><TextInput value={h.about_title} onChange={(e) => set('about_title', e.target.value)} /></Field>
      <Field label="نص «عن المتجر»" hint="اتركه فارغًا لإخفاء القسم"><TextArea value={h.about_text} onChange={(e) => set('about_text', e.target.value)} /></Field>

      <div className="space-y-3">
        <h3 className="font-extrabold">عناوين الأقسام وإظهارها</h3>
        {titles.map(([k, label, show]) => (
          <div key={k} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
            <Field label={label}><TextInput value={String(h[k])} onChange={(e) => set(k, e.target.value as never)} /></Field>
            {show && <Switch checked={Boolean(h[show])} onChange={(v) => set(show, v as never)} label="إظهار" />}
          </div>
        ))}
      </div>

      <ListEditor label="مميزات المتجر" items={h.features} onChange={(v) => set('features', v)} />
      <ListEditor label="خطوات الطلب والتوصيل" items={h.steps} onChange={(v) => set('steps', v)} />

      <button className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</button>
    </div>
  )
}

function FaqEditor() {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('faqs').select('*').order('sort_order')
    if (error) throw error
    return (data ?? []) as Faq[]
  }, [])
  const [form, setForm] = useState<Partial<Faq> | null>(null)

  async function save() {
    if (!form?.question?.trim() || !form.answer?.trim()) return toast('اكتب السؤال والجواب', 'error')
    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      sort_order: Number(form.sort_order ?? (data?.length ?? 0) + 1),
      is_active: form.is_active ?? true,
    }
    const { error: e } = form.id
      ? await supabase.from('faqs').update(payload).eq('id', form.id)
      : await supabase.from('faqs').insert(payload)
    if (e) return toast(errMsg(e), 'error')
    toast('تم الحفظ')
    setForm(null)
    void reload()
  }

  async function remove(f: Faq) {
    const { error: e } = await supabase.from('faqs').delete().eq('id', f.id)
    if (e) return toast(errMsg(e), 'error')
    void reload()
  }

  if (loading && !data) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  return (
    <div className="space-y-3">
      <button className="btn-primary" onClick={() => setForm({ is_active: true, sort_order: (data?.length ?? 0) + 1 })}>＋ سؤال جديد</button>
      {(data?.length ?? 0) === 0 && <Empty>لا توجد أسئلة.</Empty>}
      {data?.map((f) => (
        <div key={f.id} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{f.question} {!f.is_active && <span className="badge bg-red-100 text-red-800">مخفي</span>}</p>
            <p className="line-clamp-2 text-sm text-ink-600">{f.answer}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-dark btn-sm" onClick={() => setForm(f)}>تعديل</button>
            <ConfirmButton message="حذف هذا السؤال؟" onConfirm={() => void remove(f)}>حذف</ConfirmButton>
          </div>
        </div>
      ))}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'تعديل سؤال' : 'سؤال جديد'}>
        {form && (
          <div className="space-y-3">
            <Field label="السؤال"><TextInput value={form.question ?? ''} onChange={(e) => setForm({ ...form, question: e.target.value })} /></Field>
            <Field label="الجواب"><TextArea value={form.answer ?? ''} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></Field>
            <Field label="الترتيب"><TextInput type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
            <Switch checked={form.is_active ?? true} onChange={(v) => setForm({ ...form, is_active: v })} label="ظاهر" />
            <button className="btn-primary w-full" onClick={() => void save()}>حفظ</button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ArticlesEditor() {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('articles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Article[]
  }, [])
  const [form, setForm] = useState<Partial<Article> | null>(null)

  async function save() {
    if (!form?.title?.trim()) return toast('عنوان المقال مطلوب', 'error')
    const payload = {
      title: form.title.trim(),
      slug: form.slug?.trim() || slugify(form.title),
      excerpt: form.excerpt?.trim() || null,
      body: form.body?.trim() || null,
      cover_url: form.cover_url || null,
      is_published: form.is_published ?? false,
    }
    const { error: e } = form.id
      ? await supabase.from('articles').update(payload).eq('id', form.id)
      : await supabase.from('articles').insert(payload)
    if (e) return toast(errMsg(e), 'error')
    toast('تم حفظ المقال')
    setForm(null)
    void reload()
  }

  async function remove(a: Article) {
    const { error: e } = await supabase.from('articles').delete().eq('id', a.id)
    if (e) return toast(errMsg(e), 'error')
    void reload()
  }

  if (loading && !data) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  return (
    <div className="space-y-3">
      <button className="btn-primary" onClick={() => setForm({ is_published: false })}>＋ مقال جديد</button>
      {(data?.length ?? 0) === 0 && <Empty>لا توجد مقالات.</Empty>}
      {data?.map((a) => (
        <div key={a.id} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 font-extrabold">
            {a.title} <span className={`badge ${a.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-ink/10'}`}>{a.is_published ? 'منشور' : 'مسودة'}</span>
          </p>
          <div className="flex gap-2">
            <button className="btn-dark btn-sm" onClick={() => setForm(a)}>تعديل</button>
            <ConfirmButton message={`حذف المقال «${a.title}»؟`} onConfirm={() => void remove(a)}>حذف</ConfirmButton>
          </div>
        </div>
      ))}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'تعديل مقال' : 'مقال جديد'} wide>
        {form && (
          <div className="space-y-3">
            <Field label="العنوان"><TextInput value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="الرابط (اختياري)" hint="يُولَّد تلقائيًا من العنوان"><TextInput dir="ltr" value={form.slug ?? ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
            <SingleImageField label="صورة الغلاف" value={form.cover_url ?? ''} onChange={(v) => setForm({ ...form, cover_url: v })} folder="articles" />
            <Field label="مقتطف قصير"><TextArea value={form.excerpt ?? ''} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></Field>
            <Field label="نص المقال"><TextArea className="min-h-[240px]" value={form.body ?? ''} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <Switch checked={form.is_published ?? false} onChange={(v) => setForm({ ...form, is_published: v })} label="نشر المقال" />
            <button className="btn-primary w-full" onClick={() => void save()}>حفظ</button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function ContentAdmin() {
  const [tab, setTab] = useState<Tab>('home')
  const tabs: [Tab, string][] = [
    ['home', 'الصفحة الرئيسية'],
    ['faq', 'الأسئلة الشائعة'],
    ['articles', 'المقالات التعليمية'],
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">إدارة المحتوى</h1>
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={tab === id ? 'btn-dark btn-sm' : 'btn-outline btn-sm'}>{label}</button>
        ))}
      </div>
      <div className="card p-4 sm:p-6">
        {tab === 'home' && <HomeEditor />}
        {tab === 'faq' && <FaqEditor />}
        {tab === 'articles' && <ArticlesEditor />}
      </div>
    </div>
  )
}
