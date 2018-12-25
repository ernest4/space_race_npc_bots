var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

const numCPUs = require('os').cpus().length; //single threaded for now, potential to utilize more cores in future...

var AWS = require('aws-sdk');

AWS.config.update({
    region: "us-west-2",
    endpoint: "http://localhost:8000",
    //DO NOT EXPOSE CREDENTIALS ON GIT!!!, use environmental variables set up through heroku dashboard!
    accessKeyId: process.env.S3_KEY || "abcde",
    secretAccessKey: process.env.S3_SECRET || "abcde"
});

var dynamodb = new AWS.DynamoDB();

// --- Initialize DB with tables and shemas
var params = {
    TableName: "matchData",
    KeySchema: [
        {AttributeName: "matchItem", KeyType: "HASH"}, //parition key (primary key, mandatory)
        //{AttributeName: "title", KeyType: "RANGE"} //sort key (secondary index, optional)
    ],
    AttributeDefinitions: [
        {AttributeName: "matchItem", AttributeType: "S"}, //number
        //{AttributeName: "year", AttributeType: "N"}, //number
        //{AttributeName: "title", AttributeType: "S"} //string
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
    }
};

dynamodb.createTable(params, function(err, data){
    if (err) console.log("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
    else console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
});

/*dynamodb.deleteTable({TableName: "Movies"}, function(err, data) {
    if (err) {
        console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
    }
});*/



var docClient = new AWS.DynamoDB.DocumentClient();


// --- creating the initial items
var params1 = {
    TableName: "matchData",
    Item: {
        matchItem: "star",
        info: {
            x: Math.floor(Math.random() * 700) + 50,
            y: Math.floor(Math.random() * 500) + 50
        }
    },
    //only add the item if it doesn't already exist, i.e. if Exists: false ===> true...
    Expected: {
        matchItem: {
            Exists: false,
            Value: "star"
        }
    },
};

docClient.put(params1, function(err, data){
    if (err) console.error("Unable to add star item. Error JSON:", JSON.stringify(err, null, 2));
    else console.log("Added item:", JSON.stringify(data, null, 2));
});

var params2 = {
    TableName: "matchData",
    Item: {
        matchItem: "scores",
        info: {
            blue: 0,
            red: 0
        }
    },
    //only add the item if it doesn't already exist, i.e. if Exists: false ===> true...
    Expected: {
        matchItem: {
            Exists: false,
            Value: "scores"
        }
    },
}

docClient.put(params2, function(err, data){
    if (err) console.error("Unable to add scores item. Error JSON:", JSON.stringify(err, null, 2));
    else console.log("Added item:", JSON.stringify(data, null, 2));
});




// --- Reading
function getMatchData(matchItem, socket){
    let params = {
        TableName: "matchData",
        Key: {
            "matchItem": matchItem
        }
    };
    
    docClient.get(params, function(err, data){
        if (err) console.error(`Unable to read ${matchItem} item. Error JSON: ${JSON.stringify(err, null, 2)}`);
        else { 
            console.log(`GetItem succeeded: ${JSON.stringify(data, null, 2)}`);
            //console.log(`Got matchData: ${data.Item.info}`);
            if (matchItem === "star"){
                socket.emit('starLocation', data.Item.info); //update player
                star = (star == null) ? data.Item.info : star; //update global state (if it's the first time)
                //console.log("STAR::"+data.Item.info);
                //NOTE: (... == null) will catch both null and undefined in one test!
            } else {
                socket.emit('scoreUpdate', data.Item.info);
                scores = (scores == null) ? data.Item.info : scores; //update global state (if it's the first time)
            }
        }
    });
}


function saveMatchData(matchItem){
    if (matchItem === "star") {
        // --- update the items
        var params = {
            TableName: "matchData",
            Key:{
                matchItem: "star"
            },
            //UpdateExpression: "set info.x = :x, info.y = :y, info.test = :t",
            UpdateExpression: "set info.x = :x, info.y = :y",
            ExpressionAttributeValues:{
                ":x": +star.x, //update old data
                ":y": +star.y, //update old data
                //":t": ["Larry", "Moe", "Curly"] //add some new data..
            },
            ReturnValues:"UPDATED_NEW"
        };
    } else { //scores
        var params = {
            TableName: "matchData",
            Key:{
                matchItem: 'scores'
            },
            UpdateExpression: "set info.blue = :blue, info.red = :red",
            ExpressionAttributeValues: {
                ":blue": +scores.blue,
                ":red" : +scores.red
            },
            ReturnValues:"UPDATED_NEW"
        };
    }

    docClient.update(params, function(err, data) {
        if (err) console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
        else console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
    });
}

/*
// Conditional delete
var params6 = {
    TableName: "matchData",
    Key:{
        matchItem: 'scores'
    },
    UpdateExpression: "remove info.test[0]",
    ConditionExpression: "size(info.test) >= :val",
    ExpressionAttributeValues: {
        ":val": 3
    },
    ReturnValues:"UPDATED_NEW"
};

docClient.update(params6, function(err, data) {
    if (err) console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
    else console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
});
*/



/* Untill this is persisted in a database, just store it 
locally on the server. */
/*var star = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50
};
var scores = {
    blue: 0,
    red: 0
};*/

//Using dynamoDB
var star;
var scores;

//periodically back up the score to database...
/*setInterval(function(){
    if (star == null || scores == null) return; //not ready for saving yet...

    io.emit('savedToDB', `Saved the data to database... BLUE: ${scores.blue} RED: ${scores.red} Time: ${new Date().toTimeString()}`);

    saveMatchData('star');
    saveMatchData('scores');

}, 3000);*/



var players = {};

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

    //Update the new player of the current game state...
    //send the players objects to new player
    socket.emit('currentPlayers', players);

    //send the star object to the new player
    //socket.emit('starLocation', star);
    getMatchData("star", socket);

    //send the current scores
    //socket.emit('scoreUpdate', scores);
    getMatchData("scores", socket);

    //update all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);


    socket.on('disconnect', function(){
        console.log(`user disconnected: ${socket.id}`); //DEBUGGING

        //remove this player from the players object
        delete players[socket.id];

        //emit a message to all other players to remove this player
        io.emit('disconnect', socket.id);
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
    socket.on('starCollected', function(){
        if (players[socket.id].team === 'red') scores.red += 10;
        else scores.blue += 10;

        star.x = Math.floor(Math.random() * 700) + 50;
        star.y = Math.floor(Math.random() * 500) + 50;

        //broadcast
        io.emit('starLocation', star);
        io.emit('scoreUpdate', scores);
    });

    //for testing...
    socket.on('saveToDB', function(){
        if (star == null || scores == null) return; //not ready for saving yet...

        io.emit('savedToDB', `Saved the data to database... BLUE: ${scores.blue} RED: ${scores.red} Time: ${new Date().toTimeString()}`);

        saveMatchData('star');
        saveMatchData('scores');
    });

    //DEBUG
    socket.on('serverHardware', function(){
        socket.emit('serverHardware', { numCPUs: numCPUs });
    });
});

server.listen(PORT, function(){
    console.log(`Listening on ${server.address().port}`);
});