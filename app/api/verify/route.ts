// Verifies a Stripe Checkout session server-side right after payment.
// Requires STRIPE_SECRET_KEY in the environment.
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('session_id') || '';
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 });
  if (!/^cs_[a-zA-Z0-9_]+$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ ok: false }, { status: 400 });
    const s = await r.json();
    const ok = s.payment_status === 'paid';
    return NextResponse.json({ ok, email: ok ? (s.customer_details?.email || '') : '' });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
