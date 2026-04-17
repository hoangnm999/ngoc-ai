// app/admin/page.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { Card, Label, Spinner, Alert, Btn } from '@/components/ui'

/* ── Types ── */
interface Stats {
  total_users: number; new_users_7d: number
  total_appraisals: number; appraisals_7d: number
  total_revenue_vnd: number; revenue_30d: number
  pending_transactions: number; total_xu_outstanding: number
}
interface DailyRevenue { day: string; revenue_vnd: number; transaction_count: number }
interface AdminUser {
  id: string; email: string; full_name: string; xu: number
  total_appraisals: number; total_spent_vnd: number
  created_at: string; last_appraisal_at: string | null
}

/* ── Helpers ── */
function fmtVND(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`
  return String(n)
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/* ── Mini sparkline chart ── */
function RevenueChart({ data }: { data: DailyRevenue[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.revenue_vnd), 1)
  const W = 100, H = 40
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.revenue_vnd / max) * H
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, overflow: 'visible' }}>
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--jade)" stopOpacity=".4" />
            <stop offset="100%" stopColor="var(--jade)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={pts} fill="none" stroke="var(--jade)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#grad)" opacity=".5" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
        <span>{data[0] ? fmtDate(data[0].day) : ''}</span>
        <span>{data[data.length - 1] ? fmtDate(data[data.length - 1].day) : ''}</span>
      </div>
    </div>
  )
}

/* ── Stat card ── */
function StatCard({ label, value, sub, color = 'var(--jade)' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.12em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>{sub}</div>}
    </Card>
  )
}

/* ── Main ── */
export default function AdminPage() {
  const [stats, setStats]     = useState<Stats | null>(null)
  const [daily, setDaily]     = useState<DailyRevenue[]>([])
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [error, setError]     = useState('')

  // Add xu modal
  const [addXuUser, setAddXuUser] = useState<AdminUser | null>(null)
  const [addXuAmt, setAddXuAmt]   = useState('')
  const [addXuNote, setAddXuNote] = useState('')
  const [addXuLoading, setAddXuLoading] = useState(false)
  const [addXuDone, setAddXuDone] = useState(false)

  // Load stats
  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); setLoading(false); return }
      setStats(d.stats); setDaily(d.daily || [])
      setLoading(false)
    }).catch(() => { setError('Lỗi tải dữ liệu'); setLoading(false) })
  }, [])

  // Load users
  const loadUsers = useCallback(() => {
    setUsersLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20', q: search })
    fetch(`/api/admin/users?${params}`).then(r => r.json()).then(d => {
      setUsers(d.users || []); setTotal(d.total || 0)
      setUsersLoading(false)
    })
  }, [page, search])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleAddXu = async () => {
    if (!addXuUser || !addXuAmt) return
    setAddXuLoading(true)
    const resp = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: addXuUser.id, amount: parseInt(addXuAmt), note: addXuNote }),
    })
    const d = await resp.json()
    setAddXuLoading(false)
    if (d.success) { setAddXuDone(true); setTimeout(() => { setAddXuUser(null); setAddXuDone(false); setAddXuAmt(''); setAddXuNote(''); loadUsers() }, 1500) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={32} />
    </div>
  )

  if (error === 'Unauthorized') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40, opacity: .3 }}>🔒</div>
      <div style={{ fontSize: 16, color: 'var(--text-2)' }}>Bạn không có quyền truy cập trang này</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>

      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 300, marginBottom: 4 }}>
            Admin <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>Dashboard</em>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Quản lý hệ thống · Realtime</p>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {new Date().toLocaleString('vi-VN')}
        </div>
      </div>

      {error && error !== 'Unauthorized' && <div style={{ marginBottom: 20 }}><Alert type="error">{error}</Alert></div>}

      {/* Stats Grid */}
      {stats && (
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <StatCard label="TỔNG USERS" value={stats.total_users.toLocaleString()} sub={`+${stats.new_users_7d} tuần này`} />
          <StatCard label="TỔNG ĐỊNH GIÁ" value={stats.total_appraisals.toLocaleString()} sub={`+${stats.appraisals_7d} tuần này`} color="#60a5fa" />
          <StatCard label="DOANH THU (30N)" value={`${fmtVND(stats.revenue_30d)}đ`} sub={`Tổng: ${fmtVND(stats.total_revenue_vnd)}đ`} color="#d4a853" />
          <StatCard label="GD CHỜ XỬ LÝ" value={stats.pending_transactions} sub={`${fmtVND(stats.total_xu_outstanding)} xu lưu thông`} color={stats.pending_transactions > 0 ? '#f59e0b' : 'var(--jade)'} />
        </div>
      )}

      {/* Revenue chart */}
      {daily.length > 0 && (
        <div className="fade-up-3" style={{ marginBottom: 28 }}>
          <Card style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Label>Doanh thu 30 ngày gần nhất</Label>
              <span style={{ fontSize: 12, color: 'var(--jade)', fontFamily: 'var(--font-mono)' }}>
                {fmtVND(daily.reduce((s, d) => s + d.revenue_vnd, 0))}đ tổng
              </span>
            </div>
            <RevenueChart data={daily} />
          </Card>
        </div>
      )}

      {/* User table */}
      <Card>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Label>Người dùng ({total.toLocaleString()})</Label>
          <input
            placeholder="Tìm email hoặc tên..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ maxWidth: 260, padding: '7px 12px', fontSize: 12 }}
          />
        </div>

        {usersLoading
          ? <div style={{ padding: '40px', textAlign: 'center' }}><Spinner /></div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Người dùng', 'Xu', 'Định giá', 'Chi tiêu', 'Ngày tham gia', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{u.full_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: u.xu > 0 ? 'var(--jade)' : 'var(--text-3)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{u.xu}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{u.total_appraisals}</td>
                      <td style={{ padding: '12px 16px', color: u.total_spent_vnd > 0 ? '#d4a853' : 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                        {u.total_spent_vnd > 0 ? `${fmtVND(u.total_spent_vnd)}đ` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmtDate(u.created_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => { setAddXuUser(u); setAddXuAmt(''); setAddXuNote('') }}
                          style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(94,234,212,.08)', border: '1px solid rgba(94,234,212,.2)', color: 'var(--jade)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                        >
                          + Xu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* Pagination */}
        {total > 20 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              Trang {page} / {Math.ceil(total / 20)}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 14px', fontSize: 12 }}>← Trước</Btn>
              <Btn variant="ghost" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} style={{ padding: '6px 14px', fontSize: 12 }}>Sau →</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Add xu modal */}
      {addXuUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setAddXuUser(null) }}>
          <Card style={{ width: '100%', maxWidth: 400, padding: 28 }}>
            <h3 style={{ fontSize: 20, fontWeight: 300, marginBottom: 4 }}>Thêm xu thủ công</h3>
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 20 }}>{addXuUser.email}</p>

            {addXuDone
              ? <Alert type="success">Đã thêm xu thành công!</Alert>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', display: 'block', marginBottom: 6 }}>SỐ XU THÊM</label>
                    <input type="number" placeholder="2" min="1" value={addXuAmt} onChange={e => setAddXuAmt(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', display: 'block', marginBottom: 6 }}>GHI CHÚ</label>
                    <input placeholder="Lý do thêm xu..." value={addXuNote} onChange={e => setAddXuNote(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <Btn variant="jade" onClick={handleAddXu} disabled={!addXuAmt || addXuLoading}>
                      {addXuLoading ? <Spinner size={14} color="#020c0a" /> : 'Xác nhận'}
                    </Btn>
                    <Btn variant="ghost" onClick={() => setAddXuUser(null)}>Huỷ</Btn>
                  </div>
                </div>
              )}
          </Card>
        </div>
      )}
    </div>
  )
}
