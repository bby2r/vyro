<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenant
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $uuid = $request->header('X-Tenant-UUID');

        if (! is_string($uuid) || ! Str::isUuid($uuid)) {
            return response()->json(['error' => 'missing X-Tenant-UUID header'], 400);
        }

        $tenant = Tenant::firstOrCreate(['uuid' => $uuid]);

        app()->instance('current.tenant', $tenant);

        return $next($request);
    }
}
