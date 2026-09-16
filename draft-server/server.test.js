import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import createServer from './server.js';
import { waitForOpen, waitForMessage, connectAndName, connectLobby, startDraftClient } from './test-helpers.js';

const PORT = 0;
let server;

before(() => {
    server = createServer(PORT);
});

after(() => {
    server.close();
});

// Connection & naming
test('One client connects to the server', async () => {
    const client = new WebSocket(`ws://localhost:${server.address().port}`);

    const serverResponse = await new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client.send('Bob');
            } else if (data.type === 'userList') {
                resolve(data);
                clearTimeout(timeout);
                client.close();
            }
        });

        client.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client.close();
        });

    });

    assert(serverResponse.users.length === 1);
    assert(serverResponse.users[0] === 'Bob');
});

// Multi-client lobby
test('Two clients connect to the server', async () => {
    const client1 = new WebSocket(`ws://localhost:${server.address().port}`);
    const client2 = new WebSocket(`ws://localhost:${server.address().port}`);

    const serverResponse1 = new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client1.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client1.send('Alice');
            } else if (data.type === 'userJoined') {
                resolve(data);
                clearTimeout(timeout);
                client1.close();
            }
        });

        client1.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client1.close();
        });

    });

    const serverResponse2 = new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client2.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client2.send('Bob');
            } else if (data.type === 'userList') {
                resolve(data);
                clearTimeout(timeout);
                client2.close();
            }
        });

        client2.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client2.close();
        });
    });

    const [response1, response2] = await Promise.all([serverResponse1, serverResponse2]);

    assert(response1.name === 'Bob');
    assert(response2.users.length === 2);
    assert(response2.users[0] === 'Alice');
    assert(response2.users[1] === 'Bob');
})

test('/users returns every user in the room', async () => {
    const client1 = new WebSocket(`ws://localhost:${server.address().port}`);
    const client2 = new WebSocket(`ws://localhost:${server.address().port}`);
    const client3 = new WebSocket(`ws://localhost:${server.address().port}`);

    const serverResponse1 = new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client1.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client1.send('Alice');
            } else if (data.type === 'userList') {
                resolve(data);
                clearTimeout(timeout);
            }
        });

        client1.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client1.close();
        });
    });

    const serverResponse2 = new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client2.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client2.send('Bob');
            } else if (data.type === 'userList') {
                resolve(data);
                clearTimeout(timeout);
            }
        });

        client2.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client2.close();
        });
    });

    const serverResponse3 = new Promise((resolve, reject) => {

        let sentMessage = false;

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client3.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client3.send('Charlie');
            } else if (data.type === 'userList' && !sentMessage) {
                sentMessage = true;
                client3.send('/users');
            } else if (data.type === 'userList' && sentMessage) {
                resolve(data);
                clearTimeout(timeout);
            }
        });

        client3.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client3.close();
        });
    });

    const [response1, response2, response3] = await Promise.all([serverResponse1, serverResponse2, serverResponse3]);
    try {
        assert(response3.users.length === 3);
        assert.deepStrictEqual([...response3.users].sort(), ['Alice', 'Bob', 'Charlie']);
    } finally {
        client1.close();
        client2.close();
        client3.close();
    }
});

// /start rules
test('/start with one player fails', async () => {
    const client = new WebSocket(`ws://localhost:${server.address().port}`);

    const serverResponse = await new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client.send('Alice');
            } else if (data.type === 'userList') {
                client.send('/start');
            } else if (data.type === 'error') {
                resolve(data);
                clearTimeout(timeout);
                client.close();
            }
        });

        client.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client.close();
        });
    });

    assert(serverResponse.message === 'Not enough players to start draft');
});

test('/start with two players succeeds', async () => {
    const client1 = new WebSocket(`ws://localhost:${server.address().port}`);
    const client2 = new WebSocket(`ws://localhost:${server.address().port}`);

    const serverResponse1 = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        const messages = [];

        client1.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client1.send('Alice');
            } else if (data.type === 'userJoined') {
                client1.send('/start');
            } else if (data.type === 'serverMessage' && data.message !== 'Connected') {
                messages.push(data);
                if (messages.length === 2) {
                    resolve(messages);
                    clearTimeout(timeout);
                    client1.close();
                }
            }
        });

        client1.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client1.close();
        });
    });

    const serverResponse2 = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        const messages = [];

        client2.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client2.send('Bob');
            } else if (data.type === 'serverMessage' && data.message !== 'Connected') {
                messages.push(data);
                if (messages.length === 2) {
                    resolve(messages);
                    clearTimeout(timeout);
                    client2.close();
                }
            }
        });

        client2.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client2.close();
        });
    });

    const [response1, response2] = await Promise.all([serverResponse1, serverResponse2]);
    assert(response1[0].type === 'serverMessage');
    assert(response1[0].message === 'Draft started');
    assert(response1[1].type === 'serverMessage');
    assert(response1[1].message === 'Alice is picking first...' || response1[1].message === 'Bob is picking first...');
    assert(response2[0].type === 'serverMessage');
    assert(response2[0].message === 'Draft started');
    assert(response2[1].type === 'serverMessage');
    assert(response2[1].message === 'Alice is picking first...' || response2[1].message === 'Bob is picking first...');
});

// /pick rules
test('Valid pick', async () => {
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);
    
    const p1 = waitForMessage(clients[0].client, (data) => data.type === 'serverMessage' && data.message.includes(' picked '));
    const p2 = waitForMessage(clients[1].client, (data) => data.type === 'serverMessage' && data.message.includes('is picking next'));

    clients[0].client.send('/pick lebron james');

    const [response1, response2] = await Promise.all([p1, p2]);

    assert(response1.type === 'serverMessage');
    assert(response1.message === 'Alice picked lebron james');
    assert(response2.type === 'serverMessage');
    assert(response2.message === 'Bob is picking next...');

    clients[0].client.close();
    clients[1].client.close();
})