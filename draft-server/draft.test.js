import { test } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { waitForMessage, connectLobby, startDraftClient, useTestServer } from './test-helpers.js';

test('/start with one player fails', async (t) => {
    const server = await useTestServer(t);
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

test('/start with two players succeeds', async (t) => {
    const server = await useTestServer(t);
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

test('/start twice fails', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);

    clients[0].client.send('/start');

    const response = await waitForMessage(clients[0].client, (data) => data.type === 'error');
    assert(response.message === 'Draft already started');
    clients[0].client.close();
    clients[1].client.close();
})

test('/pick before start fails', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);

    const responsePromise = waitForMessage(clients[0].client, (data) => data.type === 'error');
    clients[0].client.send('/pick lebron james');
    const response = await responsePromise;

    assert(response.message === 'Draft not started yet');
    clients[0].client.close();
    clients[1].client.close();
})

test('/pick on wrong turn fails', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);

    const responsePromise = waitForMessage(clients[1].client, (data) => data.type === 'error');
    clients[1].client.send('/pick lebron james');
    const response = await responsePromise;
    assert(response.message === 'It is Alice\'s turn to pick');
    clients[0].client.close();
    clients[1].client.close();
})

test('/pick with empty name fails', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);
    const responsePromise = waitForMessage(clients[0].client, (data) => data.type === 'error');
    clients[0].client.send('/pick ');
    const response = await responsePromise;
    assert(response.message === 'Player name cannot be empty');
    clients[0].client.close();
    clients[1].client.close();
})

test('/pick with invalid name fails', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);
    const responsePromise = waitForMessage(clients[0].client, (data) => data.type === 'error');
    clients[0].client.send('/pick fake player');
    const response = await responsePromise;
    assert(response.message === 'Player does not exist');
    clients[0].client.close();
    clients[1].client.close();
})

test('Valid pick', async (t) => {
    const server = await useTestServer(t);
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

test('Player already picked fails', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);

    const r1 =waitForMessage(clients[1].client, (data) => data.type === 'error');
    clients[0].client.send('/pick lebron james');
    await waitForMessage(clients[0].client, (data) => data.message === 'Alice picked lebron james');
    clients[1].client.send('/pick lebron james');

    const response = await r1;
    assert(response.message === 'Player already picked by Alice');
    clients[0].client.close();
    clients[1].client.close();
})

test('Pick turn wraps', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);

    clients[0].client.send('/pick lebron james');

    await waitForMessage(clients[1].client, (data) => data.type === 'serverMessage' && data.message.includes(' picked '));

    clients[1].client.send('/pick stephen curry');

    const p1 = await waitForMessage(clients[0].client, (data) => data.message === 'Alice is picking next...');

    clients[0].client.send('/pick nikola jokic');

    const p2 = await waitForMessage(clients[1].client, (data) => data.message === 'Alice picked nikola jokic');

    clients[0].client.close();
    clients[1].client.close();
})

test('Join after draft started', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);
    const client3 = new WebSocket(`ws://localhost:${server.address().port}`);
    const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client3.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client3.send('Charlie');
            } else if (data.type === 'error') {
                resolve(data);
                clearTimeout(timeout);
                client3.close();
            }
        });

        client3.on('error', (error) => {
            reject(error);
            clearTimeout(timeout);
            client3.close();
        });
    });

    assert(response.message === 'Draft already started, wait for it to end');
    clients[0].client.close();
    clients[1].client.close();
    client3.close();
})

test('Waiting list promoted after draft ends', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);
    const client3 = new WebSocket(`ws://localhost:${server.address().port}`);
    const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client3.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client3.send('Charlie');
            } else if (data.type === 'userList') {
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

    await waitForMessage(client3, (data) => data.type === 'error');
    clients[0].client.close();

    const response = await responsePromise;
    assert(response.users.length === 2);
    assert(response.users.includes('Charlie'));
    clients[1].client.close();
    client3.close();
})

test('Leave during draft ends draft', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);
    clients[0].client.close();
    const response = await waitForMessage(clients[1].client, (data) => data.type === 'error');
    assert(response.message === 'Draft ended because Alice left');
    clients[1].client.close();
})

test('Leave from waiting list only', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    await startDraftClient(clients[0]);
    const client3 = new WebSocket(`ws://localhost:${server.address().port}`);
    const start = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);
        client3.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client3.send('Charlie');
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

    client3.close();
    const response = await waitForMessage(clients[0].client, (data) => data.type === 'error', 200).then(
        () => {
            throw new Error('There should not be an error when leaving from waiting list only');
        },
        () => {}
    );
    clients[0].client.close();
    clients[1].client.close();
})

test('Empty draft state on start', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    const draftStatePromise = waitForMessage(clients[0].client, (data) => data.type === 'draftState');
    await startDraftClient(clients[0]);

    const response = await draftStatePromise;
    
    assert(response.turnOrder.length === 2);
    assert(response.onClock === 'Alice');
    assert(response.picks.length === 0);
    clients[0].client.close();
    clients[1].client.close();
})

test('Draft state on pick', async (t) => {
    const server = await useTestServer(t);
    const clients = await connectLobby(server.address().port, ['Alice', 'Bob']);
    const startDraftState = waitForMessage(clients[0].client, (data) => data.type === 'draftState');
    await startDraftClient(clients[0]);

    await startDraftState;
    const pickDraftState = waitForMessage(clients[0].client, (data) => data.type === 'draftState' && data.picks.length === 1);
    clients[0].client.send('/pick lebron james');
    const response = await pickDraftState;

    assert(response.turnOrder.length === 2);
    assert(response.onClock === 'Bob');
    assert(response.picks[0].player === 'lebron james');
    assert(response.picks[0].by === 'Alice');
    clients[0].client.close();
    clients[1].client.close();
})
