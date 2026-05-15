<?php

namespace Tests\Unit\Services\Ai;

use App\Services\Ai\NullCategorizer;
use PHPUnit\Framework\TestCase;

class NullCategorizerTest extends TestCase
{
    public function test_returns_empty_shape_for_expense(): void
    {
        $categorizer = new NullCategorizer;

        $result = $categorizer->categorize('coffee at the cafe', 'expense');

        $this->assertSame(
            ['category' => null, 'labels' => [], 'estimated_minutes' => null],
            $result,
        );
    }

    public function test_returns_empty_shape_for_todo(): void
    {
        $categorizer = new NullCategorizer;

        $result = $categorizer->categorize('write annual review', 'todo');

        $this->assertSame(
            ['category' => null, 'labels' => [], 'estimated_minutes' => null],
            $result,
        );
    }

    public function test_is_deterministic_across_calls(): void
    {
        $categorizer = new NullCategorizer;

        $first = $categorizer->categorize('lunch', 'expense');
        $second = $categorizer->categorize('lunch', 'expense');
        $third = $categorizer->categorize('different text entirely', 'todo');

        $this->assertSame($first, $second);
        $this->assertSame($first, $third);
    }
}
