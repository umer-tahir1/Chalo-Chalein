import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const supabaseUrl = `https://${projectId}.supabase.co`;
export const supabase = createClient(supabaseUrl, publicAnonKey);
const CLIENT_SESSION_STORAGE_KEY = 'chalochalein_client_session_id';
const API_REQUEST_TIMEOUT_MS = 12000;

export const getClientSessionId = () => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CLIENT_SESSION_STORAGE_KEY) || '';
};

export const ensureClientSessionId = () => {
  if (typeof window === 'undefined') return '';
  let existing = getClientSessionId();
  if (!existing) {
    existing = crypto.randomUUID();
    window.localStorage.setItem(CLIENT_SESSION_STORAGE_KEY, existing);
  }
  return existing;
};

const sendSessionEvent = async (endpoint: '/session/start' | '/session/heartbeat' | '/session/end', keepalive = false) => {
  const sessionId = ensureClientSessionId();
  if (!sessionId) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const headers = new Headers();
  headers.set('apikey', publicAnonKey);
  headers.set('Authorization', `Bearer ${publicAnonKey}`);
  headers.set('x-user-token', session.access_token);
  headers.set('x-client-session-id', sessionId);
  headers.set('Content-Type', 'application/json');

  await fetch(`${supabaseUrl}/functions/v1/make-server-93f7752e${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId }),
    keepalive,
  });
};

export const startClientSession = async () => {
  await sendSessionEvent('/session/start');
};

export const heartbeatClientSession = async () => {
  await sendSessionEvent('/session/heartbeat');
};

export const endClientSession = async (keepalive = false) => {
  try {
    await sendSessionEvent('/session/end', keepalive);
  } finally {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CLIENT_SESSION_STORAGE_KEY);
    }
  }
};

// Utility for fetching from the custom edge function server
export const fetchServer = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${supabaseUrl}/functions/v1/make-server-93f7752e${endpoint}`;
  
  // Get current session for Auth token
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers);
  headers.set('apikey', publicAnonKey);
  const clientSessionId = getClientSessionId();
  if (clientSessionId) {
    headers.set('x-client-session-id', clientSessionId);
  }
  
  if (session?.access_token) {
    // If we want to pass the user's access token, we can do it via a custom header
    // so that the Edge Function gateway doesn't reject ES256 tokens if misconfigured.
    // The Edge Function gateway uses the anon key to route and authorize the request to the project.
    headers.set('Authorization', `Bearer ${publicAnonKey}`);
    headers.set('x-user-token', session.access_token);
  } else {
    headers.set('Authorization', `Bearer ${publicAnonKey}`);
  }
  
  headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out. Please check your internet and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  
  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (e) {}
    let errorData = {};
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {}
    console.error("fetchServer error details:", {
      status: response.status,
      url,
      errorText,
      headers: Object.fromEntries(headers.entries()),
    });
    throw new Error(errorData.error || `HTTP error! status: ${response.status}. Details: ${errorText}`);
  }
  
  return response.json();
};
