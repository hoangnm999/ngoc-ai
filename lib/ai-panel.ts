// lib/ai-panel.ts — Server-side only
// v3 — Tập trung nhận diện loại đá + thông tin tham khảo, BỎ định giá
import Anthropic from '@anthropic-ai/sdk'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIResult {
  // Nhận diện
  loai_da: string                    // Tên đầy đủ: "Phỉ Thúy (Jadeite) Loại A"
  ten_khoa_hoc?: string              // Jadeite, Nephrite, Corundum...
  xuat_xu_pho_bien?: string          // Myanmar, Việt Nam, Sri Lanka...

  // Đặc điểm quan sát được từ ảnh
  mau_sac: string                    // Mô tả màu cụ thể
  do_trong: string                   // Trong suốt / mờ đục / nửa trong
  dac_diem_nhan_biet: string         // Vân, pattern đặc trưng nhìn thấy
  hinh_dang_gia_cong: string         // Vòng tay, mặt dây, thô...

  // Xác thực
  dau_hieu_tu_nhien: string          // Dấu hiệu cho thấy tự nhiên
  canh_bao_co_the_gia: string        // Nghi ngờ gì không? Nếu không → ""
  muc_do_tu_nhien: 'Có vẻ tự nhiên' | 'Cần kiểm định' | 'Nghi ngờ xử lý' | 'Có thể nhân tạo'

  // Khuyến nghị
  nen_kiem_dinh: string              // Nên test gì thêm
  luu_y_khi_mua: string              // Tips thực tế cho buyer

  // Meta
  do_tin_cay: number                 // 0-100, AI tự đánh giá
  ly_do_tin_cay: string              // Tại sao confident/không confident
}

export interface ConsensusResult {
  loai_da: string                    // Tên được đồng thuận
  muc_do_tu_nhien: string
  do_tin_cay: number
  dong_thuan: number                 // Số AI đồng ý (1 hoặc 2)
}

export type HallucinationLevel = 'SAFE' | 'WARNING' | 'BLOCKED'

export interface HallucinationGuard {
  level: HallucinationLevel
  reasons: string[]
  blocked: boolean
  suggestion: string
}

export interface PanelResult {
  sonnet: AIResult | null
  haiku: AIResult | null
  gemini: null
  consensus: ConsensusResult | null
  guard: HallucinationGuard
  usage: { input_tokens: number; output_tokens: number; cost_usd: number }
  errors: Record<string, string>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timeout after ${ms}ms`)), ms)
    ),
  ])
}

function extractJSON(raw: string): string {
  // Case 1: JSON trong markdown fence HOÀN CHỈNH (có closing ```)
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    const inner = fenced[1].trim()
    if (inner.startsWith('[')) {
      const arrMatch = inner.match(/^\s*\[\s*(\{[\s\S]*\})/)
      if (arrMatch) return repairJSON(arrMatch[1])
    }
    return repairJSON(inner)
  }

  // Case 2: JSON trong markdown fence BỊ TRUNCATE (thiếu closing ```)
  // Đây là lỗi thực tế trong log: ```json\n{ ... bị cắt giữa chừng
  const truncatedFence = raw.match(/```(?:json)?\s*([\s\S]*)$/)
  if (truncatedFence) {
    const inner = truncatedFence[1].trim()
    const start = inner.indexOf('{')
    if (start !== -1) return repairJSON(inner.slice(start))
  }

  // Case 3: JSON không có fence
  const start = raw.indexOf('{')
  if (start === -1) return raw.trim()

  // Case 4: JSON đầy đủ (có cả { và })
  const end = raw.lastIndexOf('}')
  if (end !== -1 && end > start) return raw.slice(start, end + 1).trim()

  // Case 5: JSON bị truncate không có fence
  return repairJSON(raw.slice(start))
}

function repairJSON(partial: string): string {
  // Đếm số dấu { và } để biết cần đóng bao nhiêu cấp
  let depth = 0
  let inString = false
  let escape = false
  for (const ch of partial) {
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"' && !escape) { inString = !inString; continue }
    if (!inString) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
    }
  }
  let result = partial.trimEnd()

  // Đóng string đang mở (nếu bị cắt giữa value)
  if (inString) result += '"'

  // Chỉ thêm do_tin_cay nếu chưa có trong partial
  if (!partial.includes('"do_tin_cay"')) {
    result += ',"do_tin_cay":50,"ly_do_tin_cay":"Response bị cắt — độ tin cậy giảm xuống 50%"'
  }

  // Đóng object còn thiếu
  result += '}'.repeat(Math.max(0, depth))
  return result
}

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildSonnetSystem(declContext?: string): string {
  const decl = declContext ? `\nThông tin người dùng khai báo:\n${declContext}\n` : ''
  return `Bạn là chuyên gia gemologist 20 năm kinh nghiệm, chuyên thị trường ngọc đá quý Việt Nam — đặc biệt am hiểu Phỉ Thúy (Jadeite), Ngọc Bích (Nephrite), Ruby, Sapphire.${decl}

NHIỆM VỤ: Nhận diện loại đá và cung cấp thông tin hữu ích cho người mua/bán. KHÔNG định giá bằng số tiền.

QUY TẮC BẮT BUỘC:
- Chỉ mô tả những gì THỰC SỰ nhìn thấy trong ảnh
- Nếu ảnh MỜ HOÀN TOÀN/TỐI ĐEN không nhìn thấy gì → do_tin_cay < 35
- Nếu ảnh nhỏ nhưng vẫn nhìn thấy màu sắc và hình dạng → do_tin_cay 50-65
- Nếu không chắc loại đá → loai_da = "Chưa xác định được — cần kiểm định"
- KHÔNG bịa đặc điểm không nhìn thấy được
- Ưu tiên cảnh báo hơn là reassure sai

JSON SCHEMA (trả về JSON thuần túy, không markdown):
{
  "loai_da": "tên đầy đủ và chính xác",
  "ten_khoa_hoc": "tên khoa học nếu biết",
  "xuat_xu_pho_bien": "vùng xuất xứ phổ biến của loại đá này",
  "mau_sac": "mô tả màu sắc quan sát được",
  "do_trong": "trong suốt / nửa trong / mờ đục",
  "dac_diem_nhan_biet": "vân, pattern, đặc điểm nhận ra được từ ảnh này",
  "hinh_dang_gia_cong": "dạng vật phẩm và kiểu gia công",
  "dau_hieu_tu_nhien": "dấu hiệu tự nhiên quan sát thấy",
  "canh_bao_co_the_gia": "nghi ngờ xử lý/nhân tạo nếu có, hoặc chuỗi rỗng",
  "muc_do_tu_nhien": "PHẢI là một trong 4 giá trị chính xác sau, KHÔNG thêm text khác: Có vẻ tự nhiên | Cần kiểm định | Nghi ngờ xử lý | Có thể nhân tạo",
  "nen_kiem_dinh": "nên test gì thêm để xác nhận",
  "luu_y_khi_mua": "lời khuyên thực tế cho người mua loại đá này",
  "do_tin_cay": 75,
  "ly_do_tin_cay": "tại sao confident hoặc không confident"
}`
}

function buildHaikuSystem(declContext?: string): string {
  const decl = declContext ? `\nThông tin khai báo: ${declContext}\n` : ''
  return `Bạn là chuyên gia xác thực ngọc đá quý, chuyên phát hiện hàng giả và đá xử lý.${decl}

NHIỆM VỤ: Xác thực tính tự nhiên của đá từ ảnh. KHÔNG định giá.

QUY TẮC:
- Nếu ảnh MỜ HOÀN TOÀN/TỐI ĐEN → do_tin_cay < 35
- Nếu ảnh nhỏ nhưng nhìn thấy được → do_tin_cay 50-65
- Thà cảnh báo sai còn hơn reassure sai
- Chỉ kết luận những gì nhìn thấy được

JSON thuần túy — KHÔNG giải thích thêm. QUAN TRỌNG:
- do_trong = mô tả độ trong suốt (ví dụ: "trong suốt", "nửa trong", "mờ đục") — KHÔNG phải độ cứng Mohs
- muc_do_tu_nhien = PHẢI là một trong 4 giá trị CHÍNH XÁC: "Có vẻ tự nhiên" | "Cần kiểm định" | "Nghi ngờ xử lý" | "Có thể nhân tạo"
{"loai_da":"","ten_khoa_hoc":"","xuat_xu_pho_bien":"","mau_sac":"","do_trong":"trong suốt/nửa trong/mờ đục","dac_diem_nhan_biet":"","hinh_dang_gia_cong":"","dau_hieu_tu_nhien":"","canh_bao_co_the_gia":"","muc_do_tu_nhien":"Cần kiểm định","nen_kiem_dinh":"","luu_y_khi_mua":"","do_tin_cay":70,"ly_do_tin_cay":""}`
}

// ── AI Callers ────────────────────────────────────────────────────────────────

// Fallback: extract từng field bằng regex khi JSON quá hỏng để parse
function extractPartialFields(raw: string): AIResult | null {
  const get = (key: string): string => {
    const m = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`))
    return m ? m[1].replace(/\\"/g, '"') : ''
  }
  const getNum = (key: string, fallback: number): number => {
    const m = raw.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`))
    return m ? parseInt(m[1], 10) : fallback
  }

  const loai_da = get('loai_da')
  if (!loai_da) return null  // không tìm được field quan trọng nhất → bỏ

  const mucDoRaw = get('muc_do_tu_nhien')
  const validLevels = ['Có vẻ tự nhiên', 'Cần kiểm định', 'Nghi ngờ xử lý', 'Có thể nhân tạo'] as const
  const muc_do_tu_nhien = validLevels.find(l => mucDoRaw.includes(l)) ?? 'Cần kiểm định'

  return {
    loai_da,
    ten_khoa_hoc:        get('ten_khoa_hoc')        || undefined,
    xuat_xu_pho_bien:    get('xuat_xu_pho_bien')    || undefined,
    mau_sac:             get('mau_sac')             || 'Không xác định',
    do_trong:            get('do_trong')            || 'Không xác định',
    dac_diem_nhan_biet:  get('dac_diem_nhan_biet')  || 'Dữ liệu không đầy đủ',
    hinh_dang_gia_cong:  get('hinh_dang_gia_cong')  || '',
    dau_hieu_tu_nhien:   get('dau_hieu_tu_nhien')   || '',
    canh_bao_co_the_gia: get('canh_bao_co_the_gia') || '',
    muc_do_tu_nhien,
    nen_kiem_dinh:       get('nen_kiem_dinh')       || '',
    luu_y_khi_mua:       get('luu_y_khi_mua')       || '',
    do_tin_cay:          getNum('do_tin_cay', 45),
    ly_do_tin_cay:       get('ly_do_tin_cay')       || 'JSON response bị cắt — các trường có thể thiếu',
  }
}

async function callSonnet(
  imageBlocks: Array<{ type: 'image'; source: Anthropic.ImageBlockParam['source'] }>,
  declContext?: string
) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,   // đủ cho đá phức tạp (~1700 tokens) mà không kéo dài response time
    system: buildSonnetSystem(declContext),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Phân tích các ảnh đá quý này. Nhận diện loại đá và cung cấp thông tin hữu ích.' },
        ...imageBlocks,
      ],
    }],
  })

  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  console.log('[Sonnet raw]', text.slice(0, 300))

  try {
    return {
      result: JSON.parse(extractJSON(text)) as AIResult,
      usage: res.usage || { input_tokens: 0, output_tokens: 0 },
    }
  } catch {
    // Fallback: thử extract từng field bằng regex
    const partial = extractPartialFields(text)
    if (partial) {
      console.log('[Sonnet] JSON repair failed, using partial field extraction')
      return {
        result: partial,
        usage: res.usage || { input_tokens: 0, output_tokens: 0 },
      }
    }
    throw new Error(`Sonnet JSON parse failed: ${text.slice(0, 200)}`)
  }
}

async function callHaiku(
  imageBlocks: Array<{ type: 'image'; source: Anthropic.ImageBlockParam['source'] }>,
  declContext?: string
) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: buildHaikuSystem(declContext),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Xác thực tính tự nhiên của đá quý trong ảnh.' },
        ...imageBlocks,
      ],
    }],
  })

  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  console.log('[Haiku raw]', text.slice(0, 300))

  try {
    return {
      result: JSON.parse(extractJSON(text)) as AIResult,
      usage: res.usage || { input_tokens: 0, output_tokens: 0 },
    }
  } catch {
    // Fallback: thử extract từng field bằng regex
    const partial = extractPartialFields(text)
    if (partial) {
      console.log('[Haiku] JSON repair failed, using partial field extraction')
      return {
        result: partial,
        usage: res.usage || { input_tokens: 0, output_tokens: 0 },
      }
    }
    throw new Error(`Haiku JSON parse failed: ${text.slice(0, 200)}`)
  }
}

// ── Normalize stone type for comparison ──────────────────────────────────────

function normalizeStoneType(s: string): string {
  if (!s) return 'unknown'
  const l = s.toLowerCase()
  if (l.includes('jadeite') || l.includes('phỉ thúy') || l.includes('jade loại a')) return 'jadeite'
  if (l.includes('nephrite') || l.includes('ngọc bích') || l.includes('jade')) return 'jade'
  if (l.includes('ruby') || l.includes('hồng ngọc')) return 'ruby'
  if (l.includes('sapphire') || l.includes('lam ngọc') || l.includes('saphia')) return 'sapphire'
  if (l.includes('emerald') || l.includes('ngọc lục bảo')) return 'emerald'
  if (l.includes('diamond') || l.includes('kim cương')) return 'diamond'
  if (l.includes('chưa xác định') || l.includes('không xác định') || l.includes('unknown')) return 'unknown'
  // Lấy từ đầu tiên có nghĩa
  return l.split(/[\s\(\-]/)[0]
}

// Normalize muc_do_tu_nhien — AI đôi khi trả về chuỗi tự do thay vì enum
// Ví dụ: "Có vẻ tự nhiên — cần kiểm định..." → "Cần kiểm định"
function normalizeNatureLevel(raw: string): AIResult['muc_do_tu_nhien'] {
  if (!raw) return 'Cần kiểm định'
  const s = raw.toLowerCase()
  if (s.startsWith('có vẻ tự nhiên') && !s.includes('cần') && !s.includes('nghi')) return 'Có vẻ tự nhiên'
  if (s.includes('nhân tạo') || s.includes('synthetic') || s.includes('giả')) return 'Có thể nhân tạo'
  if (s.includes('nghi ngờ') || s.includes('xử lý') || s.includes('treated')) return 'Nghi ngờ xử lý'
  if (s.includes('cần kiểm định') || s.includes('cần xác nhận') || s.includes('cần xác thực')) return 'Cần kiểm định'
  // fallback: nếu có "tự nhiên" trong string → Cần kiểm định (an toàn hơn Có vẻ tự nhiên)
  if (s.includes('tự nhiên')) return 'Cần kiểm định'
  return 'Cần kiểm định'
}

// ── Hallucination Guard ───────────────────────────────────────────────────────

function runHallucinationGuard(
  results: (AIResult | null)[],
  successCount: number
): HallucinationGuard {
  const reasons: string[] = []
  let level: HallucinationLevel = 'SAFE'
  const valid = results.filter(Boolean) as AIResult[]

  // Lớp 1: Số AI thành công
  if (successCount === 1) {
    reasons.push('Chỉ 1/2 AI phản hồi — kết quả chưa được cross-check')
    level = 'WARNING'
  }

  // Lớp 2: Đồng thuận loại đá
  if (valid.length >= 2) {
    const types = valid.map(r => normalizeStoneType(r.loai_da))
    const unknownCount = types.filter(t => t === 'unknown').length
    const knownTypes = new Set(types.filter(t => t !== 'unknown'))

    if (unknownCount >= 2) {
      reasons.push('Cả 2 AI không nhận diện được loại đá — ảnh chưa đủ rõ')
      level = 'BLOCKED'
    } else if (unknownCount === 1) {
      reasons.push('1 AI không nhận diện được loại đá')
      if (level === 'SAFE') level = 'WARNING'
    } else if (knownTypes.size >= 2) {
      reasons.push(`2 AI nhận diện khác nhau: ${Array.from(knownTypes).join(' / ')} — cần kiểm định thực tế`)
      level = 'BLOCKED'
    }
  }

  // Lớp 3: Độ tin cậy — threshold thấp hơn vì chỉ nhận diện, không định giá
  const avgConf = valid.length
    ? Math.round(valid.reduce((s, r) => s + (r.do_tin_cay ?? 60), 0) / valid.length)
    : 0

  if (avgConf < 35) {
    reasons.push(`Độ tin cậy quá thấp (${avgConf}%) — ảnh không đủ chất lượng để nhận diện`)
    level = 'BLOCKED'
  } else if (avgConf < 50) {
    reasons.push(`Độ tin cậy thấp (${avgConf}%) — nên chụp thêm ảnh rõ hơn`)
    if (level === 'SAFE') level = 'WARNING'
  }

  // Lớp 4: Cảnh báo hàng giả từ nhiều AI
  const suspectCount = valid.filter(r =>
    normalizeNatureLevel(r.muc_do_tu_nhien) === 'Có thể nhân tạo' || normalizeNatureLevel(r.muc_do_tu_nhien) === 'Nghi ngờ xử lý'
  ).length
  if (suspectCount >= 2) {
    reasons.push('Cả 2 AI nghi ngờ đây là đá xử lý hoặc nhân tạo')
    if (level === 'SAFE') level = 'WARNING'
  }

  // Lớp 5: Xung đột muc_do_tu_nhien giữa các AI
  if (valid.length >= 2) {
    const natureLevels = valid.map(r => normalizeNatureLevel(r.muc_do_tu_nhien)).filter(Boolean)
    const uniqueNature = new Set(natureLevels)
    const hasNatural   = natureLevels.some(n => n === 'Có vẻ tự nhiên')
    const hasSynthetic = natureLevels.some(n => n === 'Có thể nhân tạo')
    if (hasNatural && hasSynthetic) {
      reasons.push('2 AI mâu thuẫn về tính tự nhiên: một cho là tự nhiên, một cho là nhân tạo — cần kiểm định')
      if (level === 'SAFE') level = 'WARNING'
    } else if (uniqueNature.size >= 2) {
      reasons.push(`2 AI không đồng thuận mức độ tự nhiên: ${Array.from(uniqueNature).join(' / ')}`)
      if (level === 'SAFE') level = 'WARNING'
    }
  }

  const suggestion =
    level === 'BLOCKED'
      ? 'Vui lòng chụp lại: ánh sáng tự nhiên, nền trắng/đen, ảnh sắc nét tối thiểu 3 góc. Sau đó thử lại.'
      : level === 'WARNING'
      ? 'Kết quả sơ bộ — nên mang đến tiệm ngọc hoặc trung tâm giám định để xác nhận.'
      : 'Kết quả sơ bộ mang tính tham khảo. Giao dịch giá trị cao nên có giám định GIA/GRS/IGI.'

  return { level, reasons, blocked: level === 'BLOCKED', suggestion }
}

// ── Consensus ─────────────────────────────────────────────────────────────────

function buildConsensus(results: (AIResult | null)[]): ConsensusResult | null {
  const valid = results.filter(Boolean) as AIResult[]
  if (!valid.length) return null

  const avgConf = Math.round(valid.reduce((s, r) => s + (r.do_tin_cay ?? 60), 0) / valid.length)

  // Loại đá được đa số đồng ý
  const types = valid.map(r => normalizeStoneType(r.loai_da))
  const typeCount = types.reduce<Record<string, number>>((o, t) => {
    o[t] = (o[t] ?? 0) + 1; return o
  }, {})
  const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]

  // Mức độ tự nhiên được đa số đồng ý
  const natureLevels = valid.map(r => normalizeNatureLevel(r.muc_do_tu_nhien)).filter(Boolean)
  const natureCount = natureLevels.reduce<Record<string, number>>((o, n) => {
    o[n] = (o[n] ?? 0) + 1; return o
  }, {})
  const topNature = Object.entries(natureCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Cần kiểm định'

  // Dùng loai_da gốc của AI có confidence cao nhất
  const bestAI = valid.reduce((a, b) => (a.do_tin_cay ?? 0) > (b.do_tin_cay ?? 0) ? a : b)

  return {
    loai_da: bestAI.loai_da,
    muc_do_tu_nhien: topNature,
    do_tin_cay: avgConf,
    dong_thuan: topType?.[1] ?? 1,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runAIPanel(
  images: Array<{ b64: string; mimeType: string; label: string }>,
  declarationContext?: string
): Promise<PanelResult> {
  console.log('[ai-panel] ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY)
  console.log('[ai-panel] images count:', images.length)
  console.log('[ai-panel] image sizes (bytes):', images.map(i => Math.round(i.b64.length * 0.75)))

  const imageBlocks: Array<{ type: 'image'; source: Anthropic.ImageBlockParam['source'] }> =
    images.map(img => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: img.b64,
      },
    }))

  const [r1, r2] = await Promise.allSettled([
    withTimeout(callSonnet(imageBlocks, declarationContext), 45000, 'Sonnet'),
    withTimeout(callHaiku(imageBlocks, declarationContext), 30000, 'Haiku'),
  ])

  console.log('[ai-panel] Sonnet:', r1.status, r1.status === 'rejected' ? r1.reason?.message : 'OK')
  console.log('[ai-panel] Haiku:', r2.status, r2.status === 'rejected' ? r2.reason?.message : 'OK')

  const errors: Record<string, string> = {}
  const sonnet = r1.status === 'fulfilled' ? r1.value.result : (errors.sonnet = r1.reason?.message || 'Unknown', null)
  const haiku  = r2.status === 'fulfilled' ? r2.value.result : (errors.haiku  = r2.reason?.message || 'Unknown', null)
  const gemini = null

  const successCount = [sonnet, haiku].filter(Boolean).length
  const consensus = buildConsensus([sonnet, haiku])
  const guard = runHallucinationGuard([sonnet, haiku], successCount)

  console.log('[ai-panel] Guard level:', guard.level, '| Reasons:', guard.reasons)

  const inputTokens  = (r1.status === 'fulfilled' ? r1.value.usage.input_tokens  : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.input_tokens  : 0)
  const outputTokens = (r1.status === 'fulfilled' ? r1.value.usage.output_tokens : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.output_tokens : 0)

  return {
    sonnet, haiku, gemini,
    consensus,
    guard,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: inputTokens * 0.000003 + outputTokens * 0.000015,
    },
    errors,
  }
}
