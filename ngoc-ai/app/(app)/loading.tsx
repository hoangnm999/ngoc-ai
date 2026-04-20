// app/(app)/loading.tsx  — Shared loading state for app routes
export default function Loading() {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 24px' }}>
      {/* Skeleton header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ height: 36, width: 280, borderRadius: 8, background: 'rgba(255,255,255,.05)', marginBottom: 10, animation: 'shimmer 1.5s ease infinite' }} />
        <div style={{ height: 14, width: 200, borderRadius: 6, background: 'rgba(255,255,255,.03)' }} />
      </div>
      {/* Skeleton grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: 90, borderRadius: 14, background: 'rgba(255,255,255,.03)', animation: `shimmer 1.5s ${i * .1}s ease infinite` }} />
        ))}
      </div>
      <div style={{ height: 200, borderRadius: 14, background: 'rgba(255,255,255,.03)', animation: 'shimmer 1.5s .4s ease infinite' }} />
      <style>{`@keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
    </div>
  )
}
