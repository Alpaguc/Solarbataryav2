function paraFormat(deger) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(Number(deger || 0));
}

function AnnualCashflowTable({ rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="grafik-kapsayici">
      <div className="grafik-baslik">
        <h3>Yillik Nakit Akisi</h3>
      </div>
      <div className="tablo-kapsayici">
        <table className="modern-tablo">
          <thead>
            <tr>
              <th>Yil</th>
              <th>Baz Gelir</th>
              <th>Depolamali Gelir</th>
              <th>Bakim</th>
              <th>Net Ek Gelir</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.yil}>
                <td>{row.yil}</td>
                <td>{paraFormat(row.bazGelirTry)}</td>
                <td>{paraFormat(row.depolamaliGelirTry)}</td>
                <td>{paraFormat(row.yillikBakimTry)}</td>
                <td>{paraFormat(row.netEkGelirTry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AnnualCashflowTable;
