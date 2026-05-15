<?php

namespace App\Services\Ai;

/**
 * Default categorizer used when AI_DRIVER=null (or any unrecognized value).
 *
 * Returns an empty categorization so the scheduled job runs cleanly and
 * leaves rows untouched until a real provider is configured.
 */
class NullCategorizer implements Categorizer
{
    /**
     * @return array{category: ?string, labels: array<int, string>, estimated_minutes: ?int}
     */
    public function categorize(string $text, string $kind): array
    {
        return [
            'category' => null,
            'labels' => [],
            'estimated_minutes' => null,
        ];
    }
}
