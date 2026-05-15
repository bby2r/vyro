<?php

namespace App\Services\Sync;

use App\Models\Expense;
use App\Models\Tenant;
use App\Models\Todo;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class SyncService
{
    /**
     * Upsert a batch of expense rows for the given tenant using last-writer-wins
     * semantics on `updated_at`. Returns the canonical row the server now holds
     * for each input row, in input order.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, Expense>
     */
    public function pushExpenses(Tenant $tenant, array $rows): array
    {
        $canonical = [];

        foreach ($rows as $row) {
            $canonical[] = $this->upsertExpense($tenant, $row);
        }

        return $canonical;
    }

    /**
     * Upsert a batch of todo rows for the given tenant using last-writer-wins
     * semantics on `updated_at`. Returns the canonical row the server now holds
     * for each input row, in input order.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, Todo>
     */
    public function pushTodos(Tenant $tenant, array $rows): array
    {
        $canonical = [];

        foreach ($rows as $row) {
            $canonical[] = $this->upsertTodo($tenant, $row);
        }

        return $canonical;
    }

    /**
     * Return all rows updated since `$since` (or all rows if null), including
     * soft-deleted (tombstone) rows.
     *
     * @return array{expenses: array<int, Expense>, todos: array<int, Todo>, server_time: string}
     */
    public function pullSince(Tenant $tenant, ?Carbon $since): array
    {
        $expenseQuery = Expense::query()->orderBy('updated_at');
        $todoQuery = Todo::query()->orderBy('updated_at');

        if ($since !== null) {
            $expenseQuery->where('updated_at', '>', $since);
            $todoQuery->where('updated_at', '>', $since);
        }

        return [
            'expenses' => $expenseQuery->get()->all(),
            'todos' => $todoQuery->get()->all(),
            'server_time' => now()->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function upsertExpense(Tenant $tenant, array $row): Expense
    {
        $incomingUpdatedAt = $this->clampUpdatedAt($tenant, $row['client_id'], $row['updated_at']);

        $existing = Expense::query()->where('client_id', $row['client_id'])->first();

        if ($existing === null) {
            $expense = new Expense;
            $expense->tenant_id = $tenant->id;
            $expense->client_id = $row['client_id'];
            $expense->description = $row['description'];
            $expense->amount_cents = $row['amount_cents'];
            $expense->currency = $row['currency'] ?? 'USD';
            $expense->occurred_at = Carbon::parse($row['occurred_at']);
            $expense->deleted_at = isset($row['deleted_at']) ? Carbon::parse($row['deleted_at']) : null;
            $expense->updated_at = $incomingUpdatedAt;
            $expense->save();

            return $expense;
        }

        if ($existing->updated_at !== null && $existing->updated_at->greaterThanOrEqualTo($incomingUpdatedAt)) {
            return $existing;
        }

        $existing->description = $row['description'];
        $existing->amount_cents = $row['amount_cents'];
        $existing->currency = $row['currency'] ?? $existing->currency;
        $existing->occurred_at = Carbon::parse($row['occurred_at']);
        $existing->deleted_at = isset($row['deleted_at']) ? Carbon::parse($row['deleted_at']) : null;
        $existing->updated_at = $incomingUpdatedAt;
        $existing->save();

        return $existing;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function upsertTodo(Tenant $tenant, array $row): Todo
    {
        $incomingUpdatedAt = $this->clampUpdatedAt($tenant, $row['client_id'], $row['updated_at']);

        $existing = Todo::query()->where('client_id', $row['client_id'])->first();

        if ($existing === null) {
            $todo = new Todo;
            $todo->tenant_id = $tenant->id;
            $todo->client_id = $row['client_id'];
            $todo->title = $row['title'];
            $todo->due_at = isset($row['due_at']) ? Carbon::parse($row['due_at']) : null;
            $todo->done = (bool) ($row['done'] ?? false);
            $todo->deleted_at = isset($row['deleted_at']) ? Carbon::parse($row['deleted_at']) : null;
            $todo->updated_at = $incomingUpdatedAt;
            $todo->save();

            return $todo;
        }

        if ($existing->updated_at !== null && $existing->updated_at->greaterThanOrEqualTo($incomingUpdatedAt)) {
            return $existing;
        }

        $existing->title = $row['title'];
        $existing->due_at = isset($row['due_at']) ? Carbon::parse($row['due_at']) : null;
        $existing->done = (bool) ($row['done'] ?? false);
        $existing->deleted_at = isset($row['deleted_at']) ? Carbon::parse($row['deleted_at']) : null;
        $existing->updated_at = $incomingUpdatedAt;
        $existing->save();

        return $existing;
    }

    /**
     * Clamp incoming updated_at to `now()` if it's more than 24h in the future
     * (defends against phone clock skew). Logs a warning when clamping occurs.
     *
     * @param  mixed  $rawUpdatedAt
     */
    private function clampUpdatedAt(Tenant $tenant, string $clientId, $rawUpdatedAt): Carbon
    {
        $incoming = Carbon::parse($rawUpdatedAt);
        $now = now();

        if ($incoming->greaterThan($now->copy()->addHours(24))) {
            Log::warning('sync: clamped future updated_at', [
                'tenant_uuid' => $tenant->uuid,
                'client_id' => $clientId,
                'incoming_updated_at' => $incoming->toIso8601String(),
            ]);

            return $now;
        }

        return $incoming;
    }
}
