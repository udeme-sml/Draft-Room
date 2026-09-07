import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
    ws.on('error', console.error);
    ws.id = uuidv4();
    ws.name = null;

    ws.on('message', function message(data, isBinary) {
        console.log('received: %s', data);

        if (ws.name === null) {
            if (data.toString().trim() === '') {
                ws.send('name cannot be empty');
                return;
            }
            if (data.toString().trim().length > 16) {
                ws.send('name cannot be longer than 16 characters');
                return;
            }
            ws.name = data.toString().trim().replaceAll(' ', '_');
            wss.clients.forEach(function each(client) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(`${ws.name} joined the chat`);
                }
            });
            let users = [];
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN && client.name !== null) {
                    users.push(client.name);
                }
            })
            ws.send(`Users: ${users.join(', ')}`);
            return;
        }
        if (data.toString().trim() === '/users') {
            let users = [];
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN && client.name !== null) {
                    users.push(client.name);
                }
            })
            ws.send(`Users: ${users.join(', ')}`);
            return;
        }
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(`${ws.name}: ${data.toString()}`);
            }
        })
    });

    ws.send('connected');
    console.log('connection established');
    ws.send('name: ');
});