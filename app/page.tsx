// app/page.tsx  — Public landing page
// app/(app)/appraise/page.tsx — v3 Identification Mode
'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/* ── Animated counter ── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const start = Date.now()
      const dur = 1400
      const tick = () => {
        const p = Math.min((Date.now() - start) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setVal(Math.round(ease * to))
        if (p < 1) requestAnimationFrame(tick)
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
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
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

/* ── Feature card ── */
function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: string }) {
function InfoRow({ label, value, color }: { label: string; value?: string; color?: string }) {
  if (!value) return null
return (
    <div style={{
      padding: '28px 24px', borderRadius: 16,
      background: 'rgba(255,255,255,.025)',
      border: '1px solid rgba(255,255,255,.07)',
      transition: 'border-color .3s, transform .3s, box-shadow .3s',
      animation: `fadeUp .6s ${delay} both`,
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(94,234,212,.25)'
        el.style.transform = 'translateY(-4px)'
        el.style.boxShadow = '0 16px 48px rgba(94,234,212,.07)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(255,255,255,.07)'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 16, display: 'block' }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 400, marginBottom: 10, color: '#e8eaf0' }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#5a6478', lineHeight: 1.75, fontFamily: 'var(--font-mono)' }}>{desc}</p>
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: color || 'var(--text)', lineHeight: 1.5 }}>{value}</span>
</div>
)
}

/* ── Pricing card ── */
function PricingCard({ xu, price, turns, badge, color, features }: {
  xu: number; price: number; turns: number; badge?: string; color: string; features: string[]
function AICard({ name, color, vendor, role, result, error }: {
  name: string; color: string; vendor: string; role: string
  result: AIResult | null; error?: string
}) {
  const natureCfg = result ? (NATURAL_CFG[result.muc_do_tu_nhien] ?? NATURAL_CFG['Cần kiểm định']) : null
return (
    <div style={{
      padding: '28px 24px', borderRadius: 18, position: 'relative',
      background: badge ? `linear-gradient(145deg, ${color}0d, rgba(255,255,255,.02))` : 'rgba(255,255,255,.02)',
      border: `1.5px solid ${badge ? color + '44' : 'rgba(255,255,255,.07)'}`,
      boxShadow: badge ? `0 0 40px ${color}14` : 'none',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: color, color: '#000', fontSize: 10, fontWeight: 700,
          padding: '3px 14px', borderRadius: 99, letterSpacing: '.12em',
          fontFamily: 'var(--font-mono)',
        }}>{badge}</div>
      )}
      <div style={{ fontSize: 28, fontWeight: 600, color, marginBottom: 4 }}>{xu} xu</div>
      <div style={{ fontSize: 32, fontWeight: 300, color: '#e8eaf0', marginBottom: 4 }}>
        {(price / 1000).toFixed(0)}k <span style={{ fontSize: 14, color: '#5a6478' }}>đ</span>
      </div>
      <div style={{ fontSize: 11, color: '#5a6478', fontFamily: 'var(--font-mono)', marginBottom: 20 }}>
        {turns} lượt · {Math.round(price / turns / 1000)}k/lần
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {features.map(f => (
          <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#8892a4', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color }}>✓</span>{f}

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
        ))}
      </div>
      <Link href="/register">
        <button style={{
          width: '100%', padding: '11px', borderRadius: 99,
          background: badge ? color : 'transparent',
          border: `1.5px solid ${badge ? 'transparent' : color + '55'}`,
          color: badge ? '#000' : color,
          fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: badge ? 700 : 400,
          cursor: 'pointer', transition: 'all .2s', letterSpacing: '.04em',
        }}>
          Bắt đầu →
        </button>
      </Link>

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

/* ── Main ── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
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

  // Tạo hash nhẹ từ b64 (lấy 200 ký tự đầu + size) — đủ detect ảnh trùng
  const imageHash = (b64: string) => b64.slice(0, 200) + b64.length

  const analyze = async () => {
    if (!canAnalyze) return
    setLoading(true); setError(''); setResult(null); setBlocked(null)

    // Bug 2 fix: Detect duplicate images trước khi gọi API
    const slotImages = SHOT_SLOTS.filter(s => images[s.id]).map(s => images[s.id])
    const hashes = slotImages.map(img => imageHash(img.b64))
    const uniqueHashes = new Set(hashes)
    if (uniqueHashes.size < hashes.length) {
      const dupCount = hashes.length - uniqueHashes.size
      setError(`Phát hiện ${dupCount} ảnh trùng lặp. Vui lòng chọn ảnh từ các góc chụp khác nhau.`)
      setLoading(false)
      return
    }

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
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Top nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(6,8,16,.92)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,.07)' : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        transition: 'all .3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20, color: 'var(--jade)' }}>◈</span>
          <span style={{ fontSize: 18, fontWeight: 300 }}>
            Ngọc <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>AI</em>
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
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login">
            <button style={{ padding: '7px 18px', borderRadius: 99, background: 'transparent', border: '1px solid rgba(255,255,255,.15)', color: '#8892a4', fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all .2s' }}>
              Đăng nhập
            </button>
          </Link>
          <Link href="/register">
            <button style={{ padding: '7px 18px', borderRadius: 99, background: 'linear-gradient(135deg,#0d9488,#5eead4)', color: '#020c0a', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all .2s' }}>
              Dùng miễn phí
            </button>
          </Link>
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
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(94,234,212,.1) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(212,168,83,.07) 0%, transparent 70%)', borderRadius: '50%' }} />
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

        <div style={{ maxWidth: 780, textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 10, letterSpacing: '.35em', color: 'var(--jade)', textTransform: 'uppercase', marginBottom: 20, fontFamily: 'var(--font-mono)', animation: 'fadeIn .8s .1s both' }}>
            ✦ Hệ thống định giá ngọc thông minh
          </div>
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

          <h1 style={{ fontSize: 'clamp(40px,7vw,80px)', fontWeight: 300, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: 24, animation: 'fadeUp .8s .2s both' }}>
            Định giá Ngọc & Đá quý<br />
            <em style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, var(--jade), #22d3ee, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              bằng trí tuệ nhân tạo
            </em>
          </h1>
      {error && <div style={{ marginBottom: 20 }}><Alert type="error">{error}</Alert></div>}

          <p style={{ fontSize: 17, color: '#5a6478', lineHeight: 1.8, marginBottom: 40, maxWidth: 580, margin: '0 auto 40px', fontFamily: 'var(--font-mono)', fontWeight: 300, animation: 'fadeUp .8s .3s both' }}>
            3 AI phân tích song song — Claude Sonnet, Claude Haiku, Gemini Flash.<br />
            Kết quả trong 10 giây thay vì chờ lab 3–7 ngày.
          </p>
      {blocked && <BlockedPanel data={blocked} onRetry={handleRetry} />}

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56, animation: 'fadeUp .8s .4s both' }}>
            <Link href="/register">
              <button style={{ padding: '14px 36px', borderRadius: 99, background: 'linear-gradient(135deg,#0d9488,#5eead4)', color: '#020c0a', fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 8px 32px rgba(94,234,212,.3)', fontFamily: 'var(--font-serif)' }}>
                ◈ Bắt đầu miễn phí — 2 xu
              </button>
            </Link>
            <Link href="#how-it-works">
              <button style={{ padding: '14px 28px', borderRadius: 99, background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: '#8892a4', fontSize: 15, cursor: 'pointer', fontFamily: 'var(--font-serif)' }}>
                Xem cách hoạt động ↓
              </button>
            </Link>
          </div>
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

          {/* Stats */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp .8s .5s both' }}>
            {[
              { n: 3, s: ' AI', label: 'Phân tích song song' },
              { n: 10, s: 's', label: 'Thời gian kết quả' },
              { n: 99, s: '%', label: 'Margin lợi nhuận' },
            ].map(({ n, s, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 300, color: 'var(--jade)', lineHeight: 1 }}>
                  <Counter to={n} suffix={s} />
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
                <div style={{ fontSize: 11, color: '#434e63', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{label}</div>
</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 10, letterSpacing: '.3em', color: 'var(--jade)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>QUY TRÌNH</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300 }}>Cách hoạt động</h2>
            </Card>
          )}

          {/* 2 AI Cards */}
          <div style={{ marginBottom: 12 }}><Label>Chi tiết từ 2 AI</Label></div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <AICard name="Claude Sonnet" color="#5eead4" vendor="Anthropic" role="Phân tích chuyên sâu"
              result={result.sonnet} error={result.errors?.sonnet} />
            <AICard name="Claude Haiku" color="#d4a853" vendor="Anthropic" role="Xác thực nhanh"
              result={result.haiku} error={result.errors?.haiku} />
</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, position: 'relative' }}>
            {[
              { n: '01', title: 'Upload ảnh', desc: 'Chụp 3–5 góc: tổng thể, cận cảnh, dưới ánh sáng. Tùy chọn thêm video.' },
              { n: '02', title: '3 AI phân tích', desc: 'Claude Sonnet, Haiku và Gemini Flash xử lý song song trong ~10 giây.' },
              { n: '03', title: 'Tổng hợp kết quả', desc: 'Hệ thống tính giá đồng thuận, điểm chất lượng và độ tin cậy %.' },
              { n: '04', title: 'Nhận báo cáo', desc: 'Xếp hạng, giá ước tính, cảnh báo giả/xử lý hóa học, khuyến nghị.' },
            ].map((s, i) => (
              <div key={s.n} style={{ padding: '32px 24px', position: 'relative' }}>
                {i < 3 && <div style={{ position: 'absolute', top: 48, right: 0, width: '50%', height: 1, background: 'linear-gradient(90deg, rgba(94,234,212,.3), transparent)', pointerEvents: 'none' }} />}
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--jade)', marginBottom: 14, letterSpacing: '.1em' }}>{s.n}</div>
                <h3 style={{ fontSize: 20, fontWeight: 400, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: '#5a6478', lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>{s.desc}</p>

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
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,.015)', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 10, letterSpacing: '.3em', color: 'var(--jade)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>TÍNH NĂNG</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300 }}>Tại sao chọn Ngọc AI?</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <FeatureCard delay=".1s" icon="◈" title="3 AI độc lập" desc="Claude Sonnet phân tích sâu, Haiku kiểm tra giả/thật, Gemini Flash cho góc nhìn độc lập. Giá tổng hợp từ đồng thuận." />
            <FeatureCard delay=".15s" icon="◎" title="Multi-image + Video" desc="Upload 5 ảnh nhiều góc và video. AI trích frames tự động, phân tích toàn diện hơn từ một ảnh đơn lẻ." />
            <FeatureCard delay=".2s" icon="⊡" title="Phát hiện hàng giả" desc="Nhận diện ngọc bích type B/C tẩm polymer, xử lý nhiệt, đá tổng hợp và các dấu hiệu can thiệp hóa học." />
            <FeatureCard delay=".25s" icon="✦" title="Giá thị trường VN" desc="Tham chiếu giá ngọc thị trường Việt Nam và Đông Nam Á. Không phải giá lab quốc tế xa thực tế." />
            <FeatureCard delay=".3s" icon="◉" title="Bảo mật tuyệt đối" desc="API keys ẩn hoàn toàn phía server. Ảnh không lưu lại. Giao dịch mã hóa SSL qua VNPay/MoMo." />
            <FeatureCard delay=".35s" icon="◐" title="Lịch sử & So sánh" desc="Lưu toàn bộ lịch sử định giá. Xem lại kết quả 3 AI, score breakdown và nhận xét chuyên gia." />
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 10, letterSpacing: '.3em', color: 'var(--jade)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>GIÁ CẢ</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300, marginBottom: 12 }}>Mua xu, định giá thoải mái</h2>
            <p style={{ fontSize: 13, color: '#5a6478', fontFamily: 'var(--font-mono)' }}>Không thuê bao. Mỗi lần định giá tốn 2 xu (~2,000đ). Đăng ký nhận 2 xu miễn phí.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <PricingCard xu={2} price={0} turns={1} color="#8892a4"
              features={['1 lần định giá', '3 AI phân tích', 'Kết quả đầy đủ', 'Hết là hết']} />
            <PricingCard xu={30} price={50000} turns={15} color="#5eead4"
              features={['15 lượt định giá', '3 AI song song', 'Lịch sử định giá', '~3,300đ/lần']} />
            <PricingCard xu={70} price={99000} turns={35} badge="PHỔ BIẾN" color="#60a5fa"
              features={['35 lượt định giá', '3 AI song song', 'Ưu tiên xử lý', '~2,800đ/lần']} />
            <PricingCard xu={160} price={199000} turns={80} badge="TỐT NHẤT" color="#d4a853"
              features={['80 lượt định giá', '3 AI song song', 'Ưu tiên cao nhất', '~2,500đ/lần']} />
          </div>
            </Card>
          )}

          <div style={{ marginTop: 32, padding: '16px 24px', borderRadius: 12, background: 'rgba(94,234,212,.05)', border: '1px solid rgba(94,234,212,.15)', textAlign: 'center', fontSize: 13, color: '#5a6478', fontFamily: 'var(--font-mono)' }}>
            ✦ So sánh: Định giá lab chuyên nghiệp $50–200/viên · Ngọc AI ~2,500–3,300đ/lần (tiết kiệm 95%+)
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
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 24px 100px', borderTop: '1px solid rgba(255,255,255,.05)', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 52, marginBottom: 24, animation: 'pulse 3s ease infinite' }}>◈</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300, marginBottom: 16 }}>
            Bắt đầu định giá ngay hôm nay
          </h2>
          <p style={{ fontSize: 14, color: '#5a6478', fontFamily: 'var(--font-mono)', marginBottom: 32, lineHeight: 1.7 }}>
            Đăng ký miễn phí · Nhận 2 xu · Định giá ngay lần đầu
          </p>
          <Link href="/register">
            <button style={{ padding: '16px 44px', borderRadius: 99, background: 'linear-gradient(135deg,#0d9488,#5eead4)', color: '#020c0a', fontSize: 16, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 12px 40px rgba(94,234,212,.35)', fontFamily: 'var(--font-serif)', letterSpacing: '.03em' }}>
              ✦ Đăng ký miễn phí
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,.05)', textAlign: 'center', fontSize: 11, color: '#2d3748', fontFamily: 'var(--font-mono)' }}>
        © 2025 Ngọc AI · Kết quả mang tính tham khảo · Xác nhận với gemologist trước giao dịch lớn
      </footer>
      )}
</div>
)
}
