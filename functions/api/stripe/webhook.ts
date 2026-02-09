// POST /api/stripe/webhook
// Handles Stripe webhook events - provisions seats after successful payment

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing signature', { status: 400 });
    }

    // Verify webhook signature using Stripe's v1 scheme
    const isValid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('Invalid Stripe webhook signature');
      return new Response('Invalid signature', { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Only process successful payments
      if (session.payment_status !== 'paid') {
        return new Response(JSON.stringify({ received: true, status: 'not_paid' }));
      }

      const tenantId = session.metadata?.tenant_id;
      const productId = session.metadata?.product_id;
      const quantity = parseInt(session.metadata?.quantity || '0');
      const userId = session.metadata?.user_id;

      if (!tenantId || !productId || !quantity) {
        console.error('Missing metadata in checkout session:', session.id);
        return new Response(JSON.stringify({ received: true, error: 'missing_metadata' }));
      }

      // Check for idempotency - don't re-provision if already processed
      const existing = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM seats WHERE purchase_reference = ?'
      ).bind(session.id).first();

      if (existing && (existing.count as number) > 0) {
        return new Response(JSON.stringify({ received: true, status: 'already_processed' }));
      }

      // Provision seats
      const statements = [];
      for (let i = 0; i < quantity; i++) {
        statements.push(
          env.DB.prepare(`
            INSERT INTO seats (seat_id, tenant_id, product_id, status, purchase_reference)
            VALUES (?, ?, ?, 'available', ?)
          `).bind(crypto.randomUUID(), tenantId, productId, session.id)
        );
      }

      // Audit log
      statements.push(
        env.DB.prepare(`
          INSERT INTO audit_logs (tenant_id, actor_id, action, entity_id, details)
          VALUES (?, ?, 'SEATS_PURCHASED', ?, ?)
        `).bind(
          tenantId,
          userId || 'stripe_webhook',
          session.id,
          JSON.stringify({
            product_id: productId,
            quantity,
            amount_total: session.amount_total,
            currency: session.currency,
            stripe_session_id: session.id
          })
        )
      );

      await env.DB.batch(statements);

      console.log(`Provisioned ${quantity} seats for tenant ${tenantId}, product ${productId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Webhook error:', e);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), { status: 500 });
  }
};

// Verify Stripe webhook signature (v1 scheme)
// Stripe signs with HMAC-SHA256: v1=<hmac_sha256(timestamp.payload, secret)>
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  const parts = signatureHeader.split(',');
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedSig = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');

  // Compare against all v1 signatures (timing-safe comparison)
  return signatures.some(s => s === expectedSig);
}
