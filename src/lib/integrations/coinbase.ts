import crypto from "crypto";
import jwt from "jsonwebtoken";

const API_BASE_URL = "https://api.coinbase.com/api/v3/brokerage";

interface CoinbaseResponse<T> {
  accounts?: T;
  transactions?: T;
  has_next?: boolean;
  cursor?: string;
}

export interface CoinbaseAccount {
  uuid: string;
  name: string;
  currency: string;
  available_balance: {
    value: string;
    currency: string;
  };
  hold?: {
    value: string;
    currency: string;
  };
}

export interface CoinbaseTransaction {
  id: string;
  type: string;
  status: string;
  amount: {
    value: string;
    currency: string;
  };
  native_amount?: {
    value: string;
    currency: string;
  };
  description?: string;
  created_at: string;
  updated_at: string;
  resource: string;
  resource_path: string;
  details?: {
    title?: string;
    subtitle?: string;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createJWT(apiKey: string, privateKey: string): string {
  const keyName = apiKey; // Use the API key directly

  const payload = {
    sub: keyName,
    iss: "coinbase-cloud",
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes
    aud: ["retail_rest_api_proxy"]
  };

  const options = {
    algorithm: 'ES256' as const,
    header: {
      kid: keyName,
      alg: 'ES256',
      typ: 'JWT'
    }
  };

  return jwt.sign(payload, privateKey, options);
}

async function coinbaseRequest<T>(
  method: string,
  path: string,
  options: { body?: unknown; query?: URLSearchParams } = {}
): Promise<T> {
  const apiKey = requireEnv("COINBASE_API_KEY");
  const privateKey = requireEnv("COINBASE_API_SECRET");

  const token = createJWT(apiKey, privateKey);
  console.log('Generated JWT:', token.substring(0, 50) + '...');
  console.log('API Key:', apiKey);

  let requestPath = path.startsWith("/") ? path : `/${path}`;
  const search = options.query?.toString();
  if (search) {
    requestPath = `${requestPath}?${search}`;
  }

  const bodyString = options.body ? JSON.stringify(options.body) : "";

  const response = await fetch(`${API_BASE_URL}${requestPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: method.toUpperCase() === "GET" ? undefined : bodyString,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Coinbase API Error Details:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
      requestPath,
    });
    throw new Error(`Coinbase request failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as T;
  return json;
}

export async function fetchCoinbaseAccounts(): Promise<CoinbaseAccount[]> {
  const result = await coinbaseRequest<CoinbaseResponse<CoinbaseAccount[]>>("GET", "/accounts");
  return result.accounts || [];
}

export async function fetchCoinbaseTransactions(
  accountId: string,
  params: { limit?: number; cursor?: string } = {}
): Promise<CoinbaseTransaction[]> {
  const query = new URLSearchParams();
  if (params.limit) {
    query.set("limit", params.limit.toString());
  }
  if (params.cursor) {
    query.set("cursor", params.cursor);
  }

  const result = await coinbaseRequest<CoinbaseResponse<CoinbaseTransaction[]>>(
    "GET",
    `/accounts/${accountId}/transactions`,
    { query }
  );

  return result.transactions || [];
}