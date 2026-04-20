// app/api/appraise/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { runAIPanel } from '@/lib/ai-panel'

const XU_PER_APPRAISAL = 0

export async function POST(req: NextRequest) {
  try {
    // 1. Xác thực user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // 2. Parse body
    const body = await req.json()
    const { images, hasVideo } = body as {
      images: Array<{ b64: string; mimeType: string; label: string }>
      hasVideo: boolean
    }

    if (!images || images.length < 3) {
      return NextResponse.json({ error: 'Cần ít nhất 3 ảnh' }, { status: 400 })
    }

    // 3. Kiểm tra & trừ xu (TẠM TẮT ĐỂ TEST AI)
    /* const admin = createAdminClient()
    const { data: deducted, error: deductError } = await admin
      .rpc('deduct_xu', { p_user_id: user.id, p_amount: XU_PER_APPRAISAL })

    if (deductError || !deducted) {
      return NextResponse.json({ error: 'Không đủ xu. Vui lòng nạp thêm.' }, { status: 402 })
    }
    */

    // 4. Gọi 3 AI song song 
    const panelResult = await runAIPanel(images)

    // 5. Lưu kết quả vào DB
    await admin.from('appraisals').insert({
      user_id:              user.id,
      xu_used:              XU_PER_APPRAISAL, // Ghi nhận là 0 xu
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
    })

    // 6. Lấy số dư xu hiện tại (chỉ để hiển thị cho đẹp giao diện)
    const { data: profile } = await admin
      .from('profiles')
      .select('xu')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      ...panelResult,
      xu_remaining: profile?.xu ?? 0,
      message: "Chế độ sử dụng miễn phí đang được kích hoạt"
    })

  } catch (err: unknown) {
    console.error('[appraise]', err)
    const message = err instanceof Error ? err.message : 'Lỗi server'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
