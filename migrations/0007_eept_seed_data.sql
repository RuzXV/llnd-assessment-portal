-- ============================================
-- EEPT (English Placement Test) Seed Data
-- Migration: 0007_eept_seed_data.sql
-- Date: 2026-02-19
-- Seeds: Form, Passages, Grammar Qs, Reading Qs,
--        Writing Prompts, Scoring Maps
-- ============================================

-- ============================================
-- 1. TEST FORM
-- ============================================
INSERT INTO eept_test_forms (form_id, name, version)
VALUES ('eept-form-1', 'EEPT Form 1 (Prototype)', '1.0');


-- ============================================
-- 2. READING PASSAGES (4 passages)
-- ============================================

-- P-A2-001: Community Sports Centre Notice (~270 words, A2)
INSERT INTO eept_passages (passage_id, form_id, cefr, title, text, word_count, text_type, topic_domain, order_index)
VALUES (
    'P-A2-001',
    'eept-form-1',
    'A2',
    'Community Sports Centre Notice',
    'Community Sports Centre Notice

The Greenfield Community Sports Centre is open every day from 8:00 a.m. to 8:00 p.m. The centre offers a variety of activities for both children and adults. These include swimming lessons, yoga classes, basketball training, and weekend fitness programs.

To join any activity, you must complete a registration form at the reception desk. Some activities require advance booking because spaces are limited. It is recommended that you book at least three days before the program begins.

The centre also has a small cafe where visitors can buy snacks and drinks. However, food and drinks are not allowed inside the swimming pool area. Lockers are available for a small fee, and members are advised to bring their own towels.

For more information, visit the reception desk or check the centre''s website.',
    270,
    'informational',
    'community',
    1
);

-- P-B1-001: Improving Workplace Communication (~420 words, B1)
INSERT INTO eept_passages (passage_id, form_id, cefr, title, text, word_count, text_type, topic_domain, order_index)
VALUES (
    'P-B1-001',
    'eept-form-1',
    'B1',
    'Improving Workplace Communication',
    'Improving Workplace Communication

Good communication in the workplace is essential for productivity and employee satisfaction. When managers clearly explain expectations, employees are more likely to complete tasks effectively and on time.

However, communication problems often occur when instructions are unclear or when employees feel uncomfortable asking questions. In some cases, misunderstandings arise because people interpret messages differently.

One solution is to encourage regular team meetings. These meetings allow employees to clarify responsibilities and discuss any concerns. In addition, written summaries of key decisions can reduce confusion.

Technology has also changed the way people communicate at work. While emails and messaging platforms make communication faster, they can sometimes create misunderstandings if the tone of a message is unclear.

To improve communication, organisations should provide training programs that focus on active listening, constructive feedback, and clear writing skills.',
    420,
    'article',
    'workplace',
    2
);

-- P-B2-001: Sustainable Urban Development (~560 words, B2)
INSERT INTO eept_passages (passage_id, form_id, cefr, title, text, word_count, text_type, topic_domain, order_index)
VALUES (
    'P-B2-001',
    'eept-form-1',
    'B2',
    'Sustainable Urban Development',
    'Sustainable Urban Development

As cities continue to expand, governments are under increasing pressure to design urban environments that balance economic growth with environmental sustainability. Rapid urbanisation has led to higher energy consumption, traffic congestion, and increased waste production.

In response, many cities are adopting "smart city" strategies. These involve using technology to improve energy efficiency, public transport systems, and waste management. For example, intelligent traffic systems can reduce congestion by adjusting signal timings in real time.

However, critics argue that technological solutions alone are insufficient. They emphasise the importance of behavioural change, such as encouraging citizens to use public transport and reduce household energy consumption.

Furthermore, sustainable development requires long-term planning. Policies must integrate housing, transport, and environmental protection rather than addressing each issue separately.

Although the transition to sustainable cities presents challenges, it also offers economic opportunities through green industries and innovation.',
    560,
    'article',
    'general',
    3
);

-- P-C1-001: The Paradox of Digital Transformation (~670 words, C1)
INSERT INTO eept_passages (passage_id, form_id, cefr, title, text, word_count, text_type, topic_domain, order_index)
VALUES (
    'P-C1-001',
    'eept-form-1',
    'C1',
    'The Paradox of Digital Transformation',
    'The Paradox of Digital Transformation

Organisations frequently pursue digital transformation initiatives with the expectation that technological upgrades will automatically enhance productivity and competitiveness. Yet research increasingly suggests that technology alone rarely produces the anticipated outcomes.

One reason for this paradox lies in organisational culture. When employees perceive new systems as disruptive or imposed without consultation, resistance may undermine implementation efforts. In such cases, the technological infrastructure may be sound, but its integration into daily practice remains superficial.

Moreover, digital transformation often exposes structural inefficiencies that technology cannot resolve independently. For instance, automating a flawed process merely accelerates its inefficiency. Without concurrent redesign of workflows, productivity gains may be negligible.

However, organisations that adopt a holistic strategy - combining technological investment with leadership development and employee engagement - tend to achieve more sustainable improvements. In these contexts, technology serves as an enabler rather than a substitute for strategic thinking.

Thus, digital transformation should be understood not as a singular technological upgrade but as an ongoing organisational evolution requiring cultural, structural, and behavioural adaptation.',
    670,
    'article',
    'general',
    4
);


-- ============================================
-- 3. GRAMMAR QUESTIONS (20 items for Form 1)
-- Section: grammar, passage_id: NULL, points: 1.0
-- ============================================

-- Q1 (GVA2-001, A2, Present simple)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G01', 'eept-form-1', 'grammar', NULL, 'A2', 'Present simple',
    'She usually ___ to work by bus.', 'go', 'goes', 'going', 'gone', 'B', 1.0, 1);

-- Q2 (GVA2-002, A2, Prepositions of time)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G02', 'eept-form-1', 'grammar', NULL, 'A2', 'Prepositions of time',
    'The meeting starts ___ 9:00 a.m.', 'in', 'at', 'on', 'for', 'B', 1.0, 2);

-- Q3 (GVA2-007, A2, There is/are)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G03', 'eept-form-1', 'grammar', NULL, 'A2', 'There is/are',
    'There ___ many students in the classroom.', 'is', 'are', 'was', 'be', 'B', 1.0, 3);

-- Q4 (GVA2-019, A2, Conjunction - because)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G04', 'eept-form-1', 'grammar', NULL, 'A2', 'Conjunction',
    'I stayed home ___ I was tired.', 'but', 'because', 'or', 'although', 'B', 1.0, 4);

-- Q5 (GVA2-020, A2, Vocabulary - turn off)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G05', 'eept-form-1', 'grammar', NULL, 'A2', 'Vocabulary',
    'Please turn ___ the lights when you leave.', 'on', 'in', 'off', 'up', 'C', 1.0, 5);

-- Q6 (GVB1-011, B1, Present perfect)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G06', 'eept-form-1', 'grammar', NULL, 'B1', 'Present perfect',
    'She ___ in this company since 2020.', 'worked', 'has worked', 'works', 'working', 'B', 1.0, 6);

-- Q7 (GVB1-001, B1, First conditional)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G07', 'eept-form-1', 'grammar', NULL, 'B1', 'First conditional',
    'If it ___ tomorrow, we will cancel the trip.', 'rains', 'rained', 'will rain', 'raining', 'A', 1.0, 7);

-- Q8 (GVB1-004, B1, Relative clauses)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G08', 'eept-form-1', 'grammar', NULL, 'B1', 'Relative clauses',
    'The student ___ won the award is from Malaysia.', 'which', 'whose', 'who', 'where', 'C', 1.0, 8);

-- Q9 (GVB1-015, B1, Quantifiers)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G09', 'eept-form-1', 'grammar', NULL, 'B1', 'Quantifiers',
    'There isn''t ___ information available about the event.', 'many', 'much', 'few', 'several', 'B', 1.0, 9);

-- Q10 (GVB1-010, B1, Gerund/infinitive)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G10', 'eept-form-1', 'grammar', NULL, 'B1', 'Gerund/infinitive',
    'She decided ___ early.', 'leave', 'to leave', 'leaving', 'left', 'B', 1.0, 10);

-- Q11 (GVB1-012, B1, Reported speech)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G11', 'eept-form-1', 'grammar', NULL, 'B1', 'Reported speech',
    'He said that he ___ the report the next day.', 'will finish', 'would finish', 'finishes', 'finished', 'B', 1.0, 11);

-- Q12 (GVB1-018, B1, Linking words)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G12', 'eept-form-1', 'grammar', NULL, 'B1', 'Linking words',
    'He missed the bus; ___, he arrived late.', 'as a result', 'in addition', 'for example', 'meanwhile', 'A', 1.0, 12);

-- Q13 (GVB2-004, B2, Collocation)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G13', 'eept-form-1', 'grammar', NULL, 'B2', 'Collocation',
    'The organisation aims to ___ its environmental impact.', 'reduce', 'cut down', 'make less', 'decrease off', 'A', 1.0, 13);

-- Q14 (GVB2-009, B2, Complex preposition)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G14', 'eept-form-1', 'grammar', NULL, 'B2', 'Complex preposition',
    'The report was prepared ___ accordance with company policy.', 'in', 'at', 'by', 'under', 'A', 1.0, 14);

-- Q15 (GVB2-006, B2, Discourse markers)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G15', 'eept-form-1', 'grammar', NULL, 'B2', 'Discourse markers',
    'The company reported increased profits; ___, staff satisfaction declined.', 'therefore', 'however', 'because', 'furthermore', 'B', 1.0, 15);

-- Q16 (GVB2-015, B2, Mixed conditional)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G16', 'eept-form-1', 'grammar', NULL, 'B2', 'Mixed conditional',
    'If she had prepared better, she ___ more confident now.', 'would be', 'will be', 'would have been', 'is', 'A', 1.0, 16);

-- Q17 (GVB2-007, B2, Passive voice)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G17', 'eept-form-1', 'grammar', NULL, 'B2', 'Passive voice',
    'The proposal ___ by the committee before implementation.', 'must approve', 'must be approved', 'must approved', 'approving', 'B', 1.0, 17);

-- Q18 (GVC1-002, C1, Inversion)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G18', 'eept-form-1', 'grammar', NULL, 'C1', 'Inversion',
    'Rarely ___ such a comprehensive study been conducted.', 'has', 'have', 'is', 'was', 'A', 1.0, 18);

-- Q19 (GVC1-004, C1, Lexical precision)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G19', 'eept-form-1', 'grammar', NULL, 'C1', 'Lexical precision',
    'The policy was introduced to ___ long-term economic instability.', 'lessen', 'reduce', 'mitigate', 'lower', 'C', 1.0, 19);

-- Q20 (GVC1-007, C1, Subjunctive)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-G20', 'eept-form-1', 'grammar', NULL, 'C1', 'Subjunctive',
    'The committee recommended that the policy ___ revised immediately.', 'is', 'be', 'was', 'being', 'B', 1.0, 20);


-- ============================================
-- 4. READING QUESTIONS (20 items for Form 1)
-- Section: reading, points: 1.5
-- ============================================

-- === P-A2-001 Questions (Q21-Q25) ===

-- Q21 (RCA2-001)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R21', 'eept-form-1', 'reading', 'P-A2-001', 'A2', 'Main idea',
    'What is the purpose of this text?',
    'To advertise a new cafe',
    'To provide information about a sports centre',
    'To explain how to become a swimming instructor',
    'To compare different fitness centres',
    'B', 1.5, 21);

-- Q22 (RCA2-002)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R22', 'eept-form-1', 'reading', 'P-A2-001', 'A2', 'Detail retrieval',
    'When should you book an activity?',
    'On the same day',
    'One week before',
    'At least three days before',
    'After the program begins',
    'C', 1.5, 22);

-- Q23 (RCA2-003)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R23', 'eept-form-1', 'reading', 'P-A2-001', 'A2', 'Detail retrieval',
    'What is NOT allowed in the swimming pool area?',
    'Towels',
    'Lockers',
    'Food and drinks',
    'Registration forms',
    'C', 1.5, 23);

-- Q24 (RCA2-004)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R24', 'eept-form-1', 'reading', 'P-A2-001', 'A2', 'Vocabulary in context',
    'The word "limited" in the text means:',
    'Very expensive',
    'Small in number',
    'Free',
    'New',
    'B', 1.5, 24);

-- Q25 (RCA2-005)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R25', 'eept-form-1', 'reading', 'P-A2-001', 'A2', 'Detail retrieval',
    'Where can visitors get more information?',
    'At the cafe',
    'From the swimming instructor',
    'At reception or on the website',
    'In the parking area',
    'C', 1.5, 25);

-- === P-B1-001 Questions (Q26-Q30) ===

-- Q26 (RCB1-001)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R26', 'eept-form-1', 'reading', 'P-B1-001', 'B1', 'Main idea',
    'What is the main topic of the article?',
    'Technology problems in the workplace',
    'Strategies to improve workplace communication',
    'Reasons employees leave their jobs',
    'The importance of written reports',
    'B', 1.5, 26);

-- Q27 (RCB1-002)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R27', 'eept-form-1', 'reading', 'P-B1-001', 'B1', 'Detail retrieval',
    'Why do misunderstandings happen?',
    'Employees work too slowly',
    'Instructions are always written',
    'People interpret messages differently',
    'Managers avoid meetings',
    'C', 1.5, 27);

-- Q28 (RCB1-003)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R28', 'eept-form-1', 'reading', 'P-B1-001', 'B1', 'Detail retrieval',
    'Why are written summaries useful?',
    'They replace meetings',
    'They reduce confusion',
    'They increase workload',
    'They eliminate technology',
    'B', 1.5, 28);

-- Q29 (RCB1-004)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R29', 'eept-form-1', 'reading', 'P-B1-001', 'B1', 'Vocabulary in context',
    'The word "constructive" most nearly means:',
    'Helpful',
    'Critical',
    'Negative',
    'Informal',
    'A', 1.5, 29);

-- Q30 (RCB1-005)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R30', 'eept-form-1', 'reading', 'P-B1-001', 'B1', 'Author purpose',
    'Why does the author mention technology?',
    'To criticise new tools',
    'To explain how communication methods have changed',
    'To promote a specific platform',
    'To argue that meetings are unnecessary',
    'B', 1.5, 30);

-- === P-B2-001 Questions (Q31-Q35) ===

-- Q31 (RCB2-001)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R31', 'eept-form-1', 'reading', 'P-B2-001', 'B2', 'Main idea',
    'What is the primary focus of the passage?',
    'The history of urban development',
    'The economic benefits of cities',
    'Strategies for sustainable urban growth',
    'The disadvantages of technology',
    'C', 1.5, 31);

-- Q32 (RCB2-002)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R32', 'eept-form-1', 'reading', 'P-B2-001', 'B2', 'Detail retrieval',
    'What is one example of a smart city strategy?',
    'Increasing fuel prices',
    'Intelligent traffic systems',
    'Building more highways',
    'Reducing population growth',
    'B', 1.5, 32);

-- Q33 (RCB2-003)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R33', 'eept-form-1', 'reading', 'P-B2-001', 'B2', 'Inference',
    'Why do critics believe technology alone is insufficient?',
    'It is too expensive',
    'It ignores the need for behavioural change',
    'It increases pollution',
    'It reduces employment',
    'B', 1.5, 33);

-- Q34 (RCB2-004)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R34', 'eept-form-1', 'reading', 'P-B2-001', 'B2', 'Vocabulary in context',
    'The word "integrate" most nearly means:',
    'Separate',
    'Combine',
    'Replace',
    'Analyse',
    'B', 1.5, 34);

-- Q35 (RCB2-005)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R35', 'eept-form-1', 'reading', 'P-B2-001', 'B2', 'Author viewpoint',
    'How does the author view sustainable development?',
    'Completely unrealistic',
    'Necessary but challenging',
    'Economically harmful',
    'Technologically impossible',
    'B', 1.5, 35);

-- === P-C1-001 Questions (Q36-Q40) ===

-- Q36 (RCC1-001)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R36', 'eept-form-1', 'reading', 'P-C1-001', 'C1', 'Central argument',
    'What is the central argument of the passage?',
    'Technology always increases productivity',
    'Digital transformation is unnecessary',
    'Technology alone is insufficient without organisational change',
    'Cultural resistance prevents all innovation',
    'C', 1.5, 36);

-- Q37 (RCC1-002)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R37', 'eept-form-1', 'reading', 'P-C1-001', 'C1', 'Inference',
    'What does the author imply about automating flawed processes?',
    'It improves efficiency immediately',
    'It may worsen existing inefficiencies',
    'It reduces employee resistance',
    'It eliminates cultural barriers',
    'B', 1.5, 37);

-- Q38 (RCC1-003)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R38', 'eept-form-1', 'reading', 'P-C1-001', 'C1', 'Vocabulary in context',
    'The word "superficial" most nearly means:',
    'Thorough',
    'Temporary',
    'Shallow',
    'Complex',
    'C', 1.5, 38);

-- Q39 (RCC1-004)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R39', 'eept-form-1', 'reading', 'P-C1-001', 'C1', 'Author characterisation',
    'How does the author characterise successful digital transformation?',
    'Purely technological',
    'Holistic and strategic',
    'Fast and inexpensive',
    'Fully automated',
    'B', 1.5, 39);

-- Q40 (RCC1-005)
INSERT INTO eept_questions (question_id, form_id, section, passage_id, cefr, subskill, prompt, option_a, option_b, option_c, option_d, correct_option, points, order_index)
VALUES ('EEPT-F1-R40', 'eept-form-1', 'reading', 'P-C1-001', 'C1', 'Author purpose',
    'Why does the author mention organisational culture?',
    'To provide a minor example',
    'To identify a key reason transformation may fail',
    'To criticise employees',
    'To argue against leadership',
    'B', 1.5, 40);


-- ============================================
-- 5. WRITING PROMPTS (2 prompts for Form 1)
-- ============================================

-- W1-003: Task 1 - Flexible working hours message
INSERT INTO eept_writing_prompts (prompt_id, form_id, task_type, cefr_target, prompt, requirement_1, requirement_2, requirement_3, word_limit_min, word_limit_max, assessment_focus)
VALUES (
    'W1-003',
    'eept-form-1',
    'task1',
    'B2',
    'Your company is considering introducing flexible working hours.

Write a message to your supervisor:
- explain one advantage of flexible hours
- mention one possible concern
- suggest how the concern could be addressed

Write 120-150 words.',
    'Explain one advantage of flexible hours',
    'Mention one possible concern',
    'Suggest how the concern could be addressed',
    120,
    150,
    'Balanced argument, organisational clarity, lexical range'
);

-- W2-001: Task 2 - Online vs traditional education essay
INSERT INTO eept_writing_prompts (prompt_id, form_id, task_type, cefr_target, prompt, requirement_1, requirement_2, requirement_3, word_limit_min, word_limit_max, assessment_focus)
VALUES (
    'W2-001',
    'eept-form-1',
    'task2',
    'B2',
    'Some people believe that online education is more effective than traditional classroom learning. Others disagree.

Discuss both views and give your own opinion.

Write approximately 250 words.',
    'Discuss the view that online education is more effective',
    'Discuss the opposing view',
    'Give your own opinion',
    220,
    320,
    'Clear position, paragraph structure, balanced discussion'
);


-- ============================================
-- 6. SCORING MAPS (global configs)
-- ============================================

-- Map 1: CEFR Cutoffs (includes IELTS, ACSF, skill floor, integrity)
INSERT INTO eept_scoring_maps (map_id, map_type, map_json, version, is_active, tenant_id)
VALUES (
    'score-map-cefr-v1',
    'cefr_cutoffs',
    '{
  "version": "v1.0-pilot",
  "updated_at": "2026-02-19",
  "skillFloorRuleEnabled": true,
  "cefrCutoffsOverall": [
    { "min": 0, "max": 34, "band": "A2" },
    { "min": 35, "max": 49, "band": "B1" },
    { "min": 50, "max": 64, "band": "B2" },
    { "min": 65, "max": 100, "band": "C1" }
  ],
  "cefrCutoffsReading": [
    { "min": 0, "max": 11, "band": "A2" },
    { "min": 12, "max": 17, "band": "B1" },
    { "min": 18, "max": 23, "band": "B2" },
    { "min": 24, "max": 30, "band": "C1" }
  ],
  "cefrCutoffsWriting": [
    { "min": 0, "max": 12, "band": "A2" },
    { "min": 13, "max": 20, "band": "B1" },
    { "min": 21, "max": 28, "band": "B2" },
    { "min": 29, "max": 40, "band": "C1" }
  ],
  "ieltsMappingTable": {
    "A2": { "low": "3.0", "mid": "3.5", "high": "4.0" },
    "B1": { "low": "4.5", "mid": "5.0", "high": "5.0+" },
    "B2": { "low": "5.5", "mid": "6.0", "high": "6.0+" },
    "C1": { "low": "6.5", "mid": "7.0", "high": "7.5" }
  },
  "acsfReadingMap": [
    { "min": 0, "max": 11, "band": 2 },
    { "min": 12, "max": 17, "band": 3 },
    { "min": 18, "max": 23, "band": 4 },
    { "min": 24, "max": 30, "band": 5 }
  ],
  "acsfWritingMap": [
    { "min": 0, "max": 12, "band": 2 },
    { "min": 13, "max": 20, "band": 3 },
    { "min": 21, "max": 28, "band": 4 },
    { "min": 29, "max": 40, "band": 5 }
  ],
  "integrityPolicy": {
    "mode": "display_only",
    "similarity_review_threshold": 10,
    "similarity_high_threshold": 25,
    "low_confidence_threshold": 65
  }
}',
    'v1.0-pilot',
    1,
    NULL
);

-- Map 2: Course Benchmarks (3 benchmark rules)
INSERT INTO eept_scoring_maps (map_id, map_type, map_json, version, is_active, tenant_id)
VALUES (
    'score-map-benchmarks-v1',
    'course_benchmarks',
    '{
  "version": "v1.0-pilot",
  "updated_at": "2026-02-19",
  "rules": [
    {
      "rule_id": "DEFAULT_VET_B2",
      "label": "Default VET Benchmark (B2 minimum)",
      "description": "Standard benchmark for VET courses requiring overall B2 proficiency",
      "conditions": {
        "overall_cefr_min": "B2",
        "reading_cefr_min": "B1",
        "writing_cefr_min": "B2"
      },
      "traffic_light": {
        "GREEN": "Meets or exceeds all minimum CEFR thresholds",
        "AMBER": "Overall B1+ but one or more skills below minimum; may need support",
        "RED": "Overall below B1 or critical skill gap identified"
      },
      "is_default": true
    },
    {
      "rule_id": "ELICOS_PLACEMENT_ONLY",
      "label": "ELICOS Placement (no minimum; placement only)",
      "description": "Used for ELICOS pathway placement; no pass/fail, band determines class level",
      "conditions": {
        "overall_cefr_min": null,
        "reading_cefr_min": null,
        "writing_cefr_min": null
      },
      "traffic_light": {
        "GREEN": "N/A - placement only",
        "AMBER": "N/A - placement only",
        "RED": "N/A - placement only"
      },
      "placement_map": {
        "A2": "Elementary",
        "B1": "Pre-Intermediate / Intermediate",
        "B2": "Upper-Intermediate",
        "C1": "Advanced"
      },
      "is_default": false
    },
    {
      "rule_id": "HIGHER_RISK_PACKAGED_TRADE",
      "label": "Higher-Risk Packaged / Trade (B1+ minimum)",
      "description": "Lower threshold for trade and packaged delivery courses",
      "conditions": {
        "overall_cefr_min": "B1",
        "reading_cefr_min": "B1",
        "writing_cefr_min": "B1"
      },
      "traffic_light": {
        "GREEN": "Meets or exceeds all minimum CEFR thresholds",
        "AMBER": "Overall A2+ high but one skill borderline; may need monitoring",
        "RED": "Overall below A2+ or critical skill gap identified"
      },
      "is_default": false
    }
  ]
}',
    'v1.0-pilot',
    1,
    NULL
);

-- Map 3: Writing Rubric Thresholds (rule-based scoring tables)
INSERT INTO eept_scoring_maps (map_id, map_type, map_json, version, is_active, tenant_id)
VALUES (
    'score-map-rubric-v1',
    'writing_rubric_thresholds',
    '{
  "version": "v1.0-pilot",
  "updated_at": "2026-02-19",
  "description": "Rule-based metric-to-band mapping tables for the 4 writing rubric domains. Each domain is scored 0-5 based on measurable text metrics. These scores feed into Layer 2 (rule-based) of the hybrid scoring engine.",
  "domains": {
    "task_achievement": {
      "label": "Task Achievement",
      "max_score": 5,
      "metrics": ["requirement_coverage", "word_count_compliance", "relevance"],
      "bands": [
        { "score": 0, "label": "Not Attempted", "criteria": "No response or entirely off-topic" },
        { "score": 1, "label": "Minimal", "criteria": "Fewer than 50% of requirements addressed; word count below 60% of minimum" },
        { "score": 2, "label": "Limited", "criteria": "1 of 3 requirements addressed; word count 60-79% of minimum or exceeds max by >30%" },
        { "score": 3, "label": "Adequate", "criteria": "2 of 3 requirements addressed; word count within 80-120% of target range" },
        { "score": 4, "label": "Good", "criteria": "All 3 requirements addressed with some development; word count within target range" },
        { "score": 5, "label": "Excellent", "criteria": "All requirements fully developed with supporting detail; word count within target range" }
      ]
    },
    "coherence_cohesion": {
      "label": "Coherence & Cohesion",
      "max_score": 5,
      "metrics": ["paragraph_count", "connective_density", "sentence_length_variance"],
      "bands": [
        { "score": 0, "label": "Not Attempted", "criteria": "No response" },
        { "score": 1, "label": "Minimal", "criteria": "No paragraph breaks; no connectives used; single block of text" },
        { "score": 2, "label": "Limited", "criteria": "1-2 paragraph breaks; fewer than 2 connectives per 100 words; repetitive sentence structure" },
        { "score": 3, "label": "Adequate", "criteria": "3+ paragraph breaks; 2-4 connectives per 100 words; some sentence variety" },
        { "score": 4, "label": "Good", "criteria": "Clear paragraph structure with topic sentences; 4-6 connectives per 100 words; varied sentence lengths" },
        { "score": 5, "label": "Excellent", "criteria": "Sophisticated paragraph organisation; 6+ varied connectives per 100 words; natural flow between ideas" }
      ]
    },
    "lexical_resource": {
      "label": "Lexical Resource",
      "max_score": 5,
      "metrics": ["type_token_ratio", "avg_word_length", "academic_word_density"],
      "bands": [
        { "score": 0, "label": "Not Attempted", "criteria": "No response" },
        { "score": 1, "label": "Minimal", "criteria": "TTR below 0.30; avg word length below 3.5; no academic vocabulary" },
        { "score": 2, "label": "Limited", "criteria": "TTR 0.30-0.39; avg word length 3.5-3.9; academic word % below 2%" },
        { "score": 3, "label": "Adequate", "criteria": "TTR 0.40-0.49; avg word length 4.0-4.4; academic word % 2-4%" },
        { "score": 4, "label": "Good", "criteria": "TTR 0.50-0.59; avg word length 4.5-4.9; academic word % 4-7%" },
        { "score": 5, "label": "Excellent", "criteria": "TTR 0.60+; avg word length 5.0+; academic word % 7%+; evidence of sophisticated collocations" }
      ]
    },
    "grammatical_range_accuracy": {
      "label": "Grammatical Range & Accuracy",
      "max_score": 5,
      "metrics": ["error_rate_per_100_words", "clause_density", "structure_variety"],
      "bands": [
        { "score": 0, "label": "Not Attempted", "criteria": "No response" },
        { "score": 1, "label": "Minimal", "criteria": "Error rate >10 per 100 words; only simple sentences; no subordination" },
        { "score": 2, "label": "Limited", "criteria": "Error rate 7-10 per 100 words; mostly simple sentences; limited subordination" },
        { "score": 3, "label": "Adequate", "criteria": "Error rate 4-6 per 100 words; mix of simple and compound sentences; some subordinate clauses" },
        { "score": 4, "label": "Good", "criteria": "Error rate 2-3 per 100 words; varied sentence structures; effective use of subordination and coordination" },
        { "score": 5, "label": "Excellent", "criteria": "Error rate <2 per 100 words; wide range of structures used accurately; natural and fluent expression" }
      ]
    }
  },
  "scoring_notes": {
    "task1_weight": "Task 1 total = 20 points (4 domains x 5 max each x 1.0 multiplier)",
    "task2_weight": "Task 2 total = 30 points (4 domains x 5 max each x 1.5 multiplier)",
    "writing_total": "Writing total = Task 1 (20) + Task 2 (30) = 50 raw, scaled to 40 for composite",
    "reconciliation": "Final domain score = weighted average of rule-based (Layer 2) and LLM (Layer 3) scores, with divergence flags when gap > 1.5 points"
  }
}',
    'v1.0-pilot',
    1,
    NULL
);
