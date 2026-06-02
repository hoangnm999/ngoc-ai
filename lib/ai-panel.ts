// lib/ai-panel.ts — Server-side only
// v5.1 — Few-shot + CoT + Negative prompting + Confidence calibration
// FIX: Rút gọn system prompt (~800 tokens thay vì ~3000) để tránh Sonnet timeout 45s
import Anthropic from '@anthropic-ai/sdk'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIResult {
  loai_da: string
  ten_khoa_hoc?: string
  xuat_xu_pho_bien?: string
  mau_sac: string
  do_trong: string
  dac_diem_nhan_biet: string
  hinh_dang_gia_cong: string
  dau_hieu_tu_nhien: string
  canh_bao_co_the_gia: string
  muc_do_tu_nhien: 'Có vẻ tự nhiên' | 'Cần kiểm định' | 'Nghi ngờ xử lý' | 'Có thể nhân tạo'
  nen_kiem_dinh: string
  luu_y_khi_mua: string
  cach_nhan_dang?: string  // CoT — internal, không hiển thị UI
  do_tin_cay: number
  ly_do_tin_cay: string
}

export interface ConsensusResult {
  loai_da: string
  muc_do_tu_nhien: string
  do_tin_cay: number
  dong_thuan: number
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
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    const inner = fenced[1].trim()
    if (inner.startsWith('[')) {
      const arr = inner.match(/^\s*\[\s*(\{[\s\S]*\})/)
      if (arr) return repairJSON(arr[1])
    }
    return repairJSON(inner)
  }
  const truncated = raw.match(/```(?:json)?\s*([\s\S]*)$/)
  if (truncated) {
    const inner = truncated[1].trim()
    const s = inner.indexOf('{')
    if (s !== -1) return repairJSON(inner.slice(s))
  }
  const s = raw.indexOf('{')
  if (s === -1) return raw.trim()
  const e = raw.lastIndexOf('}')
  if (e !== -1 && e > s) return raw.slice(s, e + 1).trim()
  return repairJSON(raw.slice(s))
}

function repairJSON(partial: string): string {
  let depth = 0, inString = false, escape = false
  for (const ch of partial) {
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (!inString) { if (ch === '{') depth++; else if (ch === '}') depth-- }
  }
  let r = partial.trimEnd()
  if (inString) r += '"'
  if (!partial.includes('"do_tin_cay"')) {
    r += ',"do_tin_cay":50,"ly_do_tin_cay":"Response bị cắt — confidence giảm 50%"'
  }
  return r + '}'.repeat(Math.max(0, depth))
}

// ── Prompts — giữ ngắn gọn để tránh timeout ─────────────────────────────────
// Sonnet: ~600 tokens system prompt (CoT + negative, không few-shot dài)
// Haiku: ~400 tokens (compact, focused validation)

function buildSonnetSystem(declContext?: string): string {
  const decl = declContext ? `\nKhai báo người dùng: ${declContext}\n` : ''
  return `Bạn là gemologist 20 năm kinh nghiệm, chuyên ngọc đá quý Việt Nam.${decl}

NHIỆM VỤ: Nhận diện loại đá + thông tin hữu ích. KHÔNG định giá bằng tiền.

QUY TẮC:
- Chỉ mô tả những gì THỰC SỰ nhìn thấy trong ảnh
- Ảnh mờ/tối hoàn toàn → do_tin_cay < 35, loai_da = "Chưa xác định được — cần kiểm định"
- KHÔNG bịa đặc điểm không thấy được

CHAIN-OF-THOUGHT — điền "cach_nhan_dang" 4 bước ngắn, nối " | ":
  B1: Màu chủ đạo | B2: Độ trong/ánh sáng | B3: Vân/cấu trúc thấy được | B4: Kết luận

CÁC CẶP HAY NHẦM:
- Emerald ≠ Green Fluorite (Fluorite: không jardin, quá trong) / Chrome Diopside (xanh đậm hơn) / Green Tourmaline (lưỡng sắc mạnh hơn)
- Ruby ≠ Red Spinel (không lưỡng sắc) / Red Garnet (tối hơn) / Red Tourmaline (nứt dọc)
- Sapphire ≠ Blue Topaz (nhẹ hơn) / Iolite (đổi màu theo góc) / Kyanite (cứng không đều)
- Jadeite ≠ Serpentine (mềm, vàng lục hơn) / Aventurine (ánh kim) / Nephrite (ít ánh hơn)

CALIBRATE do_tin_cay (KHÔNG BAO GIỜ 100%):
- 80-95%: Ảnh rõ, thấy 3+ đặc điểm điển hình
- 60-80%: Ảnh tương đối rõ, thấy 1-2 đặc điểm
- 35-60%: Ảnh mờ nhẹ, chỉ thấy màu tổng thể
- <35%: Ảnh quá mờ/tối → "Chưa xác định được"

VÍ DỤ CHUẨN:
Emerald rõ jardin: {"cach_nhan_dang":"B1: xanh lá đậm bão hòa | B2: nửa trong, ánh thủy tinh | B3: jardin rõ phân bố không đều | B4: Emerald tự nhiên — jardin xác nhận","loai_da":"Ngọc lục bảo (Emerald)","do_tin_cay":82,"muc_do_tu_nhien":"Có vẻ tự nhiên"}
Ruby lụa rõ: {"cach_nhan_dang":"B1: đỏ pigeon blood, sắc cam nhẹ | B2: trong một phần, thấy silk | B3: lụa (silk) mờ đặc trưng Ruby Miến Điện | B4: Ruby tự nhiên chưa nung nhiệt","loai_da":"Ruby (Hồng ngọc)","do_tin_cay":78,"muc_do_tu_nhien":"Có vẻ tự nhiên"}

JSON SCHEMA (thuần túy, không markdown):
{"cach_nhan_dang":"","loai_da":"","ten_khoa_hoc":"","xuat_xu_pho_bien":"","mau_sac":"","do_trong":"trong suốt/nửa trong/mờ đục","dac_diem_nhan_biet":"","hinh_dang_gia_cong":"","dau_hieu_tu_nhien":"","canh_bao_co_the_gia":"","muc_do_tu_nhien":"Cần kiểm định","nen_kiem_dinh":"","luu_y_khi_mua":"","do_tin_cay":70,"ly_do_tin_cay":""}`
}

function buildHaikuSystem(declContext?: string): string {
  const decl = declContext ? `\nKhai báo: ${declContext}\n` : ''
  return `Bạn là chuyên gia xác thực ngọc đá quý, chuyên phát hiện hàng giả.${decl}

NHIỆM VỤ: Xác thực tính tự nhiên của đá. KHÔNG định giá.

QUY TẮC: Thà cảnh báo sai hơn reassure sai. Chỉ kết luận những gì thấy được.
- do_trong = độ trong suốt (KHÔNG phải Mohs)
- muc_do_tu_nhien = chính xác 1 trong 4: "Có vẻ tự nhiên" | "Cần kiểm định" | "Nghi ngờ xử lý" | "Có thể nhân tạo"

CÁC CẶP HAY NHẦM: Emerald≠Fluorite/ChromeDiopside. Ruby≠Spinel/Garnet. Sapphire≠Topaz/Iolite. Jadeite≠Serpentine/Aventurine.

CALIBRATE: 80-95% ảnh rõ 3+đặc điểm | 60-80% rõ vừa | 35-60% mờ nhẹ | <35% mờ hoàn toàn

CoT ngắn: "cach_nhan_dang" = "B1: màu | B2: độ trong | B3: cấu trúc | B4: kết luận"

JSON thuần túy:
{"cach_nhan_dang":"","loai_da":"","ten_khoa_hoc":"","xuat_xu_pho_bien":"","mau_sac":"","do_trong":"trong suốt/nửa trong/mờ đục","dac_diem_nhan_biet":"","hinh_dang_gia_cong":"","dau_hieu_tu_nhien":"","canh_bao_co_the_gia":"","muc_do_tu_nhien":"Cần kiểm định","nen_kiem_dinh":"","luu_y_khi_mua":"","do_tin_cay":70,"ly_do_tin_cay":""}`
}

// ── cleanStoneName ────────────────────────────────────────────────────────────

function cleanStoneName(name: string): string {
  if (!name) return name
  const m = name.match(/^([^(]+)\s*\(([^)]+)\)$/)
  if (m) {
    const before = m[1].trim(), inside = m[2].trim()
    const toA = (s: string) => s.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z]/g, '')
    const bA = toA(before), iA = toA(inside)
    if (bA === iA || iA.startsWith(bA) || bA.startsWith(iA) ||
        (bA.length > 3 && iA.includes(bA)) || (iA.length > 3 && bA.includes(iA))) {
      return /[àáâãèéêìíòóôõùúýăđơư]/i.test(before) ? before : inside
    }
  }
  return name
}

// ── extractPartialFields ──────────────────────────────────────────────────────

function extractPartialFields(raw: string): AIResult | null {
  const get = (k: string) => {
    const m = raw.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`))
    return m ? m[1].replace(/\\"/g, '"') : ''
  }
  const getNum = (k: string, fb: number) => {
    const m = raw.match(new RegExp(`"${k}"\\s*:\\s*(\\d+)`))
    return m ? parseInt(m[1], 10) : fb
  }
  const loai_da = get('loai_da')
  if (!loai_da) return null
  const mucRaw = get('muc_do_tu_nhien')
  const validLevels = ['Có vẻ tự nhiên', 'Cần kiểm định', 'Nghi ngờ xử lý', 'Có thể nhân tạo'] as const
  const muc_do_tu_nhien = validLevels.find(l => mucRaw.includes(l)) ?? 'Cần kiểm định'
  return {
    loai_da: cleanStoneName(loai_da),
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
    cach_nhan_dang:      get('cach_nhan_dang')      || undefined,
    do_tin_cay:          getNum('do_tin_cay', 45),
    ly_do_tin_cay:       get('ly_do_tin_cay')       || 'JSON bị cắt',
  }
}

// ── AI Callers ────────────────────────────────────────────────────────────────

async function callSonnet(
  imageBlocks: Array<{ type: 'image'; source: Anthropic.ImageBlockParam['source'] }>,
  declContext?: string
) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: buildSonnetSystem(declContext),
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Phân tích ảnh đá quý. Chain-of-thought 4 bước rồi trả JSON.' },
      ...imageBlocks,
    ]}],
  })
  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  console.log('[Sonnet raw]', text.slice(0, 200))
  try {
    const r = JSON.parse(extractJSON(text)) as AIResult
    r.loai_da = cleanStoneName(r.loai_da)
    return { result: r, usage: res.usage || { input_tokens: 0, output_tokens: 0 } }
  } catch {
    const partial = extractPartialFields(text)
    if (partial) { console.log('[Sonnet] partial extraction'); return { result: partial, usage: res.usage || { input_tokens: 0, output_tokens: 0 } } }
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
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Xác thực tính tự nhiên đá quý. Điền CoT 4 bước rồi trả JSON.' },
      ...imageBlocks,
    ]}],
  })
  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  console.log('[Haiku raw]', text.slice(0, 200))
  try {
    const r = JSON.parse(extractJSON(text)) as AIResult
    r.loai_da = cleanStoneName(r.loai_da)
    return { result: r, usage: res.usage || { input_tokens: 0, output_tokens: 0 } }
  } catch {
    const partial = extractPartialFields(text)
    if (partial) { console.log('[Haiku] partial extraction'); return { result: partial, usage: res.usage || { input_tokens: 0, output_tokens: 0 } } }
    throw new Error(`Haiku JSON parse failed: ${text.slice(0, 200)}`)
  }
}

// ── Normalize helpers ─────────────────────────────────────────────────────────

function normalizeStoneType(s: string): string {
  if (!s) return 'unknown'
  const l = s.toLowerCase()
  if (l.includes('jadeite') || l.includes('phỉ thúy') || l.includes('jade loại a')) return 'jadeite'
  if (l.includes('nephrite') || l.includes('ngọc bích') || l.includes('jade')) return 'jade'
  if (l.includes('ruby') || l.includes('hồng ngọc')) return 'ruby'
  if (l.includes('sapphire') || l.includes('lam ngọc') || l.includes('saphia')) return 'sapphire'
  if (l.includes('emerald') || l.includes('ngọc lục bảo') || l.includes('lục bảo')) return 'emerald'
  if (l.includes('diamond') || l.includes('kim cương')) return 'diamond'
  if (l.includes('chưa xác định') || l.includes('không xác định') || l.includes('unknown')) return 'unknown'
  return l.split(/[\s\(\-]/)[0]
}

function normalizeNatureLevel(raw: string): AIResult['muc_do_tu_nhien'] {
  if (!raw) return 'Cần kiểm định'
  const s = raw.toLowerCase()
  if (s.startsWith('có vẻ tự nhiên') && !s.includes('cần') && !s.includes('nghi')) return 'Có vẻ tự nhiên'
  if (s.includes('nhân tạo') || s.includes('synthetic') || s.includes('giả')) return 'Có thể nhân tạo'
  if (s.includes('nghi ngờ') || s.includes('xử lý') || s.includes('treated')) return 'Nghi ngờ xử lý'
  if (s.includes('cần kiểm định') || s.includes('cần xác nhận')) return 'Cần kiểm định'
  if (s.includes('tự nhiên')) return 'Cần kiểm định'
  return 'Cần kiểm định'
}

// ── Hallucination Guard 5 lớp ─────────────────────────────────────────────────

function runHallucinationGuard(results: (AIResult | null)[], successCount: number): HallucinationGuard {
  const reasons: string[] = []
  let level: HallucinationLevel = 'SAFE'
  const valid = results.filter(Boolean) as AIResult[]

  // L1
  if (successCount === 1) { reasons.push('Chỉ 1/2 AI phản hồi — kết quả chưa được cross-check'); level = 'WARNING' }

  // L2
  if (valid.length >= 2) {
    const types = valid.map(r => normalizeStoneType(r.loai_da))
    const unknownCount = types.filter(t => t === 'unknown').length
    const knownTypes = new Set(types.filter(t => t !== 'unknown'))
    if (unknownCount >= 2) { reasons.push('Cả 2 AI không nhận diện được loại đá — ảnh chưa đủ rõ'); level = 'BLOCKED' }
    else if (unknownCount === 1) { reasons.push('1 AI không nhận diện được loại đá'); if (level === 'SAFE') level = 'WARNING' }
    else if (knownTypes.size >= 2) { reasons.push(`2 AI nhận diện khác nhau: ${Array.from(knownTypes).join(' / ')}`); level = 'BLOCKED' }
  }

  // L3
  const avgConf = valid.length ? Math.round(valid.reduce((s, r) => s + (r.do_tin_cay ?? 60), 0) / valid.length) : 0
  if (avgConf < 35) { reasons.push(`Độ tin cậy quá thấp (${avgConf}%)`); level = 'BLOCKED' }
  else if (avgConf < 50) { reasons.push(`Độ tin cậy thấp (${avgConf}%)`); if (level === 'SAFE') level = 'WARNING' }

  // L4
  const suspectCount = valid.filter(r =>
    normalizeNatureLevel(r.muc_do_tu_nhien) === 'Có thể nhân tạo' ||
    normalizeNatureLevel(r.muc_do_tu_nhien) === 'Nghi ngờ xử lý'
  ).length
  if (suspectCount >= 2) { reasons.push('Cả 2 AI nghi ngờ đá xử lý/nhân tạo'); if (level === 'SAFE') level = 'WARNING' }

  // L5
  if (valid.length >= 2) {
    const nl = valid.map(r => normalizeNatureLevel(r.muc_do_tu_nhien))
    const un = new Set(nl)
    if (nl.some(n => n === 'Có vẻ tự nhiên') && nl.some(n => n === 'Có thể nhân tạo')) {
      reasons.push('2 AI mâu thuẫn về tính tự nhiên'); if (level === 'SAFE') level = 'WARNING'
    } else if (un.size >= 2) {
      reasons.push('2 AI không đồng thuận mức độ tự nhiên'); if (level === 'SAFE') level = 'WARNING'
    }
  }

  const suggestion = level === 'BLOCKED'
    ? 'Vui lòng chụp lại: ánh sáng tự nhiên, nền trắng/đen, ảnh sắc nét tối thiểu 3 góc.'
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
  const types = valid.map(r => normalizeStoneType(r.loai_da))
  const typeCount = types.reduce<Record<string, number>>((o, t) => { o[t] = (o[t] ?? 0) + 1; return o }, {})
  const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]
  const nl = valid.map(r => normalizeNatureLevel(r.muc_do_tu_nhien))
  const nc = nl.reduce<Record<string, number>>((o, n) => { o[n] = (o[n] ?? 0) + 1; return o }, {})
  const topNature = Object.entries(nc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Cần kiểm định'
  const bestAI = valid.reduce((a, b) => (a.do_tin_cay ?? 0) > (b.do_tin_cay ?? 0) ? a : b)
  return { loai_da: bestAI.loai_da, muc_do_tu_nhien: topNature, do_tin_cay: avgConf, dong_thuan: topType?.[1] ?? 1 }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runAIPanel(
  images: Array<{ b64: string; mimeType: string; label: string }>,
  declarationContext?: string
): Promise<PanelResult> {
  console.log('[ai-panel v5.1] images count:', images.length)

  const imageBlocks: Array<{ type: 'image'; source: Anthropic.ImageBlockParam['source'] }> =
    images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: img.b64 },
    }))

  const [r1, r2] = await Promise.allSettled([
    withTimeout(callSonnet(imageBlocks, declarationContext), 45000, 'Sonnet'),
    withTimeout(callHaiku(imageBlocks, declarationContext), 30000, 'Haiku'),
  ])

  const errors: Record<string, string> = {}
  const sonnet = r1.status === 'fulfilled' ? r1.value.result : (errors.sonnet = r1.reason?.message || 'Unknown', null)
  const haiku  = r2.status === 'fulfilled' ? r2.value.result : (errors.haiku  = r2.reason?.message || 'Unknown', null)

  console.log('[ai-panel v5.1] Sonnet CoT:', sonnet?.cach_nhan_dang?.slice(0, 80) ?? 'null')
  console.log('[ai-panel v5.1] Haiku CoT:', haiku?.cach_nhan_dang?.slice(0, 80) ?? 'null')

  const successCount = [sonnet, haiku].filter(Boolean).length
  const consensus = buildConsensus([sonnet, haiku])
  const guard = runHallucinationGuard([sonnet, haiku], successCount)

  console.log('[ai-panel v5.1] Guard:', guard.level)

  const inputTokens  = (r1.status === 'fulfilled' ? r1.value.usage.input_tokens  : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.input_tokens  : 0)
  const outputTokens = (r1.status === 'fulfilled' ? r1.value.usage.output_tokens : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.output_tokens : 0)

  return {
    sonnet, haiku, gemini: null, consensus, guard,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: inputTokens * 0.000003 + outputTokens * 0.000015 },
    errors,
  }
}
