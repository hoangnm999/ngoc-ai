// app/api/appraise/route.ts — v5
// Tích hợp: image preprocessor (Giải pháp 3) + ai validator (Giải pháp 2) + appraisalId return
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { runAIPanel } from '@/lib/ai-panel'
import { preprocessImages } from '@/lib/image-preprocessor'
import { applyValidation } from '@/lib/ai-validator'

export const runtime    = 'nodejs'   // sharp cần Node.js runtime
export const maxDuration = 60

// Helper: hoàn xu an toàn
async function refundXu(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  amount: number,
  note: string
) {
  const { error } = await admin.rpc('admin_add_xu', {
    admin_id: userId,
    user_id:  userId,
    amount,
    note,
  })
  if (error) console.error('[appraise] refund failed:', error.message)
}

const XU_PER_APPRAISAL = 2

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse body ────────────────────────────────────────────────────────
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
    if (images.length > 10) {
      return NextResponse.json({ error: 'Tối đa 10 ảnh' }, { status: 400 })
    }

    const MAX_B64_LENGTH = 7_000_000
    for (const img of images) {
      if (img.b64.length > MAX_B64_LENGTH) {
        return NextResponse.json(
          { error: 'Ảnh quá lớn (tối đa 5MB mỗi ảnh). Vui lòng nén ảnh trước khi upload.' },
          { status: 413 }
        )
      }
    }

    // ── 2. Preprocess ảnh — blur detection + enhance ─────────────────────────
    // Chạy TRƯỚC auth để reject ảnh mờ sớm nhất có thể (không cần đợi DB)
    let processedImages = images
    const preprocessWarnings: string[] = []

    try {
      const preprocessed = await preprocessImages(images)

      // Tất cả ảnh đều mờ → reject HTTP 400, KHÔNG trừ xu (chưa đến bước auth)
      if (preprocessed.allBlurry) {
        return NextResponse.json({
          error: 'Tất cả ảnh đều quá mờ. Vui lòng chụp lại — ánh sáng tốt, không rung tay, ảnh sắc nét.',
          code: 'ALL_IMAGES_BLURRY',
        }, { status: 400 })
      }

      // Một số ảnh mờ → bỏ qua ảnh đó, tiếp tục với ảnh còn lại
      if (preprocessed.blurredImages.length > 0) {
        console.log('[appraise] Blurry images removed:', preprocessed.blurredImages)
        preprocessWarnings.push(
          `${preprocessed.blurredImages.length} ảnh quá mờ đã bị bỏ qua: ${preprocessed.blurredImages.join(', ')}`
        )
      }

      // Gán ảnh đã xử lý (enhanced + resize, sort theo blur score DESC)
      processedImages = preprocessed.images.map(img => ({
        b64: img.b64,
        mimeType: img.mimeType,
        label: img.label,
      }))

      if (preprocessed.warnings.length > 0) {
        preprocessWarnings.push(...preprocessed.warnings)
      }

      console.log(
        `[appraise] Preprocess OK: ${processedImages.length}/${images.length} ảnh pass,`,
        `blur scores: [${preprocessed.images.map(i => i.blurScore).join(', ')}]`
      )
    } catch (prepErr) {
      // Preprocessor lỗi hoàn toàn (module missing, v.v.) → không block, dùng ảnh gốc
      console.warn('[appraise] Preprocessor failed, using original images:', (prepErr as Error).message)
    }

    // ── 3. Auth ──────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const admin = createAdminClient()

    // ── 4. Kiểm tra xu ───────────────────────────────────────────────────────
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('xu')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[appraise] profile error:', profileError)
      return NextResponse.json({ error: 'Lỗi đọc tài khoản. Vui lòng thử lại.' }, { status: 500 })
    }

    if (!profile || profile.xu < XU_PER_APPRAISAL) {
      return NextResponse.json({ error: 'Không đủ xu. Vui lòng nạp thêm.' }, { status: 402 })
    }

    // ── 5. Trừ xu TRƯỚC khi gọi AI (atomic, chống race condition) ────────────
    const { data: deducted, error: deductError } = await admin
      .rpc('deduct_xu', { p_user_id: user.id, p_amount: XU_PER_APPRAISAL })

    if (deductError || !deducted) {
      return NextResponse.json({ error: 'Không đủ xu. Vui lòng nạp thêm.' }, { status: 402 })
    }

    // ── 6. Gọi AI ────────────────────────────────────────────────────────────
    let panelResult
    try {
      panelResult = await runAIPanel(processedImages, declarationContext)
    } catch (aiErr: unknown) {
      console.error('[appraise] AI panel crashed, refunding xu:', aiErr)
      await refundXu(admin, user.id, XU_PER_APPRAISAL, 'Hoàn xu tự động — AI không phản hồi')
      return NextResponse.json(
        { error: 'AI không phản hồi. Xu đã được hoàn. Vui lòng thử lại.' },
        { status: 503 }
      )
    }

    // ── 7. Kiểm tra successCount ─────────────────────────────────────────────
    const successCount = [panelResult.sonnet, panelResult.haiku].filter(Boolean).length

    if (successCount === 0) {
      await refundXu(admin, user.id, XU_PER_APPRAISAL, 'Hoàn xu tự động — tất cả AI fail')
      return NextResponse.json({
        error: 'Tất cả AI không phản hồi. Xu đã được hoàn. Vui lòng thử lại sau.',
      }, { status: 503 })
    }

    // ── 8. Guard BLOCKED → hoàn xu ───────────────────────────────────────────
    if (panelResult.guard.blocked) {
      await refundXu(admin, user.id, XU_PER_APPRAISAL, 'Hoàn xu tự động — Guard BLOCKED')
      return NextResponse.json({
        guard:   panelResult.guard,
        blocked: true,
        sonnet:  panelResult.sonnet,
        haiku:   panelResult.haiku,
        gemini:  null,
      }, { status: 422 })
    }

    // ── 9. Validation layer — chạy SAU guard, TRƯỚC khi lưu DB ───────────────
    const validationWarnings: string[] = []

    if (panelResult.sonnet) {
      const { result: validated, warnings } = applyValidation(panelResult.sonnet)
      panelResult.sonnet = validated
      validationWarnings.push(...warnings)
    }
    if (panelResult.haiku) {
      const { result: validated, warnings } = applyValidation(panelResult.haiku)
      panelResult.haiku = validated
      validationWarnings.push(...warnings)
    }

    if (validationWarnings.length > 0) {
      console.log('[appraise] Validation warnings:', validationWarnings)
    }

    // ── 10. Lưu DB ───────────────────────────────────────────────────────────
    // declaration JSONB lưu kết quả Sonnet (rich nhất) + validation metadata
    const declarationToSave = {
      ...(panelResult.sonnet ?? {}),
      _validation_warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
      _preprocess_warnings: preprocessWarnings.length > 0 ? preprocessWarnings : undefined,
    }

    const { data: insertedRow, error: insertError } = await admin
      .from('appraisals')
      .insert({
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
        declaration:          declarationToSave,
      })
      .select('id')  // lấy id để trả về cho FeedbackWidget
      .single()

    if (insertError) {
      console.error('[appraise] insert error:', insertError.message)
      // Không return error — kết quả AI vẫn trả về user dù lưu DB fail
    }

    // ── 11. Xu còn lại ────────────────────────────────────────────────────────
    const { data: updatedProfile } = await admin
      .from('profiles')
      .select('xu')
      .eq('id', user.id)
      .maybeSingle()

    // Sanitize errors
    const safeErrors = Object.keys(panelResult.errors).length > 0
      ? Object.fromEntries(
          Object.entries(panelResult.errors).map(([k, v]) => [
            k, v.length > 80 ? v.slice(0, 80) + '…' : v,
          ])
        )
      : undefined

    return NextResponse.json({
      ...panelResult,
      xu_remaining:         updatedProfile?.xu ?? 0,
      partial_errors:       safeErrors,
      appraisalId:          insertedRow?.id ?? null,   // dùng cho FeedbackWidget
      validation_warnings:  validationWarnings.length > 0 ? validationWarnings : undefined,
      preprocess_warnings:  preprocessWarnings.length > 0 ? preprocessWarnings : undefined,
    })

  } catch (err: unknown) {
    console.error('[appraise] unexpected error:', err)
    return NextResponse.json({ error: 'Lỗi server. Vui lòng thử lại sau.' }, { status: 500 })
  }
}
