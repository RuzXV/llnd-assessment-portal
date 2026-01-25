export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, data, request } = context;
  
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); 
    
    let sql = `
      SELECT 
        a.attempt_id, 
        a.student_name, 
        a.status, 
        a.started_at, 
        a.submitted_at, 
        a.total_score,
        p.name as product_name
      FROM assessment_attempts a
      JOIN seats s ON a.seat_id = s.seat_id
      JOIN products p ON s.product_id = p.product_id
      WHERE a.tenant_id = ?
    `;
    
    const params: any[] = [data.tenant_id];
  
    if (status) {
        sql += ` AND a.status = ?`;
        params.push(status);
    }
  
    sql += ` ORDER BY a.started_at DESC LIMIT 50`;
  
    const results = await env.DB.prepare(sql).bind(...params).all();
    return new Response(JSON.stringify(results.results));
  };