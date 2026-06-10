// ═══════════════════════════════════════════════════════════
// SimPhase — Restore access by payment email
// Stripe is the source of truth: we search succeeded charges
// for the email used at checkout. No accounts, no database.
// Requires STRIPE_SECRET_KEY (server-side env var, never public).
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const raw = body?.email;
    if (typeof raw !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }
    // sanitize: strip quotes/backslashes, normalize
    const email = raw.trim().toLowerCase().replace(/['"\\]/g, '').slice(0, 120);
    if (!email.includes('@') || email.length < 5) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
    }

    const query = `billing_details.email:'${email}' AND status:'succeeded'`;
    const res = await fetch(
      'https://api.stripe.com/v1/charges/search?' +
        new URLSearchParams({ query, limit: '5' }),
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'stripe_error' }, { status: 502 });
    }
    const data = await res.json();
    const paid = Array.isArray(data?.data) && data.data.some(
      (c: any) => c?.status === 'succeeded' && !c?.refunded,
    );
    return NextResponse.json({ ok: paid });
  } catch {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
