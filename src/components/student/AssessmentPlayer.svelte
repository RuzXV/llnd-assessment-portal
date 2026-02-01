<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    let token = $state<string | null>(null);
    let data = $state<any>(null);
    let loading = $state(true);
    let loadError = $state<string | null>(null);

    let questions = $derived(data?.questions || []);
    let branding = $derived(data?.branding || {});

    let currentIndex = $state(0);
    let answers = $state<Record<string, any>>({});
    let view = $state<'question' | 'review' | 'success'>('question');
    let submitting = $state(false);
    let submitError = $state('');
    let autosaving = $state(false);
    let lastSaved = $state<Date | null>(null);
    let autosaveInterval: number | null = null;
    let timeRemaining = $state<number | null>(null);
    let countdownInterval: number | null = null;

    let progress = $derived(questions.length > 0 ? (Object.keys(answers).length / questions.length) * 100 : 0);
    let currentQuestion = $derived(questions[currentIndex]);
    let isLastQuestion = $derived(currentIndex === questions.length - 1);

    let formattedTimeRemaining = $derived(() => {
      if (timeRemaining === null) return null;
      const hours = Math.floor(timeRemaining / 3600);
      const minutes = Math.floor((timeRemaining % 3600) / 60);
      const seconds = timeRemaining % 60;
      return `${hours}h ${minutes}m ${seconds}s`;
    });

    onMount(async () => {
      // Extract token from URL query parameter: /assess-start?token=xxx
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token');

      if (!token) {
        loadError = "Invalid assessment link";
        loading = false;
        return;
      }

      // Fetch assessment data
      try {
        const res = await fetch(`/api/assessments/${token}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Unable to load assessment');
        }
        data = await res.json();

        // Load draft responses
        if (data.draft_responses) {
          answers = data.draft_responses;
        }

        // Set up autosave every 30 seconds
        autosaveInterval = window.setInterval(async () => {
          if (Object.keys(answers).length > 0 && view !== 'success') {
            await autosave();
          }
        }, 30000);

        // Initialize countdown timer if expires_at exists
        if (data.expires_at) {
          const updateCountdown = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = data.expires_at - now;

            if (remaining <= 0) {
              timeRemaining = 0;
              // Auto-submit when time expires
              if (view !== 'success') {
                submitAssessment();
              }
            } else {
              timeRemaining = remaining;
            }
          };

          updateCountdown();
          countdownInterval = window.setInterval(updateCountdown, 1000);
        }
      } catch (e: any) {
        loadError = e.message || 'System error';
        // Redirect back to intro page
        window.location.href = `/assess?token=${token}`;
      } finally {
        loading = false;
      }
    });

    onDestroy(() => {
      if (autosaveInterval) {
        clearInterval(autosaveInterval);
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    });

    async function autosave() {
      if (autosaving) return;
      autosaving = true;

      try {
        const res = await fetch(`/api/assessments/${token}/autosave`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers })
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

    function nextQuestion() {
      if (currentIndex < questions.length - 1) {
        currentIndex++;
      } else {
        view = 'review';
      }
    }
  
    function prevQuestion() {
      if (view === 'review') {
        view = 'question';
        currentIndex = questions.length - 1; 
      } else if (currentIndex > 0) {
        currentIndex--;
      }
    }
  
    function jumpToQuestion(index: number) {
      view = 'question';
      currentIndex = index;
    }
  
    async function submitAssessment() {
      // Clear intervals before submission
      if (autosaveInterval) {
        clearInterval(autosaveInterval);
        autosaveInterval = null;
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }

      submitting = true;
      submitError = '';

      const storedName = sessionStorage.getItem(`student_name_${token}`);
      const storedId = sessionStorage.getItem(`student_id_${token}`);

      const payload: any = {
        responses: Object.entries(answers).map(([qId, val]) => ({
          questionId: qId,
          answer: val
        }))
      };

      if (storedName) {
         payload.student_name = storedName;
         payload.student_id = storedId;
      }

      try {
        const res = await fetch(`/api/assessments/${token}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Submission failed');
        
        sessionStorage.removeItem(`student_name_${token}`);
        sessionStorage.removeItem(`student_id_${token}`);
        
        view = 'success';
        
      } catch (e) {
        submitError = 'We could not save your assessment. Please try again.';
      } finally {
        submitting = false;
      }
    }
  </script>

  {#if loading}
    <div class="glass-panel-fixed p-12 rounded-xl text-center">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p class="text-slate-300">Loading assessment...</p>
    </div>
  {:else if loadError}
    <div class="glass-panel-fixed p-8 rounded-xl text-center">
      <h2 class="text-xl font-bold text-white mb-2">Error</h2>
      <p class="text-slate-300">{loadError}</p>
    </div>
  {:else}
  <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
          {#if branding.logo}
              <img src={branding.logo} alt="Logo" class="h-8 object-contain" />
          {/if}
          <span class="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {view === 'question' ? `Question ${currentIndex + 1} of ${questions.length}` : 'Review'}
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
          {#if timeRemaining !== null}
              <div class="text-xs font-bold px-3 py-1 rounded-full
                  {timeRemaining < 300 ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' :
                   timeRemaining < 1800 ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30' :
                   'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30'}">
                  ⏱️ {formattedTimeRemaining}
              </div>
          {/if}
          <div class="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
              {Math.round(progress)}% Completed
          </div>
      </div>
  </div>
  
  <div class="glass-panel-fixed rounded-2xl p-6 md:p-10 shadow-xl min-h-[400px] flex flex-col">
      
      {#if view === 'question'}
          <div class="flex-1">
               <h2 class="text-xl md:text-2xl font-bold text-white mb-6">
                  {currentQuestion.text}
              </h2>
  
              <div class="space-y-3">
                  {#if currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false'}
                      {#each currentQuestion.options as option}
                          <label class="flex items-center p-4 rounded-xl border cursor-pointer transition-all group
                              {answers[currentQuestion.question_id] === option 
                                  ? 'bg-blue-600 border-blue-500 shadow-md' 
                                  : 'bg-slate-800/40 border-slate-700 hover:bg-slate-700/50'}"
                          >
                               <input 
                                  type="radio" 
                                  name={currentQuestion.question_id} 
                                  value={option} 
                                  bind:group={answers[currentQuestion.question_id]}
                                  class="sr-only" 
                              />
                              <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 shrink-0
                                   {answers[currentQuestion.question_id] === option ? 'border-white' : 'border-slate-500 group-hover:border-slate-400'}">
                                  {#if answers[currentQuestion.question_id] === option}
                                      <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
                                   {/if}
                              </div>
                              <span class="text-slate-200 group-hover:text-white transition-colors">{option}</span>
                          </label>
                      {/each}
                  {:else}
                      <textarea 
                          bind:value={answers[currentQuestion.question_id]}
                          class="w-full glass-input-fixed rounded-xl p-4 h-32"
                          placeholder="Type your answer here..."
                      ></textarea>
                  {/if}
              </div>
          </div>
  
          <div class="mt-8 flex justify-between pt-6 border-t border-slate-700/50">
              <button 
                  onclick={prevQuestion}
                  disabled={currentIndex === 0}
                  class="px-6 py-2 rounded-lg font-medium text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                  Previous
              </button>
  
              <button 
                  onclick={nextQuestion}
                  disabled={!answers[currentQuestion.question_id]}
                  class="px-8 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
              >
                  {isLastQuestion ? 'Review Answers' : 'Next Question'}
              </button>
          </div>
  
      {:else if view === 'review'}
          <div class="flex-1">
              <h2 class="text-2xl font-bold text-white mb-2">Review Your Answers</h2>
              <p class="text-slate-400 mb-6">Please check your answers before submitting.</p>
  
              <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {#each questions as q, idx}
                      <button 
                          onclick={() => jumpToQuestion(idx)}
                          class="w-full text-left p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50 transition-colors flex justify-between items-center group"
                      >
                          <div>
                              <span class="text-xs font-bold text-slate-500 uppercase">Question {idx + 1}</span>
                              <p class="text-slate-300 font-medium truncate max-w-md">{q.text}</p>
                          </div>
                          <div class="flex items-center gap-3">
                              <span class="text-sm {answers[q.question_id] ? 'text-blue-400' : 'text-red-400'}">
                                  {answers[q.question_id] ? 'Answered' : 'Skipped'}
                              </span>
                          </div>
                      </button>
                  {/each}
              </div>
  
              {#if submitError}
                  <div class="mt-4 p-3 bg-red-500/20 text-red-300 rounded-lg text-sm text-center">
                      {submitError}
                  </div>
              {/if}
          </div>
  
          <div class="mt-8 flex justify-between pt-6 border-t border-slate-700/50">
              <button onclick={prevQuestion} class="px-6 py-2 rounded-lg font-medium text-slate-400 hover:text-white">
                   Back to Questions
              </button>
  
              <button 
                  onclick={submitAssessment}
                  disabled={submitting || Object.keys(answers).length < questions.length}
                  class="px-8 py-3 rounded-lg font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                  {#if submitting}
                      <span>Submitting...</span>
                  {:else}
                      <span>Submit Assessment</span>
                  {/if}
              </button>
          </div>
  
      {:else}
          <div class="flex-1 flex flex-col items-center justify-center text-center py-10">
              <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-500 border border-green-500/30">
                  <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 class="text-3xl font-bold text-white mb-4">Assessment Submitted</h2>
              <p class="text-slate-400 max-w-md mx-auto mb-8">
                  Thank you. Your results have been securely recorded. You may now close this window.
              </p>
              <a href="/" class="text-sm text-blue-400 hover:text-blue-300 underline">Return to Home</a>
          </div>
      {/if}
  </div>
  {/if}

  <style>
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 4px; }
  </style>