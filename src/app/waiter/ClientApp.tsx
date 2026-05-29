'use client'

import dynamic from 'next/dynamic'

const WaiterApp = dynamic(() => import('@/components/waiter/WaiterApp'), { ssr: false })

export default function WaiterClientApp() {
  return <WaiterApp />
}
