// GET /api/products
// Returns all active assessment products

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, data } = context;

  if (!data.tenant_id || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  try {
    const results = await env.DB.prepare(
      'SELECT product_id, name as product_name, aqf_level, stream FROM assessment_products WHERE active = 1'
    ).all();

    return new Response(JSON.stringify(results.results), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('Products fetch error:', e);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
