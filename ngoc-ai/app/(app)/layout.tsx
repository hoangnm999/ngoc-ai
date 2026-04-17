// app/(app)/layout.tsx
import Navbar from '@/components/Navbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: 'calc(100vh - 58px)' }}>
        {children}
      </main>
    </>
  )
}
