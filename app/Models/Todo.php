<?php

namespace App\Models;

use Database\Factories\TodoFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tombstones (rows with non-null deleted_at) are intentionally kept in queries
 * so sync push/pull can surface deletes to the client. We therefore do NOT use
 * the SoftDeletes trait — deleted_at is treated as a regular datetime column.
 */
class Todo extends Model
{
    /** @use HasFactory<TodoFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'client_id',
        'title',
        'due_at',
        'done',
        'category',
        'labels',
        'estimated_minutes',
        'deleted_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'done' => 'bool',
            'labels' => 'array',
            'estimated_minutes' => 'int',
            'deleted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder): void {
            if (app()->bound('current.tenant')) {
                $builder->where('tenant_id', app('current.tenant')->id);
            }
        });
    }

    /**
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
