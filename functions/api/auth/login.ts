import { generateToken, verifyPassword } from '../services/security';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    console.log('[LOGIN] Starting login request');

    const body: any = await request.json();
    const { email, password } = body;
    console.log('[LOGIN] Parsed body, email:', email);

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 400 });
    }

    console.log('[LOGIN] Querying database for user');
    const user = await env.DB.prepare(
      `SELECT user_id, tenant_id, password_hash, role, status
       FROM users
       WHERE email = ? AND status = 'active'
       LIMIT 1`
    )
    .bind(email)
    .first();

    console.log('[LOGIN] User found:', user ? 'yes' : 'no');

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    console.log('[LOGIN] Verifying password, hash length:', (user.password_hash as string)?.length);
    const isValid = await verifyPassword(password, user.password_hash as string);
    console.log('[LOGIN] Password valid:', isValid);

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    console.log('[LOGIN] Generating token, JWT_SECRET exists:', !!env.JWT_SECRET);
    const token = await generateToken({
        sub: user.user_id as string,
        tenant_id: user.tenant_id as string,
        role: user.role as string
    }, env.JWT_SECRET);
    console.log('[LOGIN] Token generated successfully');

    // Audit log successful login
    console.log('[LOGIN] Writing audit log');
    await env.DB.prepare(`
      INSERT INTO audit_logs (tenant_id, actor_id, action, entity, created_at)
      VALUES (?, ?, 'LOGIN', ?, unixepoch())
    `).bind(user.tenant_id, user.user_id, email).run();

    console.log('[LOGIN] Login successful');
    return new Response(JSON.stringify({
      token,
      user: {
        id: user.user_id,
        email: email,
        role: user.role,
        tenant_id: user.tenant_id
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[LOGIN] Error:', err.message, err.stack);
    return new Response(JSON.stringify({
      error: 'System error',
      debug: err.message
    }), { status: 500 });
  }
};