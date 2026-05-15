<?php

namespace Database\Factories;

use App\Models\Expense;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Expense>
 */
class ExpenseFactory extends Factory
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
            'description' => fake()->sentence(3),
            'amount_cents' => fake()->numberBetween(100, 100000),
            'currency' => 'USD',
            'category' => null,
            'labels' => null,
            'occurred_at' => fake()->dateTimeBetween('-30 days', 'now'),
            'deleted_at' => null,
        ];
    }
}
