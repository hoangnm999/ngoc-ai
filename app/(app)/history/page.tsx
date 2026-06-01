// app/(app)/history/page.tsx — v4
// Tính năng: card grid, filter, cursor pagination, modal chi tiết, CSV export
'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, Label, Btn, Spinner, Alert, ScoreBar } from '@/components/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Declaration {
  loai_da?: string
  ten_khoa_hoc?: string
  xuat_xu_pho_bien?: string
  mau_sac?: string
  do_trong?: string
  dac_diem_nhan_biet?: string
  hinh_dang_gia_cong?: string
  dau_hieu_tu_nhien?: string
  canh_bao_co_the_gia?: string
  muc_do_tu_nhien?: string
  nen_kiem_dinh?: string
  luu_y_khi_mua?: string
  do_tin_cay?: number
  ly_do_tin_cay?: string
}

interface Appraisal {
  id: string
  created_at: string
  stone_type: string
  consensus_grade: string
  consensus_confidence: number
  images_count: number
  has_video: boolean
  xu_used: number
  declaration: Declaration | null
}

type TimeFilter = 'all' | 'today' | '7d' | 'month'
type ConfFilter = 'all' | 'high' | 'mid' | 'low'
type StoneFilter = string  // 'all' hoặc tên loại đá

const PAGE_SIZE = 12

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NATURAL_COLOR: Record<string, { color: string; bg: string; icon: string }> = {
  'Có vẻ tự nhiên':  { color: '#065F46', bg: '#ECFDF5', icon: '✓' },
  'Cần kiểm định':   { color: '#92400E', bg: '#FEF3C7', icon: '?' },
  'Nghi ngờ xử lý': { color: '#9A3412', bg: '#FFF7ED', icon: '⚠' },
  'Có thể nhân tạo': { color: '#991B1B', bg: '#FEE2E2', icon: '✕' },
}

const STONE_ICONS: Record<string, { icon: string; color: string }> = {
  jade:     { icon: '◈', color: '#0D9488' },
  ruby:     { icon: '◆', color: '#DC2626' },
  sapphire: { icon: '◉', color: '#2563EB' },
  emerald:  { icon: '◈', color: '#059669' },
  diamond:  { icon: '◇', color: '#7C3AED' },
  default:  { icon: '◈', color: '#B45309' },
}

function getStoneVisual(name: string): { icon: string; color: string } {
  const l = name.toLowerCase()
  if (l.includes('jade') || l.includes('ngọc bích') || l.includes('jadeite') || l.includes('nephrite') || l.includes('phỉ thúy')) return STONE_ICONS.jade
  if (l.includes('ruby') || l.includes('hồng ngọc')) return STONE_ICONS.ruby
  if (l.includes('sapphire') || l.includes('saphia') || l.includes('lam ngọc')) return STONE_ICONS.sapphire
  if (l.includes('emerald') || l.includes('ngọc lục bảo')) return STONE_ICONS.emerald
  if (l.includes('diamond') || l.includes('kim cương')) return STONE_ICONS.diamond
  return STONE_ICONS.default
}

function confColor(v: number) {
  if (v >= 70) return 'var(--jade)'
  if (v >= 50) return '#B45309'
  return '#DC2626'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function buildTimeFilter(tf: TimeFilter): string | null {
  const now = new Date()
  if (tf === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }
  if (tf === '7d') {
    const d = new Date(now); d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (tf === 'month') {
    const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  return null
}

function exportCSV(rows: Appraisal[]) {
  const header = ['Thời gian', 'Loại đá', 'Độ tin cậy (%)', 'Màu sắc', 'Độ trong', 'Mức độ tự nhiên', 'Xu đã dùng']
  const lines = rows.map(a => [
    fmtDate(a.created_at),
    a.consensus_grade || a.stone_type || '',
    String(a.consensus_confidence ?? 0),
    a.declaration?.mau_sac ?? '',
    a.declaration?.do_trong ?? '',
    a.declaration?.muc_do_tu_nhien ?? '',
    String(a.xu_used ?? 0),
  ].map(v => `"${v.replace(/"/g, '""')}"`).join(','))

  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `ngoc-ai-history-${Date.now()}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// Lấy danh sách loại đá duy nhất từ kết quả
function extractStoneTypes(rows: Appraisal[]): string[] {
  const set = new Set<string>()
  rows.forEach(a => {
    const name = a.consensus_grade || a.stone_type || ''
    if (name && name !== 'Chưa xác định được — cần kiểm định') set.add(name)
  })
  return Array.from(set).sort()
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function NaturalBadge({ value }: { value?: string }) {
  if (!value) return null
  const cfg = NATURAL_COLOR[value] ?? NATURAL_COLOR['Cần kiểm định']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
      padding: '2px 9px', borderRadius: 99,
      border: `1px solid ${cfg.color}25`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {value}
    </span>
  )
}

function StoneAvatar({ name, size = 52 }: { name: string; size?: number }) {
  const { icon, color } = getStoneVisual(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25,
      background: color + '18',
      border: `1.5px solid ${color}35`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, color, flexShrink: 0,
      transition: 'transform .2s',
    }}>
      {icon}
    </div>
  )
}

function InfoRow({ label, value, color }: { label: string; value?: string; color?: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{
        fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)',
        fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase',
        minWidth: 148, flexShrink: 0, paddingTop: 1,
      }}>{label}</span>
      <span style={{ fontSize: 14, color: color || 'var(--text)', lineHeight: 1.65 }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal chi tiết
// ─────────────────────────────────────────────────────────────────────────────

function DetailModal({ item, onClose, onReanalyze }: {
  item: Appraisal
  onClose: () => void
  onReanalyze: (id: string) => void
}) {
  const d = item.declaration
  const conf = item.consensus_confidence ?? 0
  const stoneName = item.consensus_grade || item.stone_type || 'Đá quý'

  // Đóng khi click backdrop
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Đóng bằng Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(28,27,26,.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
        animation: 'fadeIn .2s ease',
      }}
    >
      <div style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        width: '100%', maxWidth: 640,
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,.18)',
        animation: 'fadeUp .25s cubic-bezier(.16,1,.3,1)',
      }}>
        {/* Header modal */}
        <div style={{
          padding: '22px 28px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <StoneAvatar name={stoneName} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Chi tiết nhận diện
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text)', lineHeight: 1.2, marginBottom: 6 }}>
              {stoneName}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <NaturalBadge value={d?.muc_do_tu_nhien} />
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {fmtDate(item.created_at)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 8, width: 32, height: 32,
              fontSize: 16, color: 'var(--text-2)',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Body scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

          {/* Confidence */}
          <ScoreBar label="Độ tin cậy" score={conf} desc={d?.ly_do_tin_cay} />

          {/* Thông tin cơ bản */}
          <div style={{ marginTop: 20, marginBottom: 8 }}>
            <Label>Đặc điểm quan sát</Label>
          </div>
          <InfoRow label="Màu sắc" value={d?.mau_sac} />
          <InfoRow label="Độ trong" value={d?.do_trong} />
          <InfoRow label="Đặc điểm nhận biết" value={d?.dac_diem_nhan_biet} />
          <InfoRow label="Hình dạng / Gia công" value={d?.hinh_dang_gia_cong} />

          {/* Xác thực */}
          <div style={{ marginTop: 20, marginBottom: 8 }}>
            <Label>Xác thực tính tự nhiên</Label>
          </div>
          <InfoRow label="Dấu hiệu tự nhiên" value={d?.dau_hieu_tu_nhien} color="var(--jade-text)" />
          {d?.canh_bao_co_the_gia && (
            <InfoRow label="Cảnh báo" value={d.canh_bao_co_the_gia} color="#9A3412" />
          )}

          {/* Nguồn gốc */}
          {(d?.ten_khoa_hoc || d?.xuat_xu_pho_bien) && (
            <>
              <div style={{ marginTop: 20, marginBottom: 8 }}>
                <Label>Thông tin học thuật</Label>
              </div>
              <InfoRow label="Tên khoa học" value={d?.ten_khoa_hoc} />
              <InfoRow label="Xuất xứ phổ biến" value={d?.xuat_xu_pho_bien} />
            </>
          )}

          {/* Khuyến nghị */}
          <div style={{ marginTop: 20, marginBottom: 8 }}>
            <Label>Khuyến nghị</Label>
          </div>
          <InfoRow label="Nên kiểm định" value={d?.nen_kiem_dinh} color="var(--jade-text)" />
          <InfoRow label="Lưu ý khi mua" value={d?.luu_y_khi_mua} color="#92400E" />

          {/* Meta */}
          <div style={{
            marginTop: 20, padding: '12px 14px', borderRadius: 10,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            lineHeight: 1.7,
          }}>
            {item.images_count} ảnh{item.has_video ? ' + video' : ''} · 2 AI · {item.xu_used} xu
          </div>

          {/* Disclaimer */}
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: '#FFFBEB', border: '1px solid #FDE68A',
            fontSize: 12, color: '#78350F', lineHeight: 1.6,
          }}>
            ※ Kết quả mang tính tham khảo sơ bộ — không thay thế giám định chuyên nghiệp.
          </div>
        </div>

        {/* Footer modal */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <Btn variant="ghost" onClick={onClose} style={{ padding: '9px 20px', fontSize: 14 }}>
            Đóng
          </Btn>
          <Btn variant="jade" onClick={() => { onClose(); onReanalyze(item.id) }} style={{ padding: '9px 20px', fontSize: 14 }}>
            ↺ Phân tích lại
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// History Card
// ─────────────────────────────────────────────────────────────────────────────

function HistoryCard({
  item, index, onDetail, onReanalyze
}: {
  item: Appraisal
  index: number
  onDetail: (item: Appraisal) => void
  onReanalyze: (id: string) => void
}) {
  const d = item.declaration
  const conf = item.consensus_confidence ?? 0
  const stoneName = item.consensus_grade || item.stone_type || 'Đá quý'
  const natural = d?.muc_do_tu_nhien
  const hasWarning = d?.canh_bao_co_the_gia && d.canh_bao_co_the_gia.trim() !== ''

  return (
    <div
      className="fade-up"
      style={{ animationDelay: `${index * 0.035}s` }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = '0 8px 28px rgba(0,0,0,.1)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = ''
        el.style.transform = ''
      }}
    >
      <Card style={{ padding: 0, overflow: 'hidden', transition: 'box-shadow .2s, transform .2s' }}>
        {/* Top: avatar + tên + badge */}
        <div style={{ padding: '18px 20px 14px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
            <StoneAvatar name={stoneName} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text)',
                fontFamily: 'var(--font-serif)',
                lineHeight: 1.3, marginBottom: 5,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {stoneName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <NaturalBadge value={natural} />
                {hasWarning && (
                  <span style={{
                    fontSize: 11, color: '#9A3412', background: '#FFF7ED',
                    padding: '2px 8px', borderRadius: 99, border: '1px solid #9A341225',
                    fontWeight: 600,
                  }}>⚠ Có cảnh báo</span>
                )}
              </div>
            </div>
            {/* Confidence */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: 24, fontWeight: 700,
                color: confColor(conf),
                fontFamily: 'var(--font-mono)',
                lineHeight: 1,
              }}>{conf}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                tin cậy
              </div>
            </div>
          </div>

          {/* Màu sắc + Độ trong */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
            marginBottom: 4,
          }}>
            {d?.mau_sac && (
              <div style={{
                padding: '8px 10px', borderRadius: 8,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                  Màu sắc
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                  {d.mau_sac}
                </div>
              </div>
            )}
            {d?.do_trong && (
              <div style={{
                padding: '8px 10px', borderRadius: 8,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                  Độ trong
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                  {d.do_trong}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confidence bar */}
        <div style={{ padding: '0 20px', marginBottom: 14 }}>
          <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${conf}%`,
              background: `linear-gradient(90deg, ${confColor(conf)}88, ${confColor(conf)})`,
              borderRadius: 99,
            }} />
          </div>
        </div>

        {/* Footer: meta + actions */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-3)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
            {fmtDate(item.created_at)}<br />
            {item.images_count} ảnh · {item.xu_used} xu
          </div>
          <button
            onClick={() => onReanalyze(item.id)}
            title="Phân tích lại"
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--border-2)',
              borderRadius: 8, padding: '6px 10px',
              fontSize: 13, color: 'var(--text-2)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500,
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--jade)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--jade)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)' }}
          >
            ↺
          </button>
          <Btn
            variant="ghost"
            onClick={() => onDetail(item)}
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            Xem chi tiết →
          </Btn>
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Card
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
          <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 13, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 14, width: '45%' }} />
          </div>
          <div className="skeleton" style={{ width: 40, height: 32, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="skeleton" style={{ height: 56, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 56, borderRadius: 8 }} />
        </div>
      </div>
      <div style={{ padding: '0 20px 14px' }}>
        <div className="skeleton" style={{ height: 4, borderRadius: 99 }} />
      </div>
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-3)', display: 'flex', gap: 8 }}>
        <div className="skeleton" style={{ flex: 1, height: 30, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 70, height: 30, borderRadius: 6 }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const supabase = createClient()

  // Data
  const [appraisals, setAppraisals]   = useState<Appraisal[]>([])
  const [allRows, setAllRows]         = useState<Appraisal[]>([])  // dùng cho CSV + unique stone types
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [hasMore, setHasMore]         = useState(false)
  const [cursor, setCursor]           = useState<string | null>(null)  // created_at của item cuối

  // UI
  const [modal, setModal]             = useState<Appraisal | null>(null)
  const [reanalyzeId, setReanalyzeId] = useState<string | null>(null)
  const [exporting, setExporting]     = useState(false)

  // Filters
  const [search, setSearch]           = useState('')
  const [stoneFilter, setStoneFilter] = useState<StoneFilter>('all')
  const [timeFilter, setTimeFilter]   = useState<TimeFilter>('all')
  const [confFilter, setConfFilter]   = useState<ConfFilter>('all')

  // debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // ─── Build query ───────────────────────────────────────────────────────────

  const buildQuery = useCallback(async (afterCursor: string | null = null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    let q = supabase
      .from('appraisals')
      .select('id,created_at,stone_type,consensus_grade,consensus_confidence,images_count,has_video,xu_used,declaration')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1)  // +1 để detect hasMore

    // Cursor pagination
    if (afterCursor) {
      q = q.lt('created_at', afterCursor)
    }

    // Time filter
    const since = buildTimeFilter(timeFilter)
    if (since) q = q.gte('created_at', since)

    // Stone filter
    if (stoneFilter !== 'all') {
      q = q.or(`consensus_grade.ilike.%${stoneFilter}%,stone_type.ilike.%${stoneFilter}%`)
    }

    // Confidence filter
    if (confFilter === 'high') q = q.gte('consensus_confidence', 80)
    else if (confFilter === 'mid') q = q.gte('consensus_confidence', 50).lt('consensus_confidence', 80)
    else if (confFilter === 'low') q = q.lt('consensus_confidence', 50)

    // Search
    if (debouncedSearch) {
      q = q.or(`consensus_grade.ilike.%${debouncedSearch}%,stone_type.ilike.%${debouncedSearch}%`)
    }

    return q
  }, [supabase, timeFilter, stoneFilter, confFilter, debouncedSearch])

  // ─── Initial load ──────────────────────────────────────────────────────────

  const loadFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCursor(null)
    setAppraisals([])

    try {
      const q = await buildQuery(null)
      if (!q) { setLoading(false); return }

      const { data, error: err } = await q
      if (err) throw err

      const items = (data ?? []) as Appraisal[]
      const hasNext = items.length > PAGE_SIZE
      const page = hasNext ? items.slice(0, PAGE_SIZE) : items

      setAppraisals(page)
      setHasMore(hasNext)
      setCursor(page.length > 0 ? page[page.length - 1].created_at : null)
    } catch (e) {
      setError('Không tải được lịch sử. Vui lòng thử lại.')
      console.error('[history]', e)
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  // Load thêm trang kế
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)

    try {
      const q = await buildQuery(cursor)
      if (!q) { setLoadingMore(false); return }

      const { data, error: err } = await q
      if (err) throw err

      const items = (data ?? []) as Appraisal[]
      const hasNext = items.length > PAGE_SIZE
      const page = hasNext ? items.slice(0, PAGE_SIZE) : items

      setAppraisals(prev => [...prev, ...page])
      setHasMore(hasNext)
      setCursor(page.length > 0 ? page[page.length - 1].created_at : null)
    } catch (e) {
      console.error('[history loadMore]', e)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore, buildQuery])

  // Load all rows cho CSV (không giới hạn)
  const loadAllForExport = useCallback(async () => {
    setExporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('appraisals')
        .select('id,created_at,stone_type,consensus_grade,consensus_confidence,images_count,has_video,xu_used,declaration')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (data) exportCSV(data as Appraisal[])
    } finally {
      setExporting(false)
    }
  }, [supabase])

  // Load all (first page) để lấy unique stone types cho dropdown
  const loadAllStoneTypes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('appraisals')
      .select('consensus_grade,stone_type')
      .eq('user_id', user.id)
      .limit(500)
    if (data) setAllRows(data as Appraisal[])
  }, [supabase])

  useEffect(() => { loadAllStoneTypes() }, [loadAllStoneTypes])

  // Reset + reload khi filter thay đổi
  useEffect(() => { loadFirst() }, [loadFirst])

  // ─── Reanalyze handler ─────────────────────────────────────────────────────
  // Redirect sang /appraise — ảnh gốc không lưu trong DB, user cần upload lại
  const handleReanalyze = useCallback((id: string) => {
    setReanalyzeId(id)
    // Thông báo rồi redirect
    setTimeout(() => {
      window.location.href = '/appraise'
    }, 1400)
  }, [])

  // ─── Render ────────────────────────────────────────────────────────────────

  const stoneTypes = extractStoneTypes(allRows)

  return (
    <>
      {/* Modal */}
      {modal && (
        <DetailModal
          item={modal}
          onClose={() => setModal(null)}
          onReanalyze={handleReanalyze}
        />
      )}

      {/* Reanalyze toast */}
      {reanalyzeId && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: 'var(--jade)', color: '#fff',
          padding: '12px 20px', borderRadius: 12,
          fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500,
          boxShadow: '0 8px 24px rgba(13,148,136,.35)',
          animation: 'fadeUp .2s ease',
        }}>
          ↺ Đang chuyển đến trang nhận diện…
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* ── Header ── */}
        <div className="fade-up" style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>
              Lịch sử{' '}
              <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>nhận diện</em>
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {loading ? '…' : `${appraisals.length}${hasMore ? '+' : ''} lần nhận diện`}
            </p>
          </div>
          <Btn
            variant="ghost"
            onClick={loadAllForExport}
            disabled={exporting || appraisals.length === 0}
            style={{ padding: '9px 18px', fontSize: 14, whiteSpace: 'nowrap' }}
          >
            {exporting ? <><Spinner size={14} /> Đang xuất…</> : '⬇ Xuất CSV'}
          </Btn>
        </div>

        {/* ── Filter bar ── */}
        <div className="fade-up-2" style={{ marginBottom: 28 }}>
          <Card style={{ padding: '16px 20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 10,
            }}>
              {/* Search */}
              <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 15, color: 'var(--text-3)', pointerEvents: 'none',
                }}>⌕</span>
                <input
                  placeholder="Tìm loại đá..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 36, fontSize: 14, height: 38 }}
                />
              </div>

              {/* Stone type */}
              <select
                value={stoneFilter}
                onChange={e => setStoneFilter(e.target.value)}
                style={{ fontSize: 14, height: 38, cursor: 'pointer' }}
              >
                <option value="all">Tất cả loại đá</option>
                {stoneTypes.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Time */}
              <select
                value={timeFilter}
                onChange={e => setTimeFilter(e.target.value as TimeFilter)}
                style={{ fontSize: 14, height: 38, cursor: 'pointer' }}
              >
                <option value="all">Mọi thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="7d">7 ngày qua</option>
                <option value="month">Tháng này</option>
              </select>

              {/* Confidence */}
              <select
                value={confFilter}
                onChange={e => setConfFilter(e.target.value as ConfFilter)}
                style={{ fontSize: 14, height: 38, cursor: 'pointer' }}
              >
                <option value="all">Mọi độ tin cậy</option>
                <option value="high">Cao (&gt;80%)</option>
                <option value="mid">Trung bình (50-80%)</option>
                <option value="low">Thấp (&lt;50%)</option>
              </select>

              {/* Reset */}
              {(search || stoneFilter !== 'all' || timeFilter !== 'all' || confFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearch('')
                    setStoneFilter('all')
                    setTimeFilter('all')
                    setConfFilter('all')
                  }}
                  style={{
                    background: 'none', border: '1.5px solid var(--border-2)',
                    borderRadius: 8, fontSize: 13, color: 'var(--text-2)',
                    cursor: 'pointer', height: 38, padding: '0 14px',
                    fontFamily: 'var(--font-sans)',
                    transition: 'all .15s',
                  }}
                >
                  ✕ Xóa bộ lọc
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ marginBottom: 20 }}>
            <Alert type="error">{error}</Alert>
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && appraisals.length === 0 && (
          <Card style={{ padding: '60px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, opacity: .1, marginBottom: 16 }}>◈</div>
            <div style={{ fontSize: 18, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600, fontFamily: 'var(--font-serif)' }}>
              {search || stoneFilter !== 'all' || timeFilter !== 'all' || confFilter !== 'all'
                ? 'Không tìm thấy kết quả'
                : 'Chưa có lịch sử'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {search || stoneFilter !== 'all' || timeFilter !== 'all' || confFilter !== 'all'
                ? 'Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm'
                : 'Upload ảnh ngọc để bắt đầu nhận diện'}
            </div>
          </Card>
        )}

        {/* ── Card grid ── */}
        {!loading && appraisals.length > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}>
              {appraisals.map((a, i) => (
                <HistoryCard
                  key={a.id}
                  item={a}
                  index={i}
                  onDetail={setModal}
                  onReanalyze={handleReanalyze}
                />
              ))}
            </div>

            {/* ── Load more ── */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <Btn
                  variant="ghost"
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{ padding: '10px 28px', fontSize: 14 }}
                >
                  {loadingMore
                    ? <><Spinner size={14} /> Đang tải…</>
                    : 'Tải thêm kết quả'}
                </Btn>
              </div>
            )}

            {/* ── End of results ── */}
            {!hasMore && appraisals.length >= PAGE_SIZE && (
              <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                ── Đã hiển thị tất cả {appraisals.length} lần nhận diện ──
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
