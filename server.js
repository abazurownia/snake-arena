// server.js
const { WebSocketServer } = require('ws');

// Use Render's environment variable port, or default to 3000 for local testing
const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

let players = {};

wss.on('connection', (ws) => {
    // Generate a unique identifier for the connected player
    let myId = Math.random().toString(36).substring(2, 9);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Player joins the network arena
            if (data.type === 'join') {
                players[myId] = {
                    id: myId,
                    name: data.name,
                    startRGB: data.startRGB,
                    endRGB: data.endRGB,
                    segments: [],
                    baseRadius: 16,
                    spawnTime: Date.now(),
                    actuallyBoosting: false
                };
                ws.send(JSON.stringify({ type: 'init', id: myId }));
            }
            
            // Continuous position/state synchronization updates
            if (data.type === 'sync' && players[myId]) {
                players[myId].segments = data.segments;
                players[myId].baseRadius = data.baseRadius;
                players[myId].spawnTime = data.spawnTime;
                players[myId].actuallyBoosting = data.actuallyBoosting;
                
                // Broadcast current game state collection to all live clients
                const packet = JSON.stringify({ type: 'update', players });
                wss.clients.forEach(client => {
                    if (client.readyState === 1) client.send(packet);
                });
            }

            // Sync mass-drops from real player deaths across all network points
            if (data.type === 'death') {
                wss.clients.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ 
                            type: 'spawnDeathOrbs',
                            segments: data.segments, 
                            startRGB: data.startRGB, 
                            endRGB: data.endRGB 
                        }));
                    }
                });
            }
        } catch (err) {
            console.error("Packet error:", err);
        }
    });

    ws.on('close', () => {
        delete players[myId];
        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({ type: 'update', players }));
            }
        });
    });
});

console.log(`🐍 Snake Arena server successfully listening on port ${PORT}!`);
