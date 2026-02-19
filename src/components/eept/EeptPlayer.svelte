<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    // ============================================
    // Types
    // ============================================
    interface GrammarQuestion {
      question_id: string;
      prompt: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      order_index: number;
    }

    interface Passage {
      passage_id: string;
      title: string;
      text: string;
      cefr: string;
      questions: {
        question_id: string;
        prompt: string;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        order_index: number;
      }[];
    }

    interface WritingPrompt {
      prompt_id: string;
      task_type: string;
      prompt: string;
      requirement_1: string | null;
      requirement_2: string | null;
      requirement_3: string | null;
      word_limit_min: number | null;
      word_limit_max: number | null;
    }

    // ============================================
    // State
    // ============================================
    let token = $state<string | null>(null);
    let loading = $state(true);
    let loadError = $state<string | null>(null);
    let data = $state<any>(null);

    // Sections
    let grammarQuestions = $state<GrammarQuestion[]>([]);
    let passages = $state<Passage[]>([]);
    let writingPrompt1 = $state<WritingPrompt | null>(null);
    let writingPrompt2 = $state<WritingPrompt | null>(null);

    // Navigation
    type Section = 'grammar' | 'reading' | 'writing1' | 'writing2';
    let currentSection = $state<Section>('grammar');
    let grammarIndex = $state(0);
    let readingPassageIndex = $state(0);
    let readingQuestionIndex = $state(0);

    // Answers
    let mcqAnswers = $state<Record<string, string>>({});
    let writingText1 = $state('');
    let writingText2 = $state('');

    // View state
    let view = $state<'test' | 'review' | 'submitting' | 'success'>('test');
    let submitting = $state(false);
    let submitError = $state('');

    // Autosave
    let autosaving = $state(false);
    let lastSaved = $state<Date | null>(null);
    let autosaveInterval: number | null = null;

    // Integrity tracking
    let tabSwitchCount = $state(0);
    let startTime = $state(0);

    // ============================================
    // Derived
    // ============================================
    let allReadingQuestions = $derived(passages.flatMap(p => p.questions));
    let totalMCQ = $derived(grammarQuestions.length + allReadingQuestions.length);
    let answeredMCQ = $derived(Object.keys(mcqAnswers).length);
    let answeredReadingCount = $derived(allReadingQuestions.filter(q => mcqAnswers[q.question_id]).length);
    let answeredGrammarCount = $derived(grammarQuestions.filter(q => mcqAnswers[q.question_id]).length);
    let progressPercent = $derived(() => {
        const mcqProgress = totalMCQ > 0 ? answeredMCQ / totalMCQ : 0;
        const w1Progress = writingText1.trim().length > 0 ? 1 : 0;
        const w2Progress = writingText2.trim().length > 0 ? 1 : 0;
        const totalItems = totalMCQ + 2; // +2 for writing tasks
        const completed = answeredMCQ + w1Progress + w2Progress;
        return totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0;
    });

    let currentGrammarQ = $derived(grammarQuestions[grammarIndex]);
    let currentPassage = $derived(passages[readingPassageIndex]);
    let currentReadingQ = $derived(currentPassage?.questions?.[readingQuestionIndex]);

    let wordCount1 = $derived(writingText1.trim() ? writingText1.trim().split(/\s+/).length : 0);
    let wordCount2 = $derived(writingText2.trim() ? writingText2.trim().split(/\s+/).length : 0);

    let sectionLabels: Record<Section, string> = {
        grammar: 'Section A: Grammar & Vocabulary',
        reading: 'Section B: Reading Comprehension',
        writing1: 'Section C: Writing Task 1',
        writing2: 'Section D: Writing Task 2',
    };

    // ============================================
    // Lifecycle
    // ============================================
    onMount(async () => {
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token');

      if (!token) {
        loadError = "Invalid assessment link";
        loading = false;
        return;
      }

      try {
        const res = await fetch(`/api/ebpa/start?token=${token}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Unable to load assessment');
        }
        data = await res.json();

        // Parse sections
        grammarQuestions = (data.grammar_questions || []).sort((a: any, b: any) => a.order_index - b.order_index);

        // Build passages with their questions
        const passageMap = new Map<string, Passage>();
        for (const p of (data.reading_passages || [])) {
          passageMap.set(p.passage_id, { ...p, questions: [] });
        }
        for (const q of (data.reading_questions || [])) {
          const passage = passageMap.get(q.passage_id);
          if (passage) {
            passage.questions.push(q);
          }
        }
        passages = Array.from(passageMap.values()).sort((a, b) => {
          const cefrOrder: Record<string, number> = { 'A2': 0, 'B1': 1, 'B2': 2, 'C1': 3 };
          return (cefrOrder[a.cefr] || 0) - (cefrOrder[b.cefr] || 0);
        });
        for (const p of passages) {
          p.questions.sort((a, b) => a.order_index - b.order_index);
        }

        // Writing prompts
        const prompts = data.writing_prompts || [];
        writingPrompt1 = prompts.find((p: any) => p.task_type === 'task1') || null;
        writingPrompt2 = prompts.find((p: any) => p.task_type === 'task2') || null;

        // Set start time for integrity tracking
        startTime = Date.now();

        // Set up autosave every 45 seconds
        autosaveInterval = window.setInterval(async () => {
          if (view === 'test') {
            await autosave();
          }
        }, 45000);

        // Track tab switches
        document.addEventListener('visibilitychange', handleVisibilityChange);

      } catch (e: any) {
        loadError = e.message || 'System error';
      } finally {
        loading = false;
      }
    });

    onDestroy(() => {
      if (autosaveInterval) {
        clearInterval(autosaveInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });

    function handleVisibilityChange() {
        if (document.hidden && view === 'test') {
            tabSwitchCount++;
        }
    }

    // ============================================
    // Autosave
    // ============================================
    async function autosave() {
      if (autosaving || !token) return;
      autosaving = true;
      try {
        const payload = {
            token,
            mcq_answers: mcqAnswers,
            writing_text_1: writingText1,
            writing_text_2: writingText2,
        };
        const res = await fetch('/api/ebpa/save-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          lastSaved = new Date();
        }
      } catch (e) {
        console.error('Autosave failed:', e);
      } finally {
        autosaving = false;
      }
    }

    // ============================================
    // Navigation
    // ============================================
    function goToSection(section: Section) {
        currentSection = section;
        if (section === 'grammar') grammarIndex = 0;
        if (section === 'reading') { readingPassageIndex = 0; readingQuestionIndex = 0; }
    }

    function nextGrammarQuestion() {
        if (grammarIndex < grammarQuestions.length - 1) {
            grammarIndex++;
        } else {
            // Move to reading
            currentSection = 'reading';
            readingPassageIndex = 0;
            readingQuestionIndex = 0;
        }
    }

    function prevGrammarQuestion() {
        if (grammarIndex > 0) grammarIndex--;
    }

    function nextReadingQuestion() {
        const passage = passages[readingPassageIndex];
        if (!passage) return;

        if (readingQuestionIndex < passage.questions.length - 1) {
            readingQuestionIndex++;
        } else if (readingPassageIndex < passages.length - 1) {
            readingPassageIndex++;
            readingQuestionIndex = 0;
        } else {
            // Move to writing 1
            currentSection = 'writing1';
        }
    }

    function prevReadingQuestion() {
        if (readingQuestionIndex > 0) {
            readingQuestionIndex--;
        } else if (readingPassageIndex > 0) {
            readingPassageIndex--;
            readingQuestionIndex = passages[readingPassageIndex].questions.length - 1;
        } else {
            // Go back to grammar
            currentSection = 'grammar';
            grammarIndex = grammarQuestions.length - 1;
        }
    }

    function selectAnswer(questionId: string, option: string) {
        mcqAnswers = { ...mcqAnswers, [questionId]: option };
    }

    function goToReview() {
        view = 'review';
    }

    function backToTest() {
        view = 'test';
    }

    // ============================================
    // Submission
    // ============================================
    async function submitAssessment() {
        if (autosaveInterval) {
          clearInterval(autosaveInterval);
          autosaveInterval = null;
        }

        submitting = true;
        submitError = '';
        view = 'submitting';

        const endTime = Date.now();
        const durationSeconds = Math.round((endTime - startTime) / 1000);

        const payload = {
            token,
            mcq_answers: mcqAnswers,
            writing_submissions: [
                ...(writingPrompt1 ? [{ prompt_id: writingPrompt1.prompt_id, task_type: 'task1', text: writingText1 }] : []),
                ...(writingPrompt2 ? [{ prompt_id: writingPrompt2.prompt_id, task_type: 'task2', text: writingText2 }] : []),
            ],
            integrity: {
                tab_switches: tabSwitchCount,
                duration_seconds: durationSeconds,
            }
        };

        try {
            const res = await fetch('/api/ebpa/submit-final', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Submission failed');
            }

            view = 'success';
        } catch (e: any) {
            submitError = e.message || 'We could not save your assessment. Please try again.';
            view = 'review';
        } finally {
            submitting = false;
        }
    }
</script>

{#if loading}
  <div class="flex-1 flex items-center justify-center">
    <div class="glass-panel-fixed p-12 rounded-xl text-center">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4"></div>
      <p class="text-slate-300">Loading your assessment...</p>
    </div>
  </div>
{:else if loadError}
  <div class="flex-1 flex items-center justify-center">
    <div class="glass-panel-fixed p-8 rounded-xl text-center">
      <h2 class="text-xl font-bold text-white mb-2">Error</h2>
      <p class="text-slate-300">{loadError}</p>
    </div>
  </div>
{:else if view === 'success'}
  <div class="flex-1 flex items-center justify-center">
    <div class="glass-panel-fixed rounded-2xl p-10 shadow-xl text-center max-w-lg">
      <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-500 border border-green-500/30 mx-auto">
          <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
      </div>
      <h2 class="text-3xl font-bold text-white mb-4">Assessment Submitted</h2>
      <p class="text-slate-400 max-w-md mx-auto">
          Thank you for completing the English Placement Test. Your responses have been securely recorded and will be scored. Results will be communicated to you by your institution. You may now close this window.
      </p>
    </div>
  </div>
{:else if view === 'submitting'}
  <div class="flex-1 flex items-center justify-center">
    <div class="glass-panel-fixed p-12 rounded-xl text-center">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4"></div>
      <h2 class="text-xl font-bold text-white mb-2">Submitting Assessment</h2>
      <p class="text-slate-400">Please wait while we process your responses...</p>
    </div>
  </div>
{:else}
  <!-- Top bar -->
  <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
          <div class="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
              EEPT
          </div>
          <span class="text-sm font-semibold text-slate-400">
              {sectionLabels[currentSection]}
          </span>
      </div>
      <div class="flex items-center gap-3">
          {#if autosaving}
              <span class="text-xs text-slate-400 flex items-center gap-2">
                  <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
              </span>
          {:else if lastSaved}
              <span class="text-xs text-green-500 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  Saved
              </span>
          {/if}
          <div class="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full">
              {progressPercent()}% Complete
          </div>
      </div>
  </div>

  <!-- Section nav tabs -->
  <div class="mb-4 flex gap-1 overflow-x-auto">
      {#each (['grammar', 'reading', 'writing1', 'writing2'] as Section[]) as sec}
          <button
              onclick={() => goToSection(sec)}
              class="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors
                  {currentSection === sec
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-slate-800/40 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'}"
          >
              {sec === 'grammar' ? 'A: Grammar' : sec === 'reading' ? 'B: Reading' : sec === 'writing1' ? 'C: Writing 1' : 'D: Writing 2'}
          </button>
      {/each}
  </div>

  {#if view === 'review'}
    <!-- Review view -->
    <div class="glass-panel-fixed rounded-2xl p-6 md:p-8 shadow-xl flex flex-col">
        <h2 class="text-2xl font-bold text-white mb-2">Review Your Assessment</h2>
        <p class="text-slate-400 mb-6">Please check your responses before submitting. You can click any section to make changes.</p>

        <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            <!-- Grammar summary -->
            <div class="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-white font-bold">Section A: Grammar & Vocabulary</h3>
                    <span class="text-xs px-2 py-1 rounded-full {
                        answeredGrammarCount === grammarQuestions.length
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-amber-500/20 text-amber-400'
                    }">
                        {answeredGrammarCount}/{grammarQuestions.length} answered
                    </span>
                </div>
                <button onclick={() => { view = 'test'; goToSection('grammar'); }} class="text-xs text-purple-400 hover:text-purple-300">Go to Section A</button>
            </div>

            <!-- Reading summary -->
            <div class="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-white font-bold">Section B: Reading Comprehension</h3>
                    <span class="text-xs px-2 py-1 rounded-full {
                        answeredReadingCount === allReadingQuestions.length
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-amber-500/20 text-amber-400'
                    }">
                        {answeredReadingCount}/{allReadingQuestions.length} answered
                    </span>
                </div>
                <button onclick={() => { view = 'test'; goToSection('reading'); }} class="text-xs text-purple-400 hover:text-purple-300">Go to Section B</button>
            </div>

            <!-- Writing 1 summary -->
            <div class="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-white font-bold">Section C: Writing Task 1</h3>
                    <span class="text-xs px-2 py-1 rounded-full {wordCount1 > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                        {wordCount1} words
                    </span>
                </div>
                <button onclick={() => { view = 'test'; goToSection('writing1'); }} class="text-xs text-purple-400 hover:text-purple-300">Go to Section C</button>
            </div>

            <!-- Writing 2 summary -->
            <div class="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-white font-bold">Section D: Writing Task 2</h3>
                    <span class="text-xs px-2 py-1 rounded-full {wordCount2 > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                        {wordCount2} words
                    </span>
                </div>
                <button onclick={() => { view = 'test'; goToSection('writing2'); }} class="text-xs text-purple-400 hover:text-purple-300">Go to Section D</button>
            </div>
        </div>

        {#if submitError}
            <div class="mt-4 p-3 bg-red-500/20 text-red-300 rounded-lg text-sm text-center">
                {submitError}
            </div>
        {/if}

        <div class="mt-8 flex justify-between pt-6 border-t border-slate-700/50">
            <button onclick={backToTest} class="px-6 py-2 rounded-lg font-medium text-slate-400 hover:text-white transition-colors">
                 Back to Test
            </button>

            <button
                onclick={submitAssessment}
                disabled={submitting}
                class="px-8 py-3 rounded-lg font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg"
            >
                {#if submitting}
                    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                {:else}
                    Submit Assessment
                {/if}
            </button>
        </div>
    </div>
  {:else}
    <!-- Test view - Section content -->
    <div class="glass-panel-fixed rounded-2xl p-6 md:p-8 shadow-xl min-h-[500px] flex flex-col">

        {#if currentSection === 'grammar'}
            <!-- GRAMMAR SECTION -->
            {#if currentGrammarQ}
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-6">
                        <span class="text-xs font-bold text-slate-500 uppercase">Question {grammarIndex + 1} of {grammarQuestions.length}</span>
                        <span class="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">Grammar</span>
                    </div>

                    <h2 class="text-xl md:text-2xl font-bold text-white mb-6">
                        {currentGrammarQ.prompt}
                    </h2>

                    <div class="space-y-3">
                        {#each [['A', currentGrammarQ.option_a], ['B', currentGrammarQ.option_b], ['C', currentGrammarQ.option_c], ['D', currentGrammarQ.option_d]] as [letter, text]}
                            <label class="flex items-center p-4 rounded-xl border cursor-pointer transition-all group
                                {mcqAnswers[currentGrammarQ.question_id] === letter
                                    ? 'bg-purple-600 border-purple-500 shadow-md'
                                    : 'bg-slate-800/40 border-slate-700 hover:bg-slate-700/50'}"
                            >
                                <input
                                    type="radio"
                                    name={currentGrammarQ.question_id}
                                    value={letter}
                                    checked={mcqAnswers[currentGrammarQ.question_id] === letter}
                                    onchange={() => selectAnswer(currentGrammarQ.question_id, letter)}
                                    class="sr-only"
                                />
                                <div class="w-8 h-8 rounded-lg border-2 flex items-center justify-center mr-4 shrink-0 text-sm font-bold
                                     {mcqAnswers[currentGrammarQ.question_id] === letter ? 'border-white text-white' : 'border-slate-500 text-slate-500 group-hover:border-slate-400'}">
                                    {letter}
                                </div>
                                <span class="text-slate-200 group-hover:text-white transition-colors">{text}</span>
                            </label>
                        {/each}
                    </div>
                </div>

                <div class="mt-8 flex justify-between pt-6 border-t border-slate-700/50">
                    <button
                        onclick={prevGrammarQuestion}
                        disabled={grammarIndex === 0}
                        class="px-6 py-2 rounded-lg font-medium text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        onclick={nextGrammarQuestion}
                        class="px-8 py-2 rounded-lg font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-lg transition-all"
                    >
                        {grammarIndex === grammarQuestions.length - 1 ? 'Next Section' : 'Next Question'}
                    </button>
                </div>
            {/if}

        {:else if currentSection === 'reading'}
            <!-- READING SECTION -->
            {#if currentPassage && currentReadingQ}
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-xs font-bold text-slate-500 uppercase">
                            Passage {readingPassageIndex + 1} of {passages.length} &bull; Question {readingQuestionIndex + 1} of {currentPassage.questions.length}
                        </span>
                        <span class="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">{currentPassage.cefr}</span>
                    </div>

                    <!-- Passage text -->
                    <div class="mb-6 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 max-h-[200px] overflow-y-auto custom-scrollbar">
                        {#if currentPassage.title}
                            <h3 class="text-white font-bold mb-2">{currentPassage.title}</h3>
                        {/if}
                        <p class="text-slate-300 text-sm whitespace-pre-line leading-relaxed">{currentPassage.text}</p>
                    </div>

                    <h2 class="text-lg md:text-xl font-bold text-white mb-5">
                        {currentReadingQ.prompt}
                    </h2>

                    <div class="space-y-3">
                        {#each [['A', currentReadingQ.option_a], ['B', currentReadingQ.option_b], ['C', currentReadingQ.option_c], ['D', currentReadingQ.option_d]] as [letter, text]}
                            <label class="flex items-center p-4 rounded-xl border cursor-pointer transition-all group
                                {mcqAnswers[currentReadingQ.question_id] === letter
                                    ? 'bg-blue-600 border-blue-500 shadow-md'
                                    : 'bg-slate-800/40 border-slate-700 hover:bg-slate-700/50'}"
                            >
                                <input
                                    type="radio"
                                    name={currentReadingQ.question_id}
                                    value={letter}
                                    checked={mcqAnswers[currentReadingQ.question_id] === letter}
                                    onchange={() => selectAnswer(currentReadingQ.question_id, letter)}
                                    class="sr-only"
                                />
                                <div class="w-8 h-8 rounded-lg border-2 flex items-center justify-center mr-4 shrink-0 text-sm font-bold
                                     {mcqAnswers[currentReadingQ.question_id] === letter ? 'border-white text-white' : 'border-slate-500 text-slate-500 group-hover:border-slate-400'}">
                                    {letter}
                                </div>
                                <span class="text-slate-200 group-hover:text-white transition-colors">{text}</span>
                            </label>
                        {/each}
                    </div>
                </div>

                <div class="mt-8 flex justify-between pt-6 border-t border-slate-700/50">
                    <button
                        onclick={prevReadingQuestion}
                        class="px-6 py-2 rounded-lg font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        onclick={nextReadingQuestion}
                        class="px-8 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg transition-all"
                    >
                        {readingPassageIndex === passages.length - 1 && readingQuestionIndex === currentPassage.questions.length - 1 ? 'Next Section' : 'Next Question'}
                    </button>
                </div>
            {/if}

        {:else if currentSection === 'writing1'}
            <!-- WRITING TASK 1 -->
            <div class="flex-1 flex flex-col">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-xs font-bold text-slate-500 uppercase">Writing Task 1 - Functional Writing</span>
                    <span class="text-xs px-2 py-1 rounded-full {wordCount1 >= (writingPrompt1?.word_limit_min || 120) ? 'bg-green-500/20 text-green-400' : wordCount1 > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-400'}">
                        {wordCount1} words
                        {#if writingPrompt1?.word_limit_min}
                            / {writingPrompt1.word_limit_min}-{writingPrompt1.word_limit_max} target
                        {/if}
                    </span>
                </div>

                {#if writingPrompt1}
                    <div class="mb-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <p class="text-slate-200 text-sm leading-relaxed">{writingPrompt1.prompt}</p>
                        {#if writingPrompt1.requirement_1 || writingPrompt1.requirement_2 || writingPrompt1.requirement_3}
                            <ul class="mt-3 space-y-1.5 text-sm text-slate-300">
                                {#if writingPrompt1.requirement_1}
                                    <li class="flex items-start gap-2">
                                        <span class="text-emerald-400 mt-0.5">*</span>
                                        <span>{writingPrompt1.requirement_1}</span>
                                    </li>
                                {/if}
                                {#if writingPrompt1.requirement_2}
                                    <li class="flex items-start gap-2">
                                        <span class="text-emerald-400 mt-0.5">*</span>
                                        <span>{writingPrompt1.requirement_2}</span>
                                    </li>
                                {/if}
                                {#if writingPrompt1.requirement_3}
                                    <li class="flex items-start gap-2">
                                        <span class="text-emerald-400 mt-0.5">*</span>
                                        <span>{writingPrompt1.requirement_3}</span>
                                    </li>
                                {/if}
                            </ul>
                        {/if}
                    </div>
                {/if}

                <textarea
                    bind:value={writingText1}
                    class="flex-1 w-full glass-input-fixed rounded-xl p-4 text-sm leading-relaxed min-h-[250px] resize-none"
                    placeholder="Write your response here..."
                ></textarea>

                <div class="mt-6 flex justify-between pt-6 border-t border-slate-700/50">
                    <button
                        onclick={() => { currentSection = 'reading'; readingPassageIndex = passages.length - 1; readingQuestionIndex = passages[passages.length - 1]?.questions.length - 1 || 0; }}
                        class="px-6 py-2 rounded-lg font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Previous Section
                    </button>
                    <button
                        onclick={() => { currentSection = 'writing2'; }}
                        class="px-8 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg transition-all"
                    >
                        Next Section
                    </button>
                </div>
            </div>

        {:else if currentSection === 'writing2'}
            <!-- WRITING TASK 2 -->
            <div class="flex-1 flex flex-col">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-xs font-bold text-slate-500 uppercase">Writing Task 2 - Extended Writing</span>
                    <span class="text-xs px-2 py-1 rounded-full {wordCount2 >= (writingPrompt2?.word_limit_min || 200) ? 'bg-green-500/20 text-green-400' : wordCount2 > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-400'}">
                        {wordCount2} words
                        {#if writingPrompt2?.word_limit_min}
                            / {writingPrompt2.word_limit_min}-{writingPrompt2.word_limit_max} target
                        {/if}
                    </span>
                </div>

                {#if writingPrompt2}
                    <div class="mb-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <p class="text-slate-200 text-sm leading-relaxed">{writingPrompt2.prompt}</p>
                        {#if writingPrompt2.requirement_1 || writingPrompt2.requirement_2 || writingPrompt2.requirement_3}
                            <ul class="mt-3 space-y-1.5 text-sm text-slate-300">
                                {#if writingPrompt2.requirement_1}
                                    <li class="flex items-start gap-2">
                                        <span class="text-amber-400 mt-0.5">*</span>
                                        <span>{writingPrompt2.requirement_1}</span>
                                    </li>
                                {/if}
                                {#if writingPrompt2.requirement_2}
                                    <li class="flex items-start gap-2">
                                        <span class="text-amber-400 mt-0.5">*</span>
                                        <span>{writingPrompt2.requirement_2}</span>
                                    </li>
                                {/if}
                                {#if writingPrompt2.requirement_3}
                                    <li class="flex items-start gap-2">
                                        <span class="text-amber-400 mt-0.5">*</span>
                                        <span>{writingPrompt2.requirement_3}</span>
                                    </li>
                                {/if}
                            </ul>
                        {/if}
                    </div>
                {/if}

                <textarea
                    bind:value={writingText2}
                    class="flex-1 w-full glass-input-fixed rounded-xl p-4 text-sm leading-relaxed min-h-[300px] resize-none"
                    placeholder="Write your response here..."
                ></textarea>

                <div class="mt-6 flex justify-between pt-6 border-t border-slate-700/50">
                    <button
                        onclick={() => { currentSection = 'writing1'; }}
                        class="px-6 py-2 rounded-lg font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Previous Section
                    </button>
                    <button
                        onclick={goToReview}
                        class="px-8 py-3 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-lg transition-all"
                    >
                        Review & Submit
                    </button>
                </div>
            </div>
        {/if}
    </div>

    <!-- Question navigator (MCQ sections only) -->
    {#if currentSection === 'grammar' || currentSection === 'reading'}
        <div class="mt-4 glass-panel-fixed rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold text-slate-500 uppercase">Question Navigator</span>
            </div>
            <div class="flex flex-wrap gap-2">
                {#if currentSection === 'grammar'}
                    {#each grammarQuestions as q, idx}
                        <button
                            onclick={() => { grammarIndex = idx; }}
                            class="w-8 h-8 rounded-lg text-xs font-bold transition-all
                                {grammarIndex === idx
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : mcqAnswers[q.question_id]
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                        : 'bg-slate-700/40 text-slate-500 hover:bg-slate-700/60'}"
                        >
                            {idx + 1}
                        </button>
                    {/each}
                {:else}
                    {#each passages as passage, pIdx}
                        {#each passage.questions as q, qIdx}
                            <button
                                onclick={() => { readingPassageIndex = pIdx; readingQuestionIndex = qIdx; }}
                                class="w-8 h-8 rounded-lg text-xs font-bold transition-all
                                    {readingPassageIndex === pIdx && readingQuestionIndex === qIdx
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : mcqAnswers[q.question_id]
                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                            : 'bg-slate-700/40 text-slate-500 hover:bg-slate-700/60'}"
                            >
                                {passages.slice(0, pIdx).reduce((sum, p) => sum + p.questions.length, 0) + qIdx + 1}
                            </button>
                        {/each}
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
  {/if}
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 4px; }
</style>
