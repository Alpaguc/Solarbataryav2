import axios from "axios";

function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (window.location.hostname === "localhost") {
    return "http://localhost:3001/api";
  }
  return "https://solarbataryav2-api.onrender.com/api";
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export async function register(payload) {
  const { data } = await api.post("/auth/register", payload);
  return data.data;
}

export async function login(payload) {
  const { data } = await api.post("/auth/login", payload);
  return data.data;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data.data;
}

export async function getMyProject() {
  const { data } = await api.get("/projects/me");
  return data.data;
}

export async function createProject(payload) {
  const { data } = await api.post("/projects", payload);
  return data.data;
}

export async function getBrands() {
  const { data } = await api.get("/catalog/brands");
  return data.data;
}

export async function getModels(brandId) {
  const { data } = await api.get("/catalog/models", { params: { brandId } });
  return data.data;
}

export async function getTariffs() {
  const { data } = await api.get("/catalog/tariffs");
  return data.data;
}

export async function getSolarProfiles() {
  const { data } = await api.get("/catalog/solar-profiles");
  return data.data;
}

export async function getEpiasData(params) {
  const { data } = await api.get("/epias-data", { params });
  return data;
}

export async function getEpiasDateRange() {
  const { data } = await api.get("/epias-date-range");
  return data.data;
}

export async function runSimulation(payload) {
  const { data } = await api.post("/simulations", payload);
  return data.data;
}

export async function getSimulation(runId) {
  const { data } = await api.get(`/simulations/${runId}`);
  return data.data;
}
