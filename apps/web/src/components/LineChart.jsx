function cizgiNoktalari(veri, xAlan, yAlan, width, height, padding = 24) {
  if (!veri.length) return "";

  const xMax = veri.length - 1;
  const yDegerleri = veri.map((item) => Number(item[yAlan]));
  const yMin = Math.min(...yDegerleri);
  const yMax = Math.max(...yDegerleri);
  const yAralik = yMax - yMin || 1;

  return veri
    .map((item, index) => {
      const x = padding + ((width - padding * 2) * (index / xMax || 0));
      const yNormalize = (Number(item[yAlan]) - yMin) / yAralik;
      const y = height - padding - (height - padding * 2) * yNormalize;
      return `${x},${y}`;
    })
    .join(" ");
}

function LineChart({ title, data, xAlan, yAlan, renk = "#2f80ed" }) {
  if (!data || data.length === 0) {
    return (
      <div className="grafik-kapsayici">
        <h3>{title}</h3>
        <p>Grafik verisi bulunamadi.</p>
      </div>
    );
  }

  const width = 640;
  const height = 260;
  const polyline = cizgiNoktalari(data, xAlan, yAlan, width, height);
  const ilk = data[0]?.[yAlan];
  const son = data[data.length - 1]?.[yAlan];

  return (
    <div className="grafik-kapsayici">
      <div className="grafik-baslik">
        <h3>{title}</h3>
        <span>
          {Number(ilk).toFixed(2)} → {Number(son).toFixed(2)}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        <polyline fill="none" stroke={renk} strokeWidth="3" points={polyline} />
      </svg>
    </div>
  );
}

export default LineChart;
