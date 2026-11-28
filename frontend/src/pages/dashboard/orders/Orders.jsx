import { useCan } from '@/hooks/useCan'
import { FarmerOrders } from './FarmerOrders'
import { KaluppaOrders } from './KaluppaOrders'

/** /dashboard/orders: Kaluppa manages every order; a farmer follows their own. */
export function Orders() {
  return useCan('orders.manage') ? <KaluppaOrders /> : <FarmerOrders />
}
