const authService = require("../services/authService");

async function register(req, res, next) {
  try {
    const sonuc = await authService.register(req.body);
    res.status(201).json({ success: true, data: sonuc });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const sonuc = await authService.login(req.body);
    res.json({ success: true, data: sonuc });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  me
};
