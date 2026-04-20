// lib/ai-panel.ts — Server-side only, API keys không bao giờ ra client
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const genAI     = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface AIResult {
  loai_da: string
  chat_luong?: Record<string, { diem: number; mo_ta: string }>
  gia_tri_uoc_tinh: { thap: number; cao: number }
  xep_hang: 'Thường' | 'Khá' | 'Tốt' | 'Xuất sắc' | 'Đỉnh cao'
  nhan_xet: string
  dau_hieu_that_gia?: string
  canh_bao?: string
  do_tin_cay: number
  ghi_chu?: string
}

export interface PanelResult {
  sonnet:    AIResult | null
  haiku:     AIResult | null
  gemini:    AIResult | null
  consensus: ConsensusResult | null
  usage:     { input_tokens: number; output_tokens: number; cost_usd: number }
  errors:    Record<string, string>
}

export interface ConsensusResult {
  thap:         number
  cao:          number
  xep_hang:     string
  do_tin_cay:   number
  agreement:    number  // số AI đồng thuận về xep_hang
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const SONNET_SYSTEM = `Bạn là chuyên gia định giá ngọc đá quý 20 năm kinh nghiệm, chuyên thị trường Việt Nam.
Phân tích TỔNG HỢP tất cả ảnh được cung cấp. Trả về JSON THUẦN TÚY (không markdown):
{"loai_da":"","chat_luong":{"mau_sac":{"diem":0,"mo_ta":""},"do_trong":{"diem":0,"mo_ta":""},"van_da":{"diem":0,"mo_ta":""},"khuyet_diem":{"diem":0,"mo_ta":""},"nuoc_da":{"diem":0,"mo_ta":""},"gia_cong":{"diem":0,"mo_ta":""}},"gia_tri_uoc_tinh":{"thap":0,"cao":0},"xep_hang":"Tốt","nhan_xet":"","dau_hieu_that_gia":"","canh_bao":"","do_tin_cay":75}`

const HAIKU_SYSTEM = `Bạn là chuyên gia xác thực ngọc đá quý, chuyên phát hiện hàng giả và xử lý hóa học.
Trả về JSON THUẦN TÚY:
{"loai_da":"","gia_tri_uoc_tinh":{"thap":0,"cao":0},"xep_hang":"Tốt","nhan_xet":"","dau_hieu_that_gia":"","canh_bao":"","do_tin_cay":70}`

const GEMINI_PROMPT = `You are an expert gemologist. Analyze these gemstone images objectively.
Return ONLY pure JSON with no markdown:
{"loai_da":"","gia_tri_uoc_tinh":{"thap":0,"cao":0},"xep_hang":"Tot","nhan_xet":"","do_tin_cay":70,"ghi_chu":""}`

// ── Individual callers ────────────────────────────────────────────────────────

async function callSonnet(imageBlocks: Anthropic.ImageBlockParam[]) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 900,
    system: SONNET_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: 'Phân tích và định giá viên ngọc/đá quý này.' },
      ],
    }],
  })
  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  return {
    result: JSON.parse(text.replace(/```json|```/g, '').trim()) as AIResult,
    usage: res.usage,
  }
}

async function callHaiku(imageBlocks: Anthropic.ImageBlockParam[]) {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: HAIKU_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: 'Kiểm tra tính xác thực và định giá nhanh.' },
      ],
    }],
  })
  const text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  return {
    result: JSON.parse(text.replace(/```json|```/g, '').trim()) as AIResult,
    usage: res.usage,
  }
}

async function callGemini(base64Images: Array<{ data: string; mimeType: string }>) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const parts = [
    { text: GEMINI_PROMPT },
    ...base64Images.map(img => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
    { text: 'Analyze and return JSON only.' },
  ]
  const result = await model.generateContent(parts)
  const text = result.response.text()
  return JSON.parse(text.replace(/```json|```/g, '').trim()) as AIResult
}

// ── Consensus builder ─────────────────────────────────────────────────────────

function buildConsensus(results: (AIResult | null)[]): ConsensusResult | null {
  const valid = results.filter(Boolean) as AIResult[]
  if (!valid.length) return null

  const avgLow  = Math.round(valid.reduce((s, r) => s + (r.gia_tri_uoc_tinh?.thap ?? 0), 0) / valid.length)
  const avgHigh = Math.round(valid.reduce((s, r) => s + (r.gia_tri_uoc_tinh?.cao  ?? 0), 0) / valid.length)
  const avgConf = Math.round(valid.reduce((s, r) => s + (r.do_tin_cay ?? 70), 0) / valid.length)

  const grades = valid.map(r => r.xep_hang).filter(Boolean)
  const count  = grades.reduce<Record<string, number>>((o, g) => { o[g] = (o[g] ?? 0) + 1; return o }, {})
  const topGrade = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Tốt'

  return { thap: avgLow, cao: avgHigh, xep_hang: topGrade, do_tin_cay: avgConf, agreement: count[topGrade] ?? 1 }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runAIPanel(images: Array<{
  b64: string
  mimeType: string
  label: string
}>): Promise<PanelResult> {
  // Build Anthropic image blocks
  const anthropicBlocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = images.flatMap(img => ([
    { type: 'text' as const, text: `[${img.label}]` },
    {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: img.b64 },
    },
  ]));

  const geminiImages = images.map(img => ({ data: img.b64, mimeType: img.mimeType }))

  // Gọi 3 AI song song
  const [r1, r2, r3] = await Promise.allSettled([
    async function callSonnet(blocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]),
    async function callHaiku(blocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]),
    callGemini(geminiImages),
  ])

  const errors: Record<string, string> = {}
  const sonnet = r1.status === 'fulfilled' ? r1.value.result : (errors.sonnet = r1.reason?.message, null)
  const haiku  = r2.status === 'fulfilled' ? r2.value.result : (errors.haiku  = r2.reason?.message, null)
  const gemini = r3.status === 'fulfilled' ? r3.value          : (errors.gemini = r3.reason?.message, null)

  // Token usage (chỉ Claude)
  const inputTokens  = (r1.status === 'fulfilled' ? r1.value.usage.input_tokens  : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.input_tokens  : 0)
  const outputTokens = (r1.status === 'fulfilled' ? r1.value.usage.output_tokens : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.output_tokens : 0)
  const costUsd      = inputTokens * 0.000003 + outputTokens * 0.000015

  return {
    sonnet, haiku, gemini,
    consensus: buildConsensus([sonnet, haiku, gemini]),
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd },
    errors,
  }
}
