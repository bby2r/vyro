<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SyncPushRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normalize missing arrays to empty arrays so wildcard rules don't false-fail.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'expenses' => $this->input('expenses', []),
            'todos' => $this->input('todos', []),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'expenses' => ['array'],
            'expenses.*.client_id' => ['required', 'uuid'],
            'expenses.*.description' => ['required', 'string', 'max:500'],
            'expenses.*.amount_cents' => ['required', 'integer', 'min:0'],
            'expenses.*.currency' => ['nullable', 'string', 'size:3'],
            'expenses.*.occurred_at' => ['required', 'date'],
            'expenses.*.updated_at' => ['required', 'date'],
            'expenses.*.deleted_at' => ['nullable', 'date'],

            'todos' => ['array'],
            'todos.*.client_id' => ['required', 'uuid'],
            'todos.*.title' => ['required', 'string', 'max:500'],
            'todos.*.due_at' => ['nullable', 'date'],
            'todos.*.done' => ['required', 'boolean'],
            'todos.*.updated_at' => ['required', 'date'],
            'todos.*.deleted_at' => ['nullable', 'date'],
        ];
    }
}
