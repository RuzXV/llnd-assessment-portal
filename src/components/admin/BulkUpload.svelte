<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    // Props
    let { availableSeats = [] }: { availableSeats: any[] } = $props();

    // State
    let showModal = $state(false);
    let step = $state<'upload' | 'preview' | 'processing' | 'results'>('upload');
    let dragOver = $state(false);
    let fileInput = $state<HTMLInputElement | null>(null);
    let uploadedFile = $state<File | null>(null);
    let parsedData = $state<any[]>([]);
    let validationErrors = $state<string[]>([]);
    let processing = $state(false);
    let processedResults = $state<any[]>([]);
    let processError = $state('');

    // Get assessment types for template
    let assessmentTypes = $derived(availableSeats.map(s => s.product_name || s.product_id).join(', '));

    function openModal() {
        showModal = true;
        step = 'upload';
        uploadedFile = null;
        parsedData = [];
        validationErrors = [];
        processedResults = [];
        processError = '';
    }

    function closeModal() {
        showModal = false;
    }

    function downloadTemplate() {
        // Create CSV template with headers and example rows
        const headers = ['student_name', 'student_id', 'email', 'assessment_type'];

        // Build example rows showing available assessment types
        const exampleAssessmentType = availableSeats.length > 0
            ? (availableSeats[0].product_name || availableSeats[0].product_id)
            : 'LLND Core';

        const rows = [
            headers.join(','),
            '# INSTRUCTIONS: Fill in student details below. Delete these example rows first.',
            `# Available assessment types: ${assessmentTypes || 'None available'}`,
            `# student_name is REQUIRED. student_id and email are optional.`,
            '',
            `John Smith,STU001,john.smith@email.com,${exampleAssessmentType}`,
            `Jane Doe,STU002,jane.doe@email.com,${exampleAssessmentType}`,
            `Bob Wilson,STU003,,${exampleAssessmentType}`,
            ''
        ];

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'assessment_bulk_upload_template.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        dragOver = true;
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        dragOver = false;
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        dragOver = false;
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    }

    function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            handleFile(target.files[0]);
        }
    }

    function handleFile(file: File) {
        if (!file.name.endsWith('.csv')) {
            validationErrors = ['Please upload a CSV file (.csv)'];
            return;
        }
        uploadedFile = file;
        parseCSV(file);
    }

    async function parseCSV(file: File) {
        const text = await file.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));

        if (lines.length < 2) {
            validationErrors = ['CSV file must have a header row and at least one data row'];
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['student_name', 'assessment_type'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            validationErrors = [`Missing required columns: ${missingHeaders.join(', ')}`];
            return;
        }

        const nameIdx = headers.indexOf('student_name');
        const idIdx = headers.indexOf('student_id');
        const emailIdx = headers.indexOf('email');
        const typeIdx = headers.indexOf('assessment_type');

        const data: any[] = [];
        const errors: string[] = [];
        const availableTypes = availableSeats.map(s => (s.product_name || s.product_id).toLowerCase());

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0 || values.every(v => !v.trim())) continue;

            const studentName = values[nameIdx]?.trim() || '';
            const studentId = idIdx >= 0 ? values[idIdx]?.trim() || '' : '';
            const email = emailIdx >= 0 ? values[emailIdx]?.trim() || '' : '';
            const assessmentType = values[typeIdx]?.trim() || '';

            // Validation
            if (!studentName) {
                errors.push(`Row ${i + 1}: Student name is required`);
                continue;
            }

            if (!assessmentType) {
                errors.push(`Row ${i + 1}: Assessment type is required`);
                continue;
            }

            // Find matching product
            const matchedSeat = availableSeats.find(s =>
                (s.product_name || s.product_id).toLowerCase() === assessmentType.toLowerCase()
            );

            if (!matchedSeat) {
                errors.push(`Row ${i + 1}: Unknown assessment type "${assessmentType}". Available: ${assessmentTypes}`);
                continue;
            }

            // Validate email format if provided
            if (email && !isValidEmail(email)) {
                errors.push(`Row ${i + 1}: Invalid email format "${email}"`);
                continue;
            }

            data.push({
                row: i + 1,
                student_name: studentName,
                student_id: studentId,
                email: email,
                assessment_type: assessmentType,
                product_id: matchedSeat.product_id,
                product_name: matchedSeat.product_name || matchedSeat.product_id
            });
        }

        parsedData = data;
        validationErrors = errors;

        if (data.length > 0) {
            step = 'preview';
        }
    }

    function parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    function isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    async function processUpload() {
        processing = true;
        processError = '';
        step = 'processing';

        try {
            const token = localStorage.getItem('llnd_token');
            const res = await fetch('/api/seats/bulk', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ students: parsedData })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to process bulk upload');
            }

            processedResults = data.results;
            step = 'results';
            dispatch('complete');

        } catch (e: any) {
            processError = e.message;
            step = 'preview';
        } finally {
            processing = false;
        }
    }

    function downloadResults() {
        const headers = ['student_name', 'student_id', 'email', 'assessment_type', 'status', 'assessment_link'];
        const rows = [headers.join(',')];

        for (const result of processedResults) {
            rows.push([
                `"${result.student_name || ''}"`,
                `"${result.student_id || ''}"`,
                `"${result.email || ''}"`,
                `"${result.product_name || ''}"`,
                `"${result.status}"`,
                `"${result.link || result.error || ''}"`
            ].join(','));
        }

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `assessment_links_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function resetUpload() {
        step = 'upload';
        uploadedFile = null;
        parsedData = [];
        validationErrors = [];
        if (fileInput) fileInput.value = '';
    }

    let successCount = $derived(processedResults.filter(r => r.status === 'success').length);
    let failCount = $derived(processedResults.filter(r => r.status === 'error').length);
</script>

<!-- Trigger Button -->
<button
    type="button"
    onclick={openModal}
    class="w-full mt-3 inline-flex justify-center items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 transition-colors"
>
    <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
    Bulk Upload (CSV)
</button>

<!-- Modal -->
{#if showModal}
    <div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
        <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onclick={closeModal}></div>

            <!-- Modal Panel -->
            <div class="relative inline-block w-full max-w-2xl p-6 my-8 text-left align-middle bg-white dark:bg-slate-800 rounded-2xl shadow-2xl transform transition-all border border-slate-200 dark:border-slate-700">

                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white">
                        {#if step === 'upload'}Bulk Upload Assessments{/if}
                        {#if step === 'preview'}Preview & Confirm{/if}
                        {#if step === 'processing'}Processing...{/if}
                        {#if step === 'results'}Upload Complete{/if}
                    </h3>
                    <button onclick={closeModal} class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <svg class="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Step: Upload -->
                {#if step === 'upload'}
                    <div class="space-y-4">
                        <!-- Download Template -->
                        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div class="flex items-start gap-3">
                                <svg class="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div class="flex-1">
                                    <p class="text-sm text-blue-800 dark:text-blue-200 font-medium">Step 1: Download the template</p>
                                    <p class="text-xs text-blue-600 dark:text-blue-300 mt-1">Fill in your student details using the CSV template, then upload it below.</p>
                                    <button
                                        onclick={downloadTemplate}
                                        class="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                    >
                                        <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download Template
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Available Assessment Types -->
                        {#if availableSeats.length > 0}
                            <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <p class="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Available Assessment Types:</p>
                                <div class="flex flex-wrap gap-2">
                                    {#each availableSeats as seat}
                                        <span class="px-2 py-1 text-xs font-medium bg-white dark:bg-slate-600 rounded border border-slate-200 dark:border-slate-500 text-slate-700 dark:text-slate-200">
                                            {seat.product_name || seat.product_id} ({seat.count} seats)
                                        </span>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <!-- Drop Zone -->
                        <div
                            class={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                                dragOver
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                            }`}
                            ondragover={handleDragOver}
                            ondragleave={handleDragLeave}
                            ondrop={handleDrop}
                        >
                            <input
                                type="file"
                                accept=".csv"
                                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                bind:this={fileInput}
                                onchange={handleFileSelect}
                            />
                            <svg class="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Drop your CSV file here, or <span class="text-blue-600 dark:text-blue-400">browse</span>
                            </p>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Only .csv files are accepted</p>
                        </div>

                        <!-- Validation Errors -->
                        {#if validationErrors.length > 0}
                            <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <p class="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Validation Errors:</p>
                                <ul class="text-xs text-red-600 dark:text-red-300 space-y-1">
                                    {#each validationErrors as err}
                                        <li>• {err}</li>
                                    {/each}
                                </ul>
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Step: Preview -->
                {#if step === 'preview'}
                    <div class="space-y-4">
                        <!-- Summary -->
                        <div class="flex items-center gap-4">
                            <div class="flex-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <p class="text-2xl font-bold text-green-600 dark:text-green-400">{parsedData.length}</p>
                                <p class="text-xs text-green-700 dark:text-green-300">Valid entries</p>
                            </div>
                            {#if validationErrors.length > 0}
                                <div class="flex-1 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                    <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{validationErrors.length}</p>
                                    <p class="text-xs text-amber-700 dark:text-amber-300">Skipped (errors)</p>
                                </div>
                            {/if}
                        </div>

                        <!-- Preview Table -->
                        <div class="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead class="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-xs font-bold text-slate-600 dark:text-slate-300">Name</th>
                                        <th class="px-3 py-2 text-left text-xs font-bold text-slate-600 dark:text-slate-300">Student ID</th>
                                        <th class="px-3 py-2 text-left text-xs font-bold text-slate-600 dark:text-slate-300">Email</th>
                                        <th class="px-3 py-2 text-left text-xs font-bold text-slate-600 dark:text-slate-300">Assessment</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                    {#each parsedData as row}
                                        <tr>
                                            <td class="px-3 py-2 text-sm text-slate-900 dark:text-white">{row.student_name}</td>
                                            <td class="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">{row.student_id || '-'}</td>
                                            <td class="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">{row.email || '-'}</td>
                                            <td class="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">{row.product_name}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>

                        <!-- Errors -->
                        {#if validationErrors.length > 0}
                            <details class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <summary class="text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer">
                                    {validationErrors.length} row(s) will be skipped due to errors
                                </summary>
                                <ul class="mt-2 text-xs text-amber-600 dark:text-amber-300 space-y-1">
                                    {#each validationErrors as err}
                                        <li>• {err}</li>
                                    {/each}
                                </ul>
                            </details>
                        {/if}

                        {#if processError}
                            <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <p class="text-sm text-red-600 dark:text-red-300">{processError}</p>
                            </div>
                        {/if}

                        <!-- Actions -->
                        <div class="flex gap-3 pt-2">
                            <button
                                onclick={resetUpload}
                                class="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onclick={processUpload}
                                disabled={parsedData.length === 0}
                                class="flex-1 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Issue {parsedData.length} Assessment{parsedData.length !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                {/if}

                <!-- Step: Processing -->
                {#if step === 'processing'}
                    <div class="py-12 text-center">
                        <div class="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                        <p class="text-slate-600 dark:text-slate-300">Processing {parsedData.length} assessments...</p>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">This may take a moment</p>
                    </div>
                {/if}

                <!-- Step: Results -->
                {#if step === 'results'}
                    <div class="space-y-4">
                        <!-- Summary -->
                        <div class="flex items-center gap-4">
                            <div class="flex-1 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center">
                                <p class="text-3xl font-bold text-green-600 dark:text-green-400">{successCount}</p>
                                <p class="text-sm text-green-700 dark:text-green-300">Successful</p>
                            </div>
                            {#if failCount > 0}
                                <div class="flex-1 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-center">
                                    <p class="text-3xl font-bold text-red-600 dark:text-red-400">{failCount}</p>
                                    <p class="text-sm text-red-700 dark:text-red-300">Failed</p>
                                </div>
                            {/if}
                        </div>

                        <!-- Download Results -->
                        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Download Results</p>
                                    <p class="text-xs text-blue-600 dark:text-blue-300 mt-0.5">CSV file with all generated assessment links</p>
                                </div>
                                <button
                                    onclick={downloadResults}
                                    class="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                >
                                    <svg class="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download CSV
                                </button>
                            </div>
                        </div>

                        <!-- Close Button -->
                        <button
                            onclick={closeModal}
                            class="w-full px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
</script>
