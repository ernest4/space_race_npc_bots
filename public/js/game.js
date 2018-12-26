/* Copyright 2018 Ernestas Monkevicius */
var config = {
    type: Phaser.AUTO, /* Set the renderer type for our game. The two main
                        types are Canvas and WebGL. WebGL is a faster
                        renderer and has better performance, but not all 
                        browsers support it. By choosing AUTO for the type, 
                        Phaser will use WebGL if it is available, otherwise, it
                        will use Canvas. */
    parent: 'phaser-example', /* the parent field is used to tell Phaser to 
                                render our game in an existing  <canvas>  
                                element with id 'phaser-example' if it exists.
                                If it does not exists, then Phaser will create
                                a <canvas> element for us. */
    width: 800,
    //height: 600,
    height: 550,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);


function preload() {
    // Runs once, loads up assets like images and audio

    this.load.image('ship', 'assets/spaceShips_001.png');
    this.load.image('otherPlayer', 'assets/enemyBlack5.png');
    this.load.image('star', 'assets/star_gold.png');
}


function create() {
    // Runs once, after all assets in preload are loaded

    var self = this; /*needed in order to access 'this' object inside of a
                        function. This is because functions are objects too
                        and referencing this in a function will reference the
                        function itself rather than the object the function is
                        inside.*/
    //this.socket = io();
    this.socket = io("http://localhost:3000");

    this.otherPlayers = this.physics.add.group(); /*groups in Phaser, they are 
    a way for us to manage similar game objects and control them as one unit.
    One example is, instead of having to check for collisions on each of those
    game objects separately, we can check for collision between the group and 
    other game objects. */




    /////// MOVE CLIENT SIDE LOGIC TO EXECUTE ON SERVER TO MAKE NPCs!!!!!!





    this.socket.on('currentPlayers', function(players){
        //for each of the players in the game
        Object.keys(players).forEach(function(id){
            //if the player is this player, add it to the game...
            if (players[id].playerId === self.socket.id){
                addPlayer(self, players[id]);
            } else { //...some other player, add it to the 'others' group
                addOtherPlayers(self, players[id]);
            }
        });
    });

    this.socket.on('newPlayer', function(playerInfo){
        addOtherPlayers(self, playerInfo);
    });

    this.socket.on('disconnect', function(playerId){
        self.otherPlayers.children.getArray().forEach(function(otherPlayer){
            if (otherPlayer.playerId === playerId){
                otherPlayer.destroy();
            }
        });
    });

    this.socket.on('playerMoved', function(playerInfo){
        /*Find the player that moved in the stored array of ther players and
        update it's position and rotation */
        self.otherPlayers.children.getArray().forEach(function(otherPlayer){
            if (otherPlayer.playerId === playerInfo.playerId){
                otherPlayer.setRotation(playerInfo.rotation);
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        });
    });

    this.cursors = this.input.keyboard.createCursorKeys(); /*This will populate
    the cursors object with our four main Key objects (up, down, left, and 
    right), which will bind to those arrows on the keyboard.  */

    this.blueScoreText = this.add.text(16, 16, '', {fontSize: '32px', fill: '#11bbFF'});
    this.redScoreText = this.add.text(584, 16, '', {fontSize: '32px', fill: '#FF0000'});

    this.socket.on('scoreUpdate', function(scores){
        self.blueScoreText.setText('Blue: ' + scores.blue);
        self.redScoreText.setText('Red: ' + scores.red);
    });

    this.socket.on('starLocation', function(starLocation){
        //if star exists, destroy it and make a new one based on recieved location
        if (self.star) self.star.destroy();
        self.star = self.physics.add.image(starLocation.x, starLocation.y, 'star');

        //collision detection between this ship and star
        self.physics.add.overlap(self.ship, self.star, function(){
            this.socket.emit('starCollected');
        }, null, self);
    });

    //DEBUG
    this.socket.on('serverHardware', function(serverHardware){
        console.log(serverHardware);
    });

    //////////////////////////////TESING, remove soon...
    //TESTING 2 simulaneous clients
    this.socket2 = io("http://localhost:3000");

    this.socket2.on('currentPlayers', function(players){
        //for each of the players in the game
        Object.keys(players).forEach(function(id){
            //if the player is this player, add it to the game...
            if (players[id].playerId === self.socket.id){
                addPlayer(self, players[id]);
            } else { //...some other player, add it to the 'others' group
                addOtherPlayers(self, players[id]);
            }
        });
    });

    this.socket2.on('newPlayer', function(playerInfo){
        addOtherPlayers(self, playerInfo);
    });

    this.socket2.on('disconnect', function(playerId){
        self.otherPlayers.children.getArray().forEach(function(otherPlayer){
            if (otherPlayer.playerId === playerId){
                otherPlayer.destroy();
            }
        });
    });

    this.socket2.on('playerMoved', function(playerInfo){
        /*Find the player that moved in the stored array of ther players and
        update it's position and rotation */
        self.otherPlayers.children.getArray().forEach(function(otherPlayer){
            if (otherPlayer.playerId === playerInfo.playerId){
                otherPlayer.setRotation(playerInfo.rotation);
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        });
    });

    this.socket2.on('scoreUpdate', function(scores){
        self.blueScoreText.setText('Blue: ' + scores.blue);
        self.redScoreText.setText('Red: ' + scores.red);
    });

    this.socket2.on('starLocation', function(starLocation){
        //if star exists, destroy it and make a new one based on recieved location
        if (self.star) self.star.destroy();
        self.star = self.physics.add.image(starLocation.x, starLocation.y, 'star');

        //collision detection between this ship and star
        self.physics.add.overlap(self.ship, self.star, function(){
            this.socket.emit('starCollected');
        }, null, self);
    });
}


function update() {
    // Runs once per frame for the duration of the scene

    if (this.ship){
        //console.log(new Date());
        //handle rotation
        if (this.cursors.left.isDown) this.ship.setAngularVelocity(-150);
        else if (this.cursors.right.isDown) this.ship.setAngularVelocity(150);
        else this.ship.setAngularVelocity(0);

        //handle acceleration
        /*if (this.cursors.up.isDown){
            this.physics.velocityFromRotation(this.ship.rotation + 1.5, 100, this.ship.body.acceleration);
        } else this.ship.setAcceleration(0);*/

        //FOR LOAD TESTING, SIMULATE MOVEMENT (can be override any time by user...)
        if (this.cursors.up.isDown){
            this.physics.velocityFromRotation(this.ship.rotation + 1.5, 100, this.ship.body.acceleration);
        } else this.physics.velocityFromRotation(this.ship.rotation + 1.5, 10, this.ship.body.acceleration);

        //DEBUGGING server hardware
        if (this.cursors.down.isDown) {
            this.socket.emit('serverHardware');

            ////////TESTING REMOVE SOON
            this.socket2.emit('serverHardware');
        }

        this.physics.world.wrap(this.ship, 5); /*If the ship goes off screen we
        want it to appear on the other side of the screen with an offset. */

        //tell the server this player has moved...
        //emit player movement
        var x = this.ship.x;
        var y = this.ship.y;
        var r = this.ship.rotation;
        if (this.ship.oldPosition && (x !== this.ship.oldPosition.x || y !== this.ship.oldPosition.y || r !== this.ship.oldPosition.rotation)){
            this.socket.emit('playerMovement', { x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation});

            ////////TESTING REMOVE SOON
            this.socket2.emit('playerMovement', { x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation});
        }

        //save old position data
        this.ship.oldPosition = {
            x: this.ship.x,
            y: this.ship.y,
            rotation: this.ship.rotation
        };
    }
}

function addPlayer(self, playerInfo){
    /*usign self.physics.add.image instead of self.add.image so the ship can
    use the arcade physics.*/
    self.ship = self.physics.add.image(playerInfo.x, playerInfo.y, 'ship')
                                    .setOrigin(0.5, 0.5) /*default is top left,
                                                        this affects rotation.*/
                                    .setDisplaySize(53, 40); /*Scale down the
                                    original 106×80 px image proportionately. */
    
    if (playerInfo.team === 'blue') self.ship.setTint(0x0000ff);
    else self.ship.setTint(0xff0000);

    //arcade physics settings
    self.ship.setDrag(100);
    self.ship.setAngularDrag(100);
    self.ship.setMaxVelocity(200);
}

function addOtherPlayers(self, playerInfo){
    const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer')
                                    .setOrigin(0.5, 0.5)
                                    .setDisplaySize(53, 40);

    if (playerInfo.team === 'blue') otherPlayer.setTint(0x0000ff);
    else otherPlayer.setTint(0xff0000);

    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);
}