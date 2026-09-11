import { test, before, after } from 'node:test';
import assert from 'node:assert';
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