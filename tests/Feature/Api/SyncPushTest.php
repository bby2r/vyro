<?php

namespace Tests\Feature\Api;

use App\Models\Expense;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class SyncPushTest extends TestCase
{
    use RefreshDatabase;

    public function test_push_creates_new_expenses_and_todos(): void
    {
        $tenant = Tenant::factory()->create();
        $now = now()->startOfSecond();

        $expense1ClientId = (string) Str::uuid();
        $expense2ClientId = (string) Str::uuid();
        $todoClientId = (string) Str::uuid();

        $payload = [
            'expenses' => [
                [
                    'client_id' => $expense1ClientId,
                    'description' => 'Coffee',
                    'amount_cents' => 350,
                    'currency' => 'USD',
                    'occurred_at' => $now->toIso8601String(),
                    'updated_at' => $now->toIso8601String(),
                    'deleted_at' => null,
                ],
                [
                    'client_id' => $expense2ClientId,
                    'description' => 'Lunch',
                    'amount_cents' => 1250,
                    'currency' => 'USD',
                    'occurred_at' => $now->toIso8601String(),
                    'updated_at' => $now->toIso8601String(),
                    'deleted_at' => null,
                ],
            ],
            'todos' => [
                [
                    'client_id' => $todoClientId,
                    'title' => 'Buy milk',
                    'due_at' => null,
                    'done' => false,
                    'updated_at' => $now->toIso8601String(),
                    'deleted_at' => null,
                ],
            ],
        ];

        $response = $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->postJson('/api/v1/sync/push', $payload);

        $response->assertStatus(200)
            ->assertJsonCount(2, 'expenses')
            ->assertJsonCount(1, 'todos');

        $this->assertDatabaseHas('expenses', [
            'client_id' => $expense1ClientId,
            'description' => 'Coffee',
            'amount_cents' => 350,
            'tenant_id' => $tenant->id,
        ]);

        $this->assertDatabaseHas('expenses', [
            'client_id' => $expense2ClientId,
            'description' => 'Lunch',
            'amount_cents' => 1250,
            'tenant_id' => $tenant->id,
        ]);

        $this->assertDatabaseHas('todos', [
            'client_id' => $todoClientId,
            'title' => 'Buy milk',
            'done' => 0,
            'tenant_id' => $tenant->id,
        ]);
    }

    public function test_push_is_idempotent_on_client_id(): void
    {
        $tenant = Tenant::factory()->create();
        $clientId = (string) Str::uuid();
        $now = now()->startOfSecond();

        $payload = [
            'expenses' => [[
                'client_id' => $clientId,
                'description' => 'Coffee',
                'amount_cents' => 350,
                'currency' => 'USD',
                'occurred_at' => $now->toIso8601String(),
                'updated_at' => $now->toIso8601String(),
                'deleted_at' => null,
            ]],
        ];

        $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->postJson('/api/v1/sync/push', $payload)
            ->assertStatus(200);

        $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->postJson('/api/v1/sync/push', $payload)
            ->assertStatus(200);

        $this->assertSame(1, Expense::withoutGlobalScopes()->where('client_id', $clientId)->count());
    }

    public function test_push_applies_last_writer_wins(): void
    {
        $tenant = Tenant::factory()->create();
        $clientId = (string) Str::uuid();

        $oneHourAgo = now()->subHour()->startOfSecond();
        $expense = Expense::factory()->for($tenant)->create([
            'client_id' => $clientId,
            'description' => 'old description',
            'amount_cents' => 100,
        ]);
        // Force updated_at into the past via raw DB update (timestamps would override otherwise).
        Expense::withoutGlobalScopes()->where('id', $expense->id)->update(['updated_at' => $oneHourAgo]);

        $newer = now()->startOfSecond();
        $payload = [
            'expenses' => [[
                'client_id' => $clientId,
                'description' => 'new description',
                'amount_cents' => 999,
                'currency' => 'USD',
                'occurred_at' => $newer->toIso8601String(),
                'updated_at' => $newer->toIso8601String(),
                'deleted_at' => null,
            ]],
        ];

        $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->postJson('/api/v1/sync/push', $payload)
            ->assertStatus(200)
            ->assertJsonPath('expenses.0.description', 'new description')
            ->assertJsonPath('expenses.0.amount_cents', 999);

        $fresh = Expense::withoutGlobalScopes()->where('client_id', $clientId)->first();
        $this->assertSame('new description', $fresh->description);
        $this->assertSame(999, $fresh->amount_cents);
    }

    public function test_push_skips_when_server_is_newer(): void
    {
        $tenant = Tenant::factory()->create();
        $clientId = (string) Str::uuid();

        $future = now()->addHour()->startOfSecond();
        $expense = Expense::factory()->for($tenant)->create([
            'client_id' => $clientId,
            'description' => 'server-side value',
            'amount_cents' => 500,
        ]);
        Expense::withoutGlobalScopes()->where('id', $expense->id)->update(['updated_at' => $future]);

        $older = now()->subDay()->startOfSecond();
        $payload = [
            'expenses' => [[
                'client_id' => $clientId,
                'description' => 'stale phone value',
                'amount_cents' => 1,
                'currency' => 'USD',
                'occurred_at' => $older->toIso8601String(),
                'updated_at' => $older->toIso8601String(),
                'deleted_at' => null,
            ]],
        ];

        $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->postJson('/api/v1/sync/push', $payload)
            ->assertStatus(200)
            ->assertJsonPath('expenses.0.description', 'server-side value')
            ->assertJsonPath('expenses.0.amount_cents', 500);

        $fresh = Expense::withoutGlobalScopes()->where('client_id', $clientId)->first();
        $this->assertSame('server-side value', $fresh->description);
        $this->assertSame(500, $fresh->amount_cents);
    }

    public function test_push_applies_soft_delete_tombstone(): void
    {
        $tenant = Tenant::factory()->create();
        $clientId = (string) Str::uuid();

        $oneHourAgo = now()->subHour()->startOfSecond();
        $expense = Expense::factory()->for($tenant)->create([
            'client_id' => $clientId,
            'description' => 'to be deleted',
            'deleted_at' => null,
        ]);
        Expense::withoutGlobalScopes()->where('id', $expense->id)->update(['updated_at' => $oneHourAgo]);

        $deletedAt = now()->startOfSecond();
        $payload = [
            'expenses' => [[
                'client_id' => $clientId,
                'description' => 'to be deleted',
                'amount_cents' => 100,
                'currency' => 'USD',
                'occurred_at' => $deletedAt->toIso8601String(),
                'updated_at' => $deletedAt->toIso8601String(),
                'deleted_at' => $deletedAt->toIso8601String(),
            ]],
        ];

        $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->postJson('/api/v1/sync/push', $payload)
            ->assertStatus(200);

        $fresh = Expense::withoutGlobalScopes()->where('client_id', $clientId)->first();
        $this->assertNotNull($fresh->deleted_at);
        $this->assertTrue($fresh->deleted_at->equalTo($deletedAt));
    }

    public function test_push_clamps_future_updated_at_beyond_24h(): void
    {
        $tenant = Tenant::factory()->create();
        $clientId = (string) Str::uuid();

        $farFuture = now()->addDays(2);

        $payload = [
            'expenses' => [[
                'client_id' => $clientId,
                'description' => 'time traveler',
                'amount_cents' => 100,
                'currency' => 'USD',
                'occurred_at' => now()->toIso8601String(),
                'updated_at' => $farFuture->toIso8601String(),
                'deleted_at' => null,
            ]],
        ];

        $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->postJson('/api/v1/sync/push', $payload)
            ->assertStatus(200);

        $fresh = Expense::withoutGlobalScopes()->where('client_id', $clientId)->first();
        $this->assertNotNull($fresh);

        /** @var Carbon $storedUpdatedAt */
        $storedUpdatedAt = $fresh->updated_at;
        $this->assertLessThanOrEqual(5, abs($storedUpdatedAt->diffInSeconds(now())));
    }
}
