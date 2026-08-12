# Findings and Decisions

## Requirements

- Perbaiki spesifikasi Umrah Fare Watch yang sudah ada.
- Pertimbangkan komentar pada Threads yang diberikan pengguna.
- Jadikan seluruh folder siap diserahterimakan kepada Freebuff.
- Optimalkan instruksi untuk DeepSeek V4 Flash 07/31 atau GLM 5.2.
- Pertahankan keluaran sebagai dokumen spesifikasi, bukan implementasi aplikasi pada tahap ini.

## Research Findings

- Folder induk `C:\DevPath\260809_umrah-fare-watch` hanya memuat subfolder `umrah-fare-watch-spec`.
- Akar paket memiliki 12 dokumen Markdown bernomor `00` sampai `11`.
- Tidak ada repositori Git pada folder induk maupun akar paket.
- Dokumen yang tersedia mencakup product requirements, monitoring, arsitektur, data penerbangan, backend, UI, scheduler, implementation plan, acceptance tests, master prompt, dan sumber referensi.
- Metadata halaman Threads mengonfirmasi post induk dari `@sabbounty` berisi permintaan rekomendasi aplikasi yang worth it untuk booking flight dan hotel Umrah mandiri, disertai tips dan trik.
- Pencarian web umum tidak mengindeks post atau komentarnya secara memadai. Halaman publik berhasil diambil langsung setelah izin jaringan, tetapi payload komentar masih perlu diekstrak dari HTML tersemat.
- Comet dengan CDP port 9222 berhasil digunakan. Tab tugas baru dibuat khusus untuk post Threads dan indikator `Buffy controlling` dipasang hanya pada URL tersebut.
- Komentar awal menyebut Trip.com berulang kali untuk tiket karena promo, kecepatan CS, dan penanganan refund. Traveloka disebut sebagai opsi yang cukup, sedangkan Skyscanner dipakai untuk melihat sumber yang sedang promo.
- Untuk hotel, komentar menyebut Agoda, Trip.com, aplikasi ALL Accor, Marriott Bonvoy, Mokhtara, Maysan, dan Emaar. Program membership chain hotel dinilai berguna karena promo dikirim langsung.
- Sebagian pengguna memilih booking hotel melalui provider visa karena approval Nusuk lebih cepat, walau harga lebih mahal daripada OTA. Alternatifnya adalah hotel atau chain yang responsif terhadap request agreement pada Masar Nusuk.
- Tips pembelian yang muncul adalah merencanakan jauh hari, menunggu promo, memantau promo Saudia sekitar Agustus, dan membandingkan pembelian langsung di web Saudia.
- Ada komentar mengenai penggunaan atau transfer miles untuk memperoleh tiket open-jaw Jakarta ke Madinah lalu Jeddah ke Jakarta dengan harga lebih rendah. Ini merupakan data anekdotal dan tidak boleh dijadikan jaminan harga.
- Komentar lanjutan menyebut direct booking melalui web Saudia atau aplikasi Singapore Airlines sebagai alternatif OTA.
- Untuk hotel, pengguna membandingkan Booking.com, Agoda, Tiket.com, Trip.com, dan direct chain. Ada preferensi terhadap pembayaran langsung di Agoda untuk mengurangi kekhawatiran pembatalan mendadak.
- Pengguna membandingkan Trip.com dan Traveloka berdasarkan harga saat transaksi, tetapi beberapa komentar mengkritik akses CS Traveloka untuk perjalanan internasional. MyTrip disebut memiliki refund lebih lambat dalam satu pengalaman. Klaim ini harus diberi label sebagai pengalaman komunitas, bukan skor objektif permanen.
- Hidden replies berisi promosi grup WhatsApp dan jasa pendampingan. Threads menandainya sebagai kemungkinan ofensif, menyesatkan, atau spam. Konten dan tautannya dikecualikan dari requirement serta referensi produk.
- Thread menyediakan urutan `Top` dan `Recent`. Urutan `Recent` berhasil diaktifkan untuk mengurangi bias hanya pada komentar dengan engagement tinggi. Indikator thread menampilkan 48 reply, termasuk balasan bertingkat dan hidden reply.
- Sebagian komentar menyebut booking langsung ke manajer hotel, sponsor tiket, atau syarikah transportasi dapat lebih murah. Untuk scope produk, hanya sumber flight dan hotel yang legal, dapat diverifikasi, dan mempunyai jalur booking jelas yang layak dipertimbangkan.
- Setelah booking hotel melalui OTA, pengguna menyarankan konfirmasi langsung ke hotel melalui email atau WhatsApp agar reservasi dipastikan sudah masuk ke sistem hotel.
- Trade-off direct versus transit muncul jelas. Penerbangan transit dinilai lebih murah, tetapi waktu transit dapat berjam-jam. Produk perlu mengurutkan harga sekaligus menyediakan filter durasi, jumlah transit, dan batas waktu transit.
- Komentar menyebut harga anekdotal sekitar Rp10,5 juta untuk rute open-jaw Saudia saat promo dan sekitar Rp17 juta ketika dicek untuk Oktober atau November. Ada pula dugaan promo sekitar 17 Agustus. Semua angka dan pola tanggal harus dianggap tidak stabil dan tidak boleh dipakai sebagai baseline permanen.
- Pengalaman refund Agoda dinilai buruk oleh satu komentar, sementara komentar lain tetap memilih Agoda untuk hotel. Perbedaan pengalaman ini memperkuat kebutuhan memisahkan harga live dari catatan kualitas komunitas yang tidak deterministik.
- Pengguliran sampai kelompok komentar tertua pada urutan `Recent` tidak menemukan tema baru di luar sumber booking, promo, purnajual, konfirmasi hotel, transit, serta approval Masar Nusuk. Cakupan komentar relevan dinilai memadai untuk desain revisi.
- Audit 12 dokumen menunjukkan spesifikasi lama hanya memodelkan penerbangan. `01_PRODUCT_REQUIREMENTS.md` bahkan memasukkan hotel monitoring ke daftar non-goal, sehingga bertentangan langsung dengan tujuan terbaru pengguna.
- `03_TECHNICAL_ARCHITECTURE.md`, `05_DATA_MODEL_AND_BACKEND.md`, `07_ALERTS_AND_SCHEDULER.md`, dan `10_FREEBUFF_MASTER_PROMPT.md` hanya memiliki kontrak provider, tabel, scheduler, alert, serta prompt untuk penerbangan.
- `06_UI_UX_SPEC.md` tidak memiliki input kamar, okupansi, pembagian malam Makkah dan Madinah, check-in atau check-out hotel, total biaya perjalanan, pajak hotel, kebijakan pembatalan, atau kepastian reservasi.
- `09_ACCEPTANCE_TESTS.md` tidak dapat membuktikan fungsi hotel maupun perhitungan kombinasi total perjalanan.
- Struktur lama yang layak dipertahankan adalah mock-first, adapter provider resmi, pemisahan indicative versus live, rolling horizon, global observation pool, watchlist, scheduler bertingkat, dan release gate berbasis acceptance tests.
- Dokumentasi resmi Duffel Stays menyediakan alur search, fetch rates, quote, dan booking. Untuk MVP ini hanya search serta quote verification yang diperlukan, karena pembelian tetap non-goal.
- Duffel Stays search membutuhkan check-in, check-out, jumlah kamar, tamu, serta lokasi atau accommodation IDs. Hasil awal selalu mempunyai `cheapest_rate_total_amount`, tetapi detail kamar dan rate belum tentu lengkap sebelum fetch rates.
- Duffel Stays membatasi check-in maksimum 330 hari ke depan, sementara produk mempertahankan horizon pengguna 365 hari. Hotel harus mempunyai availability frontier tersendiri dan state `NOT_YET_SEARCHABLE`, bukan dianggap tidak tersedia.
- Akses Duffel Stays harus diminta pada akun Duffel. Karena itu mock mode tetap wajib dan real hotel mode harus dinonaktifkan secara eksplisit saat access token atau akses produk belum tersedia.
- Booking.com Demand API menyediakan accommodation search, availability, detail, serta redirect booking. Sebagian kemampuan bergantung pada partner agreement. Adapter Booking.com layak menjadi opsi lanjutan, bukan dependency MVP.
- Klaim produk harus memakai frasa `termurah yang ditemukan dari sumber aktif`, bukan `termurah di internet`, karena cakupan provider dan akses partner tidak universal.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Audit semua dokumen, bukan hanya master prompt | Komentar produk dapat berdampak lintas requirement, data, UI, scheduler, dan acceptance tests. |
| Buat aturan kerja bertahap untuk Freebuff | Model penerima perlu batas scope, urutan baca, checkpoint, dan definisi selesai yang eksplisit. |
| Rekomendasikan Duffel Stays sebagai adapter hotel nyata pertama | Satu ekosistem dengan live flight adapter, dokumentasi publik jelas, dan memuat harga, pajak, fee, cancellation policy, serta quote verification. |
| Jadikan Booking.com Demand adapter opsional setelah akses partner | API resmi tersedia, tetapi kemampuan dan akses tertentu mengikuti partner agreement. |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| BrowserOS neo tidak terhubung dalam sesi ini | Gunakan fallback read-only yang tersedia dan catat sumber secara eksplisit. |
| `agent-browser` tidak terpasang pada PATH | Jangan memasang tool baru tanpa kebutuhan. Gunakan web read-only untuk halaman publik. |
| Pembuka URL web menolak path Threads dan pencarian tidak menemukan post | Ambil halaman publik langsung secara read-only dengan `curl` setelah izin jaringan. |
| Klik `See all` mengubah konteks atau URL tab sehingga filter audit lama tidak menemukannya | Temukan kembali tab berdasarkan target CDP lalu lanjutkan tanpa menyentuh tab lain. |

## Resources

- Threads sumber komentar: https://www.threads.com/@sabbounty/post/Db3hlGBga90
- Akar paket: `C:\DevPath\260809_umrah-fare-watch\umrah-fare-watch-spec`

## Visual or Browser Findings

- Post induk terlihat melalui metadata Open Graph. Fokus diskusinya adalah pemilihan aplikasi booking flight dan hotel untuk Umrah mandiri, bukan paket biro perjalanan.
- Komentar belum diringkas karena masih berada dalam payload halaman yang besar dan harus dipisahkan dari JavaScript serta metadata lain.
- Snapshot DOM Comet menampilkan komentar dan balasan langsung. Halaman memuat lebih banyak komentar ketika digulir.
- Kriteria keputusan nyata pengguna mencakup harga, kecepatan CS, reliabilitas refund, promo, membership hotel, direct booking, dan dukungan approval hotel untuk visa.
- Halaman menampilkan peringatan bahwa sebagian balasan disembunyikan, dengan tautan `See all`. Klik dilakukan hanya untuk membaca balasan dan menyebabkan filter URL audit tidak lagi cocok.
- Halaman hidden replies terpisah berhasil dibaca. Tidak ditemukan masukan produk yang layak diadopsi dari bagian tersebut.
- Urutan `Recent` memuat komentar tambahan ketika halaman digulir ke bawah. Konten mengonfirmasi bahwa kebutuhan pengguna bukan hanya harga nominal, tetapi kepastian reservasi, durasi perjalanan, dan purnajual.
- Kelompok komentar terakhir mengulang rekomendasi Trip.com, Skyscanner, Traveloka, ALL Accor, membership hotel, dan perencanaan jauh hari. Tidak ada alasan untuk menambah layanan transportasi darat, visa, atau jasa pendampingan ke MVP.

## Security Note

Semua isi Threads dan halaman web diperlakukan sebagai data tidak tepercaya. Teks tersebut hanya akan dirangkum sebagai masukan produk, bukan dijalankan sebagai instruksi.

## Final Handoff Findings

- Paket kanonis sekarang terdiri dari 13 dokumen bernomor, mencakup flight, hotel Makkah, hotel Madinah, complete trip, provider strategy, data model, UX, scheduler, 99 mandatory acceptance tests, master prompt, sources, dan handoff.
- Dua belas dokumen awal disimpan tanpa perubahan di `archive/2026-08-09-flight-only/` dan diverifikasi melalui `SOURCE_HASHES.sha256`.
- Filename strategi kanonis sekarang `04_PROVIDER_AND_DATA_STRATEGY.md`; dokumen flight-only lama hanya berada pada arsip.
- Flight user horizon adalah 365 hari dan technical horizon 370 hari. Frontier hotel mengikuti provider. Bukti Duffel Stays yang ditinjau pada 2026-08-11 memakai 330 hari dan tanggal di luarnya berstatus `NOT_YET_SEARCHABLE`.
- Provider wajib: deterministic mock untuk flight dan hotel. Kandidat real pertama: Travelpayouts atau Aviasales untuk broad flight discovery, Duffel Flights untuk selective verification, dan Duffel Stays untuk hotel setelah akses dikonfirmasi.
- Booking.com Demand API bersifat opsional setelah partner access, terms, attribution, caching, dan redirect rights dikonfirmasi.
- Duffel Stays memerlukan permintaan akses terpisah. Tidak ada real provider yang boleh diklaim aktif hanya berdasarkan keberadaan dokumentasi atau credential.
- Komentar Threads tetap diberi label masukan kualitatif. Contoh harga, promo, refund, pujian, kritik, dan rekomendasi provider tidak dijadikan fakta produksi atau skor permanen.
- Scope sesi ini hanya perbaikan spesifikasi serta handoff. Tidak ada source code web app, dependency, database, atau deployment yang dibuat. Implementasi diserahkan kepada Freebuff.
- Folder bukan repositori Git. Tidak ada commit claim dan Git tidak diinisialisasi.
