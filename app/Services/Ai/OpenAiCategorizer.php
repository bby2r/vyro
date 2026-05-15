<?php

namespace App\Services\Ai;

use RuntimeException;

/**
 * Stub for the OpenAI Chat Completions provider.
 *
 * The HTTP request shape is sketched below in {@see buildRequest()} for the
 * future implementer. To finish this adapter:
 *   1. Uncomment / replace the body of categorize() with a Http::withHeaders()
 *      ->timeout(30)->post() call to https://api.openai.com/v1/chat/completions
 *   2. Parse the JSON response and normalize to the Categorizer return shape.
 *   3. Remove the RuntimeException at the end.
 *
 * Do NOT add a new composer package — use Laravel's built-in Http facade.
 */
class OpenAiCategorizer implements Categorizer
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
        //     'Authorization' => 'Bearer '.$this->key,
        //     'Content-Type' => 'application/json',
        // ])->timeout(30)->post('https://api.openai.com/v1/chat/completions', $payload);
        // return $this->parseResponse($response->json(), $kind);

        throw new RuntimeException(
            'OpenAiCategorizer not implemented yet — set AI_DRIVER=null or provide an implementation in app/Services/Ai/OpenAiCategorizer.php'
        );
    }

    /**
     * Sketch of the OpenAI Chat Completions payload. Asks the model to return
     * a strict JSON object via response_format=json_object.
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
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $text],
            ],
        ];
    }
}
