<?php

namespace App\Services\Ai;

use RuntimeException;

/**
 * Stub for the Anthropic Claude provider.
 *
 * The HTTP request shape is sketched below in {@see buildRequest()} for the
 * future implementer. To finish this adapter:
 *   1. Uncomment / replace the body of categorize() with a Http::withHeaders()
 *      ->timeout(30)->post() call to https://api.anthropic.com/v1/messages
 *   2. Parse the JSON response and normalize to the Categorizer return shape.
 *   3. Remove the RuntimeException at the end.
 *
 * Do NOT add a new composer package — use Laravel's built-in Http facade.
 */
class ClaudeCategorizer implements Categorizer
{
    public function __construct(
        protected string $key,
        protected string $model,
    ) {}

    /**
     * @return array{category: ?string, labels: array<int, string>, estimated_minutes: ?int}
     */
    public function categorize(string $text, string $kind): array
    {
        // Future implementer: replace this with a real HTTP call.
        // $payload = $this->buildRequest($text, $kind);
        // $response = Http::withHeaders([
        //     'x-api-key' => $this->key,
        //     'anthropic-version' => '2023-06-01',
        //     'content-type' => 'application/json',
        // ])->timeout(30)->post('https://api.anthropic.com/v1/messages', $payload);
        // return $this->parseResponse($response->json(), $kind);

        throw new RuntimeException(
            'ClaudeCategorizer not implemented yet — set AI_DRIVER=null or provide an implementation in app/Services/Ai/ClaudeCategorizer.php'
        );
    }

    /**
     * Sketch of the Anthropic Messages API payload. Asks the model to return
     * a strict JSON object so the caller can decode without parsing prose.
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
            'max_tokens' => 200,
            'system' => $system,
            'messages' => [
                ['role' => 'user', 'content' => $text],
            ],
        ];
    }
}
