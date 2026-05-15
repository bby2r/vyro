<?php

namespace Tests\Feature\Api;

use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantTransferTest extends TestCase
{
    use RefreshDatabase;

    public function test_transfer_renames_uuid(): void
    {
        $tenant = Tenant::factory()->create();
        $oldUuid = $tenant->uuid;
        $newUuid = (string) Str::uuid();

        $response = $this->withHeader('X-Tenant-UUID', $oldUuid)
            ->postJson('/api/v1/tenant/transfer', ['new_uuid' => $newUuid]);

        $response->assertStatus(200)
            ->assertJsonPath('uuid', $newUuid);

        $this->assertDatabaseHas('tenants', ['id' => $tenant->id, 'uuid' => $newUuid]);
        $this->assertDatabaseMissing('tenants', ['uuid' => $oldUuid]);
    }

    public function test_transfer_rejects_uuid_already_in_use(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $response = $this->withHeader('X-Tenant-UUID', $tenantA->uuid)
            ->postJson('/api/v1/tenant/transfer', ['new_uuid' => $tenantB->uuid]);

        $response->assertStatus(409)
            ->assertExactJson(['error' => 'uuid already in use']);

        // Original UUIDs unchanged.
        $this->assertDatabaseHas('tenants', ['id' => $tenantA->id, 'uuid' => $tenantA->uuid]);
        $this->assertDatabaseHas('tenants', ['id' => $tenantB->id, 'uuid' => $tenantB->uuid]);
    }

    public function test_me_returns_current_tenant(): void
    {
        $tenant = Tenant::factory()->create(['last_synced_at' => null, 'label' => 'phone-1']);

        $response = $this->withHeader('X-Tenant-UUID', $tenant->uuid)
            ->getJson('/api/v1/tenant/me');

        $response->assertStatus(200)
            ->assertJsonPath('uuid', $tenant->uuid)
            ->assertJsonPath('label', 'phone-1');

        $lastSyncedAt = $response->json('last_synced_at');
        $this->assertIsString($lastSyncedAt);

        $tenant->refresh();
        $this->assertNotNull($tenant->last_synced_at);
        $this->assertLessThanOrEqual(5, abs($tenant->last_synced_at->diffInSeconds(now())));
    }
}
