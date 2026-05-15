<?php

namespace App\Providers;

use App\Services\Ai\Categorizer;
use App\Services\Ai\ClaudeCategorizer;
use App\Services\Ai\NullCategorizer;
use App\Services\Ai\OllamaCategorizer;
use App\Services\Ai\OpenAiCategorizer;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(Categorizer::class, function ($app): Categorizer {
            $config = $app['config']['ai'];

            return match ($config['driver']) {
                'claude' => new ClaudeCategorizer($config['claude']['key'] ?? '', $config['claude']['model']),
                'openai' => new OpenAiCategorizer($config['openai']['key'] ?? '', $config['openai']['model']),
                'ollama' => new OllamaCategorizer($config['ollama']['base'], $config['ollama']['model']),
                default => new NullCategorizer,
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
