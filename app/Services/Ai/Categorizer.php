<?php

namespace App\Services\Ai;

interface Categorizer
{
    /**
     * Categorize a user-entered text into a category, labels, and (for todos) an effort estimate.
     *
     * @param  string  $text  The user-entered text (description for expenses, title for todos)
     * @param  string  $kind  'expense' | 'todo'
     * @return array{category: ?string, labels: array<int, string>, estimated_minutes: ?int}
     *                                                                                       `estimated_minutes` is only meaningful for todos; expenses must return null.
     */
    public function categorize(string $text, string $kind): array;
}
