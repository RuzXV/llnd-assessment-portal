export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;

  if (!data.user || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  if (!data.user || !data.tenant_id) return new Response('Unauthorized', { status: 401 });

  try {
    const body = await request.json() as any;
    const { product_id, student_name, student_id } = body;

    if (!product_id) {
      return new Response(JSON.stringify({ error: 'Missing product_id' }), { status: 400 });
    }

    const version = await env.DB.prepare(`
      SELECT version_id FROM assessment_versions
      WHERE product_id = ? AND is_active = 1
      ORDER BY created_at DESC LIMIT 1
    `).bind(product_id).first();

    if (!version) {
      return new Response(JSON.stringify({ error: 'No active assessment version found for this product type.' }), { status: 400 });
    }

    const seat = await env.DB.prepare(`
      SELECT seat_id FROM seats 
      WHERE tenant_id = ? AND product_id = ? AND status = 'available' 
      LIMIT 1
    `).bind(data.tenant_id, product_id).first();

    if (!seat) {
      return new Response(JSON.stringify({ error: 'No seats available. Please purchase more credits.' }), { status: 402 });
    }

    const attemptId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const seatId = seat.seat_id as string;
    const versionId = version.version_id as string;

    await env.DB.batch([
      env.DB.prepare("UPDATE seats SET status = 'reserved' WHERE seat_id = ?").bind(seatId),

      env.DB.prepare(`
        INSERT INTO assessment_attempts (
          attempt_id, tenant_id, seat_id, version_id, token_hash,
          student_name, student_id, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'issued')
      `).bind(attemptId, data.tenant_id, seatId, versionId, token, student_name, student_id),

      env.DB.prepare(`
          INSERT INTO audit_logs (tenant_id, actor_id, action, entity_id)
          VALUES (?, ?, 'ISSUE_ASSESSMENT', ?)
      `).bind(data.tenant_id, data.user, seatId)
    ]);

    return new Response(JSON.stringify({ 
      success: true, 
      token, 
      attempt_id: attemptId 
    }));

  } catch (e: any) {
    console.error('Issue Assessment Error:', e);
    return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context;

  if (!data.tenant_id || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  
  if (!data.tenant_id) return new Response('Unauthorized', { status: 401 });

  try {
      const results = await env.DB.prepare(`
      SELECT 
          p.name as product_name,
          s.product_id, 
          s.status, 
          COUNT(*) as count 
      FROM seats s
      JOIN assessment_products p ON s.product_id = p.product_id
      WHERE s.tenant_id = ? 
      GROUP BY s.product_id, s.status, p.name
      `).bind(data.tenant_id).all();
  
      return new Response(JSON.stringify(results.results));
  } catch (e) {
      console.error('Seat Summary Error:', e);
      return new Response(JSON.stringify({ error: 'Failed to retrieve seat summary' }), { status: 500 });
  }
};