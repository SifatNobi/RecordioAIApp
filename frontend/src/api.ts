import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "recordio_session_token";

let memToken: string | null = null;

export async function setToken(token: string | null) {
  memToken = token;
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

export async function loadToken(): Promise<string | null> {
  if (memToken) return memToken;
  const t = await storage.secureGet<string>(TOKEN_KEY, "");
  memToken = t || null;
  return memToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await loadToken();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let resp: Response;
  try {
    resp = await fetch(`${BASE}${path}`, { ...opts, headers });
  } catch {
    throw new ApiError(0, "Network error. Check your connection and try again.");
  }

  if (resp.status === 401) {
    memToken = null;
    await storage.secureRemove(TOKEN_KEY);
    throw new ApiError(401, "Session expired. Please sign in again.");
  }

  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!resp.ok) {
    const msg = (data && data.detail) || (typeof data === "string" ? data : "Request failed");
    throw new ApiError(resp.status, msg);
  }
  return data as T;
}

export type User = { user_id: string; email: string; name: string; picture: string };
export type Trial = { used: number; limit: number; remaining: number };
export type Commitment = { category: string; commitment: string; quote: string; speaker: string };
export type Record = {
  record_id: string;
  created_at: string;
  capture_method: string;
  agent_name: string;
  agent_version: string;
  policy_version: string;
  conversation_type: string;
  transcript: string;
  transcript_sha256: string;
  audio_sha256: string;
  summary: string;
  promises: Commitment[];
  prices_or_fees: Commitment[];
  dates_or_deadlines: Commitment[];
  warranties_or_disclosures: Commitment[];
  cancellations_or_changes: Commitment[];
  verification_status: string;
  last_verified_at: string;
};

export const api = {
  authSession: (session_id: string) =>
    request<{ session_token: string; user: User }>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  me: () => request<User>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  trial: () => request<Trial>("/trial"),
  listRecords: (q?: string) =>
    request<{ records: Record[] }>(`/records${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getRecord: (id: string) => request<Record>(`/records/${id}`),
  createRecord: (payload: {
    transcript: string;
    capture_method: string;
    agent_name: string;
    agent_version?: string;
    policy_version?: string;
    conversation_type: string;
    audio_sha256?: string;
  }) =>
    request<{ record: Record; trial: Trial }>("/records", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyRecord: (id: string) =>
    request<{
      match: boolean;
      verification_status: string;
      stored_hash: string;
      recomputed_hash: string;
      verified_at: string;
    }>(`/records/${id}/verify`, { method: "POST" }),
  deleteRecord: (id: string) => request<{ ok: boolean }>(`/records/${id}`, { method: "DELETE" }),
  transcribe: async (uri: string, name: string, type: string) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await fetch(uri).then((r) => r.blob());
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type } as any);
    }
    return request<{ transcript: string; audio_sha256: string }>("/transcribe", {
      method: "POST",
      body: form,
    });
  },
};
