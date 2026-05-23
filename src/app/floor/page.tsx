import { redirect } from 'next/navigation'
// This route no longer exists — routing is handled by the POSApp shell at /
export default function FloorPage() { redirect('/') }
