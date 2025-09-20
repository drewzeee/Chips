import crypto from "crypto";

const API_BASE_URL = "https://api.gemini.com";

interface GeminiResponse<T> {
  result?: string;
  data?: T;
  message?: string;
}

export interface GeminiBalance {
  currency: string;
  amount: string;
  available: string;
  availableForWithdrawal: string;
  type: string;
}

export interface GeminiTrade {
  timestamp: number;
  timestampms: number;
  tid: number;
  price: string;
  amount: string;
  exchange: string;
  type: "buy" | "sell";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createSignature(apiSecret: string, payload: string): string {
  return crypto
    .createHmac("sha384", apiSecret)
    .update(payload)
    .digest("hex");
}

async function geminiRequest<T>(
  endpoint: string,
  params: Record<string, any> = {}
): Promise<T> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const apiSecret = requireEnv("GEMINI_API_SECRET");

  const nonce = Date.now().toString();
  const payload = {
    request: `/v1/${endpoint}`,
    nonce,
    ...params,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = createSignature(apiSecret, encodedPayload);

  const response = await fetch(`${API_BASE_URL}/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "Content-Length": "0",
      "X-GEMINI-APIKEY": apiKey,
      "X-GEMINI-PAYLOAD": encodedPayload,
      "X-GEMINI-SIGNATURE": signature,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Gemini API Error Details:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
      endpoint,
    });
    throw new Error(`Gemini request failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as T;
  return json;
}

export async function fetchGeminiBalances(): Promise<GeminiBalance[]> {
  return await geminiRequest<GeminiBalance[]>("balances", {
    account: "primary"
  });
}

export async function fetchGeminiTrades(
  symbol: string,
  params: { limit_trades?: number; timestamp?: number } = {}
): Promise<GeminiTrade[]> {
  return await geminiRequest<GeminiTrade[]>("mytrades", {
    symbol,
    ...params,
  });
}

// Get all available symbols
export async function fetchGeminiSymbols(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/v1/symbols`);

  if (!response.ok) {
    throw new Error(`Failed to fetch symbols: ${response.status}`);
  }

  return await response.json();
}