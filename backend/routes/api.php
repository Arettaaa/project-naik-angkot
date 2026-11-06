<?php

use App\Http\Controllers\Api\AiRekomendasiController;
use App\Http\Controllers\Api\PoiController;
use App\Http\Controllers\Api\RekomendasiKoridorController;
use App\Http\Controllers\Api\TrayekController;
use Illuminate\Support\Facades\Route;

Route::get('/trayek', [TrayekController::class, 'trayek']);
Route::get('/trayek/{kode}', [TrayekController::class, 'detail']);
Route::get('/rute', [TrayekController::class, 'rute']);
Route::get('/kepadatan', [TrayekController::class, 'kepadatan']);
Route::get('/kepadatan/ringkasan', [TrayekController::class, 'ringkasan']);
Route::get('/rekomendasi', [TrayekController::class, 'rekomendasi']);
Route::get('/poi', [PoiController::class, 'cari']);
Route::get('/rekomendasi/koridor/{kode}', [RekomendasiKoridorController::class, 'index']);
Route::post('/ai/rekomendasi', AiRekomendasiController::class);

