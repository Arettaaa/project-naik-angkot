<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class RekomendasiRoutingService
{
    public const TARIF_UMUM = "SELECT COALESCE((SELECT tarif FROM naik.tarif_rute WHERE tarif IS NOT NULL
                                 GROUP BY tarif ORDER BY COUNT(*) DESC, tarif LIMIT 1), 5000) AS tarif";

    public const LINE = "CASE WHEN GeometryType(ST_LineMerge(g.geom)) = 'LINESTRING'
                               THEN ST_LineMerge(g.geom) ELSE ST_GeometryN(ST_LineMerge(g.geom), 1) END";

    /**
     * Mempersiapkan materialized view geometri rute dan titik transfer (UTM 48S).
     */
    public function siapkanGarisRute(): void
    {
        $line = self::LINE;
        $ada = DB::selectOne("SELECT to_regclass('naik.mv_rute_garis') IS NOT NULL AS g,
                                     to_regclass('naik.mv_transfer_rute') IS NOT NULL AS t");
        try {
            if ($ada->g) {
                $cek = DB::selectOne("SELECT
                    EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'naik.mv_rute_garis'::regclass
                            AND attname = 'arah' AND NOT attisdropped) AS lama,
                    (SELECT COUNT(*) FROM naik.mv_rute_garis) <> (SELECT COUNT(*) FROM naik.rute_geometri) AS beda_g,
                    " . ($ada->t ? "(SELECT COUNT(DISTINCT transfer_id) FROM naik.mv_transfer_rute)
                        <> (SELECT COUNT(*) FROM naik.titik_transfer)" : 'false') . " AS beda_t");
                if ($cek->lama) {
                    DB::statement('DROP MATERIALIZED VIEW IF EXISTS naik.mv_rute_garis CASCADE');
                    $ada->g = $ada->t = false;
                } elseif ($cek->beda_g) {
                    DB::statement('REFRESH MATERIALIZED VIEW naik.mv_rute_garis');
                    if ($ada->t) {
                        DB::statement('REFRESH MATERIALIZED VIEW naik.mv_transfer_rute');
                    }
                } elseif ($cek->beda_t) {
                    DB::statement('REFRESH MATERIALIZED VIEW naik.mv_transfer_rute');
                }
            }
            if (!$ada->g) {
                DB::statement("CREATE MATERIALIZED VIEW IF NOT EXISTS naik.mv_rute_garis AS
                    SELECT ru.rute_id, ru.kode_trayek,
                           ST_Transform($line, 32748) AS g,
                           ST_Length(ST_Transform($line, 32748)) AS len
                    FROM naik.rute ru JOIN naik.rute_geometri g ON g.rute_id = ru.rute_id");
                DB::statement("CREATE INDEX IF NOT EXISTS idx_mv_rute_garis_g ON naik.mv_rute_garis USING GIST (g)");
                DB::statement("CREATE INDEX IF NOT EXISTS idx_mv_rute_garis_id ON naik.mv_rute_garis (rute_id)");
            }
            if (!$ada->t) {
                DB::statement("CREATE MATERIALIZED VIEW IF NOT EXISTS naik.mv_transfer_rute AS
                    SELECT tt.transfer_id, r.rute_id, r.kode_trayek,
                           ST_LineLocatePoint(r.g, ST_Transform(tt.geom, 32748)) AS f,
                           ST_Distance(r.g, ST_Transform(tt.geom, 32748)) AS d
                    FROM naik.titik_transfer tt
                    JOIN naik.mv_rute_garis r ON r.kode_trayek IN (tt.trayek_a, tt.trayek_b)");
                DB::statement("CREATE INDEX IF NOT EXISTS idx_mv_transfer_rute_rute ON naik.mv_transfer_rute (rute_id, f)");
                DB::statement("CREATE INDEX IF NOT EXISTS idx_mv_transfer_rute_tt ON naik.mv_transfer_rute (transfer_id)");
            }
        } catch (\Throwable $e) {
            if (!str_contains($e->getMessage(), 'already exists')) {
                throw $e;
            }
        }
    }

    /**
     * Hitung rekomendasi rute angkot (Dijkstra + Yen) antara titik asal dan tujuan.
     *
     * @param array{0: float, 1: float} $asal [lat, lon]
     * @param array{0: float, 1: float} $tujuan [lat, lon]
     * @param float $rad Jarak jalan kaki maksimum ke jalur (meter)
     * @return array<string, mixed>
     */
    public function cariRute(array $asal, array $tujuan, float $rad = 800): array
    {
        $rad = min(max($rad, 100), 1500);
        $this->siapkanGarisRute();
        $t0 = microtime(true);

        $g = new PencariRuteDijkstra($asal, $tujuan, $rad);
        $g->bangun();

        // Yen dua tahap: sampai 2 angkot, lalu 3 angkot
        $g->maksAngkot = 2;
        $hasilYen = $g->yen(12);
        $g->maksAngkot = 3;
        foreach ($g->yen(10) as $p) {
            if (count($p['sisi']) === 3) {
                $hasilYen[] = $p;
            }
        }

        // Jalur tercepat dengan bobot waktu asli
        $g->bobot = 'menit';
        $cepat = $g->dijkstra('O');
        $g->bobot = 'w';
        if ($cepat) {
            $hasilYen[] = ['biaya' => array_sum(array_map(fn ($id) => $g->sisi($id)['w'], $cepat[1])), 'sisi' => $cepat[1]];
        }
        usort($hasilYen, fn ($x, $y) => $x['biaya'] <=> $y['biaya']);

        $ruteLangsung = [];
        foreach ($hasilYen as $p) {
            if (count($p['sisi']) === 1) {
                $ruteLangsung[$g->sisi($p['sisi'][0])['rute']] = $p['biaya'];
            }
        }

        $opsi = [];
        $urutanKode = [];
        foreach ($hasilYen as $p) {
            $leg = array_map(fn ($id) => $g->sisi($id), $p['sisi']);
            $kode = array_column($leg, 'kode');
            $kunci = implode('>', $kode);
            if (isset($urutanKode[$kunci]) || count(array_unique($kode)) < count($kode)) {
                continue;
            }
            if (count($leg) > 1 && isset($ruteLangsung[end($leg)['rute']]) && $p['biaya'] > $ruteLangsung[end($leg)['rute']] - 1) {
                continue;
            }
            $urutanKode[$kunci] = true;
            $opsi[] = ['skor' => $p['biaya'], 'menit' => array_sum(array_column($leg, 'menit')), 'leg' => $leg];
        }

        $grup = [1 => [], 2 => [], 3 => []];
        foreach ($opsi as $o) {
            $grup[count($o['leg'])][] = $o;
        }

        $terbaik = fn ($n) => $grup[$n] ? min(array_column($grup[$n], 'skor')) : INF;
        $b1 = $terbaik(1);
        $b2 = $terbaik(2);
        $grup[1] = array_slice($grup[1], 0, 5);

        $jalan = fn ($o) => array_sum(array_map(fn ($e) => $e['d1'] + $e['d2'], $o['leg']));
        $jalanB1 = $grup[1] ? $jalan(array_reduce($grup[1], fn ($c, $o) => $c === null || $o['skor'] < $c['skor'] ? $o : $c)) : 0;
        $grup[2] = array_slice(array_values(array_filter($grup[2],
            fn ($o) => $o['skor'] <= $b1 + 10 || ($jalanB1 >= 600 && $jalan($o) <= 0.6 * $jalanB1))), 0, 5);
        $grup[3] = array_slice(array_values(array_filter($grup[3],
            fn ($o) => (!$grup[1] && !$grup[2]) || $o['skor'] <= min($b1, $b2) - 5)), 0, 3);

        if ($opsi) {
            $cepat = array_reduce($opsi, fn ($c, $o) => $c === null || $o['menit'] < $c['menit'] ? $o : $c);
            $n = count($cepat['leg']);
            if (!in_array($cepat, $grup[$n], true)) {
                $grup[$n][] = $cepat;
                usort($grup[$n], fn ($x, $y) => $x['skor'] <=> $y['skor']);
            }
        }

        $nilai = [];
        $param = [];
        $titikId = [];
        foreach ($grup as $n => $os) {
            foreach ($os as $i => $o) {
                foreach ($o['leg'] as $j => $e) {
                    $nilai[] = '(?::text, ?::int, ?::float8, ?::float8)';
                    array_push($param, "$n-$i-$j", $e['rute'], $e['f1'], $e['f2']);
                    if ($e['v'] !== 'D') {
                        $titikId[] = (int) substr($e['v'], 1);
                    }
                }
            }
        }

        $geom = [];
        if ($nilai) {
            foreach (DB::select("SELECT v.k, ST_AsGeoJSON(ST_Transform(ST_LineSubstring(r.g, v.f1, v.f2), 4326), 6) AS gj
                                 FROM (VALUES " . implode(',', $nilai) . ") v(k, rid, f1, f2)
                                 JOIN naik.mv_rute_garis r ON r.rute_id = v.rid", $param) as $x) {
                $geom[$x->k] = json_decode($x->gj);
            }
        }

        $titik = [];
        if ($titikId) {
            $in = implode(',', array_fill(0, count($titikId), '?'));
            foreach (DB::select("SELECT transfer_id, ST_AsGeoJSON(geom, 6) AS gj FROM naik.titik_transfer WHERE transfer_id IN ($in)", $titikId) as $x) {
                $titik['t' . $x->transfer_id] = json_decode($x->gj);
            }
        }

        $tarifUmum = (int) DB::selectOne(self::TARIF_UMUM)->tarif;
        $tarif = [];
        foreach (DB::select('SELECT kode_trayek, tarif FROM naik.tarif_rute') as $x) {
            $tarif[$x->kode_trayek] = $x->tarif !== null ? (int) $x->tarif : $tarifUmum;
        }

        $keluaran = [1 => [], 2 => [], 3 => []];
        foreach ($grup as $n => $os) {
            foreach ($os as $i => $o) {
                $leg = $o['leg'];
                $legs = [];
                $pindah = [];
                foreach ($leg as $j => $e) {
                    [$kode, $arah, $nama] = $g->infoRute($e['rute']);
                    $legs[] = [
                        'kode_trayek' => $kode,
                        'rute_id' => $e['rute'],
                        'arah' => $arah,
                        'nama_trayek' => $nama,
                        'jarak_m' => (int) round($e['naik']),
                        'segmen' => $geom["$n-$i-$j"] ?? null,
                    ];
                    if ($j < count($leg) - 1) {
                        $pindah[] = [
                            'titik' => $titik[$e['v']] ?? null,
                            'jalan_m' => (int) round($e['d2'] + $leg[$j + 1]['d1']),
                        ];
                    }
                }

                $x = [
                    'menit' => (int) round($o['menit']),
                    'skor' => round($o['skor'], 1),
                    'jalan_ke_naik_m' => (int) round($leg[0]['d1']),
                    'jalan_dari_turun_m' => (int) round(end($leg)['d2']),
                    'tarif' => array_sum(array_map(fn ($l) => $tarif[$l['kode_trayek']] ?? $tarifUmum, $legs)),
                    'legs' => $legs,
                    'pindah' => $pindah,
                ];

                if ($n === 1) {
                    $x += [
                        'rute_id' => $legs[0]['rute_id'],
                        'kode_trayek' => $legs[0]['kode_trayek'],
                        'arah' => $legs[0]['arah'],
                        'nama_trayek' => $legs[0]['nama_trayek'],
                        'jarak_angkot_m' => $legs[0]['jarak_m'],
                        'segmen' => $legs[0]['segmen'],
                    ];
                } else {
                    $x['jalan_pindah_m'] = array_sum(array_column($pindah, 'jalan_m'));
                }

                if ($n === 2) {
                    $x += [
                        'kode_1' => $legs[0]['kode_trayek'],
                        'arah_1' => $legs[0]['arah'],
                        'kode_2' => $legs[1]['kode_trayek'],
                        'arah_2' => $legs[1]['arah'],
                        'jarak_angkot_1_m' => $legs[0]['jarak_m'],
                        'jarak_angkot_2_m' => $legs[1]['jarak_m'],
                        'titik_transfer' => $pindah[0]['titik'],
                        'segmen_1' => $legs[0]['segmen'],
                        'segmen_2' => $legs[1]['segmen'],
                    ];
                }

                $keluaran[$n][] = $x;
            }
        }

        $lurus = DB::selectOne("SELECT ROUND(ST_Distance(ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
                                                         ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)) AS m",
            [$asal[1], $asal[0], $tujuan[1], $tujuan[0]]);

        // Adaptive Radius: jika pada 800 m tidak ada rute sama sekali, coba perluas ke 1.200 m
        if (empty($keluaran[1]) && empty($keluaran[2]) && empty($keluaran[3]) && $rad <= 800) {
            $hasilRetry = $this->cariRute($asal, $tujuan, 1200);
            if (!empty($hasilRetry['langsung']) || !empty($hasilRetry['transfer']) || !empty($hasilRetry['transfer2'])) {
                $hasilRetry['catatan_radius'] = 'Rute ditemukan dengan memperluas radius jalan kaki (1.200 m).';
                return $hasilRetry;
            }
        }

        return [
            'asal' => ['lat' => $asal[0], 'lon' => $asal[1]],
            'tujuan' => ['lat' => $tujuan[0], 'lon' => $tujuan[1]],
            'radius_jalan_kaki_m' => $rad,
            'jarak_lurus_m' => (int) $lurus->m,
            'langsung' => $keluaran[1],
            'transfer' => $keluaran[2],
            'transfer2' => $keluaran[3],
            'metode' => [
                'nama' => 'Dijkstra + Yen pada graf trayek',
                'sisi_graf' => $g->jumlahSisi(),
                'jumlah_dijkstra' => $g->jumlahDijkstra,
                'waktu_ms' => (int) round((microtime(true) - $t0) * 1000),
            ],
            'catatan' => 'Urut dari perkiraan waktu: jalan kaki 4,5 km/jam, angkot 15 km/jam, tunggu 5 menit per angkot. Tarif flat per angkot.',
        ];
    }
}

