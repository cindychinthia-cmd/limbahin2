// Master data extracted from the official price list workbook (testPL5.xlsx).
// All rates, tables and notes mirror the source sheet so the pricing engine
// can derive every location x waste type x service combination dynamically.

// Model layanan tampilan: SPKMIN + SPKMAX digabung menjadi "SPK".
export const SERVICE_CARDS = {
  SPK: {
    id: 'SPK',
    name: 'PENGAMBILAN SESEKALI / SPK',
    definisi: 'Pengambilan berdasarkan panggilan dari klien/sesekali.',
    ringkasan: 'Bayar per pengambilan, limbah ditimbang dan bayar per kg + biaya transport per ritase (biaya kontrak terpisah)',
    kontrak: 'Terpisah',
    transport: 'Bayar per ritase',
    limbah: 'Bayar per kg',
    cocok: 'Pembuangan limbah yang tidak pasti.',
  },
  PTPB: {
    id: 'PTPB',
    name: 'PAKET TAHUNAN & BULANAN',
    definisi: 'Paket tahunan & bulanan (opsi kunjungan 2, 4, 6, 12 kali setahun & 1, 2, 4 kali sebulan)',
    ringkasan: 'Bayar per tahun/per bulan, dapatkan kuota limbah dan kunjungan pada periode tersebut, jika lebih dari kuota, maka akan dikenakan biaya tambahan',
    kontrak: 'Termasuk',
    transport: 'Termasuk - Kecuali Lebih dari kuota kunjungan',
    limbah: 'Termasuk - Kecuali Lebih dari kuota limbah',
    cocok: 'Setahun menghasilkan limbah 20kg - 3 ton',
  },
  RUTIN: {
    id: 'RUTIN',
    name: 'RUTIN',
    definisi: 'Pengambilan rutin per minggu dengan jumlah limbah minimal per bulan',
    ringkasan: 'Bayar di akhir bulan atas akumulasi limbah pada bulan tersebut, terdapat kuantitas minimal pada satu bulan.',
    kontrak: 'Gratis',
    transport: 'Gratis',
    limbah: 'Bayar per kg',
    cocok: 'Di atas 250kg sebulan atau 3 ton setahun',
  },
};

export const SERVICE_ORDER = ['SPK', 'PTPB', 'RUTIN'];

export const WASTE_TYPES = [
  { id: 'MEDIS', header: 'Limbah Rumah Sakit dan Klinik', definisi: 'Limbah dari fasilitas pelayanan kesehatan yang umumnya bersifat infeksius.', available: ['SPKMIN', 'SPKMAX', 'RUTIN', 'PTPB'] },
  { id: 'PRODUK BAHAN', header: 'Limbah Produk & Bahan di Gudang', definisi: 'Limbah dari barang baku atau barang jadi yang sudah kedaluwarsa atau tidak memenuhi spesifikasi dan ingin dimusnahkan.', available: ['SPKMIN', 'SPKMAX'] },
  { id: 'KOMERSIL', header: 'Limbah Hotel, Mal, Apartemen dan Perkantoran', definisi: 'Limbah dari aktifitas bisnis yang bersifat umum seperti (Oli, Kain majun, Lampu & Elektronik (selain lampu TL), Limbah terkontaminasi B3, Kemasan bekas B3, Tinta, Minyak, Aki & Baterai)', available: ['SPKMIN', 'SPKMAX', 'PTPB'] },
  { id: 'INDUSTRI', header: 'Limbah Pabrik, Manufaktur dan Mesin', definisi: 'Limbah yang dihasilkan alat dan mesin untuk proses produksi (butuh kode limbah spesifik dan sample limbah).', available: ['SPKMAX', 'RUTIN', 'SPKMIN'] },
];

// Pickup locations AND vehicle transport rates now live ONLY in Supabase (table
// `pricelist_configs`, columns `locations` and `vehicle_rates`, row where active = true) —
// see src/lib/remoteConfig.js. This app has no local copies; SettingsContext.jsx shows an
// error screen if Supabase has no active config, instead of silently falling back to defaults.
// Shapes for reference:
//   locations:     [{ name: string, available: string[], distanceKm: number, region: string }, ...]
//   vehicle_rates: { [vehicleName]: { basedCost: number, costPerKm: number }, ... }

// Base price table per waste type ('PL Setting' rows 22-26, formula-derived).
export const WASTE_BASE = {
  MEDIS: { cost: 2500, spk: 13000, paket: 11500, spkmax: 10500, bulanan: 10000, rutin: 9500 },
  'PRODUK BAHAN': { cost: 2400, spk: 12600, paket: 11100, spkmax: 10100, bulanan: 9600, rutin: 9200 },
  KOMERSIL: { cost: 1600, spk: 9400, paket: 7900, spkmax: 6900, bulanan: 6400, rutin: 6800 },
  INDUSTRI: { cost: 1100, spk: 7400, paket: 5900, spkmax: 4900, bulanan: 4400, rutin: 5300 },
};

// SPKMAX volume tiers ("Jenis SPKMAX / Jumlah Limbah per ambil") + vehicle per tier.
export const SPKMAX_TIERS = [
  { id: '100-500kg', label: '100-500kg per ambil', minKg: 100, maxKg: 500, vehicle: 'CDE-LONG 3-4 Ton' },
  { id: '500-1000kg', label: '500-1000kg per ambil', minKg: 500, maxKg: 1000, vehicle: 'CDE-LONG 3-4 Ton' },
  { id: '1-2ton', label: '1000-2000kg per ambil', minKg: 1000, maxKg: 2000, vehicle: 'CDE-LONG 3-4 Ton' },
  { id: '2-5ton', label: '2000-5000kg per ambil', minKg: 2000, maxKg: 5000, vehicle: 'CDD 4-7 Ton' },
  { id: '5-10ton', label: '5000-10000kg atau lebih per ambil', minKg: 5000, maxKg: null, vehicle: 'FUSO/WB 9-12Ton' },
];

// RUTIN monthly volume tiers + visit frequency.
export const RUTIN_TIERS = [
  { kg: 250, freq: '1 minggu 1 kali' },
  { kg: 500, freq: '1 minggu 1 kali' },
  { kg: 750, freq: '1 minggu 2 kali' },
  { kg: 1000, freq: '1 minggu 2 kali' },
  { kg: 1500, freq: '1 minggu 3 kali' },
  { kg: 2000, freq: '1 minggu 3 kali' },
  { kg: 3000, freq: '1 minggu 3 kali' },
  { kg: 5000, freq: '2 hari 1 kali' },
  { kg: 7000, freq: '2 hari 1 kali' },
  { kg: 10000, freq: 'Setiap hari' },
];

export const PTPB_OPTIONS = {
  tahun: [2, 4, 6, 9, 12],
  bulan: [1, 2, 4],
};

// Opsi kombinasi limbah + lampu TL untuk Step 4 PTPB (6 opsi).
// `label` di sini hanya fallback generik — tampilan sebenarnya dibuat dinamis per jenis limbah
// terpilih (mis. "10 kg limbah medis + 2 kg lampu TL") lewat ptpbOptionLabel() di lib/pricing.js.
export const PTPB_FIXED_OPTIONS = [
  { id: '10+0', kg: 10, tl: 0, label: '10 kg + 0 kg lampu TL' },
  { id: '10+2', kg: 10, tl: 2, label: '10 kg + 2 kg lampu TL' },
  { id: '25+0', kg: 25, tl: 0, label: '25 kg + 0 kg lampu TL' },
  { id: '25+5', kg: 25, tl: 5, label: '25 kg + 5 kg lampu TL' },
  { id: '50+0', kg: 50, tl: 0, label: '50 kg + 0 kg lampu TL' },
  { id: '50+10', kg: 50, tl: 10, label: '50 kg + 10 kg lampu TL' },
];

// Rentang limbah SPK (langkah parameter). Rentang pertama = SPKMIN, sisanya = tier SPKMAX.
export const SPK_RANGES = [
  { id: '0-100', label: '0 – 100 kg', tier: null },
  { id: '101-500', label: '101 – 500 kg', tier: '100-500kg' },
  { id: '501-1000', label: '501 – 1.000 kg', tier: '500-1000kg' },
  { id: '1001-2000', label: '1.001 – 2.000 kg', tier: '1-2ton' },
  { id: '2001-5000', label: '2.001 – 5.000 kg', tier: '2-5ton' },
  { id: '5001-10000', label: '5.001 – 10.000 kg', tier: '5-10ton' },
  { id: '10001+', label: 'Lebih dari 10.000 kg', tier: '5-10ton' },
];

// Opsi limbah RUTIN per bulan (satu tier = satu opsi).
export const RUTIN_OPTIONS = RUTIN_TIERS.map((t) => ({
  id: String(t.kg),
  kg: t.kg,
  label: t.kg >= 1000 ? `${t.kg / 1000} ton` : `${t.kg} kg`,
  freq: t.freq,
}));

// Tabel perbandingan layanan (modal info).
export const COMPARISON = {
  columns: ['PENGAMBILAN SESEKALI / SPK', 'PAKET TAHUNAN & BULANAN', 'RUTIN'],
  rows: [
    {
      label: 'Definisi',
      values: [
        'Pengambilan berdasarkan panggilan dan di bawah 100kg per kunjungan (<100kg)',
        'Paket tahunan & bulanan (opsi kunjungan 2, 4, 6, 12 kali setahun & 1, 2, 4 kali sebulan)',
        'Pengambilan rutin per minggu dengan jumlah limbah minimal per bulan',
      ],
    },
    {
      label: 'Ringkasan',
      values: [
        'Bayar per pengambilan, limbah ditimbang dan bayar per kg + biaya transport per ritase (biaya kontrak terpisah)',
        'Bayar per tahun/per bulan, dapatkan kuota limbah dan kunjungan pada periode tersebut, jika lebih dari kuota, maka akan dikenakan biaya tambahan',
        'Bayar di akhir bulan atas akumulasi limbah pada bulan tersebut, terdapat kuantitas minimal pada satu bulan.',
      ],
    },
    { label: 'Biaya Kontrak', values: ['Terpisah', 'Termasuk', 'Gratis'] },
    { label: 'Biaya Transport', values: ['Bayar per ritase', 'Termasuk - Kecuali Lebih dari kuota kunjungan', 'Gratis'] },
    { label: 'Biaya Limbah', values: ['Bayar per kg', 'Termasuk - Kecuali Lebih dari kuota limbah', 'Bayar per kg'] },
    {
      label: 'Cocok untuk',
      values: ['Sesekali buang limbah, di bawah 100kg', 'Setahun menghasilkan limbah 20kg - 3 ton', 'Di atas 250kg sebulan atau 3 ton setahun'],
    },
  ],
};

// Formula constants (MOU fee, PTPB contract, SPKMAX/RUTIN tier multipliers, PTPB discounts,
// distance minimum, PAKET divisor, etc.) now live ONLY in Supabase (table `pricelist_configs`,
// column `constants`, row where active = true) — see src/lib/remoteConfig.js. Keys expected:
//   minimumDistanceKm, paketDivisor, mou, ptpbContract, extraPointFee, noContractSurcharge,
//   contractRevisionFee, lampuTLInPaket, lampuTLOutPaket, spkmaxMinusRate, spkmaxMinusConstant,
//   spkmaxMround, rutinMinusRate, rutinMinusConstant, rutinMround,
//   ptpbDiscountTahunan: { [visits]: number }, ptpbDiscountBulanan: { [visits]: number }

// DEPRECATED — kept only as a historical reference for the seed data in
// supabase/pricelist_notes.sql. The app no longer reads this export: note text
// (Catatan Umum / Catatan Limbah / Catatan Pelayanan) now lives ONLY in Supabase
// (table `pricelist_notes`, row where active = true) — see src/lib/remoteConfig.js
// and src/lib/pricing.js (renderNoteTemplate).
export const NOTES = {
  GLOBAL:
    '*Harga belum termasuk PPN 11%. Harga dapat berubah sewaktu-waktu, silahkan konfirmasi harga melalui CS\n*Untuk revisi kontrak yang kedua dan selanjutnya dalam satu tahun dikenakan biaya IDR 300,000 per kontrak.\n*Pembayaran maksimal 30 hari setelah invoice diterima.\n*Limbah bersifat padat/sludge mengeras dapat dikemas menggunakan plastik/kardus/jumbo bag/drum.\n*Limbah cair/sludge basah dapat dikemas menggunakan drum/IBC Tank.\n*Untuk limbah yang dikemas dalam kemasan kecil <200kg akan langsung ditimbang di lokasi, diatas itu akan menggunakan jembatan timbang untuk mendapat berat yang akan ditagihkan',
  SPKMIN:
    '*Biaya Transport tanpa kontrak dikenakan biaya tambahan sebesar 250,000 per ritase\nPelayanan kunjungan tambahan titik disekitar lokasi pengambilan pertama (<25km) dikenakan biaya sebesar IDR 200,000 per ritase\n*Jika tidak mengambil atau belum kontrak, dikenakan tambahan biaya transportasi sebesar IDR 250,000 per ritase.\n*Belum termasuk biaya penyeberangan kapal',
  SPKMAX:
    '*Biaya Transport tanpa kontrak dikenakan biaya tambahan sebesar 250,000 per ritase\nPelayanan kunjungan tambahan titik disekitar lokasi pengambilan pertama (<25km) dikenakan biaya sebesar IDR 200,000 per ritase\n*Jika tidak mengambil atau belum kontrak, dikenakan tambahan biaya transportasi sebesar IDR 250,000 per ritase.\n*Belum termasuk biaya penyeberangan kapal',
  RUTIN:
    '*Pelayanan Rutin: Biaya yang dikenakan hanya untuk biaya limbah (tanpa biaya transport), namun jika diakhir bulan jumlah limbah yang ditotal berada dibawah jumlah limbah yang seharusnya, maka akan dikenakan biaya terhadap kuantitas minimum sesuai dengan pelayanan yang dipilih\n*Contoh: Minimal 1000kg dengan harga IDR 500, jika diakhir bulan hanya terdapat 900kg, maka biaya yang dikenakan tetap pada jumlah 1000kg.',
  PTPB_QUOTA:
    '*Biaya kelebihan limbah dikenakan sesuai tarif diluar kuota (lihat rincian)\n*Biaya kunjungan tambahan diluar kuota dikenakan per ritase sesuai tarif transport\n*Lampu TL diluar paket: IDR 120,000 per kg',
};

// DEPRECATED — ?param= no longer uses a fixed code lookup. It's now parsed directly from the URL
// as a signed percentage (e.g. ?param=15xyz = +15%, ?param=-26abc = -26%) — see lib/paramRule.js.
// Kept only so old bookmarked/shared links with these exact codes don't silently 404 elsewhere.
export const PARAM_MULTIPLIERS = {
  NULL: 1.0,
  FIVE: 1.05,
  TEN: 1.1,
  FIFT: 1.15,
  TWEN: 1.2,
  MFIVE: 0.95,
  MTEN: 0.9,
  MFIFT: 0.85,
  MTWEN: 0.8,
};

// Kode referal Step 1. 'MCC' → tampilkan semua opsi (lewati Step 4). Any other code is now looked
// up live against the Supabase `referal_model` table — see lib/remoteConfig.js fetchReferralByCode()
// and lib/referralQuote.js.
export const REFERRAL_CODES = { MCC: 'all' };