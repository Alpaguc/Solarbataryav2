const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");
const legacyUiRoutes = require("./routes/legacyUiRoutes");
const { CORS_ORIGIN } = require("./config/env");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: false
  })
);
app.use(express.json({ limit: "2mb" }));

app.use("/api", apiRoutes);
app.use("/", legacyUiRoutes);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    app: "SolarBatarya API",
    docs: "/api/health"
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
