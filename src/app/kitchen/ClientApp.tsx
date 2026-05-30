'use client'

import dynamic from 'next/dynamic'

const KitchenApp = dynamic(() => import('@/components/kitchen/KitchenApp'), { ssr: false })

export default function KitchenClientApp() {
  return <KitchenApp />
}
