
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TrayekController;

Route::get('/trayek', [TrayekController::class, 'index']);
Route::get('/kepadatan-trayek', [TrayekController::class, 'kepadatan']);
