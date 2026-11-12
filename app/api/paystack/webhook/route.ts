import { validSignature, verifyPayment } from '../../../../lib/paystack';

export async function POST(request: Request) {
  const payload = await request.text();
  if (!validSignature(payload, request.headers.get('x-paystack-signature'))) return new Response(null, { status: 401 });
  try {
    const event = JSON.parse(payload) as { event?: string; data?: { reference?: string } };
    if (event.event === 'charge.success' && event.data?.reference) await verifyPayment(event.data.reference);
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('Paystack webhook processing failed', error);
    return new Response(null, { status: 500 });
  }
}
