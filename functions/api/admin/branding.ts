// Branding and white-labeling management API

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context;

  if (!data.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const tenant = await env.DB.prepare(`
      SELECT name, legal_name, logo_url, brand_primary_color
      FROM tenants
      WHERE tenant_id = ?
    `).bind(data.tenant_id).first();

    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), { status: 404 });
    }

    return new Response(JSON.stringify(tenant));

  } catch (e) {
    console.error('Branding GET Error:', e);
    return new Response(JSON.stringify({ error: 'Failed to fetch branding' }), { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;

  if (!data.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Only admins can update branding
  if (data.user.role !== 'rto_admin' && data.user.role !== 'super_admin') {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await request.json() as any;
    const { name, legal_name, logo_url, brand_primary_color } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Organization name is required' }), { status: 400 });
    }

    // Validate color format (basic hex color validation)
    if (brand_primary_color && !/^#[0-9A-Fa-f]{6}$/.test(brand_primary_color)) {
      return new Response(JSON.stringify({ error: 'Invalid color format. Use hex format (e.g., #000000)' }), { status: 400 });
    }

    // Validate logo URL format if provided
    if (logo_url) {
      try {
        new URL(logo_url);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid logo URL format' }), { status: 400 });
      }
    }

    await env.DB.prepare(`
      UPDATE tenants
      SET name = ?,
          legal_name = ?,
          logo_url = ?,
          brand_primary_color = ?
      WHERE tenant_id = ?
    `).bind(
      name,
      legal_name || null,
      logo_url || null,
      brand_primary_color || '#000000',
      data.tenant_id
    ).run();

    // Audit log branding update
    await env.DB.prepare(`
      INSERT INTO audit_logs (tenant_id, actor_id, action, entity, created_at)
      VALUES (?, ?, 'UPDATE_BRANDING', ?, unixepoch())
    `).bind(data.tenant_id, data.user, `Updated branding: ${name}`).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Branding settings updated successfully'
    }));

  } catch (e) {
    console.error('Branding PUT Error:', e);
    return new Response(JSON.stringify({ error: 'Failed to update branding' }), { status: 500 });
  }
};
