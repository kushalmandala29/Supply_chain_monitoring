/**
 * WebSocket client service for real-time communication.
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, ((data: Record<string, unknown>) => void)[]> = new Map();

  constructor(clientId: string) {
    this.url = `ws://localhost:8000/ws/${clientId}`;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type as string;
        const listeners = this.handlers.get(type) || [];
        listeners.forEach((handler) => handler(data));
      } catch (e) {
        console.error("WebSocket message parse error:", e);
      }
    };
  }

  on(type: string, handler: (data: Record<string, unknown>) => void) {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  send(message: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}
