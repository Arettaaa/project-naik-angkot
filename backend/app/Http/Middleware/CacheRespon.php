<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Simpan respon GET JSON di cache file (data trayek & kepadatan statis, query PostGIS-nya berat),
 * lalu kirim terkompresi gzip kalau browser mendukung (GeoJSON kepadatan ±3 MB -> ±0,4 MB).
 * Cache otomatis diperbarui setelah data dimuat ulang (lihat versiData). Hapus manual: php artisan cache:clear file
 */
class CacheRespon
{
    public function handle(Request $request, Closure $next, string $menit = '1440'): Response
    {
        if (!$request->isMethod('GET')) {
            return $next($request);
        }

        $store = Cache::store('file');
        $key = 'naik:' . self::versiData() . ':' . sha1($request->fullUrl());
        $isi = $store->get($key);
        $status = 'HIT';

        if ($isi === null) {
            $res = $next($request);
            if ($res->getStatusCode() !== 200 || !str_contains((string) $res->headers->get('Content-Type'), 'json')) {
                return $res;
            }
            $isi = $res->getContent();
            if ($isi !== '[]') { // hasil kosong tidak disimpan (mis. sumber sedang gagal), biar dicoba lagi
                $store->put($key, $isi, now()->addMinutes((int) $menit));
            }
            $status = 'MISS';
        }

        $headers = ['Content-Type' => 'application/json', 'X-Naik-Cache' => $status, 'Vary' => 'Accept-Encoding'];
        if (strlen($isi) > 20000 && str_contains((string) $request->header('Accept-Encoding'), 'gzip') && function_exists('gzencode')) {
            $isi = gzencode($isi, 6);
            $headers['Content-Encoding'] = 'gzip';
        }

        return response($isi, 200, $headers);
    }

    /**
     * Versi data = OID tabel naik.rute & naik.ruas_jalan. buat_skema_rute_v4.py men-DROP lalu membuat ulang
     * tabel-tabel ini, jadi OID-nya berubah setiap data dimuat ulang -> cache lama otomatis tidak terpakai.
     */
    private static function versiData(): string
    {
        try {
            $v = DB::selectOne("SELECT COALESCE(to_regclass('naik.rute')::oid, 0) || '-' || COALESCE(to_regclass('naik.ruas_jalan')::oid, 0) AS v");
            return (string) $v->v;
        } catch (\Throwable) {
            return '0';
        }
    }
}