<?php

use App\Http\Middleware\ResolveTenant;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware([ResolveTenant::class])->group(function (): void {
    Route::get('ping', fn () => ['ok' => true]);
});
