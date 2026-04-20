// app/(app)/appraise/page.tsx
'use client'
import { useState, useRef, useCallback } from 'react'
import { Btn, Card, XuBadge, Label, ScoreBar, Alert, Spinner } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

/* ── Types ── */
interface AIResult {
  loai_da: string
  chat_luong?: Record<string, { diem: number; mo_ta: string }>
  gia_tri_uoc_tinh: { thap: number; cao: number }
  xep_hang: string
  nhan_xet: string
  dau_hieu_that_gia?: string
  canh_bao?: string
  do_tin_cay: number
  ghi_chu?: string
}
interface PanelResult {
  sonnet: AIResult | null
  haiku: AIResult | null
  gemini: AIResult | null
  consensus: { thap: number; cao: number; xep_hang: string; do_tin_cay: number; agreement: number } | null
  usage: { input_tokens: number; output_tokens: number; cost_usd: number }
  errors: Record<string, string>
  xu_remaining: number
}

/* ── Config ── */
const SHOT_SLOTS = [
  { id: 'tong_the',    label: 'Tổng thể',      hint: 'Toàn viên, nền trắng/đen', icon: '◈' },
  { id: 'can_canh',    label: 'Cận cảnh',       hint: 'Bề mặt, vân màu sắc',      icon: '◉' },
  { id: 'anh_sang',    label: 'Ánh sáng',       hint: 'Rọi đèn xuyên qua',         icon: '◎' },
  { id: 'goc_nghieng', label: 'Góc nghiêng',    hint: '45° — nước đá',             icon: '◐' },
  { id: 'kich_thuoc',  label: 'Kích thước',     hint: 'Cạnh thước / đồng xu',      icon: '⊡' },
]
const AI_MODELS = [
  { id: 'sonnet', name: 'Claude Sonnet', role: 'Phân tích sâu',    color: '#5eead4', vendor: 'Anthropic' },
  { id: 'haiku',  name: 'Claude Haiku',  role: 'Kiểm tra thật/giả', color: '#d4a853', vendor: 'Anthropic' },
  { id: 'gemini', name: 'Gemini Flash',  role: 'Góc nhìn độc lập',  color: '#818cf8', vendor: 'Google'    },
]
const GRADE_CFG: Record<string, { c: string; emoji: string }> = {
  'Thường':   { c: '#8892a4', emoji: '○' },
  'Khá':      { c: '#5eead4', emoji: '◎' },
  'Tốt':      { c: '#60a5fa', emoji: '◉' },
  'Xuất sắc': { c: '#d4a853', emoji: '✦' },
  'Đỉnh cao': { c: '#e879f9', emoji: '♦' },
}

/* ── Helpers ── */
function fmtVND(n: number) {
  if (!n) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} tỷ`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} tr`
  return `${n.toLocaleString('vi-VN')}đ`
}
function fileToB64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res((e.target!.result as string).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}
function checkRes(file: File): Promise<{ ok: boolean; w: number; h: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve({ ok: img.width >= 800, w: img.width, h: img.height }) }
    img.onerror = () => resolve({ ok: false, w: 0, h: 0 })
    img.src = url
  })
}
function extractFrames(file: File, n = 3): Promise<Array<{ preview: string; b64: string }>> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.src = url; v.muted = true
    const frames: Array<{ preview: string; b64: string }> = []
    let idx = 0
    v.onloadedmetadata = () => {
      const times = Array.from({ length: n }, (_, i) => (v.duration / (n + 1)) * (i + 1))
      const grab = () => {
        if (idx >= times.length) { URL.revokeObjectURL(url); resolve(frames); return }
        v.currentTime = times[idx]
      }
      v.onseeked = () => {
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
        c.getContext('2d')!.drawImage(v, 0, 0)
        const dataUrl = c.toDataURL('image/jpeg', .82)
        frames.push({ preview: dataUrl, b64: dataUrl.split(',')[1] })
        idx++; grab()
      }
      grab()
    }
    v.onerror = () => { URL.revokeObjectURL(url); resolve([]) }
  })
}

/* ── AI Card ── */
function AICard({ model, result, loading, error }: { model: typeof AI_MODELS[0]; result: AIResult | null; loading: boolean; error?: string }) {
  const cfg = GRADE_CFG[result?.xep_hang ?? ''] ?? GRADE_CFG['Tốt']
  return (
    <div style={{ flex: 1, minWidth: 0, padding: 20, borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: `1px solid ${model.color}22` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 18, color: model.color }}>◈</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{model.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{model.role}</div>
        </div>
        <span style={{ fontSize: 9, color: model.color, background: `${model.color}18`, padding: '2px 7px', borderRadius: 99, fontFamily: 'var(--font-mono)' }}>{model.vendor}</span>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '24px 0' }}><Spinner color={model.color} /><div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, fontFamily: 'var(--font-mono)' }}>Đang phân tích…</div></div>}
      {error && !loading && <Alert type="error">{error}</Alert>}
      {result && !loading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{result.loai_da}</div>
              <div style={{ fontSize: 22, color: cfg.c }}>{cfg.emoji} {result.xep_hang}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>TIN CẬY</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: result.do_tin_cay >= 75 ? '#5eead4' : '#d4a853', fontFamily: 'var(--font-mono)' }}>{result.do_tin_cay}%</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>GIÁ ƯỚC TÍNH</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: model.color }}>{fmtVND(result.gia_tri_uoc_tinh?.thap)} – {fmtVND(result.gia_tri_uoc_tinh?.cao)}</div>
          </div>
          {result.chat_luong && Object.entries(result.chat_luong).slice(0, 3).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-3)' }}>{k.replace(/_/g, ' ')}</span>
              <span style={{ color: model.color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v.diem}/10</span>
            </div>
          ))}
          {(result.nhan_xet || result.dau_hieu_that_gia) && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.6, marginTop: 10 }}>
              {result.nhan_xet || result.dau_hieu_that_gia}
            </p>
          )}
          {result.canh_bao && result.canh_bao.length > 4 && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(212,168,83,.08)', borderRadius: 6, fontSize: 11, color: '#d4a853' }}>⚠ {result.canh_bao}</div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main Page ── */
export default function AppraisePage() {
  const supabase  = createClient()
  const [xu, setXu] = useState<number | null>(null)
  const [images, setImages] = useState<Record<string, { preview: string; b64: string; type: string; ok: boolean; w: number; h: number }>>({})
  const [frames, setFrames] = useState<Array<{ preview: string; b64: string }>>([])
  const [vidLoading, setVidLoading] = useState(false)
  const [result, setResult] = useState<PanelResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const videoRef = useRef<HTMLInputElement>(null)

  // Load xu on mount
  useState(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('xu').eq('id', user.id).single()
      if (data) setXu(data.xu)
    }
    load()
  })

  const filled = Object.keys(images).length
  const canAnalyze = filled >= 3 && (xu === null || xu >= 2)

  const addImage = useCallback(async (id: string, file: File) => {
    const preview = URL.createObjectURL(file)
    const [q, b64] = await Promise.all([checkRes(file), fileToB64(file)])
    setImages(p => ({ ...p, [id]: { preview, b64, type: file.type, ok: q.ok, w: q.w, h: q.h } }))
  }, [])

  const handleVideo = async (file: File) => {
    setVidLoading(true); setFrames([])
    const f = await extractFrames(file)
    setFrames(f); setVidLoading(false)
  }

  const analyze = async () => {
    if (!canAnalyze) return
    setLoading(true); setError(''); setResult(null)

    // Build images array for API
    const imgPayload = [
      ...SHOT_SLOTS.filter(s => images[s.id]).map(s => ({
        b64: images[s.id].b64, mimeType: images[s.id].type, label: s.label,
      })),
      ...frames.map((f, i) => ({ b64: f.b64, mimeType: 'image/jpeg', label: `Video frame ${i + 1}` })),
    ]

    const resp = await fetch('/api/appraise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: imgPayload, hasVideo: frames.length > 0 }),
    })

    const data = await resp.json()
    if (!resp.ok) { setError(data.error || 'Lỗi phân tích'); setLoading(false); return }

    setResult(data)
    if (data.xu_remaining !== undefined) setXu(data.xu_remaining)
    setLoading(false)
  }

  const cons = result?.consensus
  const consCfg = cons ? (GRADE_CFG[cons.xep_hang] ?? GRADE_CFG['Tốt']) : null

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 24px 80px' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, letterSpacing: '-.01em', marginBottom: 4 }}>
              Định giá <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>Ngọc & Đá quý</em>
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              3 AI phân tích song song · Claude Sonnet · Claude Haiku · Gemini Flash
            </p>
          </div>
          {xu !== null && <XuBadge xu={xu} />}
        </div>
      </div>

      {/* Info banner */}
      <div className="fade-up-2" style={{ marginBottom: 28 }}>
        <Alert type="info">
          Yêu cầu tối thiểu <strong>3 ảnh</strong> từ các góc khác nhau · Độ phân giải ≥ 800px · <strong>Không chỉnh sửa, không filter</strong> · Mỗi lần định giá tốn <strong>2 xu</strong>
        </Alert>
      </div>

      {xu !== null && xu < 2 && (
        <div className="fade-up" style={{ marginBottom: 20 }}>
          <Alert type="warn">Không đủ xu. Vui lòng nạp thêm trong tab <strong>Ví xu</strong>.</Alert>
        </div>
      )}

      {/* Image Grid */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Label>Ảnh chụp (tối thiểu 3)</Label>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: filled >= 3 ? 'var(--jade)' : '#d4a853' }}>
            {filled} / 3 bắt buộc
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {SHOT_SLOTS.map(slot => {
            const img = images[slot.id]
            return (
              <div key={slot.id}
                onClick={() => !img && fileRefs.current[slot.id]?.click()}
                style={{
                  aspectRatio: '1', borderRadius: 10, overflow: 'hidden', position: 'relative', cursor: img ? 'default' : 'pointer',
                  border: `1.5px ${img ? 'solid' : 'dashed'} ${img && !img.ok ? 'rgba(212,168,83,.4)' : img ? 'rgba(94,234,212,.2)' : 'var(--border)'}`,
                  background: img ? 'var(--bg-3)' : 'rgba(255,255,255,.01)', transition: 'border-color .2s, background .2s',
                }}
              >
                <input ref={(el) => {fileRefs.current[slot.id] = el;}} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) addImage(slot.id, e.target.files[0]); e.target.value = '' }} />
                {img ? (
                  <>
                    <img src={img.preview} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {!img.ok && <div style={{ position: 'absolute', top: 5, left: 5, background: '#d4a853', borderRadius: 4, padding: '1px 6px', fontSize: 9, color: '#000', fontWeight: 700 }}>THẤP</div>}
                    <button onClick={e => { e.stopPropagation(); setImages(p => { const n = { ...p }; delete n[slot.id]; return n }) }}
                      style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,.75)', border: 'none', color: '#f87171', borderRadius: 5, width: 22, height: 22, fontSize: 13, backdropFilter: 'blur(4px)' }}>×</button>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 6px 4px', background: 'linear-gradient(transparent,rgba(0,0,0,.8))', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{img.w}×{img.h}</div>
                  </>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 }}>
                    <span style={{ fontSize: 22, opacity: .2 }}>{slot.icon}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', fontWeight: 500, lineHeight: 1.3 }}>{slot.label}</span>
                    <span style={{ fontSize: 9, color: 'var(--bg-3)', textAlign: 'center', lineHeight: 1.3 }}>{slot.hint}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Video Upload */}
      <Card style={{ padding: 20, marginBottom: 24 }}>
        <Label>Video quay ngọc <span style={{ color: 'var(--text-3)', fontSize: 9, textTransform: 'none' }}>— tùy chọn, tự trích 3 frames</span></Label>
        <div onClick={() => videoRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '12px 0' }}>
          <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleVideo(e.target.files[0]); e.target.value = '' }} />
          {vidLoading
            ? <><Spinner size={24} /><span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Đang trích frames…</span></>
            : frames.length > 0
              ? <>
                  {frames.map((f, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={f.preview} style={{ width: 72, height: 50, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,.7)', fontSize: 8, color: 'var(--text-2)', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>F{i + 1}</div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--jade)', marginBottom: 2 }}>✓ {frames.length} frames trích xuất</div>
                    <button onClick={e => { e.stopPropagation(); setFrames([]) }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)', padding: 0 }}>× Xoá video</button>
                  </div>
                </>
              : <><span style={{ fontSize: 22, opacity: .2 }}>▶</span><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Tải lên video — AI tự chọn 3 khung hình đại diện</span></>
          }
        </div>
      </Card>

      {/* Analyze Button */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        {!canAnalyze && filled < 3 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
            Cần thêm {3 - filled} ảnh nữa để phân tích
          </p>
        )}
        <Btn variant="jade" onClick={analyze} disabled={!canAnalyze || loading} style={{ padding: '14px 52px', fontSize: 16 }}>
          {loading
            ? <><Spinner size={16} color="#020c0a" />3 AI đang phân tích…</>
            : `◈ Phân tích ${filled} ảnh${frames.length ? ` + ${frames.length} frames` : ''} — 2 xu`}
        </Btn>
      </div>

      {error && <div style={{ marginBottom: 20 }}><Alert type="error">{error}</Alert></div>}

      {/* Results */}
      {result && (
        <div className="fade-up">
          {/* 3-AI Panel */}
          <Label>Phân tích từ 3 AI độc lập</Label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {AI_MODELS.map(m => (
              <AICard key={m.id} model={m}
                result={result[m.id as keyof Pick<PanelResult, 'sonnet'|'haiku'|'gemini'>] as AIResult | null}
                loading={false}
                error={result.errors?.[m.id]}
              />
            ))}
          </div>

          {/* Consensus */}
          {cons && consCfg && (
            <Card glow="jade" style={{ padding: '28px 32px', marginBottom: 20 }}>
              <Label>Kết quả tổng hợp — đồng thuận 3 AI</Label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 40, fontWeight: 300, color: 'var(--text)' }}>{consCfg.emoji} {cons.xep_hang}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
                    Tin cậy: <span style={{ color: cons.do_tin_cay >= 75 ? 'var(--jade)' : '#d4a853' }}>{cons.do_tin_cay}%</span>
                    {' · '}Đồng thuận: <span style={{ color: 'var(--jade)' }}>{cons.agreement}/3 AI</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>GIÁ ĐỒNG THUẬN</div>
                  <div style={{ fontSize: 32, fontWeight: 600, color: consCfg.c }}>{fmtVND(cons.thap)} – {fmtVND(cons.cao)}</div>
                </div>
              </div>
            </Card>
          )}

          {/* Sonnet detailed scores */}
          {result.sonnet?.chat_luong && (
            <Card style={{ padding: 24, marginBottom: 20 }}>
              <Label>Chất lượng chi tiết (Claude Sonnet)</Label>
              {Object.entries(result.sonnet.chat_luong).map(([k, v]) => {
                const labels: Record<string, string> = { mau_sac: 'Màu sắc', do_trong: 'Độ trong', van_da: 'Vân đá', khuyet_diem: 'Khuyết điểm', nuoc_da: 'Nước đá', gia_cong: 'Gia công' }
                return <ScoreBar key={k} label={labels[k] ?? k} score={v.diem} desc={v.mo_ta} />
              })}
            </Card>
          )}

          {/* Token cost */}
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Token: {result.usage.input_tokens.toLocaleString()} in + {result.usage.output_tokens.toLocaleString()} out
            {' · '}Chi phí: ~${result.usage.cost_usd.toFixed(4)} USD
          </div>

          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: 'var(--bg-3)' }}>
            ※ Kết quả mang tính tham khảo. Xác nhận với chuyên gia gemologist trước khi giao dịch giá trị cao.
          </div>
        </div>
      )}
    </div>
  )
}
