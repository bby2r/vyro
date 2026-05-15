<?php

return [
    'driver' => env('AI_DRIVER', 'null'), // null | claude | openai | ollama

    'claude' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('CLAUDE_MODEL', 'claude-haiku-4-5'),
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
    ],

    'ollama' => [
        'base' => env('OLLAMA_BASE', 'http://127.0.0.1:11434'),
        'model' => env('OLLAMA_MODEL', 'qwen2.5:3b'),
    ],

    // Batch settings for the scheduled job:
    'batch_size' => env('AI_BATCH_SIZE', 50),
    'window_days' => env('AI_WINDOW_DAYS', 7), // only categorize rows from the last N days
];
