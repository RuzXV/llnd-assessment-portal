import { verifyToken } from './services/security';

interface Data {
  user: string;
  tenant_id: string;
  user_role: string;
  [key: string]: unknown;
}

export const onRequest: PagesFunction<Env, any, Data> = async (context) => {
  const { request, env, next, data } = context;
  const url = new URL(request.url);


  // Public routes that don't require authentication
  // Note: /api/assessments/{token} routes are for students, /api/assessments/list is for admins
  const isPublicRoute =
    url.pathname.includes('/api/auth/login') ||
    url.pathname.includes('/api/auth/register') ||
    url.pathname.includes('/api/stripe/webhook') ||
    (url.pathname.includes('/api/assessments/') && !url.pathname.includes('/api/assessments/list')) ||
    url.pathname.includes('/api/per/submit') ||
    // EEPT public routes: candidate start, submit, autosave, verification
    url.pathname.includes('/api/ebpa/start') ||
    url.pathname.includes('/api/ebpa/submit-') ||
    url.pathname.includes('/api/ebpa/save-progress') ||
    url.pathname.includes('/api/ebpa/verify/');

  if (isPublicRoute) {
    return next();
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing token' }), { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifyToken(token, (env as any).JWT_SECRET);
    
    if (!payload || !payload.tenant_id) {
        throw new Error('Invalid token scope');
    }

    data.user = payload.sub as string;
    data.tenant_id = payload.tenant_id as string;
    data.user_role = payload.role as string;

    return next();

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401 });
  }
};