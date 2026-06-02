// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 10

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const body = await req.json()
    const { appraisal_id, is_correct, correct_stone_name, user_comment } = body

    // Validate required fields
    if (!appraisal_id || typeof is_correct !== 'boolean') {
      return NextResponse.json(
        { error: 'Thiếu appraisal_id hoặc is_correct' },
        { status: 400 }
      )
    }

    // Kiểm tra appraisal có thuộc về user này không (RLS sẽ chặn, nhưng check trước cho error message rõ hơn)
    const { data: appraisal, error: appraisalError } = await supabase
      .from('appraisals')
      .select('id, user_id')
      .eq('id', appraisal_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (appraisalError || !appraisal) {
      return NextResponse.json(
        { error: 'Không tìm thấy lần nhận diện này hoặc bạn không có quyền feedback' },
        { status: 403 }
      )
    }

    // Sanitize inputs
    const cleanStoneName = correct_stone_name
      ? String(correct_stone_name).slice(0, 200).trim()
      : null
    const cleanComment = user_comment
      ? String(user_comment).slice(0, 1000).trim()
      : null

    // Insert feedback — unique constraint (appraisal_id, user_id) sẽ upsert
    const { data, error: insertError } = await supabase
      .from('appraisal_feedback')
      .upsert(
        {
          appraisal_id,
          user_id: user.id,
          is_correct,
          correct_stone_name: cleanStoneName,
          user_comment: cleanComment,
        },
        { onConflict: 'appraisal_id,user_id' }  // update nếu đã feedback rồi
      )
      .select('id')
      .single()

    if (insertError) {
      console.error('[feedback API]', insertError)
      return NextResponse.json({ error: 'Lỗi lưu feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (e) {
    console.error('[feedback API] unexpected:', e)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
