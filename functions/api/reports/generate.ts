export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env, data } = context;
    if (!data.user) return new Response('Unauthorized', { status: 401 });

    const { attempt_id } = await request.json() as any;

    const attempt = await env.DB.prepare(`
        SELECT a.*, t.name as rto_name, t.logo_url, t.brand_primary_color
        FROM assessment_attempts a
        JOIN tenants t ON a.tenant_id = t.tenant_id
        WHERE a.attempt_id = ? AND a.tenant_id = ?
    `).bind(attempt_id, data.tenant_id).first();

    if (!attempt || attempt.status !== 'submitted') {
        return new Response(JSON.stringify({ error: 'Report not available' }), { status: 400 });
    }

    // Audit log report generation
    await env.DB.prepare(`
      INSERT INTO audit_logs (tenant_id, actor_id, action, entity, created_at)
      VALUES (?, ?, 'GENERATE_REPORT', ?, unixepoch())
    `).bind(data.tenant_id, data.user, `Report for ${attempt.student_name} (${attempt_id})`).run();

    return new Response(JSON.stringify({ 
        success: true, 
        report_data: {
            student_name: attempt.student_name,
            rto_name: attempt.rto_name,
            logo_url: attempt.logo_url,
            completion_date: attempt.submitted_at,
            total_score: attempt.total_score,
            scores: JSON.parse(attempt.domain_breakdown as string),
            verification_hash: attempt.token_hash 
        }
    }));
};