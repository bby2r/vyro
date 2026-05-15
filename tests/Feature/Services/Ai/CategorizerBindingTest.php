<?php

namespace Tests\Feature\Services\Ai;

use App\Services\Ai\Categorizer;
use App\Services\Ai\ClaudeCategorizer;
use App\Services\Ai\NullCategorizer;
use App\Services\Ai\OllamaCategorizer;
use App\Services\Ai\OpenAiCategorizer;
use RuntimeException;
use Tests\TestCase;

class CategorizerBindingTest extends TestCase
{
    /**
     * The container caches the resolved Categorizer instance; clear it before
     * each driver-specific assertion so the binding callback re-runs with the
     * updated config value.
     */
    protected function refreshCategorizerBinding(string $driver): void
    {
        config(['ai.driver' => $driver]);
        $this->app->forgetInstance(Categorizer::class);
    }

    public function test_default_driver_resolves_null_categorizer(): void
    {
        $this->refreshCategorizerBinding('null');

        $this->assertInstanceOf(NullCategorizer::class, $this->app->make(Categorizer::class));
    }

    public function test_unknown_driver_falls_back_to_null_categorizer(): void
    {
        $this->refreshCategorizerBinding('totally-bogus-driver');

        $this->assertInstanceOf(NullCategorizer::class, $this->app->make(Categorizer::class));
    }

    public function test_claude_driver_resolves_claude_categorizer(): void
    {
        $this->refreshCategorizerBinding('claude');

        $this->assertInstanceOf(ClaudeCategorizer::class, $this->app->make(Categorizer::class));
    }

    public function test_openai_driver_resolves_openai_categorizer(): void
    {
        $this->refreshCategorizerBinding('openai');

        $this->assertInstanceOf(OpenAiCategorizer::class, $this->app->make(Categorizer::class));
    }

    public function test_ollama_driver_resolves_ollama_categorizer(): void
    {
        $this->refreshCategorizerBinding('ollama');

        $this->assertInstanceOf(OllamaCategorizer::class, $this->app->make(Categorizer::class));
    }

    public function test_claude_categorizer_throws_not_implemented(): void
    {
        $categorizer = new ClaudeCategorizer('test-key', 'claude-haiku-4-5');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('ClaudeCategorizer not implemented yet');

        $categorizer->categorize('coffee', 'expense');
    }

    public function test_openai_categorizer_throws_not_implemented(): void
    {
        $categorizer = new OpenAiCategorizer('test-key', 'gpt-4o-mini');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('OpenAiCategorizer not implemented yet');

        $categorizer->categorize('coffee', 'expense');
    }

    public function test_ollama_categorizer_throws_not_implemented(): void
    {
        $categorizer = new OllamaCategorizer('http://127.0.0.1:11434', 'qwen2.5:3b');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('OllamaCategorizer not implemented yet');

        $categorizer->categorize('coffee', 'expense');
    }
}
