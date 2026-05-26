// app/(app)/history/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, Label, Spinner, ScoreBar } from '@/components/ui'

/* ── Types (v3 schema — không có consensus_price_low/high) ── */
interface Appraisal {
  id: string
  created_at: string
  stone_type: string
  consensus_grade: string        /* loại đá */
  consensus_confidence: number   /* do_tin_cay 0-100 */
  images_count: number
  has_video: boolean
  xu_used: number
  declaration: {
    muc_do_tu_nhien?: string
    ly_do_tin_cay?: string
  } | null
}

const NATURAL_COLOR: Record<string, { color: string; bg: string }> = {
  'Có vẻ tự nhiên':  { color: '#065F46', bg: '#ECFDF5' },
  'Cần kiểm định':   { color: '#92400E', bg: '#FFFBEB' },
  'Nghi ngờ xử lý': { color: '#9A3412', bg: '#FFF7ED' },
  'Có thể nhân tạo': { color: '#991B1B', bg: '#FEF2F2' },
}

export default function HistoryPage() {
  const supabase = createClient()
  const [appraisals, setAppraisals] = useState<Appraisal[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('appraisals')
        .select('id,created_at,stone_type,consensus_grade,consensus_confidence,images_count,has_video,xu_used,declaration')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (data) setAppraisals(data)
      setLoading(false)
    }
    load()
  }, [supabase])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 24px 80px' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 36 }}>
        <h1 style={{ marginBottom: 8 }}>
          Lịch sử <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>nhận diện</em>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {appraisals.length} lần nhận diện đã thực hiện
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spinner size={32} />
        </div>
      )}

      {/* Empty */}
      {!loading && appraisals.length === 0 && (
        <Card style={{ padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, opacity: .15, marginBottom: 16 }}>◈</div>
          <div style={{ fontSize: 18, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>
            Chưa có lịch sử
          </div>
          <div style={{ fontSize: 15, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Upload ảnh ngọc để bắt đầu nhận diện
          </div>
        </Card>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {appraisals.map((a, i) => {
          const isOpen = expanded === a.id
          const conf   = a.consensus_confidence ?? 0
          const confColor = conf >= 70 ? 'var(--jade)' : conf >= 50 ? '#B45309' : '#DC2626'
          const natural = a.declaration?.muc_do_tu_nhien
          const naturalCfg = natural
            ? (NATURAL_COLOR[natural] ?? NATURAL_COLOR['Cần kiểm định'])
            : null

          return (
            <div key={a.id} className="fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
              <Card>
                {/* Row chính */}
                <div
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  style={{
                    padding: '18px 22px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 18,
                    transition: 'background .15s',
                    borderRadius: isOpen ? '20px 20px 0 0' : 20,
                  }}
                >
                  {/* Icon đá */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: 'var(--jade-light)',
                    border: '1px solid rgba(13,148,136,.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}>
                    ◈
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
                        {a.stone_type || a.consensus_grade || 'Đá quý'}
                      </span>
                      {naturalCfg && (
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: naturalCfg.color, background: naturalCfg.bg,
                          padding: '2px 10px', borderRadius: 99,
                          border: `1px solid ${naturalCfg.color}30`,
                        }}>
                          {natural}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(a.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                      {' · '}{a.images_count} ảnh{a.has_video ? ' + video' : ''}
                      {' · '}2 AI
                    </div>
                  </div>

                  {/* Confidence + xu */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 22, fontWeight: 700,
                      color: confColor, fontFamily: 'var(--font-mono)',
                      marginBottom: 4,
                    }}>
                      {conf}%
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      tin cậy · {a.xu_used} xu
                    </div>
                  </div>

                  {/* Chevron */}
                  <span style={{
                    fontSize: 14, color: 'var(--text-3)',
                    transition: 'transform .2s',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    flexShrink: 0,
                  }}>▾</span>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{
                    padding: '18px 22px',
                    borderTop: '1px solid var(--border)',
                  }}>
                    <Label>Độ tin cậy nhận diện</Label>
                    <ScoreBar label="Confidence" score={conf} />

                    {a.declaration?.ly_do_tin_cay && (
                      <div style={{ marginTop: 16 }}>
                        <Label>Lý do đánh giá</Label>
                        <p style={{
                          fontSize: 15, color: 'var(--text-2)',
                          fontStyle: 'italic', lineHeight: 1.7,
                          marginTop: 8,
                        }}>
                          {a.declaration.ly_do_tin_cay}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
