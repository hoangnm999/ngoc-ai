// components/ui.tsx
'use client'
import { ReactNode, CSSProperties } from 'react'

/* ── Spinner ── */
export function Spinner({ size = 20, color = 'var(--jade)' }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid ${color}33`,
      borderTopColor: color,
      borderRadius: '50%',
      flexShrink: 0,
    }} className="spin" />
  )
}

/* ── Button ── */
type BtnVariant = 'primary' | 'ghost' | 'danger' | 'jade'
export function Btn({
  children, onClick, disabled, variant = 'primary', fullWidth, style, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean
  variant?: BtnVariant; fullWidth?: boolean; style?: CSSProperties; type?: 'button'|'submit'
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 28px',
    borderRadius: 12,                    /* ← 12px per spec */
    fontSize: 16, fontFamily: 'var(--font-sans)', fontWeight: 600,
    letterSpacing: '.01em',
    transition: 'all .2s ease',
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? .5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transform: 'scale(1)',
  }
  const variants: Record<BtnVariant, CSSProperties> = {
    jade: {
      background: 'linear-gradient(135deg, #B8860B 0%, #DAA520 40%, #CD9B1D 70%, #A07700 100%)',
      color: '#fff',
      boxShadow: '0 2px 14px rgba(184,134,11,.28)',
      textShadow: '0 1px 2px rgba(0,0,0,.15)',
    },
    primary: {
      background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
      color: '#fff',
      boxShadow: '0 2px 10px rgba(99,102,241,.22)',
    },
    ghost: {
      background: 'var(--bg-2)',
      color: 'var(--text-2)',
      border: '1.5px solid var(--border-2)',
    },
    danger: {
      background: '#FEF2F2',
      color: '#DC2626',
      border: '1.5px solid #FECACA',
    },
  }

  /* Hover via onMouseEnter/Leave — không cần Tailwind */
  const hoverStyle: Record<BtnVariant, CSSProperties> = {
    jade:    { background: 'var(--gradient-gold-hover)', boxShadow: '0 6px 20px var(--gold-glow)', transform: 'scale(1.02)' },
    primary: { background: 'linear-gradient(135deg,#4338ca,#4f46e5)', boxShadow: '0 4px 16px rgba(99,102,241,.30)', transform: 'scale(1.02)' },
    ghost:   { background: 'var(--bg-3)', transform: 'scale(1.01)' },
    danger:  { background: '#FEE2E2', transform: 'scale(1.01)' },
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    const h = hoverStyle[variant]
    Object.assign(e.currentTarget.style, h)
  }
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    const v = variants[variant]
    e.currentTarget.style.transform = 'scale(1)'
    // Reset về gradient string gốc (không dùng CSS variable trực tiếp trong inline style reset)
    if (variant === 'jade') {
      e.currentTarget.style.background = 'linear-gradient(135deg, #B8860B 0%, #DAA520 40%, #CD9B1D 70%, #A07700 100%)'
      e.currentTarget.style.boxShadow  = '0 2px 14px rgba(184,134,11,.28)'
    } else {
      e.currentTarget.style.background = (v.background as string) ?? ''
      e.currentTarget.style.boxShadow  = (v.boxShadow  as string) ?? ''
    }
  }
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    e.currentTarget.style.transform = 'scale(0.98)'
  }
  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    e.currentTarget.style.transform = 'scale(1)'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  )
}

/* ── Card ── */
export function Card({ children, style, glow }: { children: ReactNode; style?: CSSProperties; glow?: 'jade'|'gold' }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: `1px solid ${
        glow === 'jade' ? 'rgba(13,148,136,.20)'
        : glow === 'gold' ? 'rgba(180,83,9,.18)'
        : 'var(--border)'
      }`,
      borderRadius: 20,                  /* ← 20px per spec */
      boxShadow: glow === 'jade'
        ? '0 4px 6px -2px rgba(13,148,136,.08), 0 2px 4px -1px rgba(13,148,136,.04)'
        : glow === 'gold'
        ? '0 4px 6px -2px rgba(180,83,9,.07), 0 2px 4px -1px rgba(180,83,9,.04)'
        : '0 4px 6px -2px rgba(0,0,0,.05), 0 2px 4px -1px rgba(0,0,0,.03)',
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── Xu Badge ── */
export function XuBadge({ xu, size = 'md' }: { xu: number; size?: 'sm'|'md' }) {
  const sm = size === 'sm'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 6,
      background: 'var(--jade-light)',
      border: '1px solid rgba(13,148,136,.25)',
      borderRadius: 30,
      padding: sm ? '4px 12px' : '6px 14px',
      fontSize: sm ? 13 : 15,
      color: 'var(--jade-text)',
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
    }}>
      ◈ <strong>{xu}</strong> xu
    </span>
  )
}

/* ── Section label ── */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
      color: 'var(--text-3)', fontFamily: 'var(--font-sans)',
      marginBottom: 14, fontWeight: 600,
    }}>
      {children}
    </div>
  )
}

/* ── Score bar (do_tin_cay dạng %) ── */
export function ScoreBar({ label, score, desc }: { label: string; score: number; desc?: string }) {
  /* score: 0-100 (%) */
  const c = score >= 70 ? 'var(--jade)' : score >= 50 ? '#3B82F6' : score >= 35 ? 'var(--gold)' : 'var(--ruby)'
  return (
    <div style={{ padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: 'var(--font-mono)' }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: c, fontFamily: 'var(--font-mono)' }}>{score}%</span>
      </div>
      <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${score}%`,
          background: `linear-gradient(90deg, ${c}88, ${c})`,
          borderRadius: 99, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)',
        }} />
      </div>
      {desc && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.6 }}>{desc}</div>}
    </div>
  )
}

/* ── Alert ── */
export function Alert({ type, children }: { type: 'warn'|'error'|'success'|'info'; children: ReactNode }) {
  const cfg = {
    warn:    { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icon: '⚠' },
    error:   { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', icon: '✕' },
    success: { bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', icon: '✓' },
    info:    { bg: '#EFF6FF', border: '#93C5FD', color: '#1E40AF', icon: 'ℹ' },
  }[type]
  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: 'var(--radius-sm)',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      display: 'flex', gap: 12, alignItems: 'flex-start',
      fontSize: 15, color: cfg.color,
      fontFamily: 'var(--font-sans)',
      lineHeight: 1.65,
    }}>
      <span style={{ flexShrink: 0, fontWeight: 700, marginTop: 2, fontSize: 16 }}>{cfg.icon}</span>
      <span>{children}</span>
    </div>
  )
}

/* ── Divider ── */
export function Divider({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {label && <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.12em', fontWeight: 500 }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}
