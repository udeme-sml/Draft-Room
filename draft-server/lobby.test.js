import { test } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { waitForMessage, connectLobby, useTestServer } from './test-helpers.js';

test('Two clients connect to the server', async (t) => {
    const server = await useTestServer(t);
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

test('/users returns every user in the room', async (t) => {
    const server = await useTestServer(t);
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

    try {
        const [response1, response2, response3] = await Promise.all([serverResponse1, serverResponse2, serverResponse3]);
        assert(response3.users.length === 3);
        assert.deepStrictEqual([...response3.users].sort(), ['Alice', 'Bob', 'Charlie']);
    } finally {
        client1.close();
        client2.close();
        client3.close();
    }
});

test('Client disconnects before draft', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    
    clients[1].client.close();
    const response = await waitForMessage(clients[0].client, (data) => data.type === 'userLeft');
    assert(response.type === 'userLeft');
    assert(response.name === 'Bob');
    clients[0].client.close();
})

test('Test goes to others only', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);

    const responsePromise = waitForMessage(clients[1].client, (data) => data.type === 'chat');
    const aliceCheck = waitForMessage(clients[0].client, (data) => data.type === 'chat', 100).then(
        () => {
            throw new Error('Alice should not receive the message');
        },
        () => {}
    );

    clients[0].client.send('Hello');

    const [response] = await Promise.all([responsePromise, aliceCheck]);
    assert(response.text === 'Hello');
    assert(response.from === 'Alice');
    clients[0].client.close();
    clients[1].client.close();
})
