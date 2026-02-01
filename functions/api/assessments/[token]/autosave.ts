// Autosave endpoint for student assessment drafts
// Saves in-progress answers to prevent data loss

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const token = params.token as string;

  try {
    const body = await request.json() as any;
    const { answers } = body;

    // Verify the attempt exists and is in progress
    const attempt = await env.DB.prepare(`
      SELECT attempt_id, status
      FROM assessment_attempts
      WHERE token_hash = ?
    `).bind(token).first();

    if (!attempt) {
      return new Response(JSON.stringify({ error: 'Invalid assessment' }), { status: 404 });
    }

    if (attempt.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'Assessment not in progress' }), { status: 400 });
    }

    // Save draft responses
    await env.DB.prepare(`
      UPDATE assessment_attempts
      SET draft_responses = ?,
          last_autosave_at = unixepoch()
      WHERE attempt_id = ?
    `).bind(JSON.stringify(answers), attempt.attempt_id).run();

    return new Response(JSON.stringify({
      success: true,
      saved_at: Date.now()
    }));

  } catch (e) {
    console.error("Autosave Error:", e);
    return new Response(JSON.stringify({ error: 'Autosave failed' }), { status: 500 });
  }
};
