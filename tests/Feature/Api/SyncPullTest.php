<?php

namespace Tests\Feature\Api;

use App\Models\Expense;
use App\Models\Tenant;
use App\Models\Todo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SyncPullTest extends TestCase
{
    use RefreshDatabase;

    public function test_pull_without_since_returns_all_rows(): void
    {
        $tenant = Tenant::factory()->create();
        Expense::factory()->count(3)->for($tenant)->create();
        Todo::factory()->count(2)->for($tenant)->create();

        $response = $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->getJson('/api/v1/sync/pull');

        $response->assertStatus(200)
            ->assertJsonCount(3, 'expenses')
            ->assertJsonCount(2, 'todos');
    }

    public function test_pull_with_since_filters_older_rows(): void
    {
        $tenant = Tenant::factory()->create();

        $offsets = [-50, -40, -30, -20, -10];
        $createdIds = [];
        foreach ($offsets as $i => $minutes) {
            $expense = Expense::factory()->for($tenant)->create();
            Expense::withoutGlobalScopes()
                ->where('id', $expense->id)
                ->update(['updated_at' => now()->addMinutes($minutes)]);
            $createdIds[$i] = $expense->id;
        }

        // since = 25 minutes ago — should return rows with updated_at > -25min,
        // which are the rows updated -20m and -10m (2 rows).
        $since = now()->subMinutes(25);

        $response = $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->getJson('/api/v1/sync/pull?since='.urlencode($since->toIso8601String()));

        $response->assertStatus(200)
            ->assertJsonCount(2, 'expenses');
    }

    public function test_pull_includes_soft_deleted_rows(): void
    {
        $tenant = Tenant::factory()->create();
        $deletedAt = now()->subMinute()->startOfSecond();

        $expense = Expense::factory()->for($tenant)->create([
            'deleted_at' => $deletedAt,
        ]);

        $response = $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->getJson('/api/v1/sync/pull');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'expenses')
            ->assertJsonPath('expenses.0.client_id', $expense->client_id);

        $payload = $response->json('expenses.0');
        $this->assertNotNull($payload['deleted_at']);
    }

    public function test_pull_isolates_tenants(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $expenseA = Expense::factory()->for($tenantA)->create(['description' => 'A-only']);
        Expense::factory()->for($tenantB)->create(['description' => 'B-only']);

        $response = $this->withHeader('X-Tenant-UUID', $tenantA->uuid)
            ->getJson('/api/v1/sync/pull');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'expenses')
            ->assertJsonPath('expenses.0.client_id', $expenseA->client_id)
            ->assertJsonPath('expenses.0.description', 'A-only');
    }

    public function test_pull_returns_server_time(): void
    {
        $tenant = Tenant::factory()->create();

        $response = $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->getJson('/api/v1/sync/pull');

        $response->assertStatus(200);

        $serverTime = $response->json('server_time');
        $this->assertIsString($serverTime);

        $parsed = Carbon::parse($serverTime);
        $this->assertLessThanOrEqual(5, abs($parsed->diffInSeconds(now())));
    }
}
