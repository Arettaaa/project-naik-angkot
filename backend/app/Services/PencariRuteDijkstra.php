<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use SplPriorityQueue;

/**
 * Pencarian rute angkot dengan algoritme Dijkstra + Yen (k-shortest paths) pada GRAF TRAYEK.
 *
 * Graf (berarah, berbobot waktu dalam menit):
 *   - Node   : titik pindah (naik.titik_transfer), ditambah node asal "O" dan tujuan "D".
 *   - Sisi   : satu kali naik angkot pada satu rute (trayek + arah) dari titik i ke titik j yang
 *              dilewati SETELAH i (searah jalur angkot). Bobot sisi =
 *                  2 x (jalan kaki ke jalur + jalan kaki dari jalur) / 75 + tunggu 5 + jarak naik / 250
 *              (jalan kaki 4,5 km/jam, angkot 15 km/jam, tunggu 5 menit tiap naik angkot). Menit jalan kaki
 *              dihitung 2x lipat supaya rute tidak menyuruh jalan jauh; waktu yang ditampilkan tetap waktu asli.
 *              Sisi dari "O" = naik di jalur terdekat dari asal; sisi ke "D" = turun di jalur terdekat
 *              dari tujuan. Jalur trayek TIDAK diubah: yang dicari hanya kombinasi naik-turun-pindah.
 *   - Batas  : maksimal 3 angkot (2x pindah), tidak boleh lanjut dengan trayek yang sama.
 *
 * Dijkstra mencari rute tercepat. Yen mencari alternatif berikutnya dengan menyimpang (spur) dari
 * rute-rute sebelumnya; penyimpangan dilakukan per TRAYEK (sisi bertrayek sama dari spur node dibuang),
 * sehingga tiap alternatif memakai kombinasi angkot yang berbeda.
 */
class PencariRuteDijkstra
{
    public const JALAN = 75.0;      // m/menit
    public const ANGKOT = 250.0;    // m/menit
    public const TUNGGU = 5.0;      // menit per naik angkot
    public const PINDAH = 250.0;    // jarak maks titik pindah ke jalur (m)
    public const MIN_NAIK = 300.0;  // naik angkot kurang dari ini mending jalan kaki (kecuali angkot langsung)
    public const MAKS_ANGKOT = 3;
    public const BOBOT_JALAN = 2.0; // 1 menit jalan kaki "terasa" seperti 2 menit (umum di perencana rute transit)

    /** @var array<int, array> */
    private array $sisi = [];
    /** @var array<string, int[]> node => id sisi keluar */
    private array $keluar = [];
    private array $rute = [];       // rute_id => [kode, arah, nama, len]
    public int $jumlahDijkstra = 0;
    public int $maksAngkot = self::MAKS_ANGKOT;
    public string $bobot = 'w';     // 'w' = bobot dengan jalan kaki x2, 'menit' = waktu asli (untuk opsi tercepat)

    public function __construct(private array $a, private array $b, private float $rad)
    {
    }

    /** Bangun graf: sisi antar-titik pindah (sama untuk semua pencarian) + sisi dari asal / ke tujuan. */
    public function bangun(): void
    {
        foreach (DB::select("SELECT r.rute_id, r.kode_trayek, r.arah, r.nama_trayek, g.len
                             FROM naik.rute r JOIN naik.mv_rute_garis g ON g.rute_id = r.rute_id") as $r) {
            $this->rute[$r->rute_id] = [$r->kode_trayek, $r->arah, $r->nama_trayek, (float) $r->len];
        }

        // titik pindah di sepanjang tiap rute, urut searah jalur
        $henti = [];
        foreach (DB::select("SELECT rute_id, transfer_id, f, d FROM naik.mv_transfer_rute
                             WHERE d <= ? ORDER BY rute_id, f", [self::PINDAH]) as $h) {
            $henti[$h->rute_id][] = [(int) $h->transfer_id, (float) $h->f, (float) $h->d];
        }
        foreach ($henti as $rid => $hs) {
            $len = $this->rute[$rid][3] ?? 0;
            $n = count($hs);
            for ($i = 0; $i < $n; $i++) {
                for ($j = $i + 1; $j < $n; $j++) {
                    $naik = ($hs[$j][1] - $hs[$i][1]) * $len;
                    if ($naik < self::MIN_NAIK || $hs[$i][0] === $hs[$j][0]) {
                        continue;
                    }
                    $this->tambahSisi('t' . $hs[$i][0], 't' . $hs[$j][0], $rid, $hs[$i][1], $hs[$j][1], $hs[$i][2], $hs[$j][2]);
                }
            }
        }

        // jalur yang dekat dengan asal / tujuan (posisi proyeksi & jarak jalan kaki)
        $dekat = fn (array $p) => DB::select("
            SELECT r.rute_id, ST_LineLocatePoint(r.g, q.p) AS f, ST_Distance(r.g, q.p) AS d
            FROM naik.mv_rute_garis r,
                 (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(?, ?), 4326), 32748) AS p) q
            WHERE ST_DWithin(r.g, q.p, ?)", [$p[1], $p[0], $this->rad]);
        $ra = $dekat($this->a);
        $rb = $dekat($this->b);
        $diB = [];
        foreach ($rb as $x) {
            $diB[$x->rute_id] = $x;
        }

        // rute yang bisa langsung asal -> tujuan dengan satu angkot. Rute ini tidak dipakai sebagai angkot
        // PERTAMA dalam rute pindah (sudah sampai dengan satu angkot, tidak perlu turun lalu pindah).
        $langsung = [];
        foreach ($ra as $x) {
            if (isset($diB[$x->rute_id]) && $diB[$x->rute_id]->f > $x->f
                && ($diB[$x->rute_id]->f - $x->f) * ($this->rute[$x->rute_id][3] ?? 0) >= self::MIN_NAIK) {
                $y = $diB[$x->rute_id];
                $this->tambahSisi('O', 'D', $x->rute_id, (float) $x->f, (float) $y->f, (float) $x->d, (float) $y->d);
                $langsung[$x->rute_id] = true;
            }
        }
        foreach ($ra as $x) {
            if (isset($langsung[$x->rute_id])) {
                continue;
            }
            $len = $this->rute[$x->rute_id][3] ?? 0;
            // asal -> titik pindah di depan
            foreach ($henti[$x->rute_id] ?? [] as $h) {
                if ($h[1] > $x->f && ($h[1] - $x->f) * $len >= self::MIN_NAIK) {
                    $this->tambahSisi('O', 't' . $h[0], $x->rute_id, (float) $x->f, $h[1], (float) $x->d, $h[2]);
                }
            }
        }
        foreach ($rb as $y) {
            $len = $this->rute[$y->rute_id][3] ?? 0;
            foreach ($henti[$y->rute_id] ?? [] as $h) {
                if ($h[1] < $y->f && ($y->f - $h[1]) * $len >= self::MIN_NAIK) {
                    $this->tambahSisi('t' . $h[0], 'D', $y->rute_id, $h[1], (float) $y->f, $h[2], (float) $y->d);
                }
            }
        }
    }

    private function tambahSisi(string $u, string $v, int $rid, float $f1, float $f2, float $d1, float $d2): void
    {
        $naik = ($f2 - $f1) * $this->rute[$rid][3];
        $id = count($this->sisi);
        $this->sisi[$id] = [
            'u' => $u, 'v' => $v, 'rute' => $rid, 'kode' => $this->rute[$rid][0],
            'f1' => $f1, 'f2' => $f2, 'd1' => $d1, 'd2' => $d2, 'naik' => $naik,
            'menit' => ($d1 + $d2) / self::JALAN + self::TUNGGU + $naik / self::ANGKOT,   // waktu asli
            'w' => self::BOBOT_JALAN * ($d1 + $d2) / self::JALAN + self::TUNGGU + $naik / self::ANGKOT,  // bobot Dijkstra
        ];
        $this->keluar[$u][] = $id;
    }

    /**
     * Dijkstra dari $asal ke "D". State = (node, jumlah angkot dipakai, trayek terakhir) supaya batas
     * 3 angkot dan larangan "turun lalu naik trayek yang sama" tetap tepat.
     * @return array{0: float, 1: int[]}|null  [biaya, daftar id sisi]
     */
    public function dijkstra(string $asal, int $angkot0 = 0, ?string $kode0 = null, array $buangSisi = [], array $buangNode = []): ?array
    {
        $this->jumlahDijkstra++;
        $mulai = "$asal|$angkot0|$kode0";
        $jarak = [$mulai => 0.0];
        $dari = [];
        $q = new SplPriorityQueue();
        $q->setExtractFlags(SplPriorityQueue::EXTR_BOTH);
        $q->insert([$asal, $angkot0, $kode0, $mulai], 0.0);
        $selesai = [];
        while (!$q->isEmpty()) {
            $x = $q->extract();
            [$u, $k, $kode, $key] = $x['data'];
            $du = -$x['priority'];
            if (isset($selesai[$key])) {
                continue;
            }
            $selesai[$key] = true;
            if ($u === 'D') {
                $jalur = [];
                for ($s = $key; isset($dari[$s]); $s = $dari[$s][0]) {
                    $jalur[] = $dari[$s][1];
                }
                return [$du, array_reverse($jalur)];
            }
            if ($k >= $this->maksAngkot) {
                continue;
            }
            foreach ($this->keluar[$u] ?? [] as $id) {
                $e = $this->sisi[$id];
                if (isset($buangSisi[$id]) || isset($buangNode[$e['v']]) || $e['kode'] === $kode) {
                    continue;
                }
                $kv = "{$e['v']}|" . ($k + 1) . "|{$e['kode']}";
                $nd = $du + $e[$this->bobot];
                if ($nd < ($jarak[$kv] ?? INF)) {
                    $jarak[$kv] = $nd;
                    $dari[$kv] = [$key, $id];
                    $q->insert([$e['v'], $k + 1, $e['kode'], $kv], -$nd);
                }
            }
        }
        return null;
    }

    /**
     * Algoritme Yen: K rute tercepat dengan kombinasi trayek berbeda.
     * @return array<int, array{biaya: float, sisi: int[]}>
     */
    public function yen(int $K = 10): array
    {
        $p1 = $this->dijkstra('O');
        if (!$p1) {
            return [];
        }
        $A = [['biaya' => $p1[0], 'sisi' => $p1[1]]];
        $B = [];
        $dikenal = [implode(',', $p1[1]) => true];

        for ($k = 1; $k < $K; $k++) {
            $prev = $A[$k - 1]['sisi'];
            for ($i = 0; $i < count($prev); $i++) {
                $root = array_slice($prev, 0, $i);
                $spur = $i === 0 ? 'O' : $this->sisi[$prev[$i - 1]]['v'];

                // buang sisi dari spur node yang trayeknya sudah dipakai rute lain dengan root yang sama.
                // Kalau sisi itu langsung ke tujuan (D), hanya sisi langsungnya yang dibuang, supaya trayek
                // yang sama masih bisa dipakai sebagai angkot pertama dalam rute pindah.
                $buangSisi = [];
                foreach ($A as $p) {
                    if (count($p['sisi']) > $i && array_slice($p['sisi'], 0, $i) === $root) {
                        $dipakai = $this->sisi[$p['sisi'][$i]];
                        foreach ($this->keluar[$spur] ?? [] as $id) {
                            $e = $this->sisi[$id];
                            if ($e['kode'] === $dipakai['kode'] && ($dipakai['v'] !== 'D' || $e['v'] === 'D')) {
                                $buangSisi[$id] = true;
                            }
                        }
                    }
                }
                // buang node root (selain spur) supaya rute tidak berputar balik
                $buangNode = ['O' => true];
                foreach ($root as $id) {
                    $buangNode[$this->sisi[$id]['v']] = true;
                }
                unset($buangNode[$spur]);

                $biayaRoot = 0.0;
                foreach ($root as $id) {
                    $biayaRoot += $this->sisi[$id][$this->bobot];
                }
                $kode0 = $i > 0 ? $this->sisi[$prev[$i - 1]]['kode'] : null;
                $s = $this->dijkstra($spur, $i, $kode0, $buangSisi, $buangNode);
                if (!$s) {
                    continue;
                }
                $jalur = array_merge($root, $s[1]);
                $kunci = implode(',', $jalur);
                if (!isset($dikenal[$kunci])) {
                    $dikenal[$kunci] = true;
                    $B[] = ['biaya' => $biayaRoot + $s[0], 'sisi' => $jalur];
                }
            }
            if (!$B) {
                break;
            }
            usort($B, fn ($x, $y) => $x['biaya'] <=> $y['biaya']);
            $A[] = array_shift($B);
        }
        return $A;
    }

    public function sisi(int $id): array
    {
        return $this->sisi[$id];
    }

    public function infoRute(int $rid): array
    {
        return $this->rute[$rid];
    }

    public function jumlahSisi(): int
    {
        return count($this->sisi);
    }
}