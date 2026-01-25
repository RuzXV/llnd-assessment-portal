export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, params, env } = context;
    const token = params.token as string;
  
    try {
      const body = await request.json() as any;
      const { responses } = body;
  
      const attempt = await env.DB.prepare(`
        SELECT attempt_id, seat_id, status FROM assessment_attempts WHERE token_hash = ?
      `).bind(token).first();
  
      if (!attempt || attempt.status !== 'in_progress') {
        return new Response(JSON.stringify({ error: 'Invalid submission state' }), { status: 400 });
      }
  
      const statements = [];
  
      statements.push(env.DB.prepare(`
        UPDATE assessment_attempts 
        SET status = 'submitted', submitted_at = datetime('now') 
        WHERE attempt_id = ?
      `).bind(attempt.attempt_id));
  
      statements.push(env.DB.prepare(`
        UPDATE seats 
        SET status = 'consumed', consumed_at = datetime('now') 
        WHERE seat_id = ?
      `).bind(attempt.seat_id));
  
      for (const r of responses) {
        statements.push(env.DB.prepare(`
          INSERT INTO responses (response_id, attempt_id, question_id, response_data)
          VALUES (?, ?, ?, ?)
        `).bind(crypto.randomUUID(), attempt.attempt_id, r.questionId, JSON.stringify(r.answer)));
      }
  
      await env.DB.batch(statements);
  
      return new Response(JSON.stringify({ success: true, message: 'Assessment received' }));
  
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: 'Submission failed' }), { status: 500 });
    }
  };