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
var gameServer = 'https://node-game-server-1.herokuapp.com/';
var npcs = {};
var npsState = { bots: 0 }

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
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

            npcSocket.on('currentPlayers', function(players){
                //get the server generate player state for this bot
                npcs[npcSocketID] = players[npcSocketID];
                npcs[npcSocketID].socketHandle = npcSocket;

                //console.log(npcs[npcSocketID]); //DEBUGGING
            });

            npsState.bots++;
        }

        //npcSocket.emit('playerMovement', { x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation}); ??

        //update the NPC server interface
        socket.emit('npcState', npsState);
    });

    socket.on('removeBots', function(params){
        //remove bot(s)

        if (npsState.bots == 0) return;

        var npcIDsArray = Object.keys(npcs);
        if (params.count === 'all') {
            npcIDsArray.forEach(function(npcToBeRemoved){
                npcs[npcToBeRemoved].socketHandle.disconnect(); //...from game server.
            });

            npcs = {}; //clear the whole dict, leaving old one to gc
            npsState.bots = 0;
        } else {
            var npcToBeRemoved = npcIDsArray[0]; //FIFO
            npcs[npcToBeRemoved].socketHandle.disconnect(); //...from game server.
            delete npcs[npcToBeRemoved]; //...from npcs dict.
            npsState.bots--;
        }

        //update the NPC server interface
        socket.emit('npcState', npsState);
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