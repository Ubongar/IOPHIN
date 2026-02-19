import { useEffect, useRef } from 'react';
import { useAlertStore } from '../store';

const API = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

let socketInstance: any = null;

export function useWebSocket(lgaName?: string, stateName?: string) {
  const addNotification = useAlertStore((s) => s.addNotification);
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let io: any;

    async function connect() {
      try {
        const { io: socketIO } = await import('socket.io-client');
        io = socketIO(API, {
          transports: ['websocket', 'polling'],
          reconnectionDelay: reconnectDelay.current,
          reconnectionDelayMax: 30000,
        });
        socketInstance = io;

        io.on('connect', () => {
          reconnectDelay.current = 1000;
          if (lgaName) io.emit('subscribe-lga', lgaName);
          if (stateName) io.emit('subscribe-state', stateName);
        });

        io.on('alert', (payload: any) => {
          addNotification({
            id: crypto.randomUUID(),
            type: payload.type || 'alert',
            message: payload.description || `Risk change: ${payload.lga_name}`,
            severity: payload.severity || 'medium',
            timestamp: payload.timestamp || new Date().toISOString(),
            lga_name: payload.lga_name,
            state: payload.state,
          });
        });

        io.on('connect_error', () => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        });
      } catch {
        // socket.io-client not available — fall back silently
      }
    }

    connect();

    return () => {
      if (io) io.disconnect();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [lgaName, stateName, addNotification]);

  return socketInstance;
}
