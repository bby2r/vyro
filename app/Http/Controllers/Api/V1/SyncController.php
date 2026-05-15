<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncPushRequest;
use App\Http\Resources\ExpenseResource;
use App\Http\Resources\TodoResource;
use App\Models\Tenant;
use App\Services\Sync\SyncService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SyncController extends Controller
{
    public function push(SyncPushRequest $request, SyncService $sync): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current.tenant');

        /** @var array<int, array<string, mixed>> $expenses */
        $expenses = $request->validated('expenses', []);
        /** @var array<int, array<string, mixed>> $todos */
        $todos = $request->validated('todos', []);

        [$canonicalExpenses, $canonicalTodos] = DB::transaction(function () use ($sync, $tenant, $expenses, $todos): array {
            return [
                $sync->pushExpenses($tenant, $expenses),
                $sync->pushTodos($tenant, $todos),
            ];
        });

        return response()->json([
            'expenses' => ExpenseResource::collection($canonicalExpenses)->resolve(),
            'todos' => TodoResource::collection($canonicalTodos)->resolve(),
        ]);
    }

    public function pull(Request $request, SyncService $sync): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current.tenant');

        $sinceRaw = $request->query('since');
        $since = is_string($sinceRaw) && $sinceRaw !== '' ? Carbon::parse($sinceRaw) : null;

        $result = $sync->pullSince($tenant, $since);

        return response()->json([
            'server_time' => $result['server_time'],
            'expenses' => ExpenseResource::collection($result['expenses'])->resolve(),
            'todos' => TodoResource::collection($result['todos'])->resolve(),
        ]);
    }
}
