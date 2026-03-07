function paraFormat(deger) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(deger);
}

function sayiFormat(deger, birim = "") {
  const metin = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(deger);
  return birim ? `${metin} ${birim}` : metin;
}

function KpiCards({ summary }) {
  if (!summary) return null;

  const kartlar = [
    { etiket: "Depolamali Toplam Gelir", deger: paraFormat(summary.totalWithBatteryRevenueTry) },
    { etiket: "Ek Gelir", deger: paraFormat(summary.extraRevenueTry) },
    { etiket: "Geri Odeme Suresi", deger: summary.paybackYears ? sayiFormat(summary.paybackYears, "yil") : "Hesaplanamadi" },
    { etiket: "ROI", deger: `%${sayiFormat(summary.roiPercent)}` },
    { etiket: "Son Kapasite", deger: sayiFormat(summary.finalCapacityKwh, "kWh") },
    { etiket: "Kapasite Korunumu", deger: `%${sayiFormat(summary.finalCapacityPercent)}` }
  ];

  return (
    <div className="kpi-grid">
      {kartlar.map((kart) => (
        <article className="kpi-kart" key={kart.etiket}>
          <small>{kart.etiket}</small>
          <strong>{kart.deger}</strong>
        </article>
      ))}
    </div>
  );
}

export default KpiCards;
