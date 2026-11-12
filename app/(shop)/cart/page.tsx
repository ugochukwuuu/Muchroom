import { Bag } from '../../../components/cart';
import { catalogue } from '../../../lib/catalogue';
import { demoMode } from '../../../lib/db';
import { paymentEnabled } from '../../../lib/paystack';
import { deliveryFee } from '../../../lib/settings';

export const dynamic = 'force-dynamic';
export default async function Cart() {
  return <section className="wrap section"><h1>Your bag</h1><Bag variants={await catalogue()} deliveryFee={deliveryFee()} demo={demoMode && !paymentEnabled()} online={demoMode || paymentEnabled()}/></section>;
}
