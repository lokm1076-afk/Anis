import { useRef, useState } from 'react'
import { uploadImage } from '../lib/storage'
import { errMsg } from '../lib/supabase'
import { useToast } from './ui'

/** رفع صورة واحدة (شعار، صورة رئيسية، غلاف مقال) من الهاتف أو الحاسوب */
export default function SingleImageField({
  label,
  value,
  onChange,
  folder,
}: {
  label: string
  value: string
  onChange: (url: string) => void
  folder: string
}) {
  const toast = useToast()
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const up = await uploadImage(file, folder)
      onChange(up.url)
      toast('تم رفع الصورة')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink/15 bg-ink/5 text-xs text-ink-600">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : 'لا توجد'}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => ref.current?.click()}>
            {busy ? 'جارٍ الرفع...' : value ? 'تغيير الصورة' : 'رفع صورة'}
          </button>
          {value && (
            <button type="button" className="btn-outline btn-sm" onClick={() => onChange('')}>
              إزالة
            </button>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}
