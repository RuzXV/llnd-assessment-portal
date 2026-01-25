export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env, data } = context;
  
    if (!data.user || !data.tenant_id) return new Response('Unauthorized', { status: 401 });
  
    try {
      const body = await request.json() as any;
      const { product_id, student_name, student_id } = body;

      const seat = await env.DB.prepare(`
        SELECT seat_id FROM seats 
        WHERE tenant_id = ? AND product_id = ? AND status = 'available' LIMIT 1
      `).bind(data.tenant_id, product_id).first();
  
      if (!seat) return new Response(JSON.stringify({ error: 'No seats available' }), { status: 402 });
  
      const attemptId = crypto.randomUUID();
      const token = crypto.randomUUID();
      const seatId = seat.seat_id as string;
  
      await env.DB.batch([
        env.DB.prepare("UPDATE seats SET status = 'reserved' WHERE seat_id = ?").bind(seatId),
        env.DB.prepare(`
          INSERT INTO assessment_attempts (attempt_id, tenant_id, seat_id, token_hash, student_name, student_id, status)
          VALUES (?, ?, ?, ?, ?, ?, 'issued')
        `).bind(attemptId, data.tenant_id, seatId, token, student_name, student_id),
        env.DB.prepare("INSERT INTO audit_logs (tenant_id, actor_id, action, entity_id) VALUES (?, ?, 'ISSUE_ASSESSMENT', ?)")
          .bind(data.tenant_id, data.user, seatId)
      ]);
  
      return new Response(JSON.stringify({ success: true, token, attempt_id: attemptId }));
  
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
    }
  };
  
  export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, data } = context;
    if (!data.tenant_id) return new Response('Unauthorized', { status: 401 });
  
    const results = await env.DB.prepare(`
      SELECT product_id, status, COUNT(*) as count FROM seats 
      WHERE tenant_id = ? GROUP BY product_id, status
    `).bind(data.tenant_id).all();
  
    return new Response(JSON.stringify(results.results));
  };