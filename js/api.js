/**
 * @file api.js
 * @description Cliente de API para comunicação com o backend Apps Script.
 *              Implementa Stale-While-Revalidate via Cache API.
 *              Retry com backoff exponencial para falhas transitórias.
 */

/* eslint-disable no-unused-vars */

/**
 * @typedef {Object} ApiClientConfig
 * @property {string} baseUrl - URL de deploy da Web App no Apps Script.
 * @property {string} cacheName - Nome do cache store no Cache API.
 * @property {number} maxAgeMs - Tempo máximo de validade do cache local (ms).
 * @property {number} maxRetries - Número máximo de tentativas.
 */

/** @type {ApiClientConfig} */
const API_CONFIG = {
  baseUrl: 'COLE_A_URL_DO_DEPLOY_APPS_SCRIPT_AQUI',
  cacheName: 'mediquo-api-v1',
  maxAgeMs: 5 * 60 * 1000,
  maxRetries: 3,
};

/**
 * Pausa a execução por um tempo determinado.
 * @param {number} ms - Milissegundos.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Faz fetch com retry e backoff exponencial.
 * Diferencia falhas transitórias (5xx, network) de permanentes (4xx).
 * @param {string} url - URL da requisição.
 * @param {RequestInit} [options={}] - Opções do fetch.
 * @param {number} [retries=API_CONFIG.maxRetries] - Tentativas restantes.
 * @returns {Promise<Response>}
 */
const fetchWithRetry = async (url, options = {}, retries = API_CONFIG.maxRetries) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
      console.warn(`[api] Tentativa ${attempt + 1}/${retries + 1} falhou: ${response.status}`);
    } catch (err) {
      lastError = err;
      console.warn(`[api] Tentativa ${attempt + 1}/${retries + 1} falhou: ${err.message}`);
    }

    if (attempt < retries) {
      const delay = Math.min(1000 * (2 ** attempt), 8000);
      await sleep(delay);
    }
  }

  throw lastError;
};

/**
 * Busca dados da API com estratégia Stale-While-Revalidate.
 * 1. Retorna cache imediato se disponível (stale).
 * 2. Em background, faz fetch e atualiza o cache.
 * 3. Chama onFresh quando dados atualizados chegam.
 *
 * @param {string} action - Ação da API (ex.: 'getData').
 * @param {function(Object): void} onStale - Callback com dados do cache.
 * @param {function(Object): void} onFresh - Callback com dados atualizados.
 * @param {function(Error): void} onError - Callback de erro.
 * @returns {Promise<void>}
 */
const fetchSWR = async (action, onStale, onFresh, onError) => {
  const url = `${API_CONFIG.baseUrl}?action=${encodeURIComponent(action)}`;
  const cacheKey = `swr-${action}`;
  let hasStale = false;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      const age = Date.now() - (parsed._ts || 0);

      if (age < API_CONFIG.maxAgeMs) {
        onStale(parsed.data);
        hasStale = true;
      }
    }
  } catch (err) {
    console.warn('[api] Erro ao ler cache local:', err.message);
  }

  try {
    const response = await fetchWithRetry(url);
    const json = await response.json();

    if (!json.ok) {
      throw new Error(json.error || 'Erro desconhecido da API');
    }

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data: json.data,
        _ts: Date.now(),
      }));
    } catch (storageErr) {
      console.warn('[api] Erro ao salvar cache local:', storageErr.message);
    }

    onFresh(json.data);
  } catch (err) {
    console.error('[api] Erro ao buscar dados frescos:', err.message);

    if (!hasStale) {
      onError(err);
    }
  }
};

/**
 * Faz uma requisição POST autenticada para o admin.
 * @param {string} action - Ação admin.
 * @param {Object} data - Dados da operação.
 * @param {string} token - Google ID Token.
 * @returns {Promise<Object>} Resposta da API.
 */
const adminPost = async (action, data, token) => {
  const url = API_CONFIG.baseUrl;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, data, token }),
  });

  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || 'Erro na operação admin.');
  }
  return json;
};
