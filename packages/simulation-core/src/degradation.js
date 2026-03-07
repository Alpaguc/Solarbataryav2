function hesaplaCevrimKaybiOrani(cycleLifeAt80Dod) {
  const guvenliCevrim = Number(cycleLifeAt80Dod) > 0 ? Number(cycleLifeAt80Dod) : 6000;
  return 0.2 / guvenliCevrim;
}

function hesaplaDodKatsayisi(dodOrani) {
  if (!Number.isFinite(dodOrani) || dodOrani <= 0) {
    return 0.45;
  }
  const referansDod = 0.8;
  const katsayi = dodOrani / referansDod;
  return Math.max(0.35, Math.min(1.6, katsayi));
}

function guncelleKapasite({ mevcutKapasiteKwh, ilkKapasiteKwh, efc, dodOrani, cycleLifeAt80Dod, yillikTakvimKaybiYuzde }) {
  const cevrimKayipOrani = efc * hesaplaCevrimKaybiOrani(cycleLifeAt80Dod) * hesaplaDodKatsayisi(dodOrani);
  const takvimKaybiOrani = (Number(yillikTakvimKaybiYuzde) || 0) / 100 / 365;
  const toplamKayip = Math.max(0, cevrimKayipOrani + takvimKaybiOrani);
  const guncel = mevcutKapasiteKwh * (1 - toplamKayip);
  const altSinir = ilkKapasiteKwh * 0.6;
  return Math.max(altSinir, guncel);
}

module.exports = {
  guncelleKapasite
};
