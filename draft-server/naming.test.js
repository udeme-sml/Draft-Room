import { test } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { useTestServer } from './test-helpers.js';

test('One client connects to the server', async (t) => {
    const server = await useTestServer(t);
    const client = new WebSocket(`ws://localhost:${server.address().port}`);

    let dat;
    const serverResponse = await new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverMessage') {
                dat = data;
            } else if (data.type === 'serverRequest') {
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

    assert(dat.message === 'Connected');
    assert(serverResponse.users.length === 1);
    assert(serverResponse.users[0] === 'Bob');
});

test('Empty name rejected', async (t) => {
    const server = await useTestServer(t);
    const client = new WebSocket(`ws://localhost:${server.address().port}`);

    const serverResponse = await new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client.send('');
            } else if (data.type === 'error') {
                resolve(data);
                clearTimeout(timeout);
                client.close();
            }

            client.on('error', (error) => {
                reject(error);
                clearTimeout(timeout);
                client.close();
            });
        });
    });

    assert(serverResponse.message === 'Name cannot be empty');
});

test('Name too long rejected', async (t) => {
    const server = await useTestServer(t);
    const client = new WebSocket(`ws://localhost:${server.address().port}`);

    const serverResponse = await new Promise((resolve, reject) => {

        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);

        client.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client.send('A'.repeat(17));
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

    assert(serverResponse.message === 'Name cannot be longer than 16 characters');
});

test('Invalid characters rejected', async (t) => {
    const server = await useTestServer(t);
    const client = new WebSocket(`ws://localhost:${server.address().port}`);
    
    const serverResponse = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);
        
        client.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client.send('Alice!@#$%^&*()');
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

    assert(serverResponse.message === 'Name cannot contain invalid characters');
});

test('Spaces become underscores', async (t) => {
    const server = await useTestServer(t);
    const client = new WebSocket(`ws://localhost:${server.address().port}`);
    
    const serverResponse = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timed out')), 2000);
        
        client.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'serverRequest') {
                client.send('Alice Smith');
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

    assert(serverResponse.users[0] === 'Alice_Smith');
});

test('Name already taken rejected', async (t) => {
    const server = await useTestServer(t);
    const client1 = new WebSocket(`ws://localhost:${server.address().port}`);
    const client2 = new WebSocket(`ws://localhost:${server.address().port}`);
    
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
                client2.send('Alice');
            } else if (data.type === 'error') {
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

    try {
    const [response1, response2] = await Promise.all([serverResponse1, serverResponse2]);

        assert(response1.users.length === 1);
        assert(response1.users[0] === 'Alice');
        assert(response2.message === 'Name already taken');
    } finally {
        client1.close();
        client2.close();
    }
});
