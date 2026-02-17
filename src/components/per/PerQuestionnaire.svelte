<script lang="ts">
  import { onMount } from 'svelte';

  // ============================================
  // State
  // ============================================
  let currentStep = $state(0); // 0=intro, 1=sectionA, 2=sectionB, 3=review, 4=submitted
  let loading = $state(false);
  let error = $state('');
  let submissionResult = $state<any>(null);

  // Student info
  let studentName = $state('');
  let studentId = $state('');
  let studentEmail = $state('');
  let applicationId = $state('');
  let isInternational = $state(false);
  let tenantId = $state('');

  // Section A responses
  let A1 = $state('');
  let A2 = $state('');
  let A3 = $state('');
  let A3_dropdown = $state('');
  let A4 = $state('');
  let A4_dropdown = $state('');
  let A5 = $state('');
  let A6 = $state<string[]>([]);
  let A7 = $state('');
  let A8 = $state('');
  let A9 = $state('');
  let A9_explanation = $state('');
  let A10 = $state('');
  let A10_explanation = $state('');
  let A11 = $state('');
  let A11_estimate = $state('');
  let A12 = $state('');

  // Section B responses - 27 items across 5 domains
  const sectionBDomains = [
    {
      domain: 'reading',
      label: 'Reading',
      items: [
        { id: 'R1', text: 'I can read and understand workplace instructions and procedures.' },
        { id: 'R2', text: 'I can read and understand course-related texts and study materials.' },
        { id: 'R3', text: 'I can identify key information in written documents.' },
        { id: 'R4', text: 'I can follow written instructions to complete a task.' },
        { id: 'R5', text: 'I am comfortable reading and interpreting forms and tables.' },
      ]
    },
    {
      domain: 'writing',
      label: 'Writing',
      items: [
        { id: 'W1', text: 'I can write clear sentences with correct spelling and grammar.' },
        { id: 'W2', text: 'I can complete workplace or study-related forms accurately.' },
        { id: 'W3', text: 'I can write short paragraphs to explain my ideas.' },
        { id: 'W4', text: 'I can take notes during a class or meeting.' },
        { id: 'W5', text: 'I can write a simple email or message to communicate information.' },
        { id: 'W6', text: 'I can structure a longer written response with an introduction and conclusion.' },
      ]
    },
    {
      domain: 'numeracy',
      label: 'Numeracy',
      items: [
        { id: 'N1', text: 'I can perform basic calculations (addition, subtraction, multiplication, division).' },
        { id: 'N2', text: 'I can read and interpret graphs, charts, or tables.' },
        { id: 'N3', text: 'I can work with measurements (length, weight, volume) in a practical context.' },
        { id: 'N4', text: 'I can calculate percentages and fractions.' },
        { id: 'N5', text: 'I can use numbers to solve workplace or everyday problems.' },
        { id: 'N6', text: 'I understand basic budgeting and financial concepts.' },
      ]
    },
    {
      domain: 'learning',
      label: 'Oral Communication & Learning',
      items: [
        { id: 'L1', text: 'I can follow spoken instructions in a learning or workplace setting.' },
        { id: 'L2', text: 'I can participate in group discussions and express my ideas clearly.' },
        { id: 'L3', text: 'I can ask questions when I do not understand something.' },
        { id: 'L4', text: 'I can explain a process or concept to someone else.' },
        { id: 'L5', text: 'I am comfortable presenting information to a small group.' },
      ]
    },
    {
      domain: 'digital',
      label: 'Digital Literacy',
      items: [
        { id: 'D1', text: 'I can use a computer or tablet to complete basic tasks.' },
        { id: 'D2', text: 'I can use the internet to search for and find information.' },
        { id: 'D3', text: 'I can use email and online messaging tools.' },
        { id: 'D4', text: 'I can create and save documents using word processing software.' },
        { id: 'D5', text: 'I can use a Learning Management System (LMS) or online portal.' },
      ]
    }
  ];

  let sectionBResponses = $state<Record<string, number>>({});

  // Study commitment checkboxes
  const studyCommitments = [
    'I can commit to the required study hours per week',
    'I have access to a quiet study environment',
    'I have reliable internet access for online study',
    'I have discussed study plans with my family/employer'
  ];

  // Word counts
  let wordCounts = $derived.by(() => ({
    A1: countWords(A1),
    A2: countWords(A2),
    A3: countWords(A3),
    A4: countWords(A4),
    A5: countWords(A5),
    A7: countWords(A7),
    A9_explanation: countWords(A9_explanation),
    A10_explanation: countWords(A10_explanation),
    A12: countWords(A12)
  }));

  // Validation
  let sectionAValid = $derived.by(() => {
    const baseValid = A1.trim().length > 0 && A2.trim().length > 0 && A3.trim().length > 0 &&
      A3_dropdown.length > 0 && A5.trim().length > 0 && A7.trim().length > 0 &&
      A8.length > 0 && A9.length > 0;
    if (A9 === 'yes' && A9_explanation.trim().length === 0) return false;
    if (isInternational) {
      if (!A10 || !A11 || !A12.trim()) return false;
      if (A10 === 'other' && !A10_explanation.trim()) return false;
    }
    return baseValid;
  });

  let sectionBValid = $derived.by(() => {
    const totalItems = sectionBDomains.reduce((acc, d) => acc + d.items.length, 0);
    return Object.keys(sectionBResponses).length === totalItems;
  });

  let sectionBProgress = $derived.by(() => {
    const totalItems = sectionBDomains.reduce((acc, d) => acc + d.items.length, 0);
    return { answered: Object.keys(sectionBResponses).length, total: totalItems };
  });

  // ============================================
  // Helpers
  // ============================================
  function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  function getWordCountColor(count: number, min: number): string {
    if (count >= min) return 'text-green-600 dark:text-green-400';
    if (count >= min * 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-slate-400 dark:text-slate-500';
  }

  function toggleCommitment(item: string) {
    if (A6.includes(item)) {
      A6 = A6.filter(c => c !== item);
    } else {
      A6 = [...A6, item];
    }
  }

  function setSectionBResponse(itemId: string, value: number) {
    sectionBResponses = { ...sectionBResponses, [itemId]: value };
  }

  // ============================================
  // Navigation
  // ============================================
  function nextStep() {
    if (currentStep === 0) {
      if (!studentName.trim() || !tenantId.trim()) {
        error = 'Please enter your name and RTO identifier.';
        return;
      }
      error = '';
    }
    if (currentStep === 1 && !sectionAValid) {
      error = 'Please complete all required fields in Section A.';
      return;
    }
    if (currentStep === 2 && !sectionBValid) {
      error = 'Please answer all items in Section B.';
      return;
    }
    error = '';
    currentStep++;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function prevStep() {
    error = '';
    currentStep--;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ============================================
  // Submit
  // ============================================
  async function submitPER() {
    loading = true;
    error = '';

    try {
      const sectionA: any = {
        A1, A2, A3, A3_dropdown, A4, A4_dropdown, A5,
        A6, A7, A8, A9
      };
      if (A9 === 'yes') sectionA.A9_explanation = A9_explanation;
      if (isInternational) {
        sectionA.A10 = A10;
        if (A10 === 'other') sectionA.A10_explanation = A10_explanation;
        sectionA.A11 = A11;
        if (A11 === 'yes') sectionA.A11_estimate = A11_estimate;
        sectionA.A12 = A12;
      }

      const sectionBItems = Object.entries(sectionBResponses).map(([itemId, value]) => {
        const domain = sectionBDomains.find(d => d.items.some(i => i.id === itemId))?.domain || '';
        return { domain, item_id: itemId, value };
      });

      const res = await fetch('/api/per/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          student_name: studentName,
          student_id: studentId || undefined,
          student_email: studentEmail || undefined,
          application_id: applicationId || undefined,
          is_international: isInternational,
          section_a: sectionA,
          section_b: { items: sectionBItems }
        })
      });

      const result: any = await res.json();
      if (!res.ok) throw new Error(result.error || 'Submission failed');

      submissionResult = result;
      currentStep = 4;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Check URL params for pre-filled tenant
    const urlParams = new URLSearchParams(window.location.search);
    const tid = urlParams.get('tenant');
    if (tid) tenantId = tid;
    const appid = urlParams.get('app');
    if (appid) applicationId = appid;
  });
</script>

<div class="max-w-3xl mx-auto">
  <!-- Progress bar -->
  {#if currentStep > 0 && currentStep < 4}
    <div class="mb-8">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-slate-600 dark:text-slate-400">
          Step {currentStep} of 3
        </span>
        <span class="text-sm text-slate-500 dark:text-slate-400">
          {currentStep === 1 ? 'Section A: Course Suitability' : currentStep === 2 ? 'Section B: LLND Self-Assessment' : 'Review & Submit'}
        </span>
      </div>
      <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
        <div
          class="bg-teal-600 h-2 rounded-full transition-all duration-300"
          style="width: {(currentStep / 3) * 100}%"
        ></div>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="rounded-lg bg-red-500/10 border border-red-500/20 p-4 mb-6 text-red-600 dark:text-red-400">
      <p class="text-sm font-medium">{error}</p>
    </div>
  {/if}

  <!-- Step 0: Student Info -->
  {#if currentStep === 0}
    <div class="glass-panel rounded-xl p-8">
      <div class="text-center mb-8">
        <div class="h-16 w-16 bg-teal-600/20 dark:bg-teal-400/20 border border-teal-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="h-8 w-8 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">Pre-Enrolment Review</h1>
        <p class="text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          This review helps your RTO understand your readiness for study. It includes questions about your course motivation and a self-assessment of your literacy, numeracy and digital skills.
        </p>
      </div>

      <div class="space-y-4 max-w-md mx-auto">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
          <input type="text" bind:value={studentName} class="glass-input w-full px-4 py-2.5 rounded-lg text-sm" placeholder="Enter your full name" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student ID</label>
          <input type="text" bind:value={studentId} class="glass-input w-full px-4 py-2.5 rounded-lg text-sm" placeholder="Optional" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
          <input type="email" bind:value={studentEmail} class="glass-input w-full px-4 py-2.5 rounded-lg text-sm" placeholder="Optional" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">RTO Identifier *</label>
          <input type="text" bind:value={tenantId} class="glass-input w-full px-4 py-2.5 rounded-lg text-sm" placeholder="Provided by your institution" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Application ID</label>
          <input type="text" bind:value={applicationId} class="glass-input w-full px-4 py-2.5 rounded-lg text-sm" placeholder="Optional" />
        </div>
        <div class="pt-2">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" bind:checked={isInternational} class="w-4 h-4 rounded border-slate-300 dark:border-slate-600" />
            <span class="text-sm text-slate-700 dark:text-slate-300">I am an international student</span>
          </label>
        </div>
      </div>

      <div class="mt-8 text-center">
        <button onclick={nextStep} class="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold transition-colors">
          Begin Review
        </button>
      </div>
    </div>

  <!-- Step 1: Section A -->
  {:else if currentStep === 1}
    <div class="glass-panel rounded-xl p-8">
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Section A: Course Suitability</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">Please answer each question as thoroughly as possible. Word count indicators show minimum recommendations.</p>

      <div class="space-y-6">
        <!-- A1 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            A1. Why did you choose this course? What motivated your decision? *
          </label>
          <textarea bind:value={A1} rows="4" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Explain your reasons for choosing this course..."></textarea>
          <div class="flex justify-end mt-1">
            <span class={`text-xs ${getWordCountColor(wordCounts.A1, 120)}`}>{wordCounts.A1} words (min 120)</span>
          </div>
        </div>

        <!-- A2 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            A2. Why did you choose this particular provider/institution? *
          </label>
          <textarea bind:value={A2} rows="3" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Explain why you selected this provider..."></textarea>
          <div class="flex justify-end mt-1">
            <span class={`text-xs ${getWordCountColor(wordCounts.A2, 100)}`}>{wordCounts.A2} words (min 100)</span>
          </div>
        </div>

        <!-- A3 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            A3. Describe your academic or work history leading to this course. *
          </label>
          <select bind:value={A3_dropdown} class="glass-input w-full px-4 py-2.5 rounded-lg text-sm mb-2">
            <option value="">Select progression type...</option>
            <option value="Direct progression">Direct progression from previous study</option>
            <option value="Skill upgrade">Skill upgrade in current field</option>
            <option value="Career change">Career change to new field</option>
          </select>
          <textarea bind:value={A3} rows="3" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Describe your background..."></textarea>
          <div class="flex justify-end mt-1">
            <span class={`text-xs ${getWordCountColor(wordCounts.A3, 100)}`}>{wordCounts.A3} words (min 100)</span>
          </div>
        </div>

        <!-- A4 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            A4. What employment outcomes do you expect after completing this course?
          </label>
          <select bind:value={A4_dropdown} class="glass-input w-full px-4 py-2.5 rounded-lg text-sm mb-2">
            <option value="">Select expected outcome...</option>
            <option value="New employment">New employment in chosen field</option>
            <option value="Promotion">Promotion or advancement</option>
            <option value="Self-employment">Self-employment or business start-up</option>
            <option value="Further study">Pathway to further study</option>
          </select>
          <textarea bind:value={A4} rows="2" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Optional additional detail..."></textarea>
        </div>

        <!-- A5 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            A5. What are your long-term career goals? *
          </label>
          <textarea bind:value={A5} rows="3" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Describe your 3-5 year career plan..."></textarea>
          <div class="flex justify-end mt-1">
            <span class={`text-xs ${getWordCountColor(wordCounts.A5, 120)}`}>{wordCounts.A5} words (min 120)</span>
          </div>
        </div>

        <!-- A6 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            A6. Study Commitment (confirm all that apply)
          </label>
          <div class="space-y-2">
            {#each studyCommitments as item}
              <label class="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/50 transition-colors">
                <input type="checkbox" checked={A6.includes(item)} onchange={() => toggleCommitment(item)} class="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600" />
                <span class="text-sm text-slate-700 dark:text-slate-300">{item}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- A7 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            A7. How will you manage your study alongside other commitments? *
          </label>
          <textarea bind:value={A7} rows="3" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Describe your study management plan..."></textarea>
          <div class="flex justify-end mt-1">
            <span class={`text-xs ${getWordCountColor(wordCounts.A7, 100)}`}>{wordCounts.A7} words (min 100)</span>
          </div>
        </div>

        <!-- A8 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            A8. What is your English language study background? *
          </label>
          <div class="space-y-2">
            {#each ['English is my first language', 'English is my second language - studied for 5+ years', 'English is my second language - studied for 2-5 years', 'English is my second language - studied for less than 2 years'] as option}
              <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/50 transition-colors">
                <input type="radio" name="A8" value={option} bind:group={A8} class="w-4 h-4 border-slate-300 dark:border-slate-600" />
                <span class="text-sm text-slate-700 dark:text-slate-300">{option}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- A9 -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            A9. Have you previously withdrawn from a course of study? *
          </label>
          <div class="flex gap-4 mb-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="A9" value="yes" bind:group={A9} class="w-4 h-4" />
              <span class="text-sm text-slate-700 dark:text-slate-300">Yes</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="A9" value="no" bind:group={A9} class="w-4 h-4" />
              <span class="text-sm text-slate-700 dark:text-slate-300">No</span>
            </label>
          </div>
          {#if A9 === 'yes'}
            <textarea bind:value={A9_explanation} rows="2" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Please explain the circumstances..."></textarea>
            <div class="flex justify-end mt-1">
              <span class={`text-xs ${getWordCountColor(wordCounts.A9_explanation, 80)}`}>{wordCounts.A9_explanation} words (min 80)</span>
            </div>
          {/if}
        </div>

        <!-- International-only questions -->
        {#if isInternational}
          <div class="border-t border-slate-200 dark:border-slate-700 pt-6">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-4">International Student Questions</h3>

            <!-- A10 -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                A10. How will you fund your studies? *
              </label>
              <div class="space-y-2">
                {#each ['Personal savings', 'Family support', 'Scholarship', 'Student loan', 'other'] as option}
                  <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30 cursor-pointer">
                    <input type="radio" name="A10" value={option} bind:group={A10} class="w-4 h-4" />
                    <span class="text-sm text-slate-700 dark:text-slate-300">{option === 'other' ? 'Other' : option}</span>
                  </label>
                {/each}
              </div>
              {#if A10 === 'other'}
                <textarea bind:value={A10_explanation} rows="2" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y mt-2" placeholder="Please specify..."></textarea>
              {/if}
            </div>

            <!-- A11 -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                A11. Are you aware of the cost of living in Australia? *
              </label>
              <div class="flex gap-4 mb-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="A11" value="yes" bind:group={A11} class="w-4 h-4" />
                  <span class="text-sm text-slate-700 dark:text-slate-300">Yes</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="A11" value="no" bind:group={A11} class="w-4 h-4" />
                  <span class="text-sm text-slate-700 dark:text-slate-300">No</span>
                </label>
              </div>
              {#if A11 === 'yes'}
                <input type="text" bind:value={A11_estimate} class="glass-input w-full px-4 py-2.5 rounded-lg text-sm" placeholder="Estimated weekly living expenses ($AUD)" />
              {/if}
            </div>

            <!-- A12 -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                A12. What are your plans after completing this qualification? *
              </label>
              <textarea bind:value={A12} rows="3" class="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-y" placeholder="Describe your post-qualification plans..."></textarea>
              <div class="flex justify-end mt-1">
                <span class={`text-xs ${getWordCountColor(wordCounts.A12, 100)}`}>{wordCounts.A12} words (min 100)</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="flex justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <button onclick={prevStep} class="px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">
          Back
        </button>
        <button onclick={nextStep} class="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-bold transition-colors">
          Continue to Section B
        </button>
      </div>
    </div>

  <!-- Step 2: Section B -->
  {:else if currentStep === 2}
    <div class="glass-panel rounded-xl p-8">
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Section B: LLND Self-Assessment</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-2">Rate your confidence for each statement below. This is a self-assessment, not a test.</p>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Progress: <span class="font-bold text-teal-600 dark:text-teal-400">{sectionBProgress.answered}</span> / {sectionBProgress.total} answered
      </p>

      <div class="space-y-8">
        {#each sectionBDomains as domain}
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1">{domain.label}</h3>
            <div class="text-xs text-slate-400 dark:text-slate-500 mb-3">
              {domain.items.filter(i => sectionBResponses[i.id] !== undefined).length} / {domain.items.length} answered
            </div>
            <div class="space-y-3">
              {#each domain.items as item}
                <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
                  <p class="text-sm text-slate-700 dark:text-slate-300 mb-3">{item.text}</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      onclick={() => setSectionBResponse(item.id, 2)}
                      class={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        sectionBResponses[item.id] === 2
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-green-600/10 text-green-700 dark:text-green-400 hover:bg-green-600/20 border border-green-500/20'
                      }`}
                    >
                      Confident
                    </button>
                    <button
                      onclick={() => setSectionBResponse(item.id, 1)}
                      class={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        sectionBResponses[item.id] === 1
                          ? 'bg-yellow-500 text-white shadow-sm'
                          : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20'
                      }`}
                    >
                      Somewhat
                    </button>
                    <button
                      onclick={() => setSectionBResponse(item.id, 0)}
                      class={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        sectionBResponses[item.id] === 0
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20'
                      }`}
                    >
                      May Need Support
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="flex justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <button onclick={prevStep} class="px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">
          Back to Section A
        </button>
        <button onclick={nextStep} disabled={!sectionBValid} class="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Review & Submit
        </button>
      </div>
    </div>

  <!-- Step 3: Review -->
  {:else if currentStep === 3}
    <div class="glass-panel rounded-xl p-8">
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6">Review Your Submission</h2>

      <!-- Student Info Summary -->
      <div class="mb-6 p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Student Information</h3>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div><span class="text-slate-500">Name:</span> <span class="text-slate-900 dark:text-white font-medium">{studentName}</span></div>
          {#if studentId}<div><span class="text-slate-500">Student ID:</span> <span class="text-slate-900 dark:text-white font-medium">{studentId}</span></div>{/if}
          {#if studentEmail}<div><span class="text-slate-500">Email:</span> <span class="text-slate-900 dark:text-white font-medium">{studentEmail}</span></div>{/if}
          <div><span class="text-slate-500">International:</span> <span class="text-slate-900 dark:text-white font-medium">{isInternational ? 'Yes' : 'No'}</span></div>
        </div>
      </div>

      <!-- Section A Summary -->
      <div class="mb-6">
        <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Section A: Course Suitability</h3>
        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            <span class="text-slate-600 dark:text-slate-400">Course motivation: {wordCounts.A1} words</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            <span class="text-slate-600 dark:text-slate-400">Provider rationale: {wordCounts.A2} words</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            <span class="text-slate-600 dark:text-slate-400">Academic history: {A3_dropdown} ({wordCounts.A3} words)</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            <span class="text-slate-600 dark:text-slate-400">Study commitments confirmed: {A6.length}/{studyCommitments.length}</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            <span class="text-slate-600 dark:text-slate-400">English background: {A8 || 'Not answered'}</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            <span class="text-slate-600 dark:text-slate-400">Previous withdrawal: {A9 || 'Not answered'}</span>
          </div>
        </div>
      </div>

      <!-- Section B Summary -->
      <div class="mb-6">
        <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Section B: LLND Self-Assessment</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {#each sectionBDomains as domain}
            {@const domainItems = domain.items.map(i => sectionBResponses[i.id] ?? 0)}
            {@const confident = domainItems.filter(v => v === 2).length}
            {@const somewhat = domainItems.filter(v => v === 1).length}
            {@const mns = domainItems.filter(v => v === 0).length}
            <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30">
              <div class="font-medium text-sm text-slate-900 dark:text-white mb-1">{domain.label}</div>
              <div class="flex gap-3 text-xs">
                <span class="text-green-600 dark:text-green-400">{confident} confident</span>
                <span class="text-yellow-600 dark:text-yellow-400">{somewhat} somewhat</span>
                <span class="text-red-600 dark:text-red-400">{mns} MNS</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="flex justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <button onclick={prevStep} class="px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">
          Back to Section B
        </button>
        <button onclick={submitPER} disabled={loading} class="px-8 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {#if loading}
            <span class="flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </span>
          {:else}
            Submit Pre-Enrolment Review
          {/if}
        </button>
      </div>
    </div>

  <!-- Step 4: Success -->
  {:else if currentStep === 4}
    <div class="glass-panel rounded-xl p-8 text-center">
      <div class="h-16 w-16 bg-green-600/20 dark:bg-green-400/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg class="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Submission Complete</h2>
      <p class="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
        Your Pre-Enrolment Review has been submitted successfully. Your institution will review your responses and may contact you for further discussion.
      </p>
      {#if submissionResult?.submission_id}
        <div class="inline-flex items-center px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 mb-6">
          Reference: <code class="ml-2 font-mono text-xs text-slate-900 dark:text-white">{submissionResult.submission_id.slice(0, 8)}</code>
        </div>
      {/if}
    </div>
  {/if}
</div>
