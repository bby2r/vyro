<?php

namespace Database\Factories;

use App\Models\Tenant;
use App\Models\Todo;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Todo>
 */
class TodoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'client_id' => (string) Str::uuid(),
            'title' => fake()->sentence(4),
            'due_at' => fake()->optional()->dateTimeBetween('now', '+30 days'),
            'done' => false,
            'category' => null,
            'labels' => null,
            'estimated_minutes' => null,
            'deleted_at' => null,
        ];
    }
}
