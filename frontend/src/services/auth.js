import axios from "axios";

export const AUTH_STORAGE_KEY = "adaptive_disaster_auth_session";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://gvermgjeqpbeoaacsupq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_W0uqAFU7OhF9XClNTwTLCA_ht54N1_t";

const authClient = axios.create({
  baseURL: `${SUPABASE_URL}/auth/v1`,
  timeout: 15000,
  headers: {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  },
});

export const getStoredSession = () => {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const persistSession = (session) => {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredSession = () => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const signInWithPassword = async ({ email, password }) => {
  const response = await authClient.post("/token?grant_type=password", {
    email,
    password,
  });

  const session = response.data;
  persistSession(session);
  return session;
};

export const signUpWithPassword = async ({ email, password }) => {
  const baseUrl =
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const emailRedirectTo = baseUrl ? `${baseUrl.replace(/\/$/, "")}/login` : undefined;

  const response = await authClient.post("/signup", {
    email,
    password,
    ...(emailRedirectTo ? { email_redirect_to: emailRedirectTo } : {}),
  });

  const result = response.data;
  if (result?.access_token) {
    persistSession(result);
  }

  return result;
};

export const refreshSession = async (refreshToken) => {
  const response = await authClient.post("/token?grant_type=refresh_token", {
    refresh_token: refreshToken,
  });

  const session = response.data;
  persistSession(session);
  return session;
};

export const fetchCurrentUser = async (accessToken) => {
  const response = await authClient.get("/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
};

export const signOut = () => {
  clearStoredSession();
};
