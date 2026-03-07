const { all, get } = require("../db/connection");

async function listTariffProfiles() {
  return all(
    `SELECT id, code, name, currency
     FROM tariff_profiles
     ORDER BY name ASC`
  );
}

async function listSolarProfiles() {
  return all(
    `SELECT id, code, name, location
     FROM solar_profiles
     ORDER BY name ASC`
  );
}

async function getTariffProfileByCode(code) {
  return get(
    `SELECT id, code, name, currency, hourly_price_json
     FROM tariff_profiles
     WHERE code = ?`,
    [code]
  );
}

async function getSolarProfileByCode(code) {
  return get(
    `SELECT id, code, name, location, hourly_generation_json
     FROM solar_profiles
     WHERE code = ?`,
    [code]
  );
}

module.exports = {
  listTariffProfiles,
  listSolarProfiles,
  getTariffProfileByCode,
  getSolarProfileByCode
};
