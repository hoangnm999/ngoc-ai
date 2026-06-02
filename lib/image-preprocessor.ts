// lib/image-preprocessor.ts
// Xử lý ảnh TRƯỚC khi gửi AI: phát hiện mờ, enhance contrast, resize
// Sharp (Node.js) làm chính, jimp làm fallback nếu sharp không chạy (Edge runtime)
// Chạy trong api/appraise/route.ts — Node.js runtime (export const runtime = 'nodejs')

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PreprocessResult {
  b64: string          // base64 đã xử lý
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

const MAX_PX = 1200          // chiều dài tối đa sau resize (cân bằng quality vs tokens)
const BLUR_THRESHOLD = 18    // dưới ngưỡng này → TOO_BLURRY (thực nghiệm: ảnh rõ ~50+, mờ <20)
const CONTRAST_FACTOR = 1.12 // tăng contrast nhẹ 12% — đủ để AI thấy rõ hơn, không artifacts

// ─────────────────────────────────────────────────────────────────────────────
// Laplacian variance — đo độ sắc nét
// Thuật toán: áp kernel Laplacian 3x3 lên ảnh grayscale, tính variance
// Variance cao = ảnh sắc nét (nhiều edge), variance thấp = ảnh mờ
// ─────────────────────────────────────────────────────────────────────────────

function computeLaplacianVariance(
  grayPixels: Uint8Array | number[],
  width: number,
  height: number
): number {
  if (width < 3 || height < 3) return 100  // ảnh quá nhỏ → không đánh giá được, skip

  const laplacian: number[] = []

  // Kernel Laplacian 3x3: [0,1,0],[1,-4,1],[0,1,0]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const val =
        -4 * grayPixels[idx] +
        grayPixels[(y - 1) * width + x] +  // trên
        grayPixels[(y + 1) * width + x] +  // dưới
        grayPixels[y * width + (x - 1)] +  // trái
        grayPixels[y * width + (x + 1)]    // phải
      laplacian.push(val)
    }
  }

  if (laplacian.length === 0) return 100

  const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length
  const variance = laplacian.reduce((a, b) => a + (b - mean) ** 2, 0) / laplacian.length

  // Normalize: variance thực tế dao động 0-5000+ → scale về 0-100 cho dễ đọc
  return Math.min(100, Math.round(Math.sqrt(variance) / 5))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sharp implementation (primary — Node.js)
// ─────────────────────────────────────────────────────────────────────────────

async function processWithSharp(
  b64: string,
  mimeType: string
): Promise<PreprocessResult> {
  // Dynamic import — tránh lỗi import ở Edge runtime
  const sharp = (await import('sharp')).default

  const inputBuffer = Buffer.from(b64, 'base64')

  // Lấy metadata
  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width ?? 0
  const origH = meta.height ?? 0

  // Extract grayscale pixels để tính blur score
  const { data: grayData, info } = await sharp(inputBuffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const blurScore = computeLaplacianVariance(grayData, info.width, info.height)

  if (blurScore < BLUR_THRESHOLD) {
    throw {
      code: 'TOO_BLURRY',
      message: `Ảnh quá mờ (điểm sắc nét: ${blurScore}/100). Vui lòng chụp lại ảnh rõ hơn — ánh sáng tốt, không rung tay.`,
      blurScore,
    } as PreprocessError
  }

  // Tính kích thước resize
  const scale = Math.min(1, MAX_PX / Math.max(origW, origH, 1))
  const newW = Math.round(origW * scale)
  const newH = Math.round(origH * scale)
  const wasResized = scale < 1

  // Pipeline: resize + tăng contrast nhẹ
  let pipeline = sharp(inputBuffer)

  if (wasResized) {
    pipeline = pipeline.resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
  }

  // Tăng contrast nhẹ bằng linear transform: output = FACTOR * input - offset
  // CONTRAST_FACTOR = 1.12 → contrast +12%, offset để giữ midtone
  pipeline = pipeline.linear(CONTRAST_FACTOR, -(128 * (CONTRAST_FACTOR - 1)))

  const outputBuffer = await pipeline
    .jpeg({ quality: 88, progressive: false })
    .toBuffer()

  return {
    b64: outputBuffer.toString('base64'),
    mimeType: 'image/jpeg',
    blurScore,
    wasEnhanced: true,
    wasResized,
    originalSize: { w: origW, h: origH },
    finalSize: { w: newW || origW, h: newH || origH },
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jimp implementation (fallback)
// ─────────────────────────────────────────────────────────────────────────────

async function processWithJimp(
  b64: string,
  mimeType: string
): Promise<PreprocessResult> {
  const Jimp = (await import('jimp')).default

  const inputBuffer = Buffer.from(b64, 'base64')
  const img = await Jimp.read(inputBuffer)

  const origW = img.getWidth()
  const origH = img.getHeight()

  // Tính blur score từ grayscale pixels
  const grayPixels: number[] = []
  img.clone().grayscale().scan(0, 0, origW, origH, (x, y, idx) => {
    grayPixels.push(img.bitmap.data[idx])
  })
  // Sample mỗi 2 pixel để nhanh hơn (ảnh lớn)
  const sampled = grayPixels.filter((_, i) => i % 2 === 0)
  const blurScore = computeLaplacianVariance(sampled, Math.ceil(origW / 2), Math.ceil(origH / 2))

  if (blurScore < BLUR_THRESHOLD) {
    throw {
      code: 'TOO_BLURRY',
      message: `Ảnh quá mờ (điểm sắc nét: ${blurScore}/100). Vui lòng chụp lại ảnh rõ hơn.`,
      blurScore,
    } as PreprocessError
  }

  const scale = Math.min(1, MAX_PX / Math.max(origW, origH, 1))
  const wasResized = scale < 1

  if (wasResized) {
    img.resize(Math.round(origW * scale), Math.round(origH * scale))
  }

  // Jimp contrast: -1 đến +1, 0.12 ≈ +12%
  img.contrast(0.12)

  const outputBuffer = await img.getBufferAsync(Jimp.MIME_JPEG)

  return {
    b64: outputBuffer.toString('base64'),
    mimeType: 'image/jpeg',
    blurScore,
    wasEnhanced: true,
    wasResized,
    originalSize: { w: origW, h: origH },
    finalSize: { w: img.getWidth(), h: img.getHeight() },
    warnings: ['Used Jimp fallback (sharp unavailable)'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point — gọi trong route.ts
// ─────────────────────────────────────────────────────────────────────────────

export async function preprocessImage(
  b64: string,
  mimeType: string,
  label: string
): Promise<PreprocessResult> {
  // Thử sharp trước
  try {
    const result = await processWithSharp(b64, mimeType)
    console.log(`[preprocess] ${label}: blur=${result.blurScore}, resized=${result.wasResized}, sharp OK`)
    return result
  } catch (err) {
    // Nếu là TOO_BLURRY → re-throw để caller xử lý
    if (err && typeof err === 'object' && (err as PreprocessError).code === 'TOO_BLURRY') {
      throw err
    }
    // Nếu sharp lỗi khác (module not found, v.v.) → thử jimp
    console.warn(`[preprocess] sharp failed for ${label}, trying jimp:`, (err as Error).message)
  }

  // Thử jimp fallback
  try {
    const result = await processWithJimp(b64, mimeType)
    console.log(`[preprocess] ${label}: blur=${result.blurScore}, jimp OK`)
    return result
  } catch (err) {
    if (err && typeof err === 'object' && (err as PreprocessError).code === 'TOO_BLURRY') {
      throw err
    }
    console.error(`[preprocess] jimp also failed for ${label}:`, (err as Error).message)
  }

  // Cả 2 đều lỗi (module missing, etc.) → pass through không xử lý
  // Không block request, chỉ log. AI vẫn nhận ảnh gốc.
  console.warn(`[preprocess] ${label}: both sharp and jimp failed — passing original`)
  return {
    b64,
    mimeType,
    blurScore: 50,  // assume trung bình
    wasEnhanced: false,
    wasResized: false,
    originalSize: { w: 0, h: 0 },
    finalSize: { w: 0, h: 0 },
    warnings: ['Preprocessing skipped — both sharp and jimp unavailable'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch: xử lý nhiều ảnh song song, trả về images đã xử lý + summary
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchPreprocessResult {
  images: Array<{ b64: string; mimeType: string; label: string; blurScore: number }>
  blurredImages: string[]   // label của ảnh quá mờ (đã reject)
  allBlurry: boolean        // true nếu TẤT CẢ ảnh đều mờ → HTTP 400
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
      processed.push({
        b64: r.value.b64,
        mimeType: r.value.mimeType,
        label,
        blurScore: r.value.blurScore,
      })
      if (r.value.warnings.length > 0) warnings.push(...r.value.warnings)
    } else {
      const err = r.reason as PreprocessError
      if (err?.code === 'TOO_BLURRY') {
        blurredImages.push(label)
        console.log(`[preprocess batch] ${label} rejected: too blurry (score=${err.blurScore})`)
      } else {
        // Unexpected error → pass original through
        console.error(`[preprocess batch] ${label} unexpected error:`, r.reason)
        processed.push({ b64: images[i].b64, mimeType: images[i].mimeType, label, blurScore: 50 })
      }
    }
  })

  // Sort theo blur score giảm dần — AI nhận ảnh sắc nét nhất trước
  processed.sort((a, b) => b.blurScore - a.blurScore)

  return {
    images: processed,
    blurredImages,
    allBlurry: processed.length === 0,
    warnings,
  }
}
