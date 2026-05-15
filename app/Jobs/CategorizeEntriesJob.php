<?php

namespace App\Jobs;

use App\Models\Expense;
use App\Models\Tenant;
use App\Models\Todo;
use App\Services\Ai\Categorizer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Iterates every tenant and fills in `category`, `labels`, and (for todos)
 * `estimated_minutes` on uncategorized rows from the last `ai.window_days` days,
 * up to `ai.batch_size` rows per kind per tenant.
 *
 * Resilient by design: a per-row exception is logged and the loop continues so
 * a single bad row never poisons an entire tenant's batch.
 */
class CategorizeEntriesJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct() {}

    /**
     * Execute the job.
     */
    public function handle(Categorizer $categorizer): void
    {
        $batchSize = (int) config('ai.batch_size', 50);
        $windowDays = (int) config('ai.window_days', 7);
        $cutoff = now()->subDays($windowDays);

        $totalExpenses = 0;
        $totalTodos = 0;
        $totalFailures = 0;

        foreach (Tenant::cursor() as $tenant) {
            app()->instance('current.tenant', $tenant);

            try {
                $expenses = Expense::whereNull('category')
                    ->where('created_at', '>=', $cutoff)
                    ->limit($batchSize)
                    ->get();

                foreach ($expenses as $expense) {
                    try {
                        $result = $categorizer->categorize($expense->description, 'expense');
                        $expense->forceFill([
                            'category' => $result['category'] ?? null,
                            'labels' => $result['labels'] ?? [],
                        ])->save();
                        $totalExpenses++;
                    } catch (Throwable $e) {
                        $totalFailures++;
                        Log::warning('CategorizeEntriesJob: expense categorization failed', [
                            'tenant_id' => $tenant->id,
                            'expense_id' => $expense->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                $todos = Todo::whereNull('category')
                    ->where('created_at', '>=', $cutoff)
                    ->limit($batchSize)
                    ->get();

                foreach ($todos as $todo) {
                    try {
                        $result = $categorizer->categorize($todo->title, 'todo');
                        $todo->forceFill([
                            'category' => $result['category'] ?? null,
                            'labels' => $result['labels'] ?? [],
                            'estimated_minutes' => $result['estimated_minutes'] ?? null,
                        ])->save();
                        $totalTodos++;
                    } catch (Throwable $e) {
                        $totalFailures++;
                        Log::warning('CategorizeEntriesJob: todo categorization failed', [
                            'tenant_id' => $tenant->id,
                            'todo_id' => $todo->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            } finally {
                app()->forgetInstance('current.tenant');
            }
        }

        Log::info('CategorizeEntriesJob complete', [
            'expenses_processed' => $totalExpenses,
            'todos_processed' => $totalTodos,
            'failures' => $totalFailures,
        ]);
    }
}
