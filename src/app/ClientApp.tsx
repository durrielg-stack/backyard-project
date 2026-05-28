'use client'

import dynamic from 'next/dynamic'

const POSApp = dynamic(() => import('./POSApp'), { ssr: false })

export default function ClientApp() {
  return <POSApp />
}
