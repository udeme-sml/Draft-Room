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
                ws.send(JSON.stringify({ type: 'error', message: 'name cannot be empty' }));
                return;
            }
            if (data.toString().trim().length > 16) {
                ws.send(JSON.stringify({ type: 'error', message: 'name cannot be longer than 16 characters' }));
                return;
            }
            ws.name = data.toString().trim().replaceAll(' ', '_');
            wss.clients.forEach(function each(client) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'userJoined', name: ws.name }));
                }
            });
            let users = getUsers();
            ws.send(JSON.stringify({ type: 'userList', users: users }));
            return;
        }
        if (data.toString().trim() === '/users') {
            let users = getUsers();
            ws.send(JSON.stringify({ type: 'userList', users: users }));
            return;
        }
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(JSON.stringify({ type: 'chat', from: ws.name, text: data.toString() }));
            }
        })
    });

    ws.send(JSON.stringify({ type: 'serverMessage', message: 'connected' }));
    console.log('connection established');
    ws.send(JSON.stringify({ type: 'serverRequest', request: 'name: ' }));
});

function getUsers() {
    let users = [];
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN && client.name !== null) {
                    users.push(client.name);
                }
            })
    return users;
}