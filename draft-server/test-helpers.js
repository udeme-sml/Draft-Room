import { WebSocket } from 'ws';
import createServer from './server.js';

function waitForOpen(ws, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        if (ws.readyState === WebSocket.OPEN) {
            resolve();
            return;
        }

        const timeout = setTimeout(() => reject(new Error('WebSocket open timed out')), timeoutMs);

        ws.once('open', () => {
            clearTimeout(timeout);
            resolve();
        });

        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

function waitForMessage(ws, predicate, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timed out')), timeoutMs);

        const onMessage = (message) => {
            const data = JSON.parse(message);
            if (predicate(data)) {
                ws.off('message', onMessage);
                clearTimeout(timeout);
                resolve(data);
            }
        };

        ws.on('message', onMessage);

        ws.once('error', (error) => {
            ws.off('message', onMessage);
            clearTimeout(timeout);
            reject(error);
        });
    });
}

async function connectAndName(port, name, timeoutMs = 2000) {
    const client = new WebSocket(`ws://localhost:${port}`);
    const requestPromise = waitForMessage(client, (data) => data.type === 'serverRequest', timeoutMs);

    await waitForOpen(client);
    await requestPromise;

    client.send(name);

    const userListMsg = await waitForMessage(client, (data) => data.type === 'userList', timeoutMs);
    return { client, userList: userListMsg };
}

/** Join names in order so turnOrder matches the array. */
async function connectLobby(port, names, timeoutMs = 2000) {
    const lobby = [];
    for (const name of names) {
        lobby.push(await connectAndName(port, name, timeoutMs));
    }
    return lobby;
}

/**
 * Sends /start from one lobby client and waits for draft broadcast messages.
 * @param {{ client: WebSocket }} lobbyClient - entry from connectAndName / connectLobby
 * @returns {Promise<[object, object]>} [Draft started, …is picking first…]
 */
async function startDraftClient(lobbyClient, timeoutMs = 2000) {
    const { client } = lobbyClient;
    const draftStartedPromise = waitForMessage(
        client,
        (data) => data.type === 'serverMessage' && data.message === 'Draft started',
        timeoutMs
    );
    const pickingFirstPromise = waitForMessage(
        client,
        (data) =>
            data.type === 'serverMessage' &&
            typeof data.message === 'string' &&
            data.message.endsWith('is picking first...'),
        timeoutMs
    );

    client.send('/start');

    const draftStarted = await draftStartedPromise;
    const pickingFirst = await pickingFirstPromise;
    return [draftStarted, pickingFirst];
}

function closeTestServer(server) {
    for (const client of [...server.clients]) {
        client.terminate();
    }

    return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
    });
}

/** Fresh room for one test. Closed after the test, including on failure. */
async function useTestServer(t) {
    const server = createServer(0);
    t.after(() => closeTestServer(server));

    if (server.address()) return server;

    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    return server;
}

export { waitForOpen, waitForMessage, connectAndName, connectLobby, startDraftClient, useTestServer };
