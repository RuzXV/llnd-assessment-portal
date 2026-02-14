import { hashPassword } from '../services/security';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: any = await request.json();
    const { rto_name, rto_code, contact_name, email, password } = body;

    // Validate required fields
    if (!rto_name || !email || !password || !contact_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400 });
    }

    // Validate password length
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400 });
    }

    // Check if email already exists
    const existingUser = await env.DB.prepare(
      `SELECT user_id FROM users WHERE email = ? LIMIT 1`
    ).bind(email).first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists' }), { status: 409 });
    }

    // Generate IDs
    const tenantId = `tenant-${crypto.randomUUID()}`;
    const userId = `user-${crypto.randomUUID()}`;

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create tenant
    await env.DB.prepare(`
      INSERT INTO tenants (tenant_id, name, legal_name, status)
      VALUES (?, ?, ?, 'active')
    `).bind(tenantId, rto_name, rto_code ? `${rto_name} (${rto_code})` : rto_name).run();

    // Create user
    await env.DB.prepare(`
      INSERT INTO users (user_id, tenant_id, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, 'rto_admin', 'active')
    `).bind(userId, tenantId, email, passwordHash).run();

    // Audit log
    await env.DB.prepare(`
      INSERT INTO audit_logs (tenant_id, actor_id, action, entity_id, details)
      VALUES (?, ?, 'REGISTER', ?, ?)
    `).bind(tenantId, userId, tenantId, JSON.stringify({
      rto_name,
      rto_code: rto_code || null,
      contact_name,
      email
    })).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Registration successful'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Registration error:', err.message);
    return new Response(JSON.stringify({ error: 'System error during registration' }), { status: 500 });
  }
};
