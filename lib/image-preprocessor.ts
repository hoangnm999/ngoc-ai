// lib/image-preprocessor.ts
// v5.1 — Dynamic import với webpackIgnore để Next.js không bundle sharp/jimp lúc build
// Cần cài: npm install sharp jimp  (hoặc chỉ jimp nếu không cần sharp)
// Nếu chưa cài: preprocessor tự fallback về "pass-through" — không block request

export interface PreprocessResult {
  b64: string
  mimeType: string
  blurScore: number    // 0-100, càng cao càng sắc nét
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

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PX          = 1200   // resize về max 1200px
const BLUR_THRESHOLD  = 18     // dưới ngưỡng → TOO_BLURRY
const CONTRAST_FACTOR = 1.12   // tăng contrast 12%

// ─────────────────────────────────────────────────────────────────────────────
// Laplacian variance — đo độ sắc nét
// ─────────────────────────────────────────────────────────────────────────────

function computeLaplacianVariance(
  grayPixels: Uint8Array | number[],
  width: number,
  height: number
): number {
  if (width < 3 || height < 3) return 100

  const laplacian: number[] = []
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const val =
        -4 * grayPixels[idx] +
        grayPixels[(y - 1) * width + x] +
        grayPixels[(y + 1) * width + x] +
        grayPixels[y * width + (x - 1)] +
        grayPixels[y * width + (x + 1)]
      laplacian.push(val)
    }
  }
  if (laplacian.length === 0) return 100
  const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length
  const variance = laplacian.reduce((a, b) => a + (b - mean) ** 2, 0) / laplacian.length
  return Math.min(100, Math.round(Math.sqrt(variance) / 5))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sharp — dynamic import với webpackIgnore
// Next.js sẽ KHÔNG bundle module này lúc build
// ─────────────────────────────────────────────────────────────────────────────

async function processWithSharp(b64: string): Promise<PreprocessResult> {
  // webpackIgnore: true → Next.js bỏ qua lúc bundle, chỉ load lúc runtime
  const sharp = await import(/* webpackIgnore: true */ 'sharp').then(m => m.default || m)

  const inputBuffer = Buffer.from(b64, 'base64')
  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width ?? 0
  const origH = meta.height ?? 0

  const { data: grayData, info } = await sharp(inputBuffer)
    .grayscale().raw().toBuffer({ resolveWithObject: true })

  const blurScore = computeLaplacianVariance(grayData, info.width, info.height)

  if (blurScore < BLUR_THRESHOLD) {
    throw { code: 'TOO_BLURRY', message: `Ảnh quá mờ (điểm sắc nét: ${blurScore}/100). Vui lòng chụp lại ảnh rõ hơn.`, blurScore } as PreprocessError
  }

  const scale = Math.min(1, MAX_PX / Math.max(origW, origH, 1))
  const newW  = Math.round(origW * scale)
  const newH  = Math.round(origH * scale)

  let pipeline = sharp(inputBuffer)
  if (scale < 1) pipeline = pipeline.resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
  pipeline = pipeline.linear(CONTRAST_FACTOR, -(128 * (CONTRAST_FACTOR - 1)))

  const outputBuffer = await pipeline.jpeg({ quality: 88 }).toBuffer()

  return {
    b64: outputBuffer.toString('base64'), mimeType: 'image/jpeg',
    blurScore, wasEnhanced: true, wasResized: scale < 1,
    originalSize: { w: origW, h: origH },
    finalSize: { w: newW || origW, h: newH || origH },
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jimp — dynamic import với webpackIgnore
// ─────────────────────────────────────────────────────────────────────────────

async function processWithJimp(b64: string): Promise<PreprocessResult> {
  const Jimp = await import(/* webpackIgnore: true */ 'jimp').then(m => m.default || m)

  const inputBuffer = Buffer.from(b64, 'base64')
  const img = await Jimp.read(inputBuffer)
  const origW = img.getWidth()
  const origH = img.getHeight()

  // Sample grayscale pixels
  const grayPixels: number[] = []
  img.clone().grayscale().scan(0, 0, origW, origH, function (x: number, y: number, idx: number) {
    if ((x + y) % 2 === 0) grayPixels.push((this as typeof img).bitmap.data[idx])
  })
  const blurScore = computeLaplacianVariance(
    grayPixels,
    Math.ceil(origW / 2),
    Math.ceil(origH / 2)
  )

  if (blurScore < BLUR_THRESHOLD) {
    throw { code: 'TOO_BLURRY', message: `Ảnh quá mờ (điểm sắc nét: ${blurScore}/100). Vui lòng chụp lại ảnh rõ hơn.`, blurScore } as PreprocessError
  }

  const scale = Math.min(1, MAX_PX / Math.max(origW, origH, 1))
  if (scale < 1) img.resize(Math.round(origW * scale), Math.round(origH * scale))
  img.contrast(0.12)

  const outputBuffer = await img.getBufferAsync(Jimp.MIME_JPEG)

  return {
    b64: outputBuffer.toString('base64'), mimeType: 'image/jpeg',
    blurScore, wasEnhanced: true, wasResized: scale < 1,
    originalSize: { w: origW, h: origH },
    finalSize: { w: img.getWidth(), h: img.getHeight() },
    warnings: ['Used Jimp fallback'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// preprocessImage — thử sharp → jimp → pass-through
// ─────────────────────────────────────────────────────────────────────────────

export async function preprocessImage(
  b64: string,
  mimeType: string,
  label: string
): Promise<PreprocessResult> {
  // ── Thử sharp ──
  try {
    const result = await processWithSharp(b64)
    console.log(`[preprocess] ${label}: blur=${result.blurScore}, sharp OK`)
    return result
  } catch (err) {
    if (err && typeof err === 'object' && (err as PreprocessError).code === 'TOO_BLURRY') {
      throw err  // re-throw blur error
    }
    // sharp không có → thử jimp
    console.warn(`[preprocess] sharp unavailable for ${label}, trying jimp`)
  }

  // ── Thử jimp ──
  try {
    const result = await processWithJimp(b64)
    console.log(`[preprocess] ${label}: blur=${result.blurScore}, jimp OK`)
    return result
  } catch (err) {
    if (err && typeof err === 'object' && (err as PreprocessError).code === 'TOO_BLURRY') {
      throw err
    }
    console.warn(`[preprocess] jimp unavailable for ${label}, passing through`)
  }

  // ── Cả 2 không có → pass-through, không block ──
  return {
    b64, mimeType, blurScore: 50,
    wasEnhanced: false, wasResized: false,
    originalSize: { w: 0, h: 0 }, finalSize: { w: 0, h: 0 },
    warnings: [`${label}: preprocessing skipped (sharp & jimp not installed)`],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// preprocessImages — batch
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

  const processed: Array<{ b64: string; mimeType: string; label: string; blurScore: number }> = []
  const blurredImages: string[] = []
  const warnings: string[] = []

  results.forEach((r, i) => {
    const label = images[i].label
    if (r.status === 'fulfilled') {
      processed.push({ b64: r.value.b64, mimeType: r.value.mimeType, label, blurScore: r.value.blurScore })
      warnings.push(...r.value.warnings)
    } else {
      const err = r.reason as PreprocessError
      if (err?.code === 'TOO_BLURRY') {
        blurredImages.push(label)
      } else {
        // Lỗi khác → pass original through
        processed.push({ b64: images[i].b64, mimeType: images[i].mimeType, label, blurScore: 50 })
      }
    }
  })

  // Sort: ảnh sắc nét nhất lên trước (AI nhận theo thứ tự này)
  processed.sort((a, b) => b.blurScore - a.blurScore)

  return {
    images: processed,
    blurredImages,
    allBlurry: processed.length === 0,
    warnings,
  }
}
