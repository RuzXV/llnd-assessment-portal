export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { params, env } = context;
    const token = params.token as string;
  
    const attempt = await env.DB.prepare(`
      SELECT a.attempt_id, a.student_name, a.status, t.name as rto_name, t.logo_url, t.brand_primary_color
      FROM assessment_attempts a
      JOIN seats s ON a.seat_id = s.seat_id
      JOIN tenants t ON a.tenant_id = t.tenant_id
      WHERE a.token_hash = ?
    `).bind(token).first();
  
    if (!attempt) {
      return new Response(JSON.stringify({ error: 'Invalid assessment link' }), { status: 404 });
    }
  
    if (attempt.status === 'submitted' || attempt.status === 'expired') {
      return new Response(JSON.stringify({ error: 'Assessment already completed or expired' }), { status: 403 });
    }
  
    if (attempt.status === 'issued') {
      await env.DB.prepare("UPDATE assessment_attempts SET status = 'in_progress', started_at = datetime('now') WHERE attempt_id = ?")
        .bind(attempt.attempt_id).run();
    }
  
    const questions = [
      { id: 'q1', text: 'Read the safety sign below. What implies danger?', type: 'text' },
      { id: 'q2', text: 'Calculate the area of the workspace (5m x 4m).', type: 'number' }
    ];
  
    return new Response(JSON.stringify({
      student: { name: attempt.student_name },
      branding: { 
        rto_name: attempt.rto_name, 
        logo: attempt.logo_url, 
        color: attempt.brand_primary_color 
      },
      questions
    }));
  };