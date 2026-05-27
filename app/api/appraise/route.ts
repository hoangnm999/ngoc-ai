// app/api/appraise/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { runAIPanel } from '@/lib/ai-panel'

export const maxDuration = 60

const XU_PER_APPRAISAL = 2

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body trước (trước auth để tránh timeout)
    const body = await req.json()
    const { images, hasVideo, declarationContext, declaration } = body as {
      images: Array<{ b64: string; mimeType: string; label: string }>
      hasVideo: boolean
      declarationContext?: string
      declaration?: Record<string, unknown>
    }

    // Validate input
    if (!images || images.length < 3) {
      return NextResponse.json({ error: 'Cần ít nhất 3 ảnh' }, { status: 400 })
    }
    if (images.length > 10) {
      return NextResponse.json({ error: 'Tối đa 10 ảnh' }, { status: 400 })
    }

    // Fix Bug 4: Validate kích thước ảnh — mỗi ảnh tối đa 5MB (base64 ~6.7MB string)
    const MAX_B64_LENGTH = 7_000_000
    for (const img of images) {
      if (img.b64.length > MAX_B64_LENGTH) {
        return NextResponse.json(
          { error: 'Ảnh quá lớn (tối đa 5MB mỗi ảnh). Vui lòng nén ảnh trước khi upload.' },
          { status: 413 }
        )
      }
    }

    // 2. Xác thực user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const admin = createAdminClient()

    // 3. Kiểm tra xu (bỏ upsert redundant — trigger handle_new_user() đã tạo profile)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('xu')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[appraise] profile error:', profileError)
      return NextResponse.json(
        { error: 'Lỗi đọc tài khoản. Vui lòng thử lại.' },
        { status: 500 }
      )
    }

    if (!profile || profile.xu < XU_PER_APPRAISAL) {
      return NextResponse.json(
        { error: 'Không đủ xu. Vui lòng nạp thêm.' },
        { status: 402 }
      )
    }

    // Fix Bug 1: Trừ xu TRƯỚC khi gọi AI để chặn race condition double-submit
    // deduct_xu là atomic — nếu 2 request vào cùng lúc chỉ 1 cái thành công
    const { data: deducted, error: deductError } = await admin
      .rpc('deduct_xu', { p_user_id: user.id, p_amount: XU_PER_APPRAISAL })

    if (deductError || !deducted) {
      return NextResponse.json(
        { error: 'Không đủ xu. Vui lòng nạp thêm.' },
        { status: 402 }
      )
    }

    // 4. Gọi AI + Hallucination Guard
    let panelResult
    try {
      panelResult = await runAIPanel(images, declarationContext)
    } catch (aiErr: unknown) {
      // AI call hoàn toàn crash (không phải partial fail) → hoàn xu
      console.error('[appraise] AI panel crashed, refunding xu:', aiErr)
      await admin.rpc('admin_add_xu', {
        admin_id: user.id,  // dùng tạm user.id, RPC này cần được review
        user_id:  user.id,
        amount:   XU_PER_APPRAISAL,
        note:     'Hoàn xu tự động — AI không phản hồi',
      }).catch(e => console.error('[appraise] refund failed:', e))

      return NextResponse.json(
        { error: 'AI không phản hồi. Xu đã được hoàn. Vui lòng thử lại.' },
        { status: 503 }
      )
    }

    // 5. Nếu 100% AI fail — xu đã trừ nhưng hoàn lại
    const successCount = [panelResult.sonnet, panelResult.haiku]
      .filter(Boolean).length

    if (successCount === 0) {
      await admin.rpc('admin_add_xu', {
        admin_id: user.id,
        user_id:  user.id,
        amount:   XU_PER_APPRAISAL,
        note:     'Hoàn xu tự động — tất cả AI fail',
      }).catch(e => console.error('[appraise] refund failed:', e))

      return NextResponse.json({
        error: 'Tất cả AI không phản hồi. Xu đã được hoàn. Vui lòng thử lại sau.',
        // Fix Bug 3: không expose raw error details ra client
      }, { status: 503 })
    }

    // 6. GUARD BLOCKED → hoàn xu, trả về lý do để user sửa ảnh
    if (panelResult.guard.blocked) {
      // Hoàn xu vì ảnh chưa đủ chất lượng
      await admin.rpc('admin_add_xu', {
        admin_id: user.id,
        user_id:  user.id,
        amount:   XU_PER_APPRAISAL,
        note:     'Hoàn xu tự động — Guard BLOCKED',
      }).catch(e => console.error('[appraise] refund failed:', e))

      return NextResponse.json({
        guard: panelResult.guard,
        blocked: true,
        sonnet: panelResult.sonnet,
        haiku:  panelResult.haiku,
        gemini: null,
      }, { status: 422 })
    }

    // 7. Lưu kết quả vào DB (xu đã trừ từ bước 3)
    const { error: insertError } = await admin.from('appraisals').insert({
      user_id:              user.id,
      xu_used:              XU_PER_APPRAISAL,
      images_count:         images.filter(i => !i.label.includes('frame')).length,
      has_video:            hasVideo,
      result_sonnet:        panelResult.sonnet,
      result_haiku:         panelResult.haiku,
      result_gemini:        null,
      consensus_grade:      panelResult.consensus?.loai_da,
      consensus_confidence: panelResult.consensus?.do_tin_cay,
      stone_type:           panelResult.consensus?.loai_da
                            || panelResult.sonnet?.loai_da
                            || panelResult.haiku?.loai_da,
      declaration:          declaration ?? null,
    })

    if (insertError) {
      console.error('[appraise] insert error:', insertError.message)
      // Không return error — kết quả AI vẫn trả về user dù lưu DB fail
    }

    // 8. Lấy xu còn lại
    const { data: updatedProfile } = await admin
      .from('profiles')
      .select('xu')
      .eq('id', user.id)
      .maybeSingle()

    // Fix Bug 3: Sanitize errors trước khi trả về client
    const safeErrors = Object.keys(panelResult.errors).length > 0
      ? Object.fromEntries(
          Object.entries(panelResult.errors).map(([k, v]) => [
            k,
            v.length > 80 ? v.slice(0, 80) + '…' : v
          ])
        )
      : undefined

    return NextResponse.json({
      ...panelResult,
      xu_remaining:  updatedProfile?.xu ?? 0,
      partial_errors: safeErrors,
    })

  } catch (err: unknown) {
    console.error('[appraise] unexpected error:', err)
    // Fix Bug 3: không expose stack trace
    return NextResponse.json(
      { error: 'Lỗi server. Vui lòng thử lại sau.' },
      { status: 500 }
    )
  }
}
