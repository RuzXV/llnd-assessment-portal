// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for purchasing assessment seats

const SEAT_PRICE_AUD = 995; // $9.95 in cents

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;

  if (!data.user || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  if (!data.tenant_id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body: any = await request.json();
    const { quantity, product_id } = body;

    if (!quantity || quantity < 1 || quantity > 500) {
      return new Response(JSON.stringify({ error: 'Quantity must be between 1 and 500' }), { status: 400 });
    }

    if (!product_id) {
      return new Response(JSON.stringify({ error: 'Missing product_id' }), { status: 400 });
    }

    // Verify product exists
    const product = await env.DB.prepare(
      'SELECT product_id, name FROM assessment_products WHERE product_id = ? AND active = 1'
    ).bind(product_id).first();

    if (!product) {
      return new Response(JSON.stringify({ error: 'Invalid product' }), { status: 400 });
    }

    const origin = new URL(request.url).origin;

    // Create Stripe Checkout Session via REST API (no SDK needed on CF Workers)
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'currency': 'aud',
        'line_items[0][price_data][currency]': 'aud',
        'line_items[0][price_data][unit_amount]': String(SEAT_PRICE_AUD),
        'line_items[0][price_data][product_data][name]': `${product.name} - Assessment Seat`,
        'line_items[0][price_data][product_data][description]': `LLND Assessment seat for ${product.name}`,
        'line_items[0][quantity]': String(quantity),
        'metadata[tenant_id]': data.tenant_id,
        'metadata[product_id]': product_id,
        'metadata[quantity]': String(quantity),
        'metadata[user_id]': data.user,
        'success_url': `${origin}/dashboard?payment=success&seats=${quantity}`,
        'cancel_url': `${origin}/dashboard?payment=cancelled`,
      }).toString()
    });

    const session = await stripeRes.json() as any;

    if (!stripeRes.ok) {
      console.error('Stripe error:', session);
      return new Response(JSON.stringify({ error: session.error?.message || 'Payment service error' }), { status: 500 });
    }

    // Audit log
    await env.DB.prepare(`
      INSERT INTO audit_logs (tenant_id, actor_id, action, entity_id, details)
      VALUES (?, ?, 'STRIPE_CHECKOUT_CREATED', ?, ?)
    `).bind(
      data.tenant_id, data.user, session.id,
      JSON.stringify({ product_id, quantity, amount: SEAT_PRICE_AUD * quantity })
    ).run();

    return new Response(JSON.stringify({
      checkout_url: session.url,
      session_id: session.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Checkout error:', e);
    return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
  }
};
