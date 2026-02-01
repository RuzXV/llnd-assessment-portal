// Temporary endpoint to seed admin user - DELETE AFTER USE
import { hashPassword } from '../services/security';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    // Hash the password using the same algorithm as verifyPassword
    const passwordHash = await hashPassword('admin123');

    // Delete existing users
    await env.DB.prepare('DELETE FROM users').run();

    // Ensure system tenant exists
    await env.DB.prepare(`
      INSERT OR IGNORE INTO tenants (tenant_id, name, legal_name, status)
      VALUES ('system', 'System Administration', 'LLND Platform', 'active')
    `).run();

    // Insert super admin user
    await env.DB.prepare(`
      INSERT INTO users (user_id, tenant_id, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      'usr_superadmin_001',
      'system',
      'admin@test.com',
      passwordHash,
      'super_admin',
      'active'
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Admin user created',
      email: 'admin@test.com',
      password: 'admin123'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Seed error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
