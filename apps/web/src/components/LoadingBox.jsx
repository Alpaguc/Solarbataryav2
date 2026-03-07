function LoadingBox({ text = "Hesaplama yapiliyor..." }) {
  return (
    <div className="loading-kutu">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export default LoadingBox;
