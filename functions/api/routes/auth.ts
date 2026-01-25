import { generateToken, verifyPassword } from '../services/security';

type EnvWithSecret = Env & { JWT_SECRET: string };

export const onRequestPost: PagesFunction<EnvWithSecret> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json() as any;
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
        sub: user.user_id,
        tenant_id: user.tenant_id,
        role: user.role
    }, env.JWT_SECRET);

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

  } catch (err) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ error: 'System error' }), { status: 500 });
  }
};