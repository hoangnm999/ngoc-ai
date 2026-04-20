// app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Background radial glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(94,234,212,.08) 0%, transparent 70%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        {children}
      </div>
    </main>
  )
}
