export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env, data } = context;

    if (data.user_role !== 'platform_super_admin') {
        return new Response('Forbidden: Only Super Admins can issue seats', { status: 403 });
    }

    try {
        const body = await request.json() as any;
        const { target_tenant_id, product_id, quantity } = body;

        if (!target_tenant_id || !product_id || !quantity) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }

        const tenant = await env.DB.prepare('SELECT tenant_id FROM tenants WHERE tenant_id = ?')
            .bind(target_tenant_id).first();
        
        if (!tenant) return new Response(JSON.stringify({ error: 'Tenant not found' }), { status: 404 });

        const statements = [];
        for (let i = 0; i < quantity; i++) {
            statements.push(
                env.DB.prepare(`
                    INSERT INTO seats (seat_id, tenant_id, product_id, status, created_at)
                    VALUES (?, ?, ?, 'available', unixepoch())
                `).bind(crypto.randomUUID(), target_tenant_id, product_id)
            );
        }

        const chunkSize = 50;
        for (let i = 0; i < statements.length; i += chunkSize) {
            const chunk = statements.slice(i, i + chunkSize);
            await env.DB.batch(chunk);
        }

        await env.DB.prepare(`
            INSERT INTO audit_logs (tenant_id, actor_id, action, entity, created_at)
            VALUES (?, ?, 'SEAT_PURCHASE', ?, unixepoch())
        `).bind(target_tenant_id, data.user, `Added ${quantity} seats for product ${product_id}`).run();

        return new Response(JSON.stringify({ success: true, seats_added: quantity }));

    } catch (e) {
        console.error('Purchase Error:', e);
        return new Response(JSON.stringify({ error: 'Failed to process purchase' }), { status: 500 });
    }
};