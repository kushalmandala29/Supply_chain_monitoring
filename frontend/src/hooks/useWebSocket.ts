import { useCallback, useEffect, useRef } from "react";

import { StreamKey, useJarvisStore } from "../store/useStore";

function generateId(): string {
  // crypto.randomUUID() only exists in secure contexts (HTTPS or localhost);
  // fall back to a non-cryptographic id so LAN/HTTP access still works.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getSessionId(): string {
  const existing = sessionStorage.getItem("jarvis_session_id");
  if (existing) return existing;
  const id = generateId();
  sessionStorage.setItem("jarvis_session_id", id);
  return id;
}

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const setConnectionStatus = useJarvisStore((s) => s.setConnectionStatus);
  const ingest = useJarvisStore((s) => s.ingest);
  const setSendQuery = useJarvisStore((s) => s.setSendQuery);

  useEffect(() => {
    // React StrictMode double-invokes this effect in dev (mount -> cleanup ->
    // mount) to surface non-idempotent effects like this one. `live` makes
    // the first (StrictMode-phantom) socket's handlers inert once its cleanup
    // has run, so it can't double-forward messages onto a session the second
    // socket is also connected to.
    let live = true;

    const sessionId = getSessionId();
    const url = `${import.meta.env.VITE_GATEWAY_WS_URL}?session_id=${sessionId}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      if (live) setConnectionStatus("open");
    };
    socket.onclose = () => {
      if (live) setConnectionStatus("closed");
    };
    socket.onmessage = (event) => {
      if (!live) return;
      const message = JSON.parse(event.data) as {
        stream: StreamKey;
        payload: Record<string, unknown>;
      };
      ingest(message.stream, message.payload);
    };

    return () => {
      live = false;
      socket.close();
    };
  }, [ingest, setConnectionStatus]);

  const sendQuery = useCallback((query: string) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not open yet, dropping query:", query);
      return;
    }
    socket.send(JSON.stringify({ query }));
  }, []);

  // Registered into the shared store so other components (e.g. the map,
  // where clicking a route/node should ask the same question a typed query
  // would) can trigger a query without needing their own socket connection.
  useEffect(() => {
    setSendQuery(sendQuery);
  }, [sendQuery, setSendQuery]);

  return { sendQuery };
}
