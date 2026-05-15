<?php

namespace App\Services\Ai;

use RuntimeException;

/**
 * Stub for the Ollama (local) provider.
 *
 * The HTTP request shape is sketched below in {@see buildRequest()} for the
 * future implementer. To finish this adapter:
 *   1. Uncomment / replace the body of categorize() with a Http::timeout(30)
 *      ->post($this->base.'/api/chat', $payload) call.
 *   2. Parse the JSON response (Ollama returns {message: {content: "..."}})
 *      and normalize to the Categorizer return shape.
 *   3. Remove the RuntimeException at the end.
 *
 * Do NOT add a new composer package — use Laravel's built-in Http facade.
 */
class OllamaCategorizer implements Categorizer
{
    public function __construct(
        protected string $base,
        protected string $model,
    ) {}

    /**
     * @return array{category: ?string, labels: array<int, string>, estimated_minutes: ?int}
     */
    public function categorize(string $text, string $kind): array
    {
        // Future implementer: replace this with a real HTTP call.
        // $payload = $this->buildRequest($text, $kind);
        // $response = Http::timeout(30)->post(rtrim($this->base, '/').'/api/chat', $payload);
        // return $this->parseResponse($response->json(), $kind);

        throw new RuntimeException(
            'OllamaCategorizer not implemented yet — set AI_DRIVER=null or provide an implementation in app/Services/Ai/OllamaCategorizer.php'
        );
    }

    /**
     * Sketch of the Ollama /api/chat payload. Uses format=json so the model
     * returns valid JSON without surrounding prose.
     *
     * @return array<string, mixed>
     */
    protected function buildRequest(string $text, string $kind): array
    {
        $system = 'You categorize personal '.$kind.' entries. '
            .'Reply with ONLY a JSON object of the shape '
            .'{"category": string|null, "labels": string[], "estimated_minutes": number|null}. '
            .'For expenses, set estimated_minutes to null. '
            .'Keep category short (1-2 words, lowercase). Labels are 0-3 short tags.';

        return [
            'model' => $this->model,
            'format' => 'json',
            'stream' => false,
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $text],
            ],
        ];
    }
}
