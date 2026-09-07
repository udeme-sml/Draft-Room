import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const wss = new WebSocketServer({ port: 8080 });

const players = [
    "Lebron James",
    "Stephen Curry",
    "Kevin Durant",
    "Luka Doncic",
    "Victor Wembanyama",
    "Nikola Jokic",
    "Shai Gilgeous-Alexander",
    "Joel Embiid",
    "James Harden",
    "Kyrie Irving",
    "Paul George",
    "Kawhi Leonard",
    "Anthony Davis",
    "Russell Westbrook",
    "LaMelo Ball",
    "Jayson Tatum",
    "Jaylen Brown",
    "Giannis Antetokounmpo",
    "Damian Lillard",
    "Jamal Murray",
    "Deni Avdija",
    "Donovan Mitchell"
];

let turnOrder = [];
let turn = 0;
let draftStarted = false;

wss.on('connection', function connection(ws) {
    ws.on('error', console.error);
    ws.id = uuidv4();
    ws.name = null;

    ws.on('message', function message(data, isBinary) {
        console.log('received: %s', data);

        if (ws.name === null) {
            if (data.toString().trim() === '') {
                ws.send(JSON.stringify({ type: 'error', message: 'Name cannot be empty' }));
                return;
            }
            if (data.toString().trim().length > 16) {
                ws.send(JSON.stringify({ type: 'error', message: 'Name cannot be longer than 16 characters' }));
                return;
            }
            if (data.toString().trim().includes('/') || data.toString().trim().includes('\\') || data.toString().trim().includes('|') || data.toString().trim().includes('?') ||
                data.toString().trim().includes('*') || data.toString().trim().includes('"') || data.toString().trim().includes('<') || data.toString().trim().includes('>') || 
                data.toString().trim().includes(':')) {
                ws.send(JSON.stringify({ type: 'error', message: 'Name cannot contain invalid characters' }));
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
            turnOrder.push(ws.name);
            return;
        }
        if (data.toString().trim().startsWith('/start')) {
            if (draftStarted) {
                ws.send(JSON.stringify({ type: 'error', message: 'Draft already started' }))
                return;
            }
            if (turnOrder.length < 2) {
                ws.send(JSON.stringify({ type: 'error', message: 'Not enough players to start draft' }))
                return;
            }
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'serverMessage', message: 'Draft started' }));
                    client.send(JSON.stringify({ type: 'serverMessage', message: `${turnOrder[turn]} is picking first...` }))
                }
            });
            draftStarted = true;
            return;
        }
        if (data.toString().trim().startsWith('/pick')) {
            if (!draftStarted) {
                ws.send(JSON.stringify({ type: 'error', message: 'Draft not started yet' }))
                return;
            }
            if (turnOrder[turn] !== ws.name) {
                ws.send(JSON.stringify({ type: 'error', message: `It is ${turnOrder[turn]}'s turn to pick` }))
                return;
            }
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'serverMessage', message: `${turnOrder[turn]} picked` }))
                }
            });
            if (turn >= turnOrder.length - 1) {
                turn = 0
            } else {
                turn++;
            }
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'serverMessage', message: `${turnOrder[turn]} is picking next...` }))
                }
            });
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

    ws.send(JSON.stringify({ type: 'serverMessage', message: 'Connected' }));
    console.log('connection established');
    ws.send(JSON.stringify({ type: 'serverRequest', request: 'Name: ' }));
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