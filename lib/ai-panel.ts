// lib/ai-panel.ts — Server-side only
// v5 — Few-shot examples + Chain-of-Thought + Negative prompting + Confidence calibration
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
  cach_nhan_dang?: string   // Chain-of-Thought — internal, không hiển thị UI
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
      const arrMatch = inner.match(/^\s*\[\s*(\{[\s\S]*\})/)
      if (arrMatch) return repairJSON(arrMatch[1])
    }
    return repairJSON(inner)
  }
  const truncatedFence = raw.match(/```(?:json)?\s*([\s\S]*)$/)
  if (truncatedFence) {
    const inner = truncatedFence[1].trim()
    const start = inner.indexOf('{')
    if (start !== -1) return repairJSON(inner.slice(start))
  }
  const start = raw.indexOf('{')
  if (start === -1) return raw.trim()
  const end = raw.lastIndexOf('}')
  if (end !== -1 && end > start) return raw.slice(start, end + 1).trim()
  return repairJSON(raw.slice(start))
}

function repairJSON(partial: string): string {
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
  if (inString) result += '"'
  if (!partial.includes('"do_tin_cay"')) {
    result += ',"do_tin_cay":50,"ly_do_tin_cay":"Response bị cắt — độ tin cậy giảm xuống 50%"'
  }
  result += '}'.repeat(Math.max(0, depth))
  return result
}

// ── Few-shot examples ─────────────────────────────────────────────────────────

const FEW_SHOT_EXAMPLES = `
VÍ DỤ CHUẨN (tham khảo để calibrate kết quả):

Ví dụ 1 — Emerald xanh đậm, ảnh cận rõ, thấy vân tự nhiên:
{"cach_nhan_dang":"Bước 1: Màu xanh lá đậm bão hòa, không pha xanh dương | Bước 2: Ánh thủy tinh, nửa trong suốt, thấy ánh sáng xuyên qua nhẹ | Bước 3: Thấy vân nứt tự nhiên (jardin) phân bố không đều — đặc trưng Emerald | Bước 4: Kết luận Emerald tự nhiên, độ tin cậy cao vì có jardin rõ","loai_da":"Ngọc lục bảo (Emerald)","ten_khoa_hoc":"Beryl (var. Emerald)","mau_sac":"Xanh lá đậm bão hòa, không pha xanh dương","do_trong":"Nửa trong suốt","muc_do_tu_nhien":"Có vẻ tự nhiên","do_tin_cay":82}

Ví dụ 2 — Ruby đỏ cam, ánh sáng tốt, thấy lụa (silk):
{"cach_nhan_dang":"Bước 1: Màu đỏ với sắc cam nhẹ, rất bão hòa | Bước 2: Trong suốt một phần, ánh sao mờ | Bước 3: Thấy lụa (silk) mờ bên trong — đặc trưng Ruby Miến Điện chưa xử lý nhiệt | Bước 4: Ruby tự nhiên, lụa còn nguyên nghĩa là chưa nung nhiệt","loai_da":"Ruby (Hồng ngọc)","ten_khoa_hoc":"Corundum (var. Ruby)","mau_sac":"Đỏ pigeon blood với sắc cam nhẹ","do_trong":"Trong suốt một phần, có lụa bên trong","muc_do_tu_nhien":"Có vẻ tự nhiên","do_tin_cay":78}

Ví dụ 3 — Thạch anh trắng mờ, ảnh đủ sáng nhưng không đặc điểm:
{"cach_nhan_dang":"Bước 1: Màu trắng đục đồng nhất, không có sắc màu | Bước 2: Mờ đục hoàn toàn, ánh sáng không xuyên qua | Bước 3: Không thấy vân, bọt khí, hoặc cấu trúc đặc biệt | Bước 4: Thạch anh trắng phổ thông, giá trị thấp","loai_da":"Thạch anh trắng (Quartz)","ten_khoa_hoc":"Quartz","mau_sac":"Trắng đục đồng nhất","do_trong":"Mờ đục hoàn toàn","muc_do_tu_nhien":"Có vẻ tự nhiên","do_tin_cay":70}
`

// ── Negative prompting ────────────────────────────────────────────────────────

const NEGATIVE_PROMPTS = `
CÁC CẶP ĐÁ DỄ NHẦM — ĐỌC KỸ TRƯỚC KHI KẾT LUẬN:

EMERALD: Đừng nhầm với Green Fluorite (mềm hơn, không có jardin), Chrome Diopside (xanh đậm hơn, trong hơn), Green Tourmaline (có tính lưỡng sắc mạnh hơn). Emerald thật: có jardin, màu không đồng đều.

RUBY: Đừng nhầm với Red Spinel (không lưỡng sắc, nhẹ hơn), Red Garnet (tối hơn, không lưỡng sắc), Red Tourmaline (vết nứt chiều dọc). Ruby thật: huỳnh quang đỏ, có lụa (silk).

SAPPHIRE xanh: Đừng nhầm với Blue Topaz (ánh sáng phân tán khác, nhẹ hơn), Iolite (đổi màu tím-xanh theo góc), Kyanite (độ cứng không đồng đều). Sapphire thật: xanh bão hòa, lưỡng sắc xanh-xanh lam.

JADE/JADEITE: Đừng nhầm với Serpentine (vàng lục hơn, mềm hơn nhiều), Aventurine (có ánh kim loại), Canadian Jade / Nephrite chất lượng thấp (màu đậm hơn, ít ánh). Jadeite thật: vân sợi dệt khi soi đèn.
`

// ── Confidence calibration ────────────────────────────────────────────────────

const CONFIDENCE_CALIBRATION = `
CALIBRATE do_tin_cay theo chất lượng ảnh thực tế (KHÔNG BAO GIỜ cho 100%):
80-95%: Ảnh rõ nét, thấy ít nhất 3 đặc điểm điển hình, màu đặc trưng rõ ràng
60-80%: Ảnh tương đối rõ, thấy 1-2 đặc điểm, ánh sáng chưa lý tưởng
35-60%: Ảnh mờ nhẹ hoặc thiếu sáng một phần, chỉ thấy màu sắc tổng thể
< 35%:  Ảnh quá mờ/tối — loai_da = "Chưa xác định được — cần kiểm định"
`

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildSonnetSystem(declContext?: string): string {
  const decl = declContext ? `\nThông tin người dùng khai báo:\n${declContext}\n` : ''
  return `Bạn là chuyên gia gemologist 20 năm kinh nghiệm, chuyên thị trường ngọc đá quý Việt Nam.${decl}

NHIỆM VỤ: Nhận diện loại đá và cung cấp thông tin hữu ích. KHÔNG định giá bằng số tiền.

QUY TẮC:
- Chỉ mô tả những gì THỰC SỰ nhìn thấy trong ảnh
- Nếu ảnh mờ hoàn toàn/tối đen → do_tin_cay < 35, loai_da = "Chưa xác định được — cần kiểm định"
- KHÔNG bịa đặc điểm không nhìn thấy
- Ưu tiên cảnh báo hơn reassure sai

CHAIN-OF-THOUGHT — Bắt buộc điền "cach_nhan_dang" theo 4 bước (nối bằng " | "):
  Bước 1: Màu sắc chủ đạo quan sát được (mô tả cụ thể)
  Bước 2: Độ trong suốt và cách ánh sáng tương tác với đá
  Bước 3: Cấu trúc bên trong / vân / đặc điểm bề mặt nhìn thấy
  Bước 4: Kết luận loại đá và lý do

${NEGATIVE_PROMPTS}

${CONFIDENCE_CALIBRATION}

${FEW_SHOT_EXAMPLES}

JSON SCHEMA — JSON thuần túy, không markdown:
{
  "cach_nhan_dang": "Bước 1: ... | Bước 2: ... | Bước 3: ... | Bước 4: ...",
  "loai_da": "tên đầy đủ và chính xác",
  "ten_khoa_hoc": "tên khoa học nếu biết",
  "xuat_xu_pho_bien": "vùng xuất xứ phổ biến",
  "mau_sac": "mô tả màu sắc quan sát được — cụ thể",
  "do_trong": "trong suốt / nửa trong / mờ đục — MÔ TẢ ĐỘ TRONG SUỐT, không phải Mohs",
  "dac_diem_nhan_biet": "vân, pattern, đặc điểm nhận ra được",
  "hinh_dang_gia_cong": "dạng vật phẩm và kiểu gia công",
  "dau_hieu_tu_nhien": "dấu hiệu tự nhiên quan sát thấy",
  "canh_bao_co_the_gia": "nghi ngờ nếu có, hoặc chuỗi rỗng",
  "muc_do_tu_nhien": "Có vẻ tự nhiên | Cần kiểm định | Nghi ngờ xử lý | Có thể nhân tạo",
  "nen_kiem_dinh": "nên test gì thêm",
  "luu_y_khi_mua": "lời khuyên thực tế",
  "do_tin_cay": 75,
  "ly_do_tin_cay": "lý do cụ thể tham chiếu đặc điểm đã thấy"
}`
}

function buildHaikuSystem(declContext?: string): string {
  const decl = declContext ? `\nThông tin khai báo: ${declContext}\n` : ''
  return `Bạn là chuyên gia xác thực ngọc đá quý, chuyên phát hiện hàng giả và đá xử lý.${decl}

NHIỆM VỤ: Xác thực tính tự nhiên từ ảnh. KHÔNG định giá.

QUY TẮC: Thà cảnh báo sai còn hơn reassure sai. Chỉ kết luận những gì nhìn thấy.

CHAIN-OF-THOUGHT — Điền "cach_nhan_dang" 4 bước ngắn gọn nối bằng " | "

${NEGATIVE_PROMPTS}

${CONFIDENCE_CALIBRATION}

JSON thuần túy. do_trong = mô tả độ trong suốt (KHÔNG phải Mohs). muc_do_tu_nhien = một trong 4 giá trị chính xác.

{"cach_nhan_dang":"","loai_da":"","ten_khoa_hoc":"","xuat_xu_pho_bien":"","mau_sac":"","do_trong":"trong suốt/nửa trong/mờ đục","dac_diem_nhan_biet":"","hinh_dang_gia_cong":"","dau_hieu_tu_nhien":"","canh_bao_co_the_gia":"","muc_do_tu_nhien":"Cần kiểm định","nen_kiem_dinh":"","luu_y_khi_mua":"","do_tin_cay":70,"ly_do_tin_cay":""}`
}

// ── Làm sạch tên đá ──────────────────────────────────────────────────────────

function cleanStoneName(name: string): string {
  if (!name) return name
  const dupMatch = name.match(/^([^(]+)\s*\(([^)]+)\)$/)
  if (dupMatch) {
    const before = dupMatch[1].trim()
    const inside = dupMatch[2].trim()
    const toAscii = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z]/g, '')
    const beforeAscii = toAscii(before)
    const insideAscii = toAscii(inside)
    if (
      beforeAscii === insideAscii ||
      insideAscii.startsWith(beforeAscii) || beforeAscii.startsWith(insideAscii) ||
      (beforeAscii.length > 3 && insideAscii.includes(beforeAscii)) ||
      (insideAscii.length > 3 && beforeAscii.includes(insideAscii))
    ) {
      const hasVietnamese = (s: string) => /[àáâãèéêìíòóôõùúýăđơư]/i.test(s)
      return hasVietnamese(before) ? before : inside
    }
  }
  return name
}

// ── Fallback partial extraction ───────────────────────────────────────────────

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
  if (!loai_da) return null

  const mucDoRaw = get('muc_do_tu_nhien')
  const validLevels = ['Có vẻ tự nhiên', 'Cần kiểm định', 'Nghi ngờ xử lý', 'Có thể nhân tạo'] as const
  const muc_do_tu_nhien = validLevels.find(l => mucDoRaw.includes(l)) ?? 'Cần kiểm định'

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
    ly_do_tin_cay:       get('ly_do_tin_cay')       || 'JSON response bị cắt',
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
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Phân tích các ảnh đá quý. Thực hiện chain-of-thought 4 bước rồi trả JSON.' },
        ...imageBlocks,
      ],
    }],
  })

  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  console.log('[Sonnet raw]', text.slice(0, 300))

  try {
    return {
      result: (() => {
        const r = JSON.parse(extractJSON(text)) as AIResult
        r.loai_da = cleanStoneName(r.loai_da)
        return r
      })(),
      usage: res.usage || { input_tokens: 0, output_tokens: 0 },
    }
  } catch {
    const partial = extractPartialFields(text)
    if (partial) {
      console.log('[Sonnet] using partial field extraction')
      return { result: partial, usage: res.usage || { input_tokens: 0, output_tokens: 0 } }
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
        { type: 'text', text: 'Xác thực tính tự nhiên của đá quý. Điền chain-of-thought 4 bước.' },
        ...imageBlocks,
      ],
    }],
  })

  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  console.log('[Haiku raw]', text.slice(0, 300))

  try {
    return {
      result: (() => {
        const r = JSON.parse(extractJSON(text)) as AIResult
        r.loai_da = cleanStoneName(r.loai_da)
        return r
      })(),
      usage: res.usage || { input_tokens: 0, output_tokens: 0 },
    }
  } catch {
    const partial = extractPartialFields(text)
    if (partial) {
      console.log('[Haiku] using partial field extraction')
      return { result: partial, usage: res.usage || { input_tokens: 0, output_tokens: 0 } }
    }
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
  if (l.includes('emerald') || l.includes('ngọc lục bảo')) return 'emerald'
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

// ── Hallucination Guard (5 lớp — giữ nguyên từ v4) ──────────────────────────

function runHallucinationGuard(
  results: (AIResult | null)[],
  successCount: number
): HallucinationGuard {
  const reasons: string[] = []
  let level: HallucinationLevel = 'SAFE'
  const valid = results.filter(Boolean) as AIResult[]

  if (successCount === 1) {
    reasons.push('Chỉ 1/2 AI phản hồi — kết quả chưa được cross-check')
    level = 'WARNING'
  }

  if (valid.length >= 2) {
    const types = valid.map(r => normalizeStoneType(r.loai_da))
    const unknownCount = types.filter(t => t === 'unknown').length
    const knownTypes = new Set(types.filter(t => t !== 'unknown'))
    if (unknownCount >= 2) { reasons.push('Cả 2 AI không nhận diện được loại đá — ảnh chưa đủ rõ'); level = 'BLOCKED' }
    else if (unknownCount === 1) { reasons.push('1 AI không nhận diện được loại đá'); if (level === 'SAFE') level = 'WARNING' }
    else if (knownTypes.size >= 2) { reasons.push(`2 AI nhận diện khác nhau: ${Array.from(knownTypes).join(' / ')}`); level = 'BLOCKED' }
  }

  const avgConf = valid.length ? Math.round(valid.reduce((s, r) => s + (r.do_tin_cay ?? 60), 0) / valid.length) : 0
  if (avgConf < 35) { reasons.push(`Độ tin cậy quá thấp (${avgConf}%)`); level = 'BLOCKED' }
  else if (avgConf < 50) { reasons.push(`Độ tin cậy thấp (${avgConf}%)`); if (level === 'SAFE') level = 'WARNING' }

  const suspectCount = valid.filter(r =>
    normalizeNatureLevel(r.muc_do_tu_nhien) === 'Có thể nhân tạo' ||
    normalizeNatureLevel(r.muc_do_tu_nhien) === 'Nghi ngờ xử lý'
  ).length
  if (suspectCount >= 2) { reasons.push('Cả 2 AI nghi ngờ đá xử lý hoặc nhân tạo'); if (level === 'SAFE') level = 'WARNING' }

  if (valid.length >= 2) {
    const natureLevels = valid.map(r => normalizeNatureLevel(r.muc_do_tu_nhien)).filter(Boolean)
    const uniqueNature = new Set(natureLevels)
    const hasNatural = natureLevels.some(n => n === 'Có vẻ tự nhiên')
    const hasSynthetic = natureLevels.some(n => n === 'Có thể nhân tạo')
    if (hasNatural && hasSynthetic) { reasons.push('2 AI mâu thuẫn về tính tự nhiên'); if (level === 'SAFE') level = 'WARNING' }
    else if (uniqueNature.size >= 2) { reasons.push(`2 AI không đồng thuận mức độ tự nhiên`); if (level === 'SAFE') level = 'WARNING' }
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
  const natureLevels = valid.map(r => normalizeNatureLevel(r.muc_do_tu_nhien)).filter(Boolean)
  const natureCount = natureLevels.reduce<Record<string, number>>((o, n) => { o[n] = (o[n] ?? 0) + 1; return o }, {})
  const topNature = Object.entries(natureCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Cần kiểm định'
  const bestAI = valid.reduce((a, b) => (a.do_tin_cay ?? 0) > (b.do_tin_cay ?? 0) ? a : b)
  return { loai_da: bestAI.loai_da, muc_do_tu_nhien: topNature, do_tin_cay: avgConf, dong_thuan: topType?.[1] ?? 1 }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runAIPanel(
  images: Array<{ b64: string; mimeType: string; label: string }>,
  declarationContext?: string
): Promise<PanelResult> {
  console.log('[ai-panel v5] images count:', images.length)

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
  const gemini = null

  console.log('[ai-panel v5] Sonnet CoT:', sonnet?.cach_nhan_dang?.slice(0, 100))
  console.log('[ai-panel v5] Haiku CoT:', haiku?.cach_nhan_dang?.slice(0, 100))

  const successCount = [sonnet, haiku].filter(Boolean).length
  const consensus = buildConsensus([sonnet, haiku])
  const guard = runHallucinationGuard([sonnet, haiku], successCount)

  console.log('[ai-panel v5] Guard:', guard.level)

  const inputTokens  = (r1.status === 'fulfilled' ? r1.value.usage.input_tokens  : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.input_tokens  : 0)
  const outputTokens = (r1.status === 'fulfilled' ? r1.value.usage.output_tokens : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.output_tokens : 0) 

  return {
    sonnet, haiku, gemini, consensus, guard,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: inputTokens * 0.000003 + outputTokens * 0.000015 },
    errors,
  }
}
