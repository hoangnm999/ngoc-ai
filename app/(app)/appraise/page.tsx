// app/(app)/appraise/page.tsx — v3 Identification Mode
'use client'
import { useState, useRef, useCallback } from 'react'
import { Btn, Card, XuBadge, Label, Alert, Spinner } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

/* ── Types (sync với ai-panel.ts v3) ── */
interface AIResult {
  loai_da: string
  ten_khoa_hoc?: string
  xuat_xu_pho_bien?: string
  mau_sac: string
  do_trong: string
  dac_diem_nhan_biet: string
  hinh_dang_gia_cong: string
  dau_hieu_tu_nhien: string
  canh_bao_co_the_gia: string
  muc_do_tu_nhien: 'Có vẻ tự nhiên' | 'Cần kiểm định' | 'Nghi ngờ xử lý' | 'Có thể nhân tạo'
  nen_kiem_dinh: string
  luu_y_khi_mua: string
  do_tin_cay: number
  ly_do_tin_cay: string
}

type HallucinationLevel = 'SAFE' | 'WARNING' | 'BLOCKED'
interface HallucinationGuard {
  level: HallucinationLevel
  reasons: string[]
  blocked: boolean
  suggestion: string
}

interface ConsensusResult {
  loai_da: string
  muc_do_tu_nhien: string
  do_tin_cay: number
  dong_thuan: number
}

interface PanelResult {
  sonnet: AIResult | null
  haiku: AIResult | null
  gemini: null
  consensus: ConsensusResult | null
  guard: HallucinationGuard
  usage: { input_tokens: number; output_tokens: number; cost_usd: number }
  errors: Record<string, string>
  xu_remaining: number
  partial_errors?: Record<string, string>
}

interface BlockedResult {
  blocked: true
  guard: HallucinationGuard
}

/* ── Config ── */
const SHOT_SLOTS = [
  { id: 'tong_the',    label: 'Tổng thể',    hint: 'Toàn viên, nền trắng/đen', icon: '◈' },
  { id: 'can_canh',    label: 'Cận cảnh',    hint: 'Bề mặt, vân màu sắc',      icon: '◉' },
  { id: 'anh_sang',   label: 'Ánh sáng',    hint: 'Rọi đèn xuyên qua',         icon: '◎' },
  { id: 'goc_nghieng', label: 'Góc nghiêng', hint: '45° — nước đá',             icon: '◐' },
  { id: 'kich_thuoc',  label: 'Kích thước',  hint: 'Cạnh thước / đồng xu',      icon: '⊡' },
]

const NATURAL_CFG: Record<string, { color: string; icon: string }> = {
  'Có vẻ tự nhiên':   { color: '#5eead4', icon: '✓' },
  'Cần kiểm định':    { color: '#d4a853', icon: '?' },
  'Nghi ngờ xử lý':  { color: '#fb923c', icon: '⚠' },
  'Có thể nhân tạo':  { color: '#f87171', icon: '✕' },
}

const GUARD_CFG: Record<HallucinationLevel, { color: string; bg: string; icon: string; label: string }> = {
  SAFE:    { color: '#5eead4', bg: 'rgba(94,234,212,.08)',  icon: '✓', label: 'Nhận diện đáng tin cậy' },
  WARNING: { color: '#d4a853', bg: 'rgba(212,168,83,.08)',  icon: '⚠', label: 'Nhận diện sơ bộ — cần xác nhận thêm' },
  BLOCKED: { color: '#f87171', bg: 'rgba(248,113,113,.08)', icon: '✕', label: 'Ảnh chưa đủ để nhận diện' },
}

/* ── Helpers ── */
function checkRes(file: File): Promise<{ ok: boolean; w: number; h: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve({ ok: img.width >= 600, w: img.width, h: img.height }) }
    img.onerror = () => resolve({ ok: false, w: 0, h: 0 })
    img.src = url
  })
}

// Compress + resize — max 1600px giữ đủ chi tiết cho nhận diện
function compressImage(file: File, maxPx = 1600, quality = 0.85): Promise<{ b64: string; mimeType: string }> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      res({ b64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
    }
    img.onerror = rej
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
        const c = document.createElement('canvas')
        c.width = Math.min(v.videoWidth, 1280); c.height = Math.round(c.width * v.videoHeight / v.videoWidth)
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
        frames.push({ preview: c.toDataURL('image/jpeg', .8), b64: c.toDataURL('image/jpeg', .8).split(',')[1] })
        idx++; grab()
      }
      grab()
    }
    v.onerror = () => { URL.revokeObjectURL(url); resolve([]) }
  })
}

/* ── Sub-components ── */

function GuardBanner({ guard }: { guard: HallucinationGuard }) {
  const cfg = GUARD_CFG[guard.level]
  return (
    <div style={{ padding: '14px 18px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.color}33`, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: guard.reasons.length ? 10 : 0 }}>
        <span style={{ fontSize: 18, color: cfg.color }}>{cfg.icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>AI Confidence Guard · {guard.level}</div>
        </div>
      </div>
      {guard.reasons.map((r, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', padding: '3px 0 3px 28px', lineHeight: 1.5 }}>› {r}</div>
      ))}
      {guard.suggestion && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(0,0,0,.2)', fontSize: 12, color: 'var(--text-3)', borderLeft: `2px solid ${cfg.color}` }}>
          💡 {guard.suggestion}
        </div>
      )}
    </div>
  )
}

function BlockedPanel({ data, onRetry }: { data: BlockedResult; onRetry: () => void }) {
  return (
    <div className="fade-up">
      <GuardBanner guard={data.guard} />
      <Card style={{ padding: 24, marginBottom: 20 }}>
        <Label>Hướng dẫn chụp ảnh để AI nhận diện chính xác</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          {[
            { icon: '☀️', title: 'Ánh sáng tự nhiên', desc: 'Gần cửa sổ, tránh đèn vàng/flash' },
            { icon: '⬜', title: 'Nền đơn sắc', desc: 'Nền trắng hoặc đen, không hoa văn' },
            { icon: '🔍', title: 'Ảnh sắc nét', desc: 'Chụp cận, không rung, không mờ' },
            { icon: '📐', title: 'Nhiều góc', desc: 'Tổng thể + cận vân + ánh sáng xuyên qua' },
          ].map(tip => (
            <div key={tip.title} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{tip.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{tip.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{tip.desc}</div>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ textAlign: 'center' }}>
        <Btn variant="jade" onClick={onRetry} style={{ padding: '12px 40px' }}>↺ Thử lại với ảnh mới</Btn>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, fontFamily: 'var(--font-mono)' }}>Xu không bị trừ khi ảnh chưa đủ</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value, color }: { label: string; value?: string; color?: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: color || 'var(--text)', lineHeight: 1.5 }}>{value}</span>
    </div>
  )
}

function AICard({ name, color, vendor, role, result, error }: {
  name: string; color: string; vendor: string; role: string
  result: AIResult | null; error?: string
}) {
  const natureCfg = result ? (NATURAL_CFG[result.muc_do_tu_nhien] ?? NATURAL_CFG['Cần kiểm định']) : null
  return (
    <div style={{ flex: 1, minWidth: 0, padding: 20, borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: `1px solid ${color}22` }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 16, color }}>'◈'</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{role}</div>
        </div>
        <span style={{ fontSize: 9, color, background: `${color}18`, padding: '2px 7px', borderRadius: 99, fontFamily: 'var(--font-mono)' }}>{vendor}</span>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {result && (
        <div>
          {/* Loại đá — nổi bật */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>LOẠI ĐÁ</div>
            <div style={{ fontSize: 16, fontWeight: 600, color, lineHeight: 1.3 }}>{result.loai_da}</div>
            {result.ten_khoa_hoc && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 2 }}>{result.ten_khoa_hoc}</div>
            )}
          </div>

          {/* Tự nhiên / giả */}
          {natureCfg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: `${natureCfg.color}10`, border: `1px solid ${natureCfg.color}30` }}>
              <span style={{ fontSize: 14, color: natureCfg.color }}>{natureCfg.icon}</span>
              <span style={{ fontSize: 12, color: natureCfg.color, fontWeight: 500 }}>{result.muc_do_tu_nhien}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{result.do_tin_cay}%</span>
            </div>
          )}

          {/* Chi tiết */}
          <div style={{ fontSize: 11 }}>
            <InfoRow label="Màu sắc" value={result.mau_sac} />
            <InfoRow label="Độ trong" value={result.do_trong} />
            <InfoRow label="Đặc điểm" value={result.dac_diem_nhan_biet} />
            {result.canh_bao_co_the_gia && (
              <InfoRow label="⚠ Cảnh báo" value={result.canh_bao_co_the_gia} color="#fb923c" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ── */
export default function AppraisePage() {
  const supabase = createClient()
  const [xu, setXu] = useState<number | null>(null)
  const [images, setImages] = useState<Record<string, { preview: string; b64: string; type: string; ok: boolean; w: number; h: number }>>({})
  const [frames, setFrames] = useState<Array<{ preview: string; b64: string }>>([])
  const [vidLoading, setVidLoading] = useState(false)
  const [result, setResult] = useState<PanelResult | null>(null)
  const [blocked, setBlocked] = useState<BlockedResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const videoRef = useRef<HTMLInputElement>(null)

  useState(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('xu').eq('id', user.id).maybeSingle()
      if (data) setXu(data.xu)
    }
    load()
  })

  const filled = Object.keys(images).length
  const canAnalyze = filled >= 3 && (xu === null || xu >= 2)

  const addImage = useCallback(async (id: string, file: File) => {
    const preview = URL.createObjectURL(file)
    const [q, compressed] = await Promise.all([checkRes(file), compressImage(file)])
    setImages(p => ({ ...p, [id]: { preview, b64: compressed.b64, type: compressed.mimeType, ok: q.ok, w: q.w, h: q.h } }))
  }, [])

  const handleVideo = async (file: File) => {
    setVidLoading(true); setFrames([])
    setFrames(await extractFrames(file))
    setVidLoading(false)
  }

  const handleRetry = () => { setBlocked(null); setResult(null); setError('') }

  const analyze = async () => {
    if (!canAnalyze) return
    setLoading(true); setError(''); setResult(null); setBlocked(null)

    const imgPayload = [
      ...SHOT_SLOTS.filter(s => images[s.id]).map(s => ({
        b64: images[s.id].b64, mimeType: images[s.id].type, label: s.label,
      })),
      ...frames.map((f, i) => ({ b64: f.b64, mimeType: 'image/jpeg', label: `Video frame ${i + 1}` })),
    ]

    try {
      const resp = await fetch('/api/appraise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imgPayload, hasVideo: frames.length > 0 }),
      })
      const data = await resp.json()

      if (resp.status === 422 && data.blocked) {
        setBlocked(data as BlockedResult)
      } else if (!resp.ok) {
        setError(data.error || 'Lỗi phân tích. Vui lòng thử lại.')
      } else {
        setResult(data as PanelResult)
        if (data.xu_remaining !== undefined) setXu(data.xu_remaining)
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.')
    }
    setLoading(false)
  }

  const cons = result?.consensus

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 24px 80px' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, letterSpacing: '-.01em', marginBottom: 4 }}>
              Nhận diện <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>Ngọc & Đá quý</em>
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              2 AI phân tích · Nhận diện loại đá · Thông tin tham khảo · Không định giá
            </p>
          </div>
          {xu !== null && <XuBadge xu={xu} />}
        </div>
      </div>

      {/* Info banner */}
      <div className="fade-up-2" style={{ marginBottom: 28 }}>
        <Alert type="info">
          Tối thiểu <strong>3 ảnh</strong> từ các góc khác nhau · Ảnh sắc nét ≥ 600px · AI nhận diện loại đá và đặc điểm — <strong>không định giá chính xác</strong> · Mỗi lần tốn <strong>2 xu</strong>
        </Alert>
      </div>

      {xu !== null && xu < 2 && (
        <div style={{ marginBottom: 20 }}><Alert type="warn">Không đủ xu. Vui lòng nạp thêm trong <strong>Ví xu</strong>.</Alert></div>
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
                  aspectRatio: '1', borderRadius: 10, overflow: 'hidden', position: 'relative',
                  cursor: img ? 'default' : 'pointer',
                  border: `1.5px ${img ? 'solid' : 'dashed'} ${img && !img.ok ? 'rgba(212,168,83,.4)' : img ? 'rgba(94,234,212,.2)' : 'var(--border)'}`,
                  background: img ? 'var(--bg-3)' : 'rgba(255,255,255,.01)',
                }}
              >
                <input ref={el => { if (el) fileRefs.current[slot.id] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) addImage(slot.id, e.target.files[0]); e.target.value = '' }} />
                {img ? (
                  <>
                    <img src={img.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {!img.ok && <div style={{ position: 'absolute', top: 5, left: 5, background: '#d4a853', borderRadius: 4, padding: '1px 6px', fontSize: 9, color: '#000', fontWeight: 700 }}>NHỎ</div>}
                    <button onClick={e => { e.stopPropagation(); setImages(p => { const n = { ...p }; delete n[slot.id]; return n }) }}
                      style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,.75)', border: 'none', color: '#f87171', borderRadius: 5, width: 22, height: 22, fontSize: 13 }}>×</button>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 6px 4px', background: 'linear-gradient(transparent,rgba(0,0,0,.8))', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{img.w}×{img.h}</div>
                  </>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 }}>
                    <span style={{ fontSize: 22, opacity: .2 }}>{slot.icon}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', fontWeight: 500 }}>{slot.label}</span>
                    <span style={{ fontSize: 9, color: 'var(--bg-3)', textAlign: 'center' }}>{slot.hint}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Video */}
      <Card style={{ padding: 20, marginBottom: 24 }}>
        <Label>Video quay ngọc <span style={{ color: 'var(--text-3)', fontSize: 9, textTransform: 'none' }}>— tùy chọn</span></Label>
        <div onClick={() => videoRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '12px 0' }}>
          <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleVideo(e.target.files[0]); e.target.value = '' }} />
          {vidLoading
            ? <><Spinner size={24} /><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Đang trích frames…</span></>
            : frames.length > 0
              ? <>
                  {frames.map((f, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={f.preview} style={{ width: 72, height: 50, objectFit: 'cover', borderRadius: 6 }} />
                      <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,.7)', fontSize: 8, color: 'var(--text-2)', padding: '1px 4px', borderRadius: 3 }}>F{i + 1}</div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--jade)' }}>✓ {frames.length} frames</div>
                    <button onClick={e => { e.stopPropagation(); setFrames([]) }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 11, padding: 0 }}>× Xoá</button>
                  </div>
                </>
              : <><span style={{ fontSize: 22, opacity: .2 }}>▶</span><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Tải lên video — AI tự chọn 3 khung hình</span></>
          }
        </div>
      </Card>

      {/* Analyze Button */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        {filled < 3 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
            Cần thêm {3 - filled} ảnh nữa
          </p>
        )}
        <Btn variant="jade" onClick={analyze} disabled={!canAnalyze || loading} style={{ padding: '14px 52px', fontSize: 16 }}>
          {loading
            ? <><Spinner size={16} color="#020c0a" />AI đang nhận diện…</>
            : `◈ Nhận diện ${filled} ảnh${frames.length ? ` + ${frames.length} frames` : ''} — 2 xu`}
        </Btn>
      </div>

      {error && <div style={{ marginBottom: 20 }}><Alert type="error">{error}</Alert></div>}

      {blocked && <BlockedPanel data={blocked} onRetry={handleRetry} />}

      {/* Results */}
      {result && (
        <div className="fade-up">
          <GuardBanner guard={result.guard} />

          {/* Consensus — kết quả tổng hợp */}
          {cons && (
            <Card glow="jade" style={{ padding: '24px 28px', marginBottom: 24 }}>
              <Label>Kết quả nhận diện tổng hợp</Label>
              <div style={{ marginTop: 12 }}>
                {/* Loại đá */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>LOẠI ĐÁ</div>
                  <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--jade)', lineHeight: 1.2 }}>{cons.loai_da}</div>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {/* Mức độ tự nhiên */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>TÍNH TỰ NHIÊN</div>
                    {(() => {
                      const cfg = NATURAL_CFG[cons.muc_do_tu_nhien] ?? NATURAL_CFG['Cần kiểm định']
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20, color: cfg.color }}>{cfg.icon}</span>
                          <span style={{ fontSize: 16, color: cfg.color, fontWeight: 500 }}>{cons.muc_do_tu_nhien}</span>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Confidence */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>ĐỘ TIN CẬY NHẬN DIỆN</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: cons.do_tin_cay >= 70 ? '#5eead4' : cons.do_tin_cay >= 50 ? '#d4a853' : '#f87171', fontFamily: 'var(--font-mono)' }}>
                      {cons.do_tin_cay}%
                    </div>
                  </div>

                  {/* Đồng thuận */}
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>ĐỒNG THUẬN</div>
                    <div style={{ fontSize: 16, color: cons.dong_thuan >= 2 ? 'var(--jade)' : '#d4a853' }}>
                      {cons.dong_thuan}/2 AI
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 2 AI Cards */}
          <Label style={{ marginBottom: 12 }}>Chi tiết từ 2 AI</Label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <AICard name="Claude Sonnet" color="#5eead4" vendor="Anthropic" role="Phân tích chuyên sâu"
              result={result.sonnet} error={result.errors?.sonnet} />
            <AICard name="Claude Haiku" color="#d4a853" vendor="Anthropic" role="Xác thực nhanh"
              result={result.haiku} error={result.errors?.haiku} />
          </div>

          {/* Thông tin bổ sung từ Sonnet */}
          {result.sonnet && (
            <Card style={{ padding: 24, marginBottom: 20 }}>
              <Label>Thông tin tham khảo</Label>
              <div style={{ marginTop: 12 }}>
                <InfoRow label="Xuất xứ phổ biến" value={result.sonnet.xuat_xu_pho_bien} />
                <InfoRow label="Hình dạng / Gia công" value={result.sonnet.hinh_dang_gia_cong} />
                <InfoRow label="Dấu hiệu tự nhiên" value={result.sonnet.dau_hieu_tu_nhien} />
                <InfoRow label="Nên kiểm định" value={result.sonnet.nen_kiem_dinh} color="#5eead4" />
                <InfoRow label="Lưu ý khi mua" value={result.sonnet.luu_y_khi_mua} color="#d4a853" />
                {result.sonnet.ly_do_tin_cay && (
                  <InfoRow label="Lý do tin cậy" value={result.sonnet.ly_do_tin_cay} />
                )}
              </div>
            </Card>
          )}

          {/* Partial errors */}
          {result.partial_errors && Object.keys(result.partial_errors).length > 0 && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(212,168,83,.06)', border: '1px solid rgba(212,168,83,.2)' }}>
              <div style={{ fontSize: 11, color: '#d4a853', marginBottom: 4 }}>⚠ Một số AI không phản hồi:</div>
              {Object.entries(result.partial_errors).map(([ai, err]) => (
                <div key={ai} style={{ fontSize: 11, color: 'var(--text-3)' }}>{ai}: {err}</div>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 8 }}>
            Token: {result.usage.input_tokens.toLocaleString()} in + {result.usage.output_tokens.toLocaleString()} out
            {' · '}~${result.usage.cost_usd.toFixed(4)} USD
          </div>
          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)', textAlign: 'center', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7 }}>
            ※ Kết quả mang tính tham khảo sơ bộ — không thay thế giám định chuyên nghiệp.<br />
            Giao dịch giá trị cao nên có chứng thư từ GIA / GRS / IGI hoặc trung tâm giám định uy tín tại Việt Nam.
          </div>
        </div>
      )}
    </div>
  )
}
