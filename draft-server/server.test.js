import { test, before, after } from 'node:test';
import { assert } from 'node:assert';
import { WebSocket } from 'ws';
import createServer from './server.js';

const PORT = 0;
let server;

before(() => {
    server = createServer(PORT);
});

after(() => {
    server.close();
});

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