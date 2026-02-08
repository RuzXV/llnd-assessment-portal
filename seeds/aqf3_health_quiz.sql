-- AQF 3 Universal LLND Assessment - Health & Community Services Context
-- 28 Questions, Target ACSF Band: Level 2-3

-- Product and version should already exist (created separately)
-- ============================================
-- SECTION 1: READING (8 Questions)
-- ============================================

-- R1.1 - Shift Handover Note (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-r1-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What must be checked before the shift ends?',
    'What must be checked before the shift ends?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Physiotherapy notes", "Breakfast records", "Medication charts", "Incident reports"]',
    'Medication charts',
    'Medication charts',
    1.0,
    3.625,
    'Reading',
    'Reading',
    2,
    'Comprehension',
    'core',
    1,
    'Shift Handover – Morning Shift\n• Mrs Green requires assistance with breakfast\n• Mr Ali has a physiotherapy appointment at 10:30 am\n• Ensure medication charts are checked before the end of the shift'
);

-- R1.2 - Workplace Notice (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-r1-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'When does this requirement begin?',
    'When does this requirement begin?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Immediately", "Next Monday", "End of the week", "Next month"]',
    'Next Monday',
    'Next Monday',
    1.0,
    3.625,
    'Reading',
    'Reading',
    2,
    'Comprehension',
    'core',
    2,
    'Notice to Staff\nFrom next Monday, all staff must wear identification badges while on duty.'
);

-- R2.1 - Following Written Instructions (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-r2-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What should be done before cleaning surfaces?',
    'What should be done before cleaning surfaces?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Dispose of waste", "Wash hands", "Put on gloves", "Report to supervisor"]',
    'Put on gloves',
    'Put on gloves',
    1.0,
    3.625,
    'Reading',
    'Reading',
    3,
    'Procedure',
    'core',
    3,
    'To prepare a client room:\n1. Wash hands\n2. Put on gloves\n3. Clean surfaces\n4. Dispose of waste safely'
);

-- R2.2 - Multi-Step Procedure (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-r2-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What must be done after notifying the supervisor?',
    'What must be done after notifying the supervisor?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Call the family", "Record the observation", "Provide medication", "End the shift"]',
    'Record the observation',
    'Record the observation',
    1.0,
    3.625,
    'Reading',
    'Reading',
    3,
    'Procedure',
    'core',
    4,
    'If a client feels unwell, notify the supervisor immediately.\nRecord the observation in the client notes before the end of your shift.'
);

-- R3.1 - Identifying Risk (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-r3-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What is the main risk described?',
    'What is the main risk described?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Infection", "Slipping", "Equipment damage", "Noise"]',
    'Slipping',
    'Slipping',
    1.0,
    3.625,
    'Reading',
    'Reading',
    3,
    'Risk Identification',
    'core',
    5,
    'A spill was reported near the bathroom entrance earlier today.'
);

-- R3.2 - Policy Intent (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-r3-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Why must incidents be reported?',
    'Why must incidents be reported?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["To increase paperwork", "To ensure timely action is taken", "To assign responsibility", "To reduce staff workload"]',
    'To ensure timely action is taken',
    'To ensure timely action is taken',
    1.0,
    3.625,
    'Reading',
    'Reading',
    3,
    'Policy Understanding',
    'core',
    6,
    'All incidents must be reported as soon as practicable to ensure appropriate action can be taken.'
);

-- R-S1 - Conflicting Information (ACSF 3, Stretch)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-r-s1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What is the most appropriate action?',
    'What is the most appropriate action?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Follow the care plan only", "Send the client to the activity without checking", "Check how the client is feeling and confirm with the supervisor", "Cancel all activities"]',
    'Check how the client is feeling and confirm with the supervisor',
    'Check how the client is feeling and confirm with the supervisor',
    1.0,
    3.625,
    'Reading',
    'Reading',
    3,
    'Critical Analysis',
    'stretch',
    7,
    'Text A – Care Plan:\nClient should rest in their room after lunch.\n\nText B – Supervisor Message:\nClient may join group activity if they are feeling well.'
);

-- R-S2 - Implied Meaning (ACSF 3, Stretch)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-r-s2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What problem is this instruction trying to prevent?',
    'What problem is this instruction trying to prevent?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Client boredom", "Missed meal times", "Delays in getting help", "Equipment loss"]',
    'Delays in getting help',
    'Delays in getting help',
    1.0,
    3.625,
    'Reading',
    'Reading',
    3,
    'Inference',
    'stretch',
    8,
    'Staff are reminded to ensure call bells are within reach of clients at all times.'
);

-- ============================================
-- SECTION 2: WRITING (4 Questions)
-- ============================================

-- W1.1 - Functional Explanation (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-w1-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Write 1–2 sentences explaining why a client activity started late today.',
    'Write 1–2 sentences explaining why a client activity started late today.',
    'short_answer',
    'short_answer',
    'short_text',
    NULL,
    NULL,
    NULL,
    3.0,
    3.5,
    'Writing',
    'Writing',
    2,
    'Explanation',
    'core',
    9,
    NULL
);

-- W1.2 - Confirmation Message (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-w1-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Write 1–2 sentences confirming that you understand the hygiene procedures explained this morning.',
    'Write 1–2 sentences confirming that you understand the hygiene procedures explained this morning.',
    'short_answer',
    'short_answer',
    'short_text',
    NULL,
    NULL,
    NULL,
    3.0,
    3.5,
    'Writing',
    'Writing',
    2,
    'Confirmation',
    'core',
    10,
    NULL
);

-- W-S1 - Cause and Impact (ACSF 3, Stretch)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-w-s1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Write 3–4 sentences explaining why a task could not be completed as planned and how this affected the rest of your shift.',
    'Write 3–4 sentences explaining why a task could not be completed as planned and how this affected the rest of your shift.',
    'short_answer',
    'short_answer',
    'short_text',
    NULL,
    NULL,
    NULL,
    3.0,
    3.5,
    'Writing',
    'Writing',
    3,
    'Cause and Effect',
    'stretch',
    11,
    NULL
);

-- W2.2 - Request for Clarification (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-w2-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Write 3–4 sentences asking your supervisor to clarify changes to tomorrow''s shift tasks.',
    'Write 3–4 sentences asking your supervisor to clarify changes to tomorrow''s shift tasks.',
    'short_answer',
    'short_answer',
    'short_text',
    NULL,
    NULL,
    NULL,
    3.0,
    3.5,
    'Writing',
    'Writing',
    3,
    'Request',
    'core',
    12,
    NULL
);

-- ============================================
-- SECTION 3: NUMERACY (8 Questions)
-- ============================================

-- N1.1 - Time Calculation (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-n1-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'How long is the shift? (Enter answer in hours, e.g., 7.5)',
    'How long is the shift? (Enter answer in hours, e.g., 7.5)',
    'short_answer',
    'numeric',
    'numeric',
    NULL,
    '7.5',
    '7.5',
    1.0,
    3.625,
    'Numeracy',
    'Numeracy',
    2,
    'Time Calculation',
    'core',
    13,
    'A shift starts at 7:00 am and ends at 3:00 pm, with a 30-minute break.'
);

-- N1.2 - Counting (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-n1-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'How many clients remain on the ward?',
    'How many clients remain on the ward?',
    'short_answer',
    'numeric',
    'numeric',
    NULL,
    '7',
    '7',
    1.0,
    3.625,
    'Numeracy',
    'Numeracy',
    2,
    'Arithmetic',
    'core',
    14,
    'There are 10 clients on a ward.\n3 clients are attending appointments.'
);

-- N1.3 - Cost Calculation (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-n1-3',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What is the cost of 6 meals?',
    'What is the cost of 6 meals?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["$45.00", "$48.00", "$51.00", "$54.00"]',
    '$51.00',
    '$51.00',
    1.0,
    3.625,
    'Numeracy',
    'Numeracy',
    3,
    'Cost Calculation',
    'core',
    15,
    'Each meal costs $8.50.'
);

-- N2.1 - Time Interpretation (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-n2-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'When is the next check due?',
    'When is the next check due?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["8:00 am", "9:00 am", "10:00 am", "12:00 pm"]',
    '10:00 am',
    '10:00 am',
    1.0,
    3.625,
    'Numeracy',
    'Numeracy',
    3,
    'Time Interpretation',
    'core',
    16,
    'Medication must be checked every 4 hours.\nThe first check was at 6:00 am.'
);

-- N-S1 - Percentage Calculation (ACSF 3, Stretch)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-n-s1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What percentage is this?',
    'What percentage is this?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["20%", "25%", "30%", "40%"]',
    '25%',
    '25%',
    1.0,
    3.625,
    'Numeracy',
    'Numeracy',
    3,
    'Percentage',
    'stretch',
    17,
    'Out of 20 clients, 5 require additional assistance.'
);

-- N-S2 - Table + Rule (ACSF 3, Stretch)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text, context_table)
VALUES (
    'aqf3-n-s2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What is the total time required? (Enter answer in minutes)',
    'What is the total time required? (Enter answer in minutes)',
    'short_answer',
    'numeric',
    'numeric',
    NULL,
    '50',
    '50',
    1.0,
    3.625,
    'Numeracy',
    'Numeracy',
    3,
    'Table Analysis',
    'stretch',
    18,
    'Rule: Any check over 15 minutes requires an extra 5 minutes.',
    '{"headers": ["Client", "Required Check (min)"], "rows": [["A", "10"], ["B", "15"], ["C", "20"]]}'
);

-- N3.1 - Data Interpretation (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text, context_table)
VALUES (
    'aqf3-n3-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Which day had the most incidents?',
    'Which day had the most incidents?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Monday", "Tuesday", "Wednesday", "Thursday"]',
    'Wednesday',
    'Wednesday',
    1.0,
    3.625,
    'Numeracy',
    'Numeracy',
    3,
    'Data Interpretation',
    'core',
    19,
    NULL,
    '{"headers": ["Day", "Incidents"], "rows": [["Monday", "2"], ["Tuesday", "1"], ["Wednesday", "3"], ["Thursday", "1"], ["Friday", "0"]]}'
);

-- N3.2 - Trend Interpretation (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text, context_table)
VALUES (
    'aqf3-n3-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Which statement best describes the data?',
    'Which statement best describes the data?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Incidents increased every day", "Incidents decreased every day", "Incidents varied across the week", "Incidents stayed the same"]',
    'Incidents varied across the week',
    'Incidents varied across the week',
    1.0,
    3.625,
    'Numeracy',
    'Numeracy',
    3,
    'Trend Analysis',
    'core',
    20,
    NULL,
    '{"headers": ["Day", "Incidents"], "rows": [["Monday", "2"], ["Tuesday", "1"], ["Wednesday", "3"], ["Thursday", "1"], ["Friday", "0"]]}'
);

-- ============================================
-- SECTION 4: ORAL COMMUNICATION (4 Questions)
-- ============================================

-- O1.1 - Instruction Transcript (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-o1-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What must be done before informing the supervisor?',
    'What must be done before informing the supervisor?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Assist with lunch", "Prepare medication", "Clean the room", "Update records"]',
    'Assist with lunch',
    'Assist with lunch',
    1.0,
    3.5,
    'Oral',
    'Oral',
    2,
    'Following Instructions',
    'core',
    21,
    'Transcript:\n"Please assist Mrs Green with lunch and let me know once she has finished."'
);

-- O1.2 - Clarification Message (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-o1-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What is the key message?',
    'What is the key message?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Follow the plan without questions", "Ask for clarification if unsure", "Work independently", "Finish quickly"]',
    'Ask for clarification if unsure',
    'Ask for clarification if unsure',
    1.0,
    3.5,
    'Oral',
    'Oral',
    3,
    'Key Message',
    'core',
    22,
    'Transcript:\n"If you are unsure about the care plan, ask before proceeding."'
);

-- O-S1 - Appropriate Response (ACSF 3, Stretch)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-o-s1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What is the best response?',
    'What is the best response?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Guess what to do", "Ignore the instruction", "Ask questions to clarify", "Wait until later"]',
    'Ask questions to clarify',
    'Ask questions to clarify',
    1.0,
    3.5,
    'Oral',
    'Oral',
    3,
    'Appropriate Response',
    'stretch',
    23,
    'A supervisor gives you new instructions that you do not fully understand.'
);

-- O-S2 - Prioritisation (ACSF 3, Stretch)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-o-s2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What should you do?',
    'What should you do?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Ignore the call bell", "Finish current task and respond as soon as safe to do so", "Leave immediately without explanation", "Turn off the bell"]',
    'Finish current task and respond as soon as safe to do so',
    'Finish current task and respond as soon as safe to do so',
    1.0,
    3.5,
    'Oral',
    'Oral',
    3,
    'Prioritisation',
    'stretch',
    24,
    'You are assisting a client when another client rings the call bell.'
);

-- ============================================
-- SECTION 5: DIGITAL LITERACY (4 Questions)
-- ============================================

-- D1.1 - Digital Form Completion (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-d1-1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Which field must be completed before submission?',
    'Which field must be completed before submission?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Optional comments", "Supervisor notes", "Date and time of incident", "Attachments"]',
    'Date and time of incident',
    'Date and time of incident',
    1.0,
    3.5,
    'Digital',
    'Digital',
    2,
    'Form Completion',
    'core',
    25,
    'You are completing an online incident report.'
);

-- D1.2 - File Type Selection (ACSF 2, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-d1-2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Which file type is most appropriate for uploading a scanned document?',
    'Which file type is most appropriate for uploading a scanned document?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '[".exe", ".pdf", ".bat", ".tmp"]',
    '.pdf',
    '.pdf',
    1.0,
    3.5,
    'Digital',
    'Digital',
    2,
    'File Types',
    'core',
    26,
    NULL
);

-- D-S1 - Workflow Correction (ACSF 3, Stretch)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-d-s1',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'What should you do?',
    'What should you do?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Leave the error", "Delete the record", "Edit, save, and submit the corrected note", "Log out"]',
    'Edit, save, and submit the corrected note',
    'Edit, save, and submit the corrected note',
    1.0,
    3.5,
    'Digital',
    'Digital',
    3,
    'Error Correction',
    'stretch',
    27,
    'You notice an error after saving a client note.'
);

-- D-S2 - Digital Safety (ACSF 3, Core)
INSERT OR REPLACE INTO questions (question_id, version_id, product_id, question_text, text, question_type, type, response_type, options, correct_answer, correct_response, max_score, weight, acsf_domain, domain, acsf_level, acsf_skill, difficulty_tag, order_index, context_text)
VALUES (
    'aqf3-d-s2',
    'ver-aqf3-health-v1',
    'aqf3-health',
    'Which action best protects client information?',
    'Which action best protects client information?',
    'multiple_choice',
    'multiple_choice',
    'mcq',
    '["Sharing login details", "Leaving the system logged in", "Using strong passwords and logging out", "Writing passwords down"]',
    'Using strong passwords and logging out',
    'Using strong passwords and logging out',
    1.0,
    3.5,
    'Digital',
    'Digital',
    3,
    'Digital Safety',
    'core',
    28,
    NULL
);

-- Add seats for testing
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-001', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-002', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-003', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-004', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-005', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-006', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-007', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-008', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-009', 'system', 'aqf3-health', 'available', 'PILOT-2026');
INSERT OR IGNORE INTO seats (seat_id, tenant_id, product_id, status, purchase_reference) VALUES ('seat-aqf3-health-010', 'system', 'aqf3-health', 'available', 'PILOT-2026');
