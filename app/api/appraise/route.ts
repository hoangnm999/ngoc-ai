// app/api/appraise/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { runAIPanel } from '@/lib/ai-panel'

// FIX: Tăng maxDuration cho Vercel (cần Pro plan cho >10s, Hobby max 60s với config này)
export const maxDuration = 60

const XU_PER_APPRAISAL = 2

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body TRƯỚC — không đụng Supabase
    const body = await req.json()
    const { images, hasVideo, declarationContext, declaration } = body as {
      images: Array<{ b64: string; mimeType: string; label: string }>
      hasVideo: boolean
      declarationContext?: string
      declaration?: Record<string, unknown>
    }

    if (!images || images.length < 3) {
      return NextResponse.json({ error: 'Cần ít nhất 3 ảnh' }, { status: 400 })
    }

    // 2. Xác thực user — sau khi validate input
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // 3. Kiểm tra xu TRƯỚC khi gọi AI — tránh gọi AI xong mới biết hết xu
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles').select('xu').eq('id', user.id).single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 })
    }

    if (profile.xu < XU_PER_APPRAISAL) {
      return NextResponse.json({ error: 'Không đủ xu. Vui lòng nạp thêm.' }, { status: 402 })
    }

    // 4. Gọi AI phân tích (chưa trừ xu)
    const panelResult = await runAIPanel(images, declarationContext)

    // FIX: Chỉ fail nếu CẢ 3 AI đều lỗi — nếu ít nhất 1 AI OK thì vẫn tiếp tục
    const successCount = [panelResult.sonnet, panelResult.haiku, panelResult.gemini]
      .filter(Boolean).length

    if (successCount === 0) {
      // Không trừ xu khi 100% AI fail
      return NextResponse.json({
        error: 'AI analysis failed',
        details: panelResult.errors,
        message: 'Tất cả AI không phản hồi. Vui lòng thử lại sau.'
      }, { status: 500 })
    }

    // 5. Trừ xu — chỉ khi có ít nhất 1 AI thành công
    const { data: deducted, error: deductError } = await admin
      .rpc('deduct_xu', { p_user_id: user.id, p_amount: XU_PER_APPRAISAL })

    if (deductError || !deducted) {
      return NextResponse.json({ error: 'Không đủ xu. Vui lòng nạp thêm.' }, { status: 402 })
    }

    // 6. Lưu kết quả vào DB
    await admin.from('appraisals').insert({
      user_id:              user.id,
      xu_used:              XU_PER_APPRAISAL,
      images_count:         images.filter(i => !i.label.includes('frame')).length,
      has_video:            hasVideo,
      result_sonnet:        panelResult.sonnet,
      result_haiku:         panelResult.haiku,
      result_gemini:        panelResult.gemini,
      consensus_grade:      panelResult.consensus?.xep_hang,
      consensus_price_low:  panelResult.consensus?.thap,
      consensus_price_high: panelResult.consensus?.cao,
      consensus_confidence: panelResult.consensus?.do_tin_cay,
      stone_type:           panelResult.sonnet?.loai_da || panelResult.haiku?.loai_da,
      declaration:          declaration ?? null,
      // FIX: Lưu thêm thông tin AI nào bị lỗi để debug sau
      ai_errors:            Object.keys(panelResult.errors).length > 0 ? panelResult.errors : null,
    })

    // 7. Lấy xu còn lại
    const { data: updatedProfile } = await admin
      .from('profiles').select('xu').eq('id', user.id).single()

    return NextResponse.json({
      ...panelResult,
      xu_remaining: updatedProfile?.xu ?? 0,
      // Trả về warning nếu có AI bị lỗi nhưng không fail toàn bộ
      partial_errors: Object.keys(panelResult.errors).length > 0 ? panelResult.errors : undefined,
    })

  } catch (err: unknown) {
    console.error('[appraise]', err)
    const message = err instanceof Error ? err.message : 'Lỗi server'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
