import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Backyard Project',
  description: 'Live table availability at The Backyard Project · bar + kitchen',
}

export default function TablesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Hanken+Grotesk:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  )
}
