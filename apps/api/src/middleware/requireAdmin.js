function requireAdmin(req, _res, next) {
  if (req.user?.role === "admin") {
    return next();
  }

  const err = new Error("Bu endpoint sadece admin kullanicilar icindir.");
  err.statusCode = 403;
  return next(err);
}

module.exports = {
  requireAdmin
};
