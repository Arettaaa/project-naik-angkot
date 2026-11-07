<?php

use App\Http\Controllers\Api\AiRekomendasiController;
use App\Http\Controllers\Api\PoiController;
use App\Http\Controllers\Api\RekomendasiKoridorController;
use App\Http\Controllers\Api\TrayekController;
use App\Http\Middleware\CacheRespon;
use Illuminate\Support\Facades\Route;

// data statis (trayek, rute, kepadatan, hasil cari tempat) -> di-cache 1 hari + gzip
Route::middleware(CacheRespon::class . ':1440')->group(function () {
    Route::get('/trayek', [TrayekController::class, 'trayek']);
    Route::get('/trayek/{kode}', [TrayekController::class, 'detail']);
    Route::get('/rute', [TrayekController::class, 'rute']);
    Route::get('/kepadatan', [TrayekController::class, 'kepadatan']);
    Route::get('/kepadatan/ringkasan', [TrayekController::class, 'ringkasan']);
});
Route::get('/poi', [PoiController::class, 'cari'])->middleware(CacheRespon::class . ':360');
Route::get('/alamat', [PoiController::class, 'alamat'])->middleware(CacheRespon::class . ':10080');

Route::get('/rekomendasi', [TrayekController::class, 'rekomendasi']);
Route::get('/rekomendasi/koridor/{kode}', [RekomendasiKoridorController::class, 'index']);
Route::post('/ai/rekomendasi', AiRekomendasiController::class);
