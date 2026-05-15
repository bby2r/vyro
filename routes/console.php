<?php

use App\Jobs\CategorizeEntriesJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new CategorizeEntriesJob)->twiceDaily(9, 21)->name('ai-categorize')->withoutOverlapping();
