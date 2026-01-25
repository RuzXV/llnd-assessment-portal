export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env, data } = context;
  
    if (data.user_role !== 'platform_super_admin') {
      return new Response('Forbidden', { status: 403 });
    }
  
    try {
      const body: any = await request.json();
      const { name, legal_name, subdomain, brand_color } = body;
  
      if (!name || !subdomain) {
        return new Response(JSON.stringify({ error: 'Name and Subdomain are required' }), { status: 400 });
      }
  
      const tenantId = crypto.randomUUID();
  
      await env.DB.prepare(`
        INSERT INTO tenants (tenant_id, name, legal_name, subdomain, brand_primary_color, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'active', unixepoch())
      `).bind(tenantId, name, legal_name, subdomain, brand_color || '#000000').run();
  
      return new Response(JSON.stringify({ 
        success: true, 
        tenant_id: tenantId,
        message: 'Tenant created successfully' 
      }));
  
    } catch (e) {
      console.error('Create Tenant Error:', e);
      return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
  };

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, data } = context;
  
    if (data.user_role !== 'platform_super_admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
  
    try {
        const results = await env.DB.prepare(`
          SELECT 
            t.tenant_id, t.name, t.subdomain, t.status, t.created_at,
            (SELECT COUNT(*) FROM seats s WHERE s.tenant_id = t.tenant_id) as total_seats,
            (SELECT COUNT(*) FROM seats s WHERE s.tenant_id = t.tenant_id AND s.status = 'consumed') as used_seats
          FROM tenants t
          ORDER BY t.created_at DESC
        `).all();
    
        return new Response(JSON.stringify(results.results));
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to list tenants' }), { status: 500 });
    }
  };