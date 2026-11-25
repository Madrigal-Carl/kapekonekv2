import { useCan } from '@/hooks/useCan'
import { ComingSoon } from '../ComingSoon'
import { FarmerOrders } from './FarmerOrders'

/** /dashboard/orders: Kaluppa manages every order; a farmer follows their own. */
export function Orders() {
  return useCan('orders.manage') ? <ComingSoon /> : <FarmerOrders />
}
