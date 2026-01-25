import { hashPassword } from '../services/security';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, data } = context;

  if (data.user_role !== 'platform_super_admin' && data.user_role !== 'rto_admin') {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body: any = await request.json();
    const { email, password, role, target_tenant_id } = body;

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    let tenantId = data.tenant_id;
    if (data.user_role === 'platform_super_admin') {
        if (!target_tenant_id) return new Response(JSON.stringify({ error: 'Super Admin must specify target_tenant_id' }), { status: 400 });
        tenantId = target_tenant_id;
    }

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO users (user_id, tenant_id, email, password_hash, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', unixepoch())
    `).bind(userId, tenantId, email, hashedPassword, role).run();

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: userId 
    }));

  } catch (e) {
    console.error('Create User Error:', e);
    if (String(e).includes('UNIQUE')) {
        return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};