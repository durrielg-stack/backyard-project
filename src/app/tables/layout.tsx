import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Backyard Project',
  description: 'Live table availability at The Backyard Project',
  icons: { icon: '/logo-black.png' },
}

export default function TablesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
