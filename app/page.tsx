// app/page.tsx  — Public landing page
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
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

/* ── Feature card ── */
function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: string }) {
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
    </div>
  )
}

/* ── Pricing card ── */
function PricingCard({ xu, price, turns, badge, color, features }: {
  xu: number; price: number; turns: number; badge?: string; color: string; features: string[]
}) {
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
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {features.map(f => (
          <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#8892a4', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color }}>✓</span>{f}
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
  }, [])

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
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(94,234,212,.1) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(212,168,83,.07) 0%, transparent 70%)', borderRadius: '50%' }} />
        </div>

        <div style={{ maxWidth: 780, textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 10, letterSpacing: '.35em', color: 'var(--jade)', textTransform: 'uppercase', marginBottom: 20, fontFamily: 'var(--font-mono)', animation: 'fadeIn .8s .1s both' }}>
            ✦ Hệ thống định giá ngọc thông minh
          </div>

          <h1 style={{ fontSize: 'clamp(40px,7vw,80px)', fontWeight: 300, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: 24, animation: 'fadeUp .8s .2s both' }}>
            Định giá Ngọc & Đá quý<br />
            <em style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, var(--jade), #22d3ee, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              bằng trí tuệ nhân tạo
            </em>
          </h1>

          <p style={{ fontSize: 17, color: '#5a6478', lineHeight: 1.8, marginBottom: 40, maxWidth: 580, margin: '0 auto 40px', fontFamily: 'var(--font-mono)', fontWeight: 300, animation: 'fadeUp .8s .3s both' }}>
            3 AI phân tích song song — Claude Sonnet, Claude Haiku, Gemini Flash.<br />
            Kết quả trong 10 giây thay vì chờ lab 3–7 ngày.
          </p>

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

          <div style={{ marginTop: 32, padding: '16px 24px', borderRadius: 12, background: 'rgba(94,234,212,.05)', border: '1px solid rgba(94,234,212,.15)', textAlign: 'center', fontSize: 13, color: '#5a6478', fontFamily: 'var(--font-mono)' }}>
            ✦ So sánh: Định giá lab chuyên nghiệp $50–200/viên · Ngọc AI ~2,500–3,300đ/lần (tiết kiệm 95%+)
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
    </div>
  )
}
