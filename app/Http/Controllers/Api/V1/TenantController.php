<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    public function me(): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current.tenant');

        $tenant->last_synced_at = now();
        $tenant->save();

        return response()->json([
            'uuid' => $tenant->uuid,
            'label' => $tenant->label,
            'last_synced_at' => $tenant->last_synced_at?->toIso8601String(),
        ]);
    }

    public function transfer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'new_uuid' => ['required', 'uuid'],
        ]);

        /** @var Tenant $tenant */
        $tenant = app('current.tenant');

        $newUuid = $data['new_uuid'];

        if ($newUuid === $tenant->uuid) {
            return response()->json(['uuid' => $tenant->uuid]);
        }

        $conflict = Tenant::query()->where('uuid', $newUuid)->exists();

        if ($conflict) {
            return response()->json(['error' => 'uuid already in use'], 409);
        }

        $tenant->uuid = $newUuid;
        $tenant->save();

        return response()->json(['uuid' => $tenant->uuid]);
    }
}
