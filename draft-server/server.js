import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const wss = new WebSocketServer({ port: 8080 });

const players = {
    "lebron james": null,
    "stephen curry": null,
    "kevin durant": null,
    "luka doncic": null,
    "victor wembanyama": null,
    "nikola jokic": null,
    "shai gilgeous-alexander": null,
    "joel embiid": null,
    "james harden": null,
    "kyrie irving": null,
    "paul george": null,
    "kawhi leonard": null,
    "anthony davis": null,
    "russell westbrook": null,
    "lamelo ball": null,
    "jayson tatum": null,
    "jaylen brown": null,
    "giannis antetokounmpo": null,
    "damian lillard": null,
    "jamal murray": null,
    "deni avdija": null,
    "donovan mitchell": null
};

let turnOrder = [];
let waitingList = [];
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
            if (turnOrder.includes(data.toString().trim().replaceAll(' ', '_'))) {
                ws.name = null;
                ws.send(JSON.stringify({ type: 'error', message: 'Name already taken' }));
                return;
            }
            ws.pendingName = data.toString().trim().replaceAll(' ', '_'); //give it a pending name so it can be added to the waiting list with a name
            if (draftStarted) {
                ws.send(JSON.stringify({ type: 'error', message: 'Draft already started, wait for it to end' }));
                waitingList.push(ws);
                return;
            }
            ws.name = ws.pendingName;
            ws.pendingName = null;
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
            const namePart = data.toString().trim().split(/\s(.*)/)[1];
            if (namePart === undefined) {
                ws.send(JSON.stringify({ type: 'error', message: 'Player name cannot be empty' }))
                return;
            }
            const player = namePart.trim().toLowerCase();
            if (!(player in players)) {
                ws.send(JSON.stringify({ type: 'error', message: 'Player does not exist' }))
                return;
            }
            if (players[player] !== null) {
                ws.send(JSON.stringify({ type: 'error', message: `Player already picked by ${players[player]}` }))
                return;
            }
            players[player] = ws.name;
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'serverMessage', message: `${turnOrder[turn]} picked ${player}` }))
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

    ws.on('close', function close() {
        if (turnOrder.includes(ws.name)) {
            turnOrder.splice(turnOrder.indexOf(ws.name), 1);
        } else if (waitingList.includes(ws)) {
            waitingList.splice(waitingList.indexOf(ws), 1);
        }
        if (!draftStarted && ws.name !== null) {
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'userLeft', name: ws.name }));
                }
            });
        } else if (draftStarted && ws.name !== null) {
            draftStarted = false;
            turn = 0;
            let playersArray = Object.keys(players);
            for (let i = 0; i < playersArray.length; i++) {
                players[playersArray[i]] = null;
            }
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'userLeft', name: ws.name }));
                    client.send(JSON.stringify({ type: 'error', message: `Draft ended because ${ws.name} left` }))
                }
            });
            onDraftEnd();
        }
    });
});


// getUsers() function returns an array of every connected and named client in the server
function getUsers() {
    let users = [];
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN && client.name !== null) {
                    users.push(client.name);
                }
            })
    return users;
}

//onDraftEnd() function is called at the end of the draft to clear waiting list
function onDraftEnd() {
    if (waitingList.length > 0) {
        //maybe unoptimal, but informs everyone all of the users that joined from the waiting list
        wss.clients.forEach(function each(client) {
            waitingList.forEach(function each(ws) {
                if (client.readyState === WebSocket.OPEN && client !== ws) {
                    client.send(JSON.stringify({ type: 'userJoined', name: ws.pendingName }));
                }
            });
        });
        waitingList.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                turnOrder.push(client.pendingName); //adds client to the draft list
                client.name = client.pendingName;
                client.pendingName = null;
                client.send(JSON.stringify({ type: 'userList', users: getUsers() }));
            }
        });
        waitingList = []; //clears the waiting list
    }
}
