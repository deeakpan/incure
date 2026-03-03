import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Set();

export function initWebSocket(server) {
  wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected. Total:', clients.size);
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected. Total:', clients.size);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  console.log('WebSocket server initialized');
}

export function broadcast(message) {
  if (!wss) return;
  
  const data = JSON.stringify(message);
  let count = 0;
  
  clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(data);
        count++;
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        clients.delete(client);
      }
    }
  });
  
  if (count > 0) {
    console.log(`Broadcasted to ${count} clients:`, message.type);
  }
}
