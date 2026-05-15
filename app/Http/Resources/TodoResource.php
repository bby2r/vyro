<?php

namespace App\Http\Resources;

use App\Models\Todo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Todo
 */
class TodoResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'client_id' => $this->client_id,
            'title' => $this->title,
            'due_at' => $this->due_at?->toIso8601String(),
            'done' => (bool) $this->done,
            'category' => $this->category,
            'labels' => $this->labels,
            'estimated_minutes' => $this->estimated_minutes,
            'updated_at' => $this->updated_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
