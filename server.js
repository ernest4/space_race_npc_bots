/* Copyright 2018 Ernestas Monkevicius

This is a stripped down version of the game server, repurposed as an NPC
or 'bots' server for stress testing the game server and providing NPC clients
to the game.

The server is stripped down and simpliefied to simulate clients running at full
speed as much as possible as we're interested in stressing the game server, not
the NPC server. Thus, most of the game server messages are recieved, but ignored.
*/
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server); //server for bots interface
var clientIO = require('socket.io-client'); //for NPC client bots

const numCPUs = require('os').cpus().length; //single threaded for now, potential to utilize more cores in future...

/* Globals */
//var gameServer = 'https://node-game-server-1.herokuapp.com/';
var gameServer = 'https://node-game-server-2.herokuapp.com/';
var npcs = {};
var npcKeys = [];
var npsState = { bots: 0 };
var movementIntervalFunction;
var reusableMovementObject = { x: 0, y: 0, rotation: 0};
//var dateObj = new Date();
var currenTime = Date.now();
var deltaTime = 0;
var lowestDeltaTime = 0;
var averageDeltaTime = 0;
var maxDeltaTime = 0;
var tick = 0;
var frameCount = 0;
var serverState = {fpsMin: 1000000, fpsAvg: 0, fpsMax: 0, fpsTarget: 20};

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});
const eventMSG = Object.freeze({
    player: Object.freeze({
        list: "1",
        new: "2",
        disconnect: "3",
        movement: "4",
        moved: "5"
    }),
    star: Object.freeze({
        location: "6",
        collected: "7"
    }),
    score: Object.freeze({
        update: "8"
    })
});

io.on('connection', function (socket){
    console.log(`a user connected: ${socket.id}`); //DEBUGGING

    socket.on('addBots', function(params){
        //add bot(s)

        for (let i = 0; i < params.count; i++){
            //create a connection
            let npcSocket = clientIO.connect(gameServer, {reconnection: true});
            let npcSocketID;

            npcSocket.on('connect', function() {
                npcSocketID = npcSocket.io.engine.id;
            });

            npcSocket.on(eventMSG.player.list, function(players){
                //get the server generate player state for this bot
                //console.log(players[npcSocketID]); //testing

                /*npcs[npcSocketID] = {
                    binaryBuffer: players[npcSocketID], //Buffer instance
                    socketHandle: npcSocket
                };*/
                npcs[npcSocketID] = players[npcSocketID];
                npcs[npcSocketID].socketHandle = npcSocket;

                //console.log(npcs[npcSocketID]); //DEBUGGING
            });

            npsState.bots++;
        }
        //npcKeys = Object.keys(npcs); //caching ... doesnt work, for some reason npcs = {} the very first time 'addBots' fires

        //update the NPC server interface
        socket.emit('npcState', npsState);
    });

    socket.on('removeBots', function(params){
        //remove bot(s)

        if (npsState.bots === 0) return;

        npcKeys = Object.keys(npcs); //caching
        if (params.count === 'all') {
            npcKeys.forEach(function(npcToBeRemoved){
                npcs[npcToBeRemoved].socketHandle.disconnect(); //...from game server.
            });

            npcs = {}; //clear the whole dict, leaving old one to gc
            npsState.bots = 0;
        } else {
            var npcToBeRemoved = npcKeys[0]; //FIFO
            npcs[npcToBeRemoved].socketHandle.disconnect(); //...from game server.
            delete npcs[npcToBeRemoved]; //...from npcs dict.
            npsState.bots--;
        }

        //update the NPC server interface
        socket.emit('npcState', npsState);
    });

    socket.on('moveBots', function(botsMovementState){
        var updateRate = 1000 / serverState.fpsTarget;
        npcKeys = Object.keys(npcs); //caching

        if (botsMovementState.move){
            var lastUpdateFinishTime = Date.now();
            //console.log(`initial lastUpdateFinishTime:${lastUpdateFinishTime}`);

            movementIntervalFunction = setInterval(function(){
                //For each npc generate new npc pos and update the game server

                currenTime = Date.now();
                deltaTime = currenTime - lastUpdateFinishTime;

                if (tick >= 1000) {
                    averageDeltaTime = tick / frameCount; //seconds per frame

                    serverState.fpsMin = (frameCount < serverState.fpsMin) ? frameCount : serverState.fpsMin;
                    serverState.fpsAvg = frameCount;
                    serverState.fpsMax = (frameCount > serverState.fpsMax) ? frameCount : serverState.fpsMax;

                    socket.emit('serverState', serverState);

                    tick = 0;
                    frameCount = 0;
                } else {
                    tick += deltaTime;
                    frameCount++;
                }

                var speedRotation = 0.0001;
                var speedX = 0.01;
                var speedY = 0.01;

                npcKeys.forEach(function(npc){
                    var currentNPC = npcs[npc];

                    currentNPC.rotation = currentNPC.rotation + (speedRotation * deltaTime);
                    //increment position or wrap around
                    currentNPC.x = currentNPC.x > 800 ? 0 : currentNPC.x + (speedX * deltaTime);
                    currentNPC.y = currentNPC.y > 550 ? 0 : currentNPC.y + (speedY * deltaTime);

                    /*var currentNPC = npcs[npc];

                    console.log(currentNPC.binaryBuffer.readInt16BE(0));
                    var updatedRotation = currentNPC.binaryBuffer.readInt16BE(0) + 1;
                    var updatedPositionX = currentNPC.binaryBuffer.readUInt16BE(2) > 800 ? 0 : currentNPC.binaryBuffer.readUInt16BE(2) + 1;
                    var updatedPositionY = currentNPC.binaryBuffer.readUInt16BE(4) > 550 ? 0 : currentNPC.binaryBuffer.readUInt16BE(4) + 1;

                    currentNPC.binaryBuffer.writeInt16BE(updatedRotation, 0);
                    currentNPC.binaryBuffer.writeUInt16BE(updatedPositionX, 2);
                    currentNPC.binaryBuffer.writeUInt16BE(updatedPositionY, 4);*/

                    reusableMovementObject.x = currentNPC.x;
                    reusableMovementObject.y = currentNPC.y;
                    reusableMovementObject.rotation = currentNPC.rotation;
                    currentNPC.socketHandle.emit(eventMSG.player.movement, reusableMovementObject);
                    //currentNPC.socketHandle.emit(eventMSG.player.movement, movementToBinary({ x: npcs[npc].x, y: npcs[npc].y, rotation: npcs[npc].rotation}));
                    //currentNPC.socketHandle.emit(eventMSG.player.movement, currentNPC.binaryBuffer);
                });

                lastUpdateFinishTime = currenTime;
            }, updateRate);
        } else clearInterval(movementIntervalFunction);
    });

    socket.on('disconnect', function(){
        console.log(`user disconnected: ${socket.id}`); //DEBUGGING
        //emit a message to server that NPCs server is disconnected??
        //io.emit('disconnect', socket.id);
    });
});

server.listen(PORT, function(){
    console.log(`Listening on ${server.address().port}`);
});

var movementBinaryBlobView = new DataView(new ArrayBuffer(6)); //global scope for reuse
function movementToBinary(movementObject){
    /* input:
    {   
        x: this.ship.x,
        y: this.ship.y,
        rotation: this.ship.rotation
    } 
    */
    /*var binaryBlob = Buffer.allocUnsafe(6); //6 bytes with cruft
    
    binaryBlob.writeUInt16BE(movementObject.rotation, 0);
    binaryBlob.writeUInt16BE(movementObject.x, 2);
    binaryBlob.writeUInt16BE(movementObject.y, 4);*/

    //console.log("Rotation in movementToBinary::");
    //console.log(movementObject.rotation);

    movementBinaryBlobView.setInt16(0, movementObject.rotation*100);
    movementBinaryBlobView.setUint16(2, movementObject.x);
    movementBinaryBlobView.setUint16(4, movementObject.y);

    return movementBinaryBlobView.buffer;
}