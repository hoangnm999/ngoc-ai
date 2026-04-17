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

/* ── Button variants ── */
type BtnVariant = 'primary' | 'ghost' | 'danger' | 'jade'
export function Btn({
  children, onClick, disabled, variant = 'primary', fullWidth, style, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean
  variant?: BtnVariant; fullWidth?: boolean; style?: CSSProperties; type?: 'button'|'submit'
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 28px', borderRadius: 99,
    fontSize: 15, fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '.04em',
    transition: 'all .25s ease', width: fullWidth ? '100%' : undefined,
    opacity: disabled ? .45 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
  }
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,.3)' },
    jade:    { background: 'linear-gradient(135deg,#0d9488,#5eead4)', color: '#020c0a', boxShadow: '0 4px 20px rgba(94,234,212,.25)' },
    ghost:   { background: 'var(--bg-2)', color: 'var(--text-2)', border: '1px solid var(--border)' },
    danger:  { background: 'rgba(239,68,68,.1)', color: '#f87171', border: '1px solid rgba(239,68,68,.2)' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

/* ── Card ── */
export function Card({ children, style, glow }: { children: ReactNode; style?: CSSProperties; glow?: 'jade'|'gold' }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: `1px solid ${glow === 'jade' ? 'rgba(94,234,212,.15)' : glow === 'gold' ? 'rgba(212,168,83,.15)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      boxShadow: glow === 'jade' ? '0 0 32px rgba(94,234,212,.07)' : glow === 'gold' ? '0 0 32px rgba(212,168,83,.07)' : 'none',
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
      background: 'rgba(94,234,212,.08)', border: '1px solid rgba(94,234,212,.2)',
      borderRadius: 99, padding: sm ? '3px 10px' : '5px 14px',
      fontSize: sm ? 11 : 13, color: 'var(--jade)',
      fontFamily: 'var(--font-mono)', fontWeight: 500,
    }}>
      ◈ <strong>{xu}</strong> xu
    </span>
  )
}

/* ── Section label ── */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase',
      color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

/* ── Score bar ── */
export function ScoreBar({ label, score, desc }: { label: string; score: number; desc?: string }) {
  const c = score >= 8 ? 'var(--jade)' : score >= 6 ? '#60a5fa' : score >= 4 ? 'var(--gold)' : 'var(--ruby)'
  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: c, fontFamily: 'var(--font-mono)' }}>{score}<span style={{ color: 'var(--text-3)', fontSize: 10 }}>/10</span></span>
      </div>
      <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${score * 10}%`,
          background: `linear-gradient(90deg, ${c}55, ${c})`,
          borderRadius: 99, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)',
        }} />
      </div>
      {desc && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>{desc}</div>}
    </div>
  )
}

/* ── Alert ── */
export function Alert({ type, children }: { type: 'warn'|'error'|'success'|'info'; children: ReactNode }) {
  const cfg = {
    warn:    { bg: 'rgba(212,168,83,.07)',   border: 'rgba(212,168,83,.25)',  color: '#d4a853', icon: '⚠' },
    error:   { bg: 'rgba(239,68,68,.07)',    border: 'rgba(239,68,68,.2)',    color: '#f87171', icon: '✕' },
    success: { bg: 'rgba(94,234,212,.07)',   border: 'rgba(94,234,212,.2)',   color: 'var(--jade)', icon: '✓' },
    info:    { bg: 'rgba(99,102,241,.07)',   border: 'rgba(99,102,241,.2)',   color: '#818cf8', icon: 'ℹ' },
  }[type]
  return (
    <div style={{ padding: '13px 16px', borderRadius: 'var(--radius-sm)', background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: cfg.color }}>
      <span style={{ flexShrink: 0, fontWeight: 700 }}>{cfg.icon}</span>
      <span style={{ lineHeight: 1.6 }}>{children}</span>
    </div>
  )
}

/* ── Divider ── */
export function Divider({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {label && <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}
