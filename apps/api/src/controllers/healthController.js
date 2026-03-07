function healthCheck(_req, res) {
  res.json({
    success: true,
    status: "OK",
    service: "solarbatarya-api",
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  healthCheck
};
