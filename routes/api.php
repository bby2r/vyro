<?php

use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Middleware\ResolveTenant;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware([ResolveTenant::class])->group(function (): void {
    Route::post('sync/push', [SyncController::class, 'push']);
    Route::get('sync/pull', [SyncController::class, 'pull']);
    Route::post('tenant/transfer', [TenantController::class, 'transfer']);
    Route::get('tenant/me', [TenantController::class, 'me']);
});
