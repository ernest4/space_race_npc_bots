var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server); //server for bots interface
var clientIO = require('socket.io-client'); //for NPC client bots

const numCPUs = require('os').cpus().length; //single threaded for now, potential to utilize more cores in future...

/* Globals */
var players = {};
var npcSockets = [];
var npsState = { bots: 0 }

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket){
    console.log(`a user connected: ${socket.id}`); //DEBUGGING

    //create a new player and add it to the player object
    players[socket.id] = {
        rotation: 0,
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        playerId: socket.id,
        team: (Math.floor(Math.random() * 2) === 0) ? 'red' : 'blue'
    }

    socket.on('addBots', function(){
        //add bots
        //create a connection
        var socket = clientIO.connect('https://node-game-server-1.herokuapp.com/', {reconnection: true});

        //testing
        console.log(`NPC server:: ${socket.id}`);

        //npcSockets.push(socket); ?? 

        socket.emit('npcState', npsState);
    });

    socket.on('removeBots', function(){
        //remove bots

        //...socket.disconnect()
        socket.emit('npcState', npsState);
    });

    //Update the new player of the current game state...
    //send the players objects to new player
    //socket.emit('currentPlayers', players);

    //send the star object to the new player
    //socket.emit('starLocation', star);
    //getMatchData("star", socket);

    //send the current scores
    //socket.emit('scoreUpdate', scores);
    //getMatchData("scores", socket);


    socket.on('disconnect', function(){
        console.log(`user disconnected: ${socket.id}`); //DEBUGGING

        //leave players for garbage collection
        players = null;

        //emit a message to server that NPCs server is disconnected??
        //io.emit('disconnect', socket.id);
    });


    /*When the playerMovement event is received on the server, we update that
    player’s information that is stored on the server, emit a new event called 
    playerMoved to all other players, and in this event we pass the updated
    player’s information. */
    socket.on('playerMovement', function(movementData){
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].rotation = movementData.rotation;


        //emit message to all players about the player that moved
            //socket.broadcast.emit('playerMoved', players[socket.id]);

        /*volatile messages should be faster as they dont require confirmation 
        (but then they may not reach the sender)*/
        socket.volatile.broadcast.emit('playerMoved', players[socket.id]);
    });

    /*update the correct team’s score, generate a new location for the star, 
    and let each player know about the updated scores and the stars new location.*/
    /*socket.on('starCollected', function(){
        if (players[socket.id].team === 'red') scores.red += 10;
        else scores.blue += 10;

        star.x = Math.floor(Math.random() * 700) + 50;
        star.y = Math.floor(Math.random() * 500) + 50;

        //broadcast
        io.emit('starLocation', star);
        io.emit('scoreUpdate', scores);
    });*/

    //for testing...
    /*socket.on('saveToDB', function(){
        if (star == null || scores == null) return; //not ready for saving yet...

        io.emit('savedToDB', `Saved the data to database... BLUE: ${scores.blue} RED: ${scores.red} Time: ${new Date().toTimeString()}`);

        saveMatchData('star');
        saveMatchData('scores');
    });*/

    //DEBUG
    /*socket.on('serverHardware', function(){
        socket.emit('serverHardware', { numCPUs: numCPUs });
    });*/
});

server.listen(PORT, function(){
    console.log(`Listening on ${server.address().port}`);
});