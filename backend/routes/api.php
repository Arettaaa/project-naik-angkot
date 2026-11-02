<?php

use App\Http\Controllers\Api\TrayekController;
use Illuminate\Support\Facades\Route;

Route::get('/trayek', [TrayekController::class, 'trayek']);
Route::get('/trayek/{kode}', [TrayekController::class, 'detail']);
Route::get('/rute', [TrayekController::class, 'rute']);
Route::get('/kepadatan', [TrayekController::class, 'kepadatan']);
Route::get('/kepadatan/ringkasan', [TrayekController::class, 'ringkasan']);
Route::get('/rekomendasi', [TrayekController::class, 'rekomendasi']);