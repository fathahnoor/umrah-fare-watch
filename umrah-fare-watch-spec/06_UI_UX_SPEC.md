# UI and UX Specification

## 1. Experience Principles

- Tunjukkan complete trip total sebagai keputusan utama, lalu breakdown komponen.
- Bedakan complete, partial, stale, expired, dan belum searchable secara jelas.
- Harga per orang selalu sekunder terhadap party and room total.
- Setiap klaim termurah disertai provider coverage dan waktu observasi.
- Gunakan plain language Indonesia, progressive disclosure, dan mobile-first layout.
- Status tidak boleh mengandalkan warna saja.

## 2. Information Architecture

Primary navigation:

```text
Total Termurah
Tiket
Hotel
Kalender
Pantauan Saya
Tentang
```

`Total Termurah` adalah halaman default. `Tiket` dan `Hotel` memberi component views. `Kalender` membedakan flight dan hotel coverage. `Pantauan Saya` membutuhkan authentication. `Tentang` menjelaskan cakupan, provider, dan disclaimer.

## 3. Homepage

Headline:

```text
Cari Total Umrah Termurah
```

Supporting copy:

```text
Bandingkan tiket pesawat serta hotel Makkah dan Madinah dalam satu total biaya yang transparan.
```

Primary CTA: `Cari kombinasi`. Secondary CTA: `Lihat cara menghitung total`.

Jangan menampilkan logo provider yang belum aktif. Tampilkan singkat `Membandingkan provider aktif` dengan link ke coverage.

## 4. Search Form

Form dibagi menjadi empat kelompok:

### Perjalanan

- bandara asal multi-select, default CGK;
- rentang tanggal departure;
- pattern: roundtrip JED, roundtrip MED, open-jaw JED to MED, open-jaw MED to JED;
- city order: otomatis, Makkah dahulu, atau Madinah dahulu;
- cabin.

### Tamu dan kamar

- adults;
- children count dan age field untuk setiap anak;
- rooms;
- helper text bahwa minimal satu adult diperlukan per room.

### Durasi kota

- `makkahNights`, default 5;
- `madinahNights`, default 4;
- ringkasan total nights;
- preview city sequence berdasarkan pattern dan city order.

### Preferensi

- max stops;
- max layover dan total flight duration;
- radius Makkah dan Madinah;
- free cancellation only.

Validation tampil dekat field, mempunyai text, dan fokus ke error pertama saat submit. Date range tidak boleh melebihi 365 hari.

## 5. Search Progress

Progress memperlihatkan tahap yang benar:

```text
Mencari kandidat tiket
Memverifikasi jadwal terpilih
Mencari hotel Makkah
Mencari hotel Madinah
Menghitung total lengkap
```

Jika hotel belum masuk frontier, stage tidak tampil sebagai gagal. Gunakan `Hotel belum dapat dicari untuk tanggal ini` dan pertahankan flight result.

## 6. Result Summary

Empat summary cards:

1. complete trip termurah;
2. cheapest flight component;
3. cheapest Makkah stay;
4. cheapest Madinah stay.

Card complete trip menampilkan total IDR paling besar. Per-person equivalent diberi label `setara per orang` dan tidak menggantikan total. Breakdown ketiga komponen harus menjumlah tepat ke displayed total.

Di atas results tampilkan provider coverage, waktu observasi, serta definisi `termurah yang ditemukan`. Partial alternatives berada pada section terpisah: `Mungkin lebih murah, tetapi biaya belum lengkap`.

## 7. Complete Trip Card

Card minimum memuat:

- total dan `PriceCompleteness`;
- flight party subtotal;
- Makkah hotel subtotal untuk semua rooms and nights;
- Madinah hotel subtotal untuk semua rooms and nights;
- tanggal, night allocation, rooms, adults, dan children ages summary;
- airline, airports, stops, layover, dan duration;
- property names, area, dan distance semantic;
- cancellation, board, due now, dan due at property;
- provider setiap komponen;
- verification status, observation time, dan expiry setiap komponen;
- `Included` dan `Not included`;
- CTA `Verifikasi harga` lalu `Buka sumber booking` jika sukses.

Jika quote berubah, tampilkan old total, new total, per-component difference, dan tombol konfirmasi. Jangan redirect otomatis.

## 8. Flight Component View

Flight view mengurutkan party total. Tampilkan per-person hanya sebagai detail. Row menampilkan route pattern, local dates, airline, flight numbers jika tersedia, stops, duration, baggage information if supplied, provider, verification, expiry, dan fee completeness.

Indicative result diberi CTA untuk live verification. Jika verification gagal, result lama tetap ada dengan status stale atau expired.

## 9. Hotel Component View

User memilih Makkah atau Madinah. Hotel card menampilkan total untuk all rooms and nights, property, room and rate, board, cancellation deadline, payment policy, due at property, provider, observation time, dan distance.

Jika distance dihitung dari coordinates, label harus `straight-line distance`. Jangan memakai istilah walking distance tanpa routing source.

Untuk rate OTA yang dipilih, tampilkan reminder:

> Setelah memesan, konfirmasikan nomor reservasi langsung ke hotel. Untuk kebutuhan visa, pastikan persyaratan dan proses approval melalui sumber resmi atau provider visa Anda.

Reminder adalah guidance, bukan klaim bahwa property tertentu mendukung Masar Nusuk.

## 10. Calendar

Calendar cell memisahkan flight dan hotel state. Legend dengan text and icon:

- total lengkap tersedia;
- flight tersedia, hotel belum dicari;
- hotel belum masuk frontier;
- sudah dicari tanpa hasil;
- provider unavailable;
- belum dipindai.

Hover tidak boleh menjadi satu-satunya akses detail. Tap atau keyboard membuka popover. Day 366 berada di luar selectable user horizon.

## 11. Watchlists

List mengelompokkan `FLIGHT`, `HOTEL`, dan `COMPLETE_TRIP`. Setiap item memperlihatkan constraints, target price, latest observed price, latest complete state, provider coverage, next eligible scan, alert channel, cooldown, dan active status.

Form complete trip watchlist memakai input yang sama dengan search. User dapat pause, edit threshold, atau delete dengan confirmation. Empty state mengajak membuat pantauan dari result saat ini.

## 12. Status and Empty States

- `NOT_SCANNED`: `Belum dipindai untuk kombinasi ini`.
- `NO_RESULT`: `Provider aktif sudah dicari, belum ada hasil`.
- `NOT_YET_PUBLISHED`: `Inventori belum diterbitkan provider`.
- `NOT_YET_SEARCHABLE`: `Tanggal belum masuk jangkauan pencarian hotel`.
- `PROVIDER_UNAVAILABLE`: `Provider sedang tidak dapat digunakan`.
- `STALE`: `Harga lama, verifikasi ulang diperlukan`.
- `EXPIRED`: `Penawaran sudah kedaluwarsa`.

Jangan memakai `Tidak ada hotel` untuk `NOT_YET_SEARCHABLE` atau provider failure.

## 13. Error Recovery

Error panel menyebut komponen yang gagal, bagian yang masih berhasil, apakah retry aman, dan kapan dapat dicoba lagi. Retry per komponen tidak mengulang seluruh search. Credential atau access missing pada real mode menunjukkan configuration state, bukan error user.

Offline atau timeout mempertahankan last valid data dengan timestamp. Data tidak diganti skeleton permanen atau nol.

## 14. Responsive Behavior

- 360px adalah mandatory mobile width.
- Form menjadi single column tanpa horizontal scroll.
- Result breakdown tetap terbaca dan total tidak terpotong.
- Table berubah menjadi stacked cards dengan label field.
- Sticky CTA tidak menutup disclaimer atau browser controls.
- Touch target minimal 44 by 44 CSS pixels.
- Desktop memakai maksimum content width yang nyaman dan tidak memaksa data padat satu baris.

## 15. Accessibility

- Semantic headings dan landmarks.
- Semua controls mempunyai label programmatic.
- Focus order mengikuti visual order dan focus indicator jelas.
- Modal focus-trapped dan dapat ditutup dengan Escape.
- Status memiliki icon plus text, bukan color-only.
- Currency dan dates dibaca screen reader dengan konteks.
- Dynamic search progress dan result count memakai polite live region.
- Contrast memenuhi WCAG AA.
- Reduced-motion preference dihormati.

## 16. Content Rules

Gunakan istilah konsisten: `Total perjalanan`, `Tiket untuk semua penumpang`, `Hotel Makkah`, `Hotel Madinah`, `Termasuk`, `Not included`, `Harga belum lengkap`, dan `Terakhir diverifikasi`.

Jangan menulis `pasti termurah`, `harga final` ketika masih indicative, `jalan kaki` untuk straight-line distance, atau `tersedia` ketika hanya historical observation.

## 17. Required Disclaimer

Footer dan result detail memuat:

```text
Harga dan ketersediaan dapat berubah. Hasil membandingkan provider yang aktif saat observasi, bukan seluruh penawaran di internet. Verifikasi total, syarat refund, detail reservasi hotel, persyaratan visa, dan kebijakan provider sebelum booking.
```

## 18. UX Acceptance Gate

- Search dapat diselesaikan tanpa mouse.
- Complete dan partial results tidak tertukar secara visual.
- Component totals add up exactly.
- Provider and freshness terlihat tanpa membuka developer tools.
- Hotel frontier mempunyai state serta copy yang benar.
- Quote change memerlukan confirmation.
- Layout 360px tidak horizontal scroll.
- Status tidak mengandalkan warna.
- Reminder reservasi hotel dan required disclaimer tampil.
