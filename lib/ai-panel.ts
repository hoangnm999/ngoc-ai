// lib/ai-panel.ts — Server-side only
import Anthropic from '@anthropic-ai/sdk'

export interface AIResult {
  loai_da: string
  chat_luong?: Record<string, { diem: number; mo_ta: string }>
  gia_tri_uoc_tinh: { thap: number; cao: number }
  xep_hang: 'Thường' | 'Khá' | 'Tốt' | 'Xuất sắc' | 'Đỉnh cao'
  nhan_xet: string
  dau_hieu_that_gia?: string
  canh_bao?: string
  mau_thuan_khai_bao?: string
  do_tin_cay: number
  ghi_chu?: string
}

export interface ConsensusResult {
  thap: number
  cao: number
  xep_hang: string
  do_tin_cay: number
  agreement: number
}

// ── Hallucination Guard Types ─────────────────────────────────────────────────

export type HallucinationLevel = 'SAFE' | 'WARNING' | 'BLOCKED'

export interface HallucinationGuard {
  level: HallucinationLevel
  // Lý do cụ thể để hiển thị cho user
  reasons: string[]
  // Có cho phép hiển thị kết quả không
  blocked: boolean
  // Gợi ý hành động cho user
  suggestion: string
}

export interface PanelResult {
  sonnet: AIResult | null
  haiku: AIResult | null
  gemini: null  // Tạm vô hiệu — dùng Sonnet + Haiku
  consensus: ConsensusResult | null
  guard: HallucinationGuard          // ← LỚP BẢO VỆ MỚI
  usage: { input_tokens: number; output_tokens: number; cost_usd: number }
  errors: Record<string, string>
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timeout after ${ms}ms`)), ms)
    ),
  ])
}


// ── JSON extractor — handles markdown fences + truncated responses ─────────────

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const curly = raw.indexOf('{')
  const lastCurly = raw.lastIndexOf('}')
  if (curly !== -1 && lastCurly !== -1) return raw.slice(curly, lastCurly + 1).trim()
  return raw.trim()
}

// ── Prompts (thêm yêu cầu AI tự báo cáo uncertainty) ─────────────────────────

function buildSonnetSystem(declContext?: string) {
  const decl = declContext ? `\n\n${declContext}\n` : ''
  return `Bạn là chuyên gia định giá ngọc đá quý 20 năm kinh nghiệm, chuyên thị trường Việt Nam.${decl}

QUY TẮC QUAN TRỌNG VỀ ĐỘ TIN CẬY:
- Nếu ảnh MỜ, THIẾU SÁNG, hoặc KHÔNG ĐỦ RÕ để nhận diện → do_tin_cay PHẢI < 50
- Nếu KHÔNG CHẮC loại đá → loai_da = "Không xác định được"
- Nếu giá dao động quá rộng (cao/thap > 3x) → do_tin_cay PHẢI < 60
- TUYỆT ĐỐI KHÔNG bịa thông số khi không nhìn thấy rõ

Phân tích TỔNG HỢP tất cả ảnh. Đối chiếu với thông tin khai báo nếu có.
Trả về JSON THUẦN TÚY (không markdown, không backtick):
{"loai_da":"","chat_luong":{"mau_sac":{"diem":0,"mo_ta":""},"do_trong":{"diem":0,"mo_ta":""},"van_da":{"diem":0,"mo_ta":""},"khuyet_diem":{"diem":0,"mo_ta":""},"nuoc_da":{"diem":0,"mo_ta":""},"gia_cong":{"diem":0,"mo_ta":""}},"gia_tri_uoc_tinh":{"thap":0,"cao":0},"xep_hang":"Tốt","nhan_xet":"","dau_hieu_that_gia":"","canh_bao":"","mau_thuan_khai_bao":"","do_tin_cay":75}`
}

function buildHaikuSystem(declContext?: string) {
  const decl = declContext ? `\n\n${declContext}\n` : ''
  return `Bạn là chuyên gia xác thực ngọc đá quý, chuyên phát hiện hàng giả.${decl}

QUY TẮC QUAN TRỌNG:
- Nếu ảnh không đủ rõ để kết luận → do_tin_cay PHẢI < 50
- Nếu không xác định được thật/giả → ghi rõ trong canh_bao
- KHÔNG được đoán mò khi thiếu thông tin

Trả về JSON THUẦN TÚY:
{"loai_da":"","gia_tri_uoc_tinh":{"thap":0,"cao":0},"xep_hang":"Tốt","nhan_xet":"","dau_hieu_that_gia":"","canh_bao":"","mau_thuan_khai_bao":"","do_tin_cay":70}`
}


// ── Individual callers ────────────────────────────────────────────────────────

async function callSonnet(
  imageBlocks: Array<{ type: 'image'; source: Anthropic.ImageBlockParam['source'] }>,
  declContext?: string
) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const content: Anthropic.MessageParam['content'] = [
    { type: 'text', text: `[USER'S GEMSTONE IMAGES]` },
    ...imageBlocks,
    { type: 'text', text: 'Phân tích và định giá. Báo cáo trung thực nếu ảnh không đủ rõ.' },
  ]

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: buildSonnetSystem(declContext),
    messages: [{ role: 'user', content }],
  })

  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  console.log('[Sonnet raw]', text.slice(0, 200))

  try {
    return {
      result: JSON.parse(extractJSON(text)) as AIResult,
      usage: res.usage || { input_tokens: 0, output_tokens: 0 },
    }
  } catch {
    throw new Error(`Sonnet JSON parse failed: ${text.slice(0, 200)}`)
  }
}

async function callHaiku(
  imageBlocks: Array<{ type: 'image'; source: Anthropic.ImageBlockParam['source'] }>,
  declContext?: string
) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const content: Anthropic.MessageParam['content'] = [
    { type: 'text', text: `[USER'S GEMSTONE IMAGES]` },
    ...imageBlocks,
    { type: 'text', text: 'Kiểm tra tính xác thực. Báo cáo trung thực nếu không chắc.' },
  ]

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    system: buildHaikuSystem(declContext),
    messages: [{ role: 'user', content }],
  })

  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  console.log('[Haiku raw]', text.slice(0, 200))

  try {
    return {
      result: JSON.parse(extractJSON(text)) as AIResult,
      usage: res.usage || { input_tokens: 0, output_tokens: 0 },
    }
  } catch {
    throw new Error(`Haiku JSON parse failed: ${text.slice(0, 200)}`)
  }
}


// ── Hallucination Guard — 3 lớp bảo vệ ──────────────────────────────────────

function runHallucinationGuard(
  results: (AIResult | null)[],
  consensus: ConsensusResult | null,
  successCount: number
): HallucinationGuard {
  const reasons: string[] = []
  let level: HallucinationLevel = 'SAFE'

  const valid = results.filter(Boolean) as AIResult[]

  // ── LỚP 1: Kiểm tra số lượng AI thành công ──────────────────────────────
  if (successCount === 0) {
    // 0 AI → route.ts đã handle riêng (trả 500), guard không cần xử lý
  } else if (successCount === 1) {
    reasons.push('Chỉ 1/2 AI phản hồi — không đủ để cross-check')
    if (level === 'SAFE') level = 'WARNING'
    // KHÔNG BLOCKED — vẫn cho trả kết quả với cảnh báo
  }

  // ── LỚP 2: Kiểm tra đồng thuận loại đá (quan trọng nhất) ───────────────
  if (valid.length >= 2) {
    const stoneTypes = valid
      .map(r => r.loai_da?.toLowerCase().trim())
      .filter(Boolean)

    // Chuẩn hóa tên đá để so sánh (jade = ngọc bích = jadite)
    const normalize = (s: string) => {
      if (!s) return ''
      if (s.includes('jade') || s.includes('ngọc bích') || s.includes('jadeite') || s.includes('nephrite')) return 'jade'
      if (s.includes('ruby') || s.includes('hồng ngọc')) return 'ruby'
      if (s.includes('sapphire') || s.includes('saphia') || s.includes('lam ngọc')) return 'sapphire'
      if (s.includes('emerald') || s.includes('ngọc lục bảo')) return 'emerald'
      if (s.includes('diamond') || s.includes('kim cương')) return 'diamond'
      if (s.includes('không xác định') || s.includes('unknown') || s.includes('unclear')) return 'unknown'
      return s.split(' ')[0] // Lấy từ đầu tiên nếu không match
    }

    const normalized = stoneTypes.map(normalize)
    const uniqueTypes = new Set(normalized.filter(t => t !== 'unknown'))

    if (uniqueTypes.size >= 3) {
      // Cả 3 AI nói khác nhau hoàn toàn → BLOCKED
      reasons.push(`3 AI không đồng thuận loại đá: ${Array.from(uniqueTypes).join(' / ')}`)
      level = 'BLOCKED'
    } else if (uniqueTypes.size === 2 && valid.length === 3) {
      // 2 AI đồng thuận, 1 AI khác → WARNING
      const typeCounts = normalized.reduce<Record<string, number>>((o, t) => {
        if (t !== 'unknown') o[t] = (o[t] ?? 0) + 1
        return o
      }, {})
      const minority = Object.entries(typeCounts).find(([, c]) => c === 1)
      if (minority) {
        reasons.push(`1 AI nhận diện khác loại đá (${minority[0]}) — kết quả cần xem xét thêm`)
        if (level === 'SAFE') level = 'WARNING'
      }
    }

    // Có AI báo "Không xác định được"
    const unknownCount = normalized.filter(t => t === 'unknown').length
    if (unknownCount >= 2) {
      reasons.push(`${unknownCount}/3 AI không nhận diện được loại đá — ảnh có thể không đủ rõ`)
      level = 'BLOCKED'
    } else if (unknownCount === 1) {
      reasons.push('1 AI không nhận diện được loại đá')
      if (level === 'SAFE') level = 'WARNING'
    }
  }

  // ── LỚP 3: Kiểm tra độ tin cậy ─────────────────────────────────────────
  if (consensus) {
    if (consensus.do_tin_cay < 50) {
      reasons.push(`Độ tin cậy trung bình quá thấp (${consensus.do_tin_cay}%) — ảnh không đủ chất lượng`)
      level = 'BLOCKED'
    } else if (consensus.do_tin_cay < 65) {
      reasons.push(`Độ tin cậy thấp (${consensus.do_tin_cay}%) — nên chụp thêm ảnh rõ hơn`)
      if (level === 'SAFE') level = 'WARNING'
    }

    // Kiểm tra khoảng giá quá rộng (dấu hiệu AI đang đoán mò)
    if (consensus.thap > 0 && consensus.cao > 0) {
      const priceRatio = consensus.cao / consensus.thap
      if (priceRatio > 5) {
        reasons.push(`Khoảng giá quá rộng (${consensus.thap.toLocaleString()}đ – ${consensus.cao.toLocaleString()}đ) — AI không đủ tự tin định giá`)
        if (level === 'SAFE') level = 'WARNING'
      }
    }
  }

  // ── LỚP 3b: Kiểm tra từng AI có tự báo cáo uncertainty không ──────────
  const lowConfAIs = valid.filter(r => r.do_tin_cay < 55)
  if (lowConfAIs.length >= 2) {
    reasons.push(`${lowConfAIs.length} AI tự báo cáo độ tin cậy thấp — không nên dùng kết quả này`)
    level = 'BLOCKED'
  }

  // ── Tổng hợp suggestion cho user ────────────────────────────────────────
  let suggestion = ''
  if (level === 'BLOCKED') {
    suggestion = 'Vui lòng chụp lại ảnh: ánh sáng tự nhiên, nền trắng, nhiều góc độ khác nhau. Hoặc gửi đến chuyên gia giám định.'
  } else if (level === 'WARNING') {
    suggestion = 'Kết quả có thể chưa chính xác hoàn toàn. Khuyến nghị chụp thêm ảnh cận cảnh hoặc tham khảo ý kiến chuyên gia.'
  } else {
    suggestion = 'Kết quả mang tính tham khảo. Với viên ngọc giá trị cao, nên có giám định từ GIA/GRS.'
  }

  return {
    level,
    reasons,
    blocked: level === 'BLOCKED',
    suggestion,
  }
}

// ── Consensus ─────────────────────────────────────────────────────────────────

function buildConsensus(results: (AIResult | null)[]): ConsensusResult | null {
  const valid = results.filter(Boolean) as AIResult[]
  if (!valid.length) return null

  const avgLow  = Math.round(valid.reduce((s, r) => s + (r.gia_tri_uoc_tinh?.thap ?? 0), 0) / valid.length)
  const avgHigh = Math.round(valid.reduce((s, r) => s + (r.gia_tri_uoc_tinh?.cao  ?? 0), 0) / valid.length)
  const avgConf = Math.round(valid.reduce((s, r) => s + (r.do_tin_cay ?? 70), 0) / valid.length)
  const grades  = valid.map(r => r.xep_hang).filter(Boolean)
  const count   = grades.reduce<Record<string, number>>((o, g) => { o[g] = (o[g] ?? 0) + 1; return o }, {})
  const topGrade = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Tốt'

  return { thap: avgLow, cao: avgHigh, xep_hang: topGrade, do_tin_cay: avgConf, agreement: count[topGrade] ?? 1 }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runAIPanel(
  images: Array<{ b64: string; mimeType: string; label: string }>,
  declarationContext?: string
): Promise<PanelResult> {

  console.log('[ai-panel] ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY)
  console.log('[ai-panel] images count:', images.length)
  console.log('[ai-panel] image sizes (bytes):', images.map(i => Math.round(i.b64.length * 0.75)))

  const imageBlocks: Array<{ type: 'image'; source: Anthropic.ImageBlockParam['source'] }> = images.map(img => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
      data: img.b64,
    },
  }))


  const [r1, r2] = await Promise.allSettled([
    withTimeout(callSonnet(imageBlocks, declarationContext), 45000, 'Sonnet'),
    withTimeout(callHaiku(imageBlocks, declarationContext), 28000, 'Haiku'),
  ])

  console.log('[ai-panel] Sonnet:', r1.status, r1.status === 'rejected' ? r1.reason?.message : 'OK')
  console.log('[ai-panel] Haiku:', r2.status, r2.status === 'rejected' ? r2.reason?.message : 'OK')

  const errors: Record<string, string> = {}
  const sonnet = r1.status === 'fulfilled' ? r1.value.result : (errors.sonnet = r1.reason?.message || 'Unknown', null)
  const haiku  = r2.status === 'fulfilled' ? r2.value.result : (errors.haiku  = r2.reason?.message || 'Unknown', null)
  const gemini = null  // Tạm vô hiệu — Gemini billing issue

  const successCount = [sonnet, haiku].filter(Boolean).length
  const consensus = buildConsensus([sonnet, haiku])

  // Chạy hallucination guard
  const guard = runHallucinationGuard([sonnet, haiku], consensus, successCount)
  console.log('[ai-panel] Guard level:', guard.level, '| Reasons:', guard.reasons)

  const inputTokens  = (r1.status === 'fulfilled' ? r1.value.usage.input_tokens  : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.input_tokens  : 0)
  const outputTokens = (r1.status === 'fulfilled' ? r1.value.usage.output_tokens : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.output_tokens : 0)
  // Gemini: tạm vô hiệu

  return {
    sonnet, haiku, gemini,
    consensus,
    guard,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: inputTokens * 0.000003 + outputTokens * 0.000015 },
    errors,
  }
}
