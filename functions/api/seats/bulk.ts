export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env, data } = context;

    // Authorization check
    if (!data.user || (data.user_role !== 'rto_admin' && data.user_role !== 'super_admin')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    if (!data.tenant_id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        const body = await request.json() as any;
        const { students } = body;

        if (!students || !Array.isArray(students) || students.length === 0) {
            return new Response(JSON.stringify({ error: 'No students provided' }), { status: 400 });
        }

        // Limit batch size to prevent timeout
        if (students.length > 500) {
            return new Response(JSON.stringify({ error: 'Maximum 500 students per batch' }), { status: 400 });
        }

        const results: any[] = [];
        const origin = new URL(request.url).origin;

        // Process each student
        for (const student of students) {
            const { product_id, student_name, student_id, email, product_name } = student;

            try {
                // Find active version for this product
                const version = await env.DB.prepare(`
                    SELECT version_id FROM assessment_versions
                    WHERE product_id = ? AND is_active = 1
                    ORDER BY created_at DESC LIMIT 1
                `).bind(product_id).first();

                if (!version) {
                    results.push({
                        student_name,
                        student_id,
                        email,
                        product_name,
                        status: 'error',
                        error: 'No active assessment version found'
                    });
                    continue;
                }

                // Find available seat
                const seat = await env.DB.prepare(`
                    SELECT seat_id FROM seats
                    WHERE tenant_id = ? AND product_id = ? AND status = 'available'
                    LIMIT 1
                `).bind(data.tenant_id, product_id).first();

                if (!seat) {
                    results.push({
                        student_name,
                        student_id,
                        email,
                        product_name,
                        status: 'error',
                        error: 'No seats available for this assessment type'
                    });
                    continue;
                }

                const attemptId = crypto.randomUUID();
                const token = crypto.randomUUID();
                const seatId = seat.seat_id as string;
                const versionId = version.version_id as string;

                // Create assessment attempt
                await env.DB.batch([
                    env.DB.prepare("UPDATE seats SET status = 'reserved' WHERE seat_id = ?").bind(seatId),

                    env.DB.prepare(`
                        INSERT INTO assessment_attempts (
                            attempt_id, tenant_id, seat_id, version_id, token_hash,
                            student_name, student_id, status
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'issued')
                    `).bind(attemptId, data.tenant_id, seatId, versionId, token, student_name, student_id || null),

                    env.DB.prepare(`
                        INSERT INTO audit_logs (tenant_id, actor_id, action, entity_id)
                        VALUES (?, ?, 'BULK_ISSUE_ASSESSMENT', ?)
                    `).bind(data.tenant_id, data.user, seatId)
                ]);

                results.push({
                    student_name,
                    student_id,
                    email,
                    product_name,
                    status: 'success',
                    link: `${origin}/assess?token=${token}`,
                    attempt_id: attemptId
                });

            } catch (studentError: any) {
                results.push({
                    student_name,
                    student_id,
                    email,
                    product_name,
                    status: 'error',
                    error: studentError.message || 'Failed to create assessment'
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            total: students.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'error').length,
            results
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('Bulk Upload Error:', e);
        return new Response(JSON.stringify({ error: 'Server error', debug: e.message }), { status: 500 });
    }
};
