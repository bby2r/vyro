<?php

namespace Tests\Feature\Jobs;

use App\Jobs\CategorizeEntriesJob;
use App\Models\Expense;
use App\Models\Tenant;
use App\Models\Todo;
use App\Services\Ai\Categorizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategorizeEntriesJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_runs_cleanly_with_null_driver_and_makes_no_changes(): void
    {
        config(['ai.driver' => 'null']);
        $this->app->forgetInstance(Categorizer::class);

        $tenant = Tenant::factory()->create();

        $expenses = Expense::factory()
            ->count(3)
            ->for($tenant)
            ->create(['category' => null, 'labels' => null]);

        $todos = Todo::factory()
            ->count(2)
            ->for($tenant)
            ->create(['category' => null, 'labels' => null, 'estimated_minutes' => null]);

        (new CategorizeEntriesJob)->handle($this->app->make(Categorizer::class));

        foreach ($expenses as $expense) {
            $expense->refresh();
            $this->assertNull($expense->category);
            $this->assertSame([], $expense->labels);
        }

        foreach ($todos as $todo) {
            $todo->refresh();
            $this->assertNull($todo->category);
            $this->assertSame([], $todo->labels);
            $this->assertNull($todo->estimated_minutes);
        }
    }

    public function test_respects_batch_size(): void
    {
        config(['ai.batch_size' => 2]);

        $tenant = Tenant::factory()->create();

        Expense::factory()
            ->count(5)
            ->for($tenant)
            ->create(['category' => null, 'labels' => null]);

        $fake = new RecordingCategorizer([
            'category' => 'food',
            'labels' => ['lunch'],
            'estimated_minutes' => null,
        ]);
        $this->app->instance(Categorizer::class, $fake);

        (new CategorizeEntriesJob)->handle($fake);

        $this->assertSame(2, Expense::withoutGlobalScopes()->where('category', 'food')->count());
        $this->assertSame(3, Expense::withoutGlobalScopes()->whereNull('category')->count());
        $this->assertSame(2, $fake->callCount);
    }

    public function test_skips_already_categorized_rows(): void
    {
        $tenant = Tenant::factory()->create();

        Expense::factory()
            ->for($tenant)
            ->create(['category' => 'existing', 'labels' => ['preset']]);

        Expense::factory()
            ->for($tenant)
            ->create(['category' => null, 'labels' => null]);

        $fake = new RecordingCategorizer([
            'category' => 'food',
            'labels' => ['lunch'],
            'estimated_minutes' => null,
        ]);
        $this->app->instance(Categorizer::class, $fake);

        (new CategorizeEntriesJob)->handle($fake);

        $this->assertSame(1, $fake->callCount);
        $this->assertSame(1, Expense::withoutGlobalScopes()->where('category', 'existing')->count());
        $this->assertSame(1, Expense::withoutGlobalScopes()->where('category', 'food')->count());
        $this->assertSame(0, Expense::withoutGlobalScopes()->whereNull('category')->count());
    }

    public function test_respects_window_days(): void
    {
        config(['ai.window_days' => 7]);

        $tenant = Tenant::factory()->create();

        $old = Expense::factory()
            ->for($tenant)
            ->create(['category' => null, 'labels' => null]);
        // Backdate created_at past the configured window without bumping updated_at.
        $old->forceFill(['created_at' => now()->subDays(30), 'updated_at' => now()->subDays(30)])
            ->saveQuietly();

        Expense::factory()
            ->for($tenant)
            ->create(['category' => null, 'labels' => null]);

        $fake = new RecordingCategorizer([
            'category' => 'food',
            'labels' => ['lunch'],
            'estimated_minutes' => null,
        ]);
        $this->app->instance(Categorizer::class, $fake);

        (new CategorizeEntriesJob)->handle($fake);

        $this->assertSame(1, $fake->callCount);
        $this->assertSame(1, Expense::withoutGlobalScopes()->where('category', 'food')->count());
        $this->assertSame(1, Expense::withoutGlobalScopes()->whereNull('category')->count());

        $old->refresh();
        $this->assertNull($old->category);
    }

    public function test_persists_todo_estimated_minutes(): void
    {
        $tenant = Tenant::factory()->create();

        Todo::factory()
            ->for($tenant)
            ->create(['category' => null, 'labels' => null, 'estimated_minutes' => null]);

        $fake = new RecordingCategorizer([
            'category' => 'work',
            'labels' => ['writing'],
            'estimated_minutes' => 45,
        ]);
        $this->app->instance(Categorizer::class, $fake);

        (new CategorizeEntriesJob)->handle($fake);

        $todo = Todo::withoutGlobalScopes()->where('category', 'work')->firstOrFail();
        $this->assertSame(['writing'], $todo->labels);
        $this->assertSame(45, $todo->estimated_minutes);
    }

    public function test_continues_when_one_row_throws(): void
    {
        $tenant = Tenant::factory()->create();

        Expense::factory()
            ->count(3)
            ->for($tenant)
            ->create(['category' => null, 'labels' => null]);

        $fake = new ThrowOnNthCategorizer(2);
        $this->app->instance(Categorizer::class, $fake);

        (new CategorizeEntriesJob)->handle($fake);

        $this->assertSame(3, $fake->callCount);
        // Two rows succeeded (calls #1 and #3), one threw (call #2).
        $this->assertSame(2, Expense::withoutGlobalScopes()->where('category', 'ok')->count());
        $this->assertSame(1, Expense::withoutGlobalScopes()->whereNull('category')->count());
    }

    public function test_iterates_every_tenant(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        Expense::factory()->for($tenantA)->create(['category' => null, 'labels' => null]);
        Expense::factory()->for($tenantB)->create(['category' => null, 'labels' => null]);

        $fake = new RecordingCategorizer([
            'category' => 'misc',
            'labels' => [],
            'estimated_minutes' => null,
        ]);
        $this->app->instance(Categorizer::class, $fake);

        (new CategorizeEntriesJob)->handle($fake);

        $this->assertSame(2, $fake->callCount);
        $this->assertSame(2, Expense::withoutGlobalScopes()->where('category', 'misc')->count());

        // The global scope binding must be cleared between tenants.
        $this->assertFalse($this->app->bound('current.tenant'));
    }
}

/**
 * Test double: records every call and returns a preset categorization.
 */
class RecordingCategorizer implements Categorizer
{
    public int $callCount = 0;

    /** @var array<int, array{text: string, kind: string}> */
    public array $calls = [];

    /**
     * @param  array{category: ?string, labels: array<int, string>, estimated_minutes: ?int}  $payload
     */
    public function __construct(public array $payload) {}

    public function categorize(string $text, string $kind): array
    {
        $this->callCount++;
        $this->calls[] = ['text' => $text, 'kind' => $kind];

        return $this->payload;
    }
}

/**
 * Test double: throws on the Nth call, returns success on every other call.
 */
class ThrowOnNthCategorizer implements Categorizer
{
    public int $callCount = 0;

    public function __construct(public int $throwOn) {}

    public function categorize(string $text, string $kind): array
    {
        $this->callCount++;

        if ($this->callCount === $this->throwOn) {
            throw new \RuntimeException('simulated provider failure');
        }

        return [
            'category' => 'ok',
            'labels' => [],
            'estimated_minutes' => null,
        ];
    }
}
