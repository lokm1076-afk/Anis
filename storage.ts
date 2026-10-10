import { MEDIA_BUCKET, supabase } from './supabase'

/** تصغير الصورة في المتصفح (حتى 1600px) وتحويلها إلى WebP لتسريع التحميل على الهاتف */
async function compress(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export interface UploadedImage {
  url: string
  path: string
}

export async function uploadImage(file: File, folder = 'misc'): Promise<UploadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('الملف المختار ليس صورة')
  if (file.size > 15 * 1024 * 1024) throw new Error('حجم الصورة كبير جدًا (الحد 15 ميغابايت)')
  const blob = await compress(file)
  const ext = blob.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: blob.type || file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

export async function deleteImage(path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from(MEDIA_BUCKET).remove([path])
}
