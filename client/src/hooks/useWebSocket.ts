import { useEffect } from 'react';
import { useAlertStore } from '../store';

const API = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

// Module-level singleton: one socket shared across all hook instances
let socketInstance: any = null;
let socketConnecting = false;

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useWebSocket(lgaName?: string, stateName?: string) {
  const addNotification = useAlertStore((s) => s.addNotification);

  useEffect(() => {
    let mounted = true;

    async function ensureConnected() {
      if (socketConnecting) return;
      socketConnecting = true;
      try {
        if (!socketInstance) {
          const { io: socketIO } = await import('socket.io-client');
          socketInstance = socketIO(API, {
            transports: ['websocket', 'polling'],
            reconnectionDelayMax: 30000,
          });
        }
      } catch {
        // socket.io-client not available — fall back silently
        socketConnecting = false;
        return;
      }
      socketConnecting = false;

      if (!mounted) return;

      socketInstance.on('connect', () => {
        if (lgaName) socketInstance.emit('subscribe-lga', lgaName);
        if (stateName) socketInstance.emit('subscribe-state', stateName);
      });

      socketInstance.on('alert', (payload: any) => {
        if (!mounted) return;
        addNotification({
          id: genId(),
          type: payload.type || 'alert',
          message: payload.description || `Risk change: ${payload.lga_name}`,
          severity: payload.severity || 'medium',
          timestamp: payload.timestamp || new Date().toISOString(),
          lga_name: payload.lga_name,
          state: payload.state,
        });
      });

      if (socketInstance.connected) {
        if (lgaName) socketInstance.emit('subscribe-lga', lgaName);
        if (stateName) socketInstance.emit('subscribe-state', stateName);
      }
    }

    ensureConnected();

    return () => {
      mounted = false;
    };
  }, [lgaName, stateName, addNotification]);

  return socketInstance;
}
