import crypto from "crypto";

const API_BASE_URL = "https://api.kraken.com";

interface KrakenResponse<T> {
  error: string[];
  result: T;
}

export interface KrakenBalance {
  [currency: string]: string;
}

export interface KrakenBalanceFormatted {
  currency: string;
  amount: number;
  source: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createKrakenSignature(
  path: string,
  postData: string,
  secret: string,
  nonce: string
): string {
  // Kraken signature: SHA256(nonce + postdata) + path, then HMAC-SHA512 with base64 decoded secret
  const hash = crypto.createHash("sha256").update(nonce + postData).digest();
  const message = Buffer.concat([Buffer.from(path, 'utf8'), hash]);
  const hmac = crypto.createHmac("sha512", Buffer.from(secret, "base64"));
  return hmac.update(message).digest("base64");
}

async function krakenRequest<T>(
  endpoint: string,
  params: Record<string, any> = {}
): Promise<T> {
  const apiKey = requireEnv("KRAKEN_API_KEY");
  const apiSecret = requireEnv("KRAKEN_API_SECRET");

  const nonce = Date.now().toString();
  const path = `/0/private/${endpoint}`;

  const postData = new URLSearchParams({
    nonce,
    ...params,
  }).toString();

  const signature = createKrakenSignature(path, postData, apiSecret, nonce);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "API-Sign": signature,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: postData,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Kraken API Error Details:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
      endpoint,
    });
    throw new Error(`Kraken request failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as KrakenResponse<T>;

  if (json.error && json.error.length > 0) {
    throw new Error(`Kraken API error: ${json.error.join(", ")}`);
  }

  return json.result;
}

// Currency mapping for common Kraken symbols
const KRAKEN_CURRENCY_MAP: Record<string, string> = {
  XXBT: "BTC",
  XETH: "ETH",
  ZUSD: "USD",
  ZEUR: "EUR",
  ADA: "ADA",
  DOT: "DOT",
  SOL: "SOL",
  MATIC: "MATIC",
  LINK: "LINK",
  UNI: "UNI",
  AAVE: "AAVE",
  // Add more mappings as needed
};

function normalizeKrakenCurrency(krakenSymbol: string): string {
  return KRAKEN_CURRENCY_MAP[krakenSymbol] || krakenSymbol;
}

export async function fetchKrakenBalances(): Promise<KrakenBalanceFormatted[]> {
  const balances = await krakenRequest<KrakenBalance>("Balance");

  const formattedBalances: KrakenBalanceFormatted[] = [];

  for (const [krakenCurrency, amount] of Object.entries(balances)) {
    const numericAmount = parseFloat(amount);

    // Only include non-zero balances
    if (numericAmount > 0) {
      formattedBalances.push({
        currency: normalizeKrakenCurrency(krakenCurrency),
        amount: numericAmount,
        source: "kraken",
      });
    }
  }

  return formattedBalances;
}

export async function fetchKrakenTrades(params: {
  pair?: string;
  start?: number;
  end?: number;
} = {}): Promise<any> {
  return await krakenRequest("TradesHistory", params);
}