// app/(app)/history/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, Label, Spinner, XuBadge } from '@/components/ui'

interface Appraisal {
  id: string; created_at: string; stone_type: string
  consensus_grade: string; consensus_price_low: number; consensus_price_high: number
  consensus_confidence: number; images_count: number; has_video: boolean; xu_used: number
  result_sonnet: { nhan_xet?: string } | null
}

const GRADE_CFG: Record<string, { c: string; emoji: string }> = {
  'Thường':   { c: '#8892a4', emoji: '○' },
  'Khá':      { c: '#5eead4', emoji: '◎' },
  'Tốt':      { c: '#60a5fa', emoji: '◉' },
  'Xuất sắc': { c: '#d4a853', emoji: '✦' },
  'Đỉnh cao': { c: '#e879f9', emoji: '♦' },
}

function fmtVND(n: number) {
  if (!n) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} tỷ`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} tr`
  return `${n.toLocaleString('vi-VN')}đ`
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
        .select('id,created_at,stone_type,consensus_grade,consensus_price_low,consensus_price_high,consensus_confidence,images_count,has_video,xu_used,result_sonnet')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (data) setAppraisals(data)
      setLoading(false)
    }
    load()
  }, [supabase])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 300, letterSpacing: '-.01em', marginBottom: 6 }}>
          Lịch sử <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>định giá</em>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {appraisals.length} lần định giá đã thực hiện
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spinner size={28} />
        </div>
      )}

      {!loading && appraisals.length === 0 && (
        <Card style={{ padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, opacity: .2, marginBottom: 16 }}>◈</div>
          <div style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 8 }}>Chưa có lịch sử</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Upload ảnh ngọc để bắt đầu định giá
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {appraisals.map((a, i) => {
          const cfg = GRADE_CFG[a.consensus_grade] ?? GRADE_CFG['Tốt']
          const isOpen = expanded === a.id
          return (
            <div key={a.id} className="fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
              <Card style={{ overflow: 'hidden' }}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'background .15s' }}
                >
                  {/* Grade badge */}
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${cfg.c}14`, border: `1px solid ${cfg.c}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {cfg.emoji}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{a.stone_type || 'Đá quý'}</span>
                      <span style={{ fontSize: 11, color: cfg.c, fontFamily: 'var(--font-mono)' }}>{a.consensus_grade}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(a.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{a.images_count} ảnh{a.has_video ? ' + video' : ''}
                      {' · '}3 AI
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: cfg.c, marginBottom: 2 }}>
                      {fmtVND(a.consensus_price_low)} – {fmtVND(a.consensus_price_high)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 10, color: a.consensus_confidence >= 75 ? 'var(--jade)' : '#d4a853', fontFamily: 'var(--font-mono)' }}>
                        {a.consensus_confidence}% tin cậy
                      </span>
                      <XuBadge xu={-a.xu_used} size="sm" />
                    </div>
                  </div>

                  {/* Chevron */}
                  <span style={{ fontSize: 12, color: 'var(--text-3)', transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                </div>

                {/* Expanded detail */}
                {isOpen && a.result_sonnet?.nhan_xet && (
                  <div style={{ padding: '0 20px 18px', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <Label>Nhận xét Claude Sonnet</Label>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.7 }}>
                      {a.result_sonnet.nhan_xet}
                    </p>
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
