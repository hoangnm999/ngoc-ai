// app/api/appraise/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { runAIPanel } from '@/lib/ai-panel'

export const maxDuration = 60

const XU_PER_APPRAISAL = 2

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body trước
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

    // 2. Xác thực user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const admin = createAdminClient()

    // 3. Upsert profile + kiểm tra xu
    await admin
      .from('profiles')
      .upsert(
        { id: user.id, email: user.email ?? '', xu: 2 },
        { onConflict: 'id', ignoreDuplicates: true }
      )

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('xu')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[appraise] profile error:', profileError)
      return NextResponse.json(
        { error: `Lỗi đọc tài khoản: ${profileError.message}` },
        { status: 500 }
      )
    }

    if (!profile || profile.xu < XU_PER_APPRAISAL) {
      return NextResponse.json(
        { error: 'Không đủ xu. Vui lòng nạp thêm.' },
        { status: 402 }
      )
    }

    // 4. Gọi AI + Hallucination Guard
    const panelResult = await runAIPanel(images, declarationContext)

    // 5. Nếu 100% AI fail → không trừ xu
    const successCount = [panelResult.sonnet, panelResult.haiku, panelResult.gemini]
      .filter(Boolean).length

    if (successCount === 0) {
      return NextResponse.json({
        error: 'AI analysis failed',
        details: panelResult.errors,
        message: 'Tất cả AI không phản hồi. Vui lòng thử lại sau.'
      }, { status: 500 })
    }

    // 6. GUARD BLOCKED → không trừ xu, trả về lý do để user sửa ảnh
    if (panelResult.guard.blocked) {
      return NextResponse.json({
        guard: panelResult.guard,
        blocked: true,
        // Vẫn trả về raw results để debug nhưng không lưu DB, không trừ xu
        sonnet: panelResult.sonnet,
        haiku: panelResult.haiku,
        gemini: panelResult.gemini,
      }, { status: 422 })
      // 422 Unprocessable Entity — request hợp lệ nhưng AI không đủ tin cậy
    }

    // 7. Trừ xu (chỉ khi guard SAFE hoặc WARNING)
    const { data: deducted, error: deductError } = await admin
      .rpc('deduct_xu', { p_user_id: user.id, p_amount: XU_PER_APPRAISAL })

    if (deductError || !deducted) {
      return NextResponse.json(
        { error: 'Không đủ xu. Vui lòng nạp thêm.' },
        { status: 402 }
      )
    }

    // 8. Lưu kết quả vào DB
    const { error: insertError } = await admin.from('appraisals').insert({
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
    })

    if (insertError) {
      console.error('[appraise] insert error:', insertError)
    }

    // 9. Lấy xu còn lại
    const { data: updatedProfile } = await admin
      .from('profiles')
      .select('xu')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      ...panelResult,
      xu_remaining: updatedProfile?.xu ?? 0,
      partial_errors: Object.keys(panelResult.errors).length > 0
        ? panelResult.errors
        : undefined,
    })

  } catch (err: unknown) {
    console.error('[appraise] unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Lỗi server không xác định'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
