// lib/image-preprocessor.ts — v5.2
// Dùng Function('require') để bypass cả webpack bundle VÀ TypeScript type-check lúc build
// sharp/jimp không cần cài — nếu thiếu sẽ fallback pass-through, không block request

export interface PreprocessResult {
  b64: string
  mimeType: string
  blurScore: number
  wasEnhanced: boolean
  wasResized: boolean
  originalSize: { w: number; h: number }
  finalSize: { w: number; h: number }
  warnings: string[]
}

export interface PreprocessError {
  code: 'TOO_BLURRY' | 'INVALID_IMAGE' | 'PROCESS_FAILED'
  message: string
  blurScore?: number
}

const MAX_PX         = 1200
const BLUR_THRESHOLD = 18

// ─────────────────────────────────────────────────────────────────────────────
// Safe require — bypass webpack + TS checker hoàn toàn
// Function('require') tạo require mới ở runtime, không bị phân tích tĩnh
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const runtimeRequire = typeof require !== 'undefined'
  ? require
  : Function('require')('module').createRequire(import.meta.url)

function safeRequire<T>(mod: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return runtimeRequire(mod) as T
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Laplacian variance — đo độ sắc nét
// ─────────────────────────────────────────────────────────────────────────────

function computeLaplacianVariance(
  pixels: { [i: number]: number },
  width: number,
  height: number
): number {
  if (width < 3 || height < 3) return 100
  const values: number[] = []
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const v =
        -4 * pixels[i] +
        pixels[(y - 1) * width + x] +
        pixels[(y + 1) * width + x] +
        pixels[y * width + (x - 1)] +
        pixels[y * width + (x + 1)]
      values.push(v)
    }
  }
  if (!values.length) return 100
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.min(100, Math.round(Math.sqrt(variance) / 5))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sharp
// ─────────────────────────────────────────────────────────────────────────────

async function processWithSharp(b64: string): Promise<PreprocessResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharpModule = safeRequire<any>('sharp')
  if (!sharpModule) throw new Error('sharp not installed')

  const sharp = sharpModule.default ?? sharpModule
  const buf   = Buffer.from(b64, 'base64')
  const meta  = await sharp(buf).metadata()
  const origW = (meta.width  as number) ?? 0
  const origH = (meta.height as number) ?? 0

  const { data, info } = await sharp(buf).grayscale().raw().toBuffer({ resolveWithObject: true })
  const blurScore = computeLaplacianVariance(data as Buffer, info.width as number, info.height as number)

  if (blurScore < BLUR_THRESHOLD) {
    throw { code: 'TOO_BLURRY', message: `Ảnh quá mờ (điểm sắc nét: ${blurScore}/100). Vui lòng chụp lại ảnh rõ hơn.`, blurScore } as PreprocessError
  }

  const scale = Math.min(1, MAX_PX / Math.max(origW, origH, 1))
  const newW  = Math.round(origW * scale)
  const newH  = Math.round(origH * scale)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pipeline: any = sharp(buf)
  if (scale < 1) pipeline = pipeline.resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
  pipeline = pipeline.linear(1.12, -(128 * 0.12))
  const out = await pipeline.jpeg({ quality: 88 }).toBuffer()

  return {
    b64: (out as Buffer).toString('base64'), mimeType: 'image/jpeg',
    blurScore, wasEnhanced: true, wasResized: scale < 1,
    originalSize: { w: origW, h: origH },
    finalSize: { w: newW || origW, h: newH || origH },
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jimp
// ─────────────────────────────────────────────────────────────────────────────

async function processWithJimp(b64: string): Promise<PreprocessResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jimpModule = safeRequire<any>('jimp')
  if (!jimpModule) throw new Error('jimp not installed')

  const Jimp = jimpModule.default ?? jimpModule
  const buf  = Buffer.from(b64, 'base64')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const img: any = await Jimp.read(buf)
  const origW    = img.getWidth()  as number
  const origH    = img.getHeight() as number

  const pixels: number[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  img.clone().grayscale().scan(0, 0, origW, origH, function (this: any, x: number, y: number, idx: number) {
    if ((x + y) % 2 === 0) pixels.push(this.bitmap.data[idx] as number)
  })
  const blurScore = computeLaplacianVariance(pixels, Math.ceil(origW / 2), Math.ceil(origH / 2))

  if (blurScore < BLUR_THRESHOLD) {
    throw { code: 'TOO_BLURRY', message: `Ảnh quá mờ (điểm sắc nét: ${blurScore}/100). Vui lòng chụp lại ảnh rõ hơn.`, blurScore } as PreprocessError
  }

  const scale = Math.min(1, MAX_PX / Math.max(origW, origH, 1))
  if (scale < 1) img.resize(Math.round(origW * scale), Math.round(origH * scale))
  img.contrast(0.12)
  const out = await img.getBufferAsync(Jimp.MIME_JPEG) as Buffer

  return {
    b64: out.toString('base64'), mimeType: 'image/jpeg',
    blurScore, wasEnhanced: true, wasResized: scale < 1,
    originalSize: { w: origW, h: origH },
    finalSize: { w: img.getWidth() as number, h: img.getHeight() as number },
    warnings: ['Used Jimp fallback'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function preprocessImage(
  b64: string,
  mimeType: string,
  label: string
): Promise<PreprocessResult> {
  // Thử sharp
  try {
    const r = await processWithSharp(b64)
    console.log(`[preprocess] ${label}: blur=${r.blurScore}, sharp OK`)
    return r
  } catch (err) {
    if ((err as PreprocessError).code === 'TOO_BLURRY') throw err
    console.warn(`[preprocess] sharp failed for ${label}:`, (err as Error).message)
  }

  // Thử jimp
  try {
    const r = await processWithJimp(b64)
    console.log(`[preprocess] ${label}: blur=${r.blurScore}, jimp OK`)
    return r
  } catch (err) {
    if ((err as PreprocessError).code === 'TOO_BLURRY') throw err
    console.warn(`[preprocess] jimp failed for ${label}:`, (err as Error).message)
  }

  // Pass-through — không block request
  console.warn(`[preprocess] ${label}: both unavailable, passing original`)
  return {
    b64, mimeType, blurScore: 50,
    wasEnhanced: false, wasResized: false,
    originalSize: { w: 0, h: 0 }, finalSize: { w: 0, h: 0 },
    warnings: [`${label}: preprocessing skipped`],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchPreprocessResult {
  images: Array<{ b64: string; mimeType: string; label: string; blurScore: number }>
  blurredImages: string[]
  allBlurry: boolean
  warnings: string[]
}

export async function preprocessImages(
  images: Array<{ b64: string; mimeType: string; label: string }>
): Promise<BatchPreprocessResult> {
  const results = await Promise.allSettled(
    images.map(img => preprocessImage(img.b64, img.mimeType, img.label))
  )

  const processed: BatchPreprocessResult['images'] = []
  const blurredImages: string[] = []
  const warnings: string[] = []

  results.forEach((r, i) => {
    const { label, b64, mimeType } = images[i]
    if (r.status === 'fulfilled') {
      processed.push({ b64: r.value.b64, mimeType: r.value.mimeType, label, blurScore: r.value.blurScore })
      warnings.push(...r.value.warnings)
    } else {
      const err = r.reason as PreprocessError
      if (err?.code === 'TOO_BLURRY') {
        blurredImages.push(label)
      } else {
        processed.push({ b64, mimeType, label, blurScore: 50 })
      }
    }
  })

  processed.sort((a, b) => b.blurScore - a.blurScore)

  return { images: processed, blurredImages, allBlurry: processed.length === 0, warnings }
}
