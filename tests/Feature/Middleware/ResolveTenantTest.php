<?php

namespace Tests\Feature\Middleware;

use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ResolveTenantTest extends TestCase
{
    use RefreshDatabase;

    public function test_missing_header_returns_400_with_error_json(): void
    {
        $response = $this->getJson('/api/v1/ping');

        $response->assertStatus(400)
            ->assertExactJson(['error' => 'missing X-Tenant-UUID header']);
    }

    public function test_invalid_uuid_header_returns_400(): void
    {
        $response = $this->getJson('/api/v1/ping', ['X-Tenant-UUID' => 'not-a-uuid']);

        $response->assertStatus(400)
            ->assertExactJson(['error' => 'missing X-Tenant-UUID header']);
    }

    public function test_new_uuid_creates_tenant_and_returns_200(): void
    {
        $uuid = (string) Str::uuid();

        $this->assertDatabaseCount('tenants', 0);

        $response = $this->getJson('/api/v1/ping', ['X-Tenant-UUID' => $uuid]);

        $response->assertStatus(200)
            ->assertExactJson(['ok' => true]);

        $this->assertDatabaseHas('tenants', ['uuid' => $uuid]);
        $this->assertSame(1, Tenant::count());
    }

    public function test_existing_uuid_does_not_create_new_tenant(): void
    {
        $tenant = Tenant::factory()->create();
        $initialCount = Tenant::count();

        $response = $this->getJson('/api/v1/ping', ['X-Tenant-UUID' => $tenant->uuid]);

        $response->assertStatus(200)
            ->assertExactJson(['ok' => true]);

        $this->assertSame($initialCount, Tenant::count());
    }
}
