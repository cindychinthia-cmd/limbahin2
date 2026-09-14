import {
  WASTE_TYPES, WASTE_BASE,
  SPKMAX_TIERS, RUTIN_TIERS, SERVICE_CARDS,
  SPK_RANGES, RUTIN_OPTIONS, PTPB_OPTIONS, PTPB_FIXED_OPTIONS,
} from '@/data/pricelistData';

export const mround = (value, multiple) => multiple * Math.round(value / multiple);

export const formatIDR = (value) => `IDR ${Math.round(value).toLocaleString('id-ID')}`;

// Fills {{token}} placeholders in a "Catatan Pelayanan" template (content.notes.service[id],
// stored in Supabase table `pricelist_notes`) with the live values behind them, so the price
// quoted inside the note text can never drift from what the app actually charges. Unknown tokens
// are left untouched (rather than silently dropped) so a typo in Supabase is easy to spot.
export function renderNoteTemplate(template, tokens) {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => (tokens[key] != null ? tokens[key] : match));
}

// Biaya transport satu ritase untuk `vehicle` pada jarak `distanceKm`.
// `constants` dan `content.vehicleRates` HARUS berasal dari Supabase (lewat useSettings()) —
// tidak ada tabel bawaan lokal lagi, jadi kedua argumen ini wajib diisi oleh pemanggil.
// basedCost mencakup constants.minimumDistanceKm pertama (jarak di bawah itu tetap basedCost penuh);
// sisa jarak dikali costPerKm.
export function transportCost(vehicle, distanceKm, constants, content) {
  const rate = content?.vehicleRates?.[vehicle];
  if (!rate) return 0;
  const extraKm = Math.max(0, (Number(distanceKm) || 0) - constants.minimumDistanceKm);
  return rate.basedCost + rate.costPerKm * extraKm;
}

// Harga PAKET (dipakai SPKMIN & PTPB) = transport 'CDE 2-3 Ton' pada jarak lokasi, dibagi paketDivisor.
export function paketCost(distanceKm, constants, content) {
  return Math.round(transportCost('CDE 2-3 Ton', distanceKm, constants, content) / constants.paketDivisor);
}

function findLocation(locationName, content) {
  return (content?.locations || []).find((l) => l.name === locationName);
}

// Label opsi PTPB yang menyebutkan jenis limbah terpilih, mis. "10 kg limbah medis + 2 kg lampu TL".
export function ptpbOptionLabel(opt, wasteId) {
  const name = (wasteId || '').toLowerCase();
  const base = `${opt.kg} kg limbah${name ? ` ${name}` : ''}`;
  return opt.tl ? `${base} + ${opt.tl} kg lampu TL` : base;
}

// Layanan tampilan baru: SPKMIN + SPKMAX digabung menjadi "SPK".
export function availableServices(locationName, wasteId, content) {
  const locs = content?.locations || [];
  const wastes = content?.wasteTypes || WASTE_TYPES;
  const loc = locs.find((l) => l.name === locationName);
  const waste = wastes.find((w) => w.id === wasteId);
  if (!loc || !waste) return [];
  const out = [];
  const locSpk = loc.available.includes('SPKMIN') || loc.available.includes('SPKMAX');
  const wasteSpk = waste.available.includes('SPKMIN') || waste.available.includes('SPKMAX');
  if (locSpk && wasteSpk) out.push('SPK');
  if (loc.available.includes('PTPB') && waste.available.includes('PTPB')) out.push('PTPB');
  if (loc.available.includes('RUTIN') && waste.available.includes('RUTIN')) out.push('RUTIN');
  return out;
}

export function serviceDefaults(service, locationName = '', content) {
  const loc = findLocation(locationName, content);
  switch (service) {
    case 'SPK':
      return { range: (loc?.available || []).includes('SPKMIN') ? '0-100' : '101-500', needContract: null };
    case 'PTPB':
      return { option: null, monthly: null, visits: null };
    case 'RUTIN':
      return { kg: null };
    default:
      return {};
  }
}

// SPKMAX per-kg rate chain: tier 1 = waste base "SPKMAX", next = mround(prev*0.95-350, 100)
export function spkmaxRates(wasteId, constants) {
  let rate = WASTE_BASE[wasteId].spkmax;
  return SPKMAX_TIERS.map((tier, i) => {
    if (i > 0) rate = mround(rate * constants.spkmaxMinusRate - constants.spkmaxMinusConstant, constants.spkmaxMround);
    return { ...tier, rate };
  });
}

// RUTIN per-kg rate chain per monthly volume tier: base = waste "Base Rutin", next = mround(prev*0.95-150, 200)
export function rutinRates(wasteId, constants) {
  let rate = WASTE_BASE[wasteId].rutin;
  return RUTIN_TIERS.map((tier, i) => {
    if (i > 0) rate = mround(rate * constants.rutinMinusRate - constants.rutinMinusConstant, constants.rutinMround);
    return { ...tier, rate };
  });
}

// Harga satuan untuk rentang limbah SPK (per kg & transport per ritase).
export function spkRangePrice(wasteId, locationName, rangeId, constants, content) {
  const base = WASTE_BASE[wasteId];
  const distanceKm = findLocation(locationName, content)?.distanceKm;
  const range = SPK_RANGES.find((r) => r.id === rangeId) || SPK_RANGES[0];
  let rate;
  let vehicleKey;
  if (!range.tier) {
    rate = base.spk;
    vehicleKey = 'PAKET';
  } else {
    const tiers = spkmaxRates(wasteId, constants);
    const tier = tiers.find((t) => t.id === range.tier) || tiers[0];
    rate = tier.rate;
    vehicleKey = tier.vehicle;
  }
  return {
    range,
    rate,
    vehicle: vehicleKey === 'PAKET' ? null : vehicleKey,
    transportBase:
      vehicleKey === 'PAKET'
        ? paketCost(distanceKm, constants, content)
        : transportCost(vehicleKey, distanceKm, constants, content),
  };
}

// Harga paket PTPB untuk satu kombinasi periode × jumlah kunjungan.
export function ptpbOptionPrice(wasteId, locationName, { kgPerVisit, tlKg }, period, visits, constants, content) {
  const base = WASTE_BASE[wasteId];
  const distanceKm = findLocation(locationName, content)?.distanceKm;
  const contract = period === 'tahun' ? constants.ptpbContract : constants.ptpbContract / 12;
  const discountPer = (period === 'tahun' ? constants.ptpbDiscountTahunan : constants.ptpbDiscountBulanan)[visits] || 0;
  const kg = Math.max(1, Math.round(Number(kgPerVisit) || 1));
  const tl = ['MEDIS', 'KOMERSIL'].includes(wasteId) ? Math.max(0, Math.round(Number(tlKg) || 0)) : 0;
  const biayaLimbah = base.paket * kg * visits;
  const biayaTL = constants.lampuTLInPaket * tl * visits;
  const biayaTransport = paketCost(distanceKm, constants, content) * visits;
  const pengurang = discountPer * visits;
  const harga = mround(biayaLimbah + biayaTL + biayaTransport - pengurang + contract, 10000);
  return { harga, contract, discountPer };
}

const DEF = {
  mou: 'Biaya yang dikenakan untuk dokumen kontrak kerjasama sebagai pemenuhan persyaratan lembaga/instansi',
  limbah: 'Biaya yang dikenakan untuk limbah yang dipilih, limbah akan ditimbang dan dikenakan cas per kgnya',
  transport: 'Biaya yang dikenakan untuk pengambilan, handling dan pengantaran limbah untuk di olah.',
  kontrak: 'Biaya kontrak paket yang sudah termasuk dalam harga paket',
};

// Concise, itemized summary of a `quote` (from computeQuote() or buildReferralQuote()) — every
// selected item with its price, unit, quantity and subtotal, plus the pelayanan/limbah notes,
// condensed to a few short lines. This is what's actually reused in:
//   - the WhatsApp message sent to CS (lib/waMessages.js)
//   - the "Rincian Pelayanan & Harga" section shown/submitted in the unified registration step
//   - the {rinc} placeholder of the generated contract (Apps Script)
// It replaces the earlier plain `quote.summary` label/value list, which only described the
// *choices* made (location, waste type, range...) and never actually showed price/qty/unit —
// which read as unclear and didn't match the numbers on the price list document the customer
// received (quote.items, rendered in full in QuoteDocument.jsx / the emailed PDF).
export function buildPricelistSummaryText(quote) {
  if (!quote) return '';
  const lines = [];
  lines.push(`Layanan: ${quote.serviceLabel || '-'}`);
  (quote.summary || []).forEach((s) => lines.push(`${s.label}: ${s.value}`));

  if ((quote.items || []).length) {
    lines.push('');
    lines.push('Rincian Item:');
    quote.items.forEach((it, i) => {
      const unit = (it.unit || '').replace(/^per\s+/i, '');
      const qtyPart = it.qty != null ? ` x ${Number(it.qty).toLocaleString('id-ID')}` : '';
      lines.push(`${i + 1}. ${it.item} — ${formatIDR(it.harga)}/${unit}${qtyPart} = ${formatIDR(it.amount)}`);\n      if (it.definisi) lines.push(`   Deskripsi: ${it.definisi}`);
    });
  }

  if (quote.total != null) {
    lines.push(`${quote.totalLabel || 'Total'}: ${formatIDR(quote.total)}`);
  }

  const noteParts = [];
  if (quote.notes?.pelayanan) noteParts.push(quote.notes.pelayanan.trim());
  if (quote.notes?.limbah) noteParts.push(quote.notes.limbah.trim());
  if (noteParts.length) {
    lines.push('');
    lines.push(`Catatan: ${noteParts.join(' ')}`);
  }

  return lines.join('\n');
}

export function computeQuote(state, constants, content, multiplier = 1, showAll = false) {
  const { location, waste, service, params } = state;
  if (!location || !waste || !service) return null;
  if (!constants || !content) return null;
  if (!showAll && !params) return null;

  const cards = content?.services || SERVICE_CARDS;
  const svc = cards[service] || SERVICE_CARDS[service];
  const wasteTypes = content?.wasteTypes || WASTE_TYPES;
  const wasteInfo = wasteTypes.find((w) => w.id === waste);
  const notes = content?.notes || { global: '', waste: {}, service: {} };
  const base = WASTE_BASE[waste];
  const loc = findLocation(location, content);
  const hasSpkmin = (loc?.available || []).includes('SPKMIN');

  const items = [];
  const summary = [
    { label: 'Lokasi Pengambilan', value: location },
    { label: 'Jenis Limbah', value: waste },
  ];
  let total = null;
  let totalLabel = '';
  let vehicle = null;
  let code = '';

  if (service === 'SPK') {
    const ranges = hasSpkmin ? SPK_RANGES : SPK_RANGES.filter((r) => r.tier);
    if (showAll) {
      items.push({ item: 'Biaya MOU (Kontrak)', definisi: DEF.mou, harga: constants.mou, unit: 'per Tahun', qty: null, amount: constants.mou });
      ranges.forEach((r) => {
        const sp = spkRangePrice(waste, location, r.id, constants, content);
        items.push({ item: `Harga Limbah — ${sp.range.label}`, definisi: DEF.limbah, harga: sp.rate, unit: 'per Kg', qty: null, amount: sp.rate });
        items.push({
          item: sp.vehicle ? `Biaya Transport — ${sp.vehicle} (${sp.range.label})` : `Biaya Transport (${sp.range.label})`,
          definisi: DEF.transport,
          harga: sp.transportBase,
          unit: 'per Ritase',
          qty: null,
          amount: sp.transportBase,
        });
      });
      totalLabel = 'Harga Satuan';
      summary.push({ label: 'Kontrak', value: 'Ya — termasuk MOU' });
      code = `LIMBAHIN-PL-${location}-${waste}-SPK-ALL`;
    } else {
      if (params.range == null || params.needContract == null) return null;
      const sp = spkRangePrice(waste, location, params.range, constants, content);
      const needContract = params.needContract === true;
      const transportUnit = needContract ? sp.transportBase : sp.transportBase + constants.noContractSurcharge;
      vehicle = sp.vehicle;
      if (needContract) {
        items.push({ item: 'Biaya MOU (Kontrak)', definisi: DEF.mou, harga: constants.mou, unit: 'per Tahun', qty: null, amount: constants.mou });
      }
      items.push({ item: `Harga Limbah — ${sp.range.label}`, definisi: DEF.limbah, harga: sp.rate, unit: 'per Kg', qty: null, amount: sp.rate });
      items.push({
        item: sp.vehicle ? `Biaya Transport — ${sp.vehicle}` : 'Biaya Transport',
        definisi: DEF.transport,
        harga: transportUnit,
        unit: 'per Ritase',
        qty: null,
        amount: transportUnit,
      });
      totalLabel = 'Harga Satuan';
      summary.push({ label: 'Jumlah Limbah per Ambil', value: sp.range.label });
      summary.push({ label: 'Kendaraan', value: sp.vehicle || '-' });
      summary.push({
        label: 'Kontrak',
        value: needContract
          ? `Ya — + ${formatIDR(constants.mou)} per tahun`
          : `Tidak — + ${formatIDR(constants.noContractSurcharge)} per ritase transport`,
      });
      code = `LIMBAHIN-PL-${location}-${waste}-SPK-${params.range}`;
    }
  } else if (service === 'PTPB') {
    const pushPtpb = (opt, period, visits) => {
      const { harga } = ptpbOptionPrice(waste, location, { kgPerVisit: opt.kg, tlKg: opt.tl }, period, visits, constants, content);
      const kuota = `Kuota limbah ${opt.kg * visits} kg per ${period === 'tahun' ? 'tahun' : 'bulan'}${opt.tl ? ` · Lampu TL ${opt.tl * visits} kg` : ''}`;
      items.push({
        item: `${period === 'tahun' ? 'Paket Tahunan' : 'Paket Bulanan'} — ${ptpbOptionLabel(opt, waste)} — ${visits}× kunjungan`,
        definisi: `${DEF.kontrak}. ${kuota}`,
        harga,
        unit: period === 'tahun' ? 'per Tahun' : 'per Bulan',
        qty: null,
        amount: harga,
      });
    };
    if (showAll) {
      PTPB_FIXED_OPTIONS.forEach((opt) => {
        PTPB_OPTIONS.tahun.forEach((v) => pushPtpb(opt, 'tahun', v));
        PTPB_OPTIONS.bulan.forEach((v) => pushPtpb(opt, 'bulan', v));
      });
      totalLabel = 'Harga Paket';
      summary.push({ label: 'Opsi', value: 'Semua paket tahunan & bulanan' });
      code = `LIMBAHIN-PL-${location}-${waste}-PTPB-ALL`;
    } else {
      if (!params.option || params.monthly == null || params.visits == null) return null;
      const opt = PTPB_FIXED_OPTIONS.find((o) => o.id === params.option);
      if (!opt) return null;
      const period = params.monthly === true ? 'bulan' : 'tahun';
      pushPtpb(opt, period, params.visits);
      totalLabel = 'Harga Paket';
      summary.push({ label: 'Paket Limbah', value: ptpbOptionLabel(opt, waste) });
      summary.push({ label: 'Periode', value: period === 'tahun' ? 'Tahunan' : 'Bulanan' });
      summary.push({ label: 'Kunjungan', value: `${params.visits}× per ${period === 'tahun' ? 'tahun' : 'bulan'}` });
      summary.push({ label: 'Tarif Kelebihan Limbah', value: `${formatIDR(period === 'tahun' ? base.spk : base.bulanan)}/kg` });
      code = `LIMBAHIN-PL-${location}-${waste}-PTPB-${opt.id}-${period}-${params.visits}`;
    }
  } else if (service === 'RUTIN') {
    const rates = rutinRates(waste, constants);
    if (showAll) {
      rates.forEach((t) => {
        items.push({ item: `${t.kg} kg per bulan — ${t.freq}`, definisi: DEF.limbah, harga: t.rate, unit: 'per Kg', qty: t.kg, amount: t.rate * t.kg });
      });
      totalLabel = 'Estimasi Biaya per Bulan';
      summary.push({ label: 'Opsi', value: 'Semua tier rutin' });
      code = `LIMBAHIN-PL-${location}-${waste}-RUTIN-ALL`;
    } else {
      if (params.kg == null) return null;
      const t = rates.find((r) => r.kg === Number(params.kg));
      if (!t) return null;
      items.push({ item: `${t.kg} kg per bulan — ${t.freq}`, definisi: DEF.limbah, harga: t.rate, unit: 'per Kg', qty: t.kg, amount: t.rate * t.kg });
      totalLabel = 'Estimasi Biaya per Bulan';
      summary.push({ label: 'Jumlah Limbah per Bulan', value: `${t.kg} kg` });
      summary.push({ label: 'Tagihan Minimum', value: 'Mengikuti jumlah limbah per bulan yang dipilih' });
      code = `LIMBAHIN-PL-${location}-${waste}-RUTIN-${t.kg}`;
    }
  }

  if (multiplier !== 1) {
    items.forEach((it) => {
      it.harga = Math.round(it.harga * multiplier);
      it.amount = Math.round(it.amount * multiplier);
    });
    if (total != null) total = Math.round(total * multiplier);
  }

  // "Catatan Pelayanan" — service note template (Supabase `pricelist_notes.service_notes[service]`)
  // with its {{token}} placeholders resolved against the live constants + the selected waste
  // type's own rates, so numbers quoted in the note always match what's actually charged.
  const noteTokens = {
    noContractSurcharge: formatIDR(constants.noContractSurcharge),
    lampuTLOutPaket: formatIDR(constants.lampuTLOutPaket),
    ptpbExtraVisitFee: formatIDR(constants.ptpbExtraVisitFee),
    limbahTahun: base ? formatIDR(base.spk) : '',
    limbahBulan: base ? formatIDR(base.bulanan) : '',
  };
  const pelayananNote = renderNoteTemplate(notes.service?.[service] || '', noteTokens);

  return {
    service,
    serviceLabel: svc.name,
    code,
    vehicle,
    definisi: svc.definisi,
    summary,
    items,
    total,
    totalLabel,
    notes: {
      pelayananTitle: 'Catatan Pelayanan',
      pelayanan: pelayananNote,
      limbah: notes.waste?.[waste] || wasteInfo?.definisi || '',
      global: notes.global || '',
    },
  };
}