// lib/ai-panel.ts — Chỉ chạy ở Server-side
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

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
  agreement:    number 
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const SONNET_SYSTEM = `Bạn là chuyên gia định giá ngọc đá quý 20 năm kinh nghiệm, chuyên thị trường Việt Nam.
Phân tích TỔNG HỢP tất cả ảnh được cung cấp. Trả về JSON THUẦN TÚY (không markdown):
{"loai_da":"","chat_luong":{"mau_sac":{"diem":0,"mo_ta":""},"do_trong":{"diem":0,"mo_ta":""},"van_da":{"diem":0,"mo_ta":""},"khuyet_diem":{"diem":0,"mo_ta":""},"nuoc_da":{"diem":0,"mo_ta":""},"gia_cong":{"diem":0,"mo_ta":""}},"gia_tri_uoc_tinh":{"thap":0,"cao":0},"xep_hang":"Tốt","nhan_xet":"","dau_hieu_that_gia":"","can_bao":"","do_tin_cay":85}`

const HAIKU_SYSTEM = `Bạn là chuyên gia xác thực ngọc đá quý, chuyên phát hiện hàng giả và xử lý hóa học.
Trả về JSON THUẦN TÚY:
{"loai_da":"","gia_tri_uoc_tinh":{"thap":0,"cao":0},"xep_hang":"Tốt","nhan_xet":"","dau_hieu_that_gia":"","can_bao":"","do_tin_cay":70}`

const GEMINI_PROMPT = `You are an expert gemologist. Analyze these gemstone images objectively.
Return ONLY pure JSON. Do not include any text outside the JSON object:
{"loai_da":"","gia_tri_uoc_tinh":{"thap":0,"cao":0},"xep_hang":"Tốt","nhan_xet":"","do_tin_cay":70}`

// ── Individual callers ────────────────────────────────────────────────────────

async function callSonnet(imageBlocks: any[]) {
  const res = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1000,
    system: SONNET_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: 'Hãy phân tích chi tiết và định giá viên đá này.' },
      ],
    }],
  })
  const text = res.content.find(b => b.type === 'text' && 'text' in b)?.text ?? '{}'
  return {
    result: JSON.parse(text.replace(/```json|```/g, '').trim()) as AIResult,
    usage: res.usage,
  }
}

async function callHaiku(imageBlocks: any[]) {
  const res = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 600,
    system: HAIKU_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: 'Xác thực nhanh và đưa ra nhận xét về tính tự nhiên.' },
      ],
    }],
  })
  const text = res.content.find(b => b.type === 'text' && 'text' in b)?.text ?? '{}'
  return {
    result: JSON.parse(text.replace(/```json|```/g, '').trim()) as AIResult,
    usage: res.usage,
  }
}

async function callGemini(base64Images: Array<{ data: string; mimeType: string }>) {
  try {
    // 1. Kiểm tra API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('[Gemini] Lỗi: Thiếu API Key trong biến môi trường');
      return null;
    }

    // 2. Cấu hình Model với JSON Mode và tắt bộ lọc an toàn để tránh chặn nhầm ảnh đá quý
    const model = genAI.getGenerativeModel(
      { 
        model: 'gemini-1.5-flash-latest',
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1, // Giảm tối đa sự sáng tạo để đảm bảo cấu trúc JSON
        },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      },
      { apiVersion: 'v1beta' }
    ) 
    
    // 3. Chuẩn bị dữ liệu gửi đi (Prompt + Ảnh)
    const parts = [
      { text: GEMINI_PROMPT },
      ...base64Images.map(img => ({ 
        inlineData: { 
          data: img.data, 
          mimeType: img.mimeType 
        } 
      })),
    ]
    
    // 4. Gọi API
    const result = await model.generateContent(parts)
    const text = result.response.text()
    
    if (!text || text.trim() === "") {
      console.warn('[Gemini] Cảnh báo: AI trả về nội dung rỗng');
      return null;
    }
    
    // 5. Parse và trả về kết quả
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson) as AIResult;
    
  } catch (err: any) {
    console.error('[Gemini Error Details]', err);
    return null;
  }
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
  const anthropicBlocks: any[] = images.flatMap(img => ([
    { type: 'text', text: `[Ảnh: ${img.label}]` },
    {
      type: 'image',
      source: { 
        type: 'base64', 
        media_type: img.mimeType as any, 
        data: img.b64 
      },
    },
  ]));

  const geminiImages = images.map(img => ({ data: img.b64, mimeType: img.mimeType }))

  const [r1, r2, r3] = await Promise.allSettled([
    callSonnet(anthropicBlocks),
    callHaiku(anthropicBlocks),
    callGemini(geminiImages),
  ])

  const errors: Record<string, string> = {}
  const sonnet = r1.status === 'fulfilled' ? r1.value.result : (errors.sonnet = r1.reason?.message, null)
  const haiku  = r2.status === 'fulfilled' ? r2.value.result : (errors.haiku  = r2.reason?.message, null)
  const gemini = r3.status === 'fulfilled' ? r3.value          : (errors.gemini = r3.reason?.message, null)

  const inputTokens  = (r1.status === 'fulfilled' ? r1.value.usage.input_tokens  : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.input_tokens  : 0)
  const outputTokens = (r1.status === 'fulfilled' ? r1.value.usage.output_tokens : 0)
                     + (r2.status === 'fulfilled' ? r2.value.usage.output_tokens : 0)
  
  const costUsd = (inputTokens * 0.000003) + (outputTokens * 0.000015)

  return {
    sonnet, haiku, gemini,
    consensus: buildConsensus([sonnet, haiku, gemini]),
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd },
    errors,
  }
}
