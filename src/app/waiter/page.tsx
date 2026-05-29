import dynamic from 'next/dynamic'

const WaiterApp = dynamic(() => import('@/components/waiter/WaiterApp'), { ssr: false })

export default function WaiterPage() {
  return <WaiterApp />
}
