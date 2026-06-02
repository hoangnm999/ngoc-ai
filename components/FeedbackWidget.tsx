// components/FeedbackWidget.tsx
'use client'
import { useState } from 'react'

interface FeedbackWidgetProps {
  appraisalId: string
  stoneName: string
}

// Tách isSubmitting khỏi state để tránh TypeScript narrowing conflict
type FeedbackState = 'idle' | 'awaiting_correction' | 'done' | 'error'

export default function FeedbackWidget({ appraisalId, stoneName: _stoneName }: FeedbackWidgetProps) {
  const [state, setState]             = useState<FeedbackState>('idle')
  const [isSubmitting, setSubmitting] = useState(false)
  const [correctName, setCorrectName] = useState('')
  const [comment, setComment]         = useState('')
  const [errorMsg, setErrorMsg]       = useState('')

  const submitCorrect = async () => {
    setSubmitting(true)
    await sendFeedback(true, null, null)
    setSubmitting(false)
  }

  const clickWrong = () => setState('awaiting_correction')

  const submitWrong = async () => {
    setSubmitting(true)
    await sendFeedback(false, correctName || null, comment || null)
    setSubmitting(false)
  }

  const sendFeedback = async (
    is_correct: boolean,
    correct_stone_name: string | null,
    user_comment: string | null
  ) => {
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appraisal_id: appraisalId, is_correct, correct_stone_name, user_comment }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error || 'Lỗi gửi feedback')
        setState('error')
        return
      }
      setState('done')
    } catch {
      setErrorMsg('Lỗi kết nối mạng')
      setState('error')
    }
  }

  // ── Done ──
  if (state === 'done') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 8,
        background: '#ECFDF5', border: '1px solid #6EE7B7',
        fontSize: 14, color: '#065F46', fontFamily: 'var(--font-sans)',
      }}>
        ✓ Cảm ơn phản hồi — giúp cải thiện độ chính xác cho Ngọc AI!
      </div>
    )
  }

  // ── Error ──
  if (state === 'error') {
    return (
      <div style={{
        padding: '10px 14px', borderRadius: 8,
        background: '#FEF2F2', border: '1px solid #FECACA',
        fontSize: 13, color: '#991B1B', fontFamily: 'var(--font-sans)',
      }}>
        {errorMsg} —{' '}
        <button onClick={() => setState('idle')} style={{
          background: 'none', border: 'none', color: '#991B1B',
          cursor: 'pointer', textDecoration: 'underline', fontSize: 13,
        }}>Thử lại</button>
      </div>
    )
  }

  // ── Awaiting correction form ──
  if (state === 'awaiting_correction') {
    return (
      <div style={{
        padding: '14px 16px', borderRadius: 10,
        background: 'var(--bg-3)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-sans)', marginBottom: 10, fontWeight: 500 }}>
          Loại đá đúng là gì? (tùy chọn)
        </div>
        <input
          placeholder='Ví dụ: "Ruby" hoặc "Thạch anh tím"…'
          value={correctName}
          onChange={e => setCorrectName(e.target.value)}
          maxLength={200}
          style={{
            marginBottom: 8, fontSize: 14, padding: '8px 12px',
            background: 'var(--bg-2)', border: '1.5px solid var(--border-2)',
            borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font-sans)',
            width: '100%', boxSizing: 'border-box' as const,
          }}
        />
        <textarea
          placeholder="Nhận xét thêm (tùy chọn)…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={500}
          rows={2}
          style={{
            marginBottom: 10, fontSize: 13, padding: '8px 12px',
            background: 'var(--bg-2)', border: '1.5px solid var(--border-2)',
            borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font-sans)',
            width: '100%', resize: 'none' as const, boxSizing: 'border-box' as const,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={submitWrong}
            disabled={isSubmitting}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8,
              background: 'linear-gradient(135deg, #B8860B, #DAA520)',
              color: '#fff', border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
            }}
          >
            {isSubmitting ? 'Đang gửi…' : 'Gửi phản hồi'}
          </button>
          <button
            onClick={() => setState('idle')}
            disabled={isSubmitting}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'var(--bg-2)', border: '1px solid var(--border-2)',
              color: 'var(--text-2)', cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-sans)',
            }}
          >
            Hủy
          </button>
        </div>
      </div>
    )
  }

  // ── Idle ──
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 8,
      background: 'var(--bg-3)', border: '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)',
        fontWeight: 500, marginRight: 4,
      }}>
        Kết quả có đúng không?
      </span>

      <button
        onClick={submitCorrect}
        disabled={isSubmitting}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 20,
          background: '#ECFDF5', border: '1px solid #6EE7B7',
          color: '#065F46', cursor: isSubmitting ? 'not-allowed' : 'pointer',
          opacity: isSubmitting ? 0.6 : 1,
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
          transition: 'all .15s',
        }}
        onMouseEnter={e => { if (!isSubmitting) (e.currentTarget).style.background = '#D1FAE5' }}
        onMouseLeave={e => { (e.currentTarget).style.background = '#ECFDF5' }}
      >
        👍 Đúng
      </button>

      <button
        onClick={clickWrong}
        disabled={isSubmitting}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 20,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', cursor: isSubmitting ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
          transition: 'all .15s',
        }}
        onMouseEnter={e => { if (!isSubmitting) (e.currentTarget).style.background = '#FEE2E2' }}
        onMouseLeave={e => { (e.currentTarget).style.background = '#FEF2F2' }}
      >
        👎 Sai
      </button>
    </div>
  )
}
