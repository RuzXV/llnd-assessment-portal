import { generateToken, verifyPassword } from '../services/security';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: any = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 400 });
    }

    const user = await env.DB.prepare(
      `SELECT user_id, tenant_id, password_hash, role, status
       FROM users
       WHERE email = ? AND status = 'active'
       LIMIT 1`
    )
    .bind(email)
    .first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password_hash as string);

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    const token = await generateToken({
        sub: user.user_id as string,
        tenant_id: user.tenant_id as string,
        role: user.role as string
    }, env.JWT_SECRET);

    // Audit log successful login
    await env.DB.prepare(`
      INSERT INTO audit_logs (tenant_id, actor_id, action, entity_id, details)
      VALUES (?, ?, 'LOGIN', ?, ?)
    `).bind(user.tenant_id, user.user_id, user.user_id, JSON.stringify({ email })).run();

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
    console.error('Login error:', err.message);
    return new Response(JSON.stringify({ error: 'System error' }), { status: 500 });
  }
};
