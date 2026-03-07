const batteryRepository = require("../repositories/batteryCatalogRepository");
const profileRepository = require("../repositories/profileRepository");

async function getCatalogBrands() {
  return batteryRepository.listBrands();
}

async function getCatalogModels(brandId) {
  const modeller = await batteryRepository.listModelsByBrand(brandId);
  const zengin = [];
  for (const model of modeller) {
    const specs = await batteryRepository.getSpecsByModelId(model.id);
    zengin.push({ ...model, dodSpecs: specs });
  }
  return zengin;
}

async function getTariffProfiles() {
  return profileRepository.listTariffProfiles();
}

async function getSolarProfiles() {
  return profileRepository.listSolarProfiles();
}

module.exports = {
  getCatalogBrands,
  getCatalogModels,
  getTariffProfiles,
  getSolarProfiles
};
