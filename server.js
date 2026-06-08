// server.js
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 3000 });

let players = {};

wss.on('connection', (ws) => {
    // Generate a unique identifier for the connected player
    let myId = Math.random().toString(36).substring(2, 9);
    console.log(`👤 New player connected. Assigning network ID: ${myId}`);
    
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
                console.log(`🎮 Player "${data.name}" (${myId}) has joined the arena.`);
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
                console.log(`💀 Player ${myId} died. Relaying death orbs across network.`);
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
        console.log(`🔌 Player ${myId} disconnected.`);
        delete players[myId];
        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({ type: 'update', players }));
            }
        });
    });
});

console.log('🐍 Snake Arena LAN server successfully listening on port 3000!');
