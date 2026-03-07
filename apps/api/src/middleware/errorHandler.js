function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Endpoint bulunamadi: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || "Beklenmeyen sunucu hatasi",
    details: err.details || undefined
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
