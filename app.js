var express = require('express');
var path = require('path');
var hbs = require('express-handlebars');
var bodyParser = require('body-parser');
var Player = require('./Player.js');

// Initialize App
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
// app.use(favicon(__dirname + '/public/images/favicon.ico'));

// View Engine
app.set('views', path.join(__dirname, 'views'));
app.engine('hbs', hbs({extname: 'hbs'}));
app.set('view engine', 'hbs');

// Set Static Folder
app.use(express.static(path.join(__dirname, 'public')));

// This is where routing code lives
var routes = require('./routes/routes');

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json())
app.use('/', routes);

server.listen(3000, function() {
  console.log("Server is now running on port 3000");
});

var currentLobbyClients = {};
var currentLobbyCount = 0;


// class Player {
//   constructor(username, socketId) {
//     this.username = username;
//     this.socketId = socketId;
//   }
// }

// contains about:
// owner - username of the owner
// players - username and socket id of the current players inside the room 
// name - name of the game room

var testPlayer1 = new Player('test', 1)
var testPlayer2 = new Player('test', 2)

var currentGames = {
  '11111': {'owner': 'test', 'players': [testPlayer1], 'name':'lit times' },
  '22222': {'owner': 'test', 'players': [testPlayer2], 'name':'okay room'}
};
var currentIds = {
  '11111': 'lit times',
  '22222': 'okay room'  
}

const MAX_ROOMS = 100000;
const ID_ATTEMPT_LIMIT = 1000;

// There is an issue where you can have multiple users with the same username 
// but validating between frontend and backend is annoying so might do later

io.on('connection', function(socket){ 

  // This variable tells you the last part of the current url, e.g. 'lobby'
  var urlLastPath = socket.client.request.headers['referer'].split("/").pop();

  //
  //
  // Case: Entering the game lobby, where all the rooms exist
  if (urlLastPath == "lobby") {

    // When a new user enters the lobby, list the rooms available in the lobby
    // to the user
    socket.on('enter lobby', function(username) {
      if (Object.values(currentLobbyClients).includes(username)) {
        console.log(username + " (another one) has entered the lobby");
      } else {
        console.log(username + " has entered the lobby");
      }

      if (!(socket.id in currentLobbyClients)) {
        currentLobbyCount += 1;
        console.log("New socket (id: " + socket.id + ") has connected to lobby");
        currentLobbyClients[socket.id] = username;
      }

      io.sockets.connected[socket.id].emit('generate rooms', currentGames);
    });

    // When the new user tries to create a new room, it checks if it's valid,
    // creates a new id, then emits to all socket connections about this new room
    socket.on('new room', function(roomName, username) {
      console.log(username + " trying to create room " + roomName);
      let currentNames = []
      for (var gameid in currentGames) {
        currentNames.push(currentGames[gameid]['name'])
      }

      // Checks if the room name already exists
      if (roomName in currentNames) {
        io.sockets.connected[socket.id].emit('failed room', roomName);
      } 
      // If valid, create a random id, create a default room, and communicate to clients
      // about creation of new room
      else {
        let currentCount = 0
        let randomId = Math.round(Math.random()*MAX_ROOMS);
        while (randomId in currentIds) {
          randomId = Math.round(Math.random()*MAX_ROOMS);
          currentCount += 1;
          if (currentCount > ID_ATTEMPT_LIMIT)  {
            randomId = "FAIL";
            break
          }
        }

        if (randomId == "FAIL") {
          io.sockets.connected[socket.id].emit('failed room id');
        } else {
          let gameDetails = {'owner': username, 'players': [], 'name': roomName};
          
          // NOTE: kind of a useless variable
          currentIds[randomId] = roomName;

          currentGames[randomId] = gameDetails;
          io.emit('new room', {'gameid': randomId, 'details': gameDetails});
        }
      }
    });

    // Indicates that we are trying to enter a room with a specific url
    socket.on('join game room', function(clientInfo) {
      var username = clientInfo['username'];
      var gameid = clientInfo['gameid'];
      var gameDetails = currentGames[gameid];
      var currentPlayers = gameDetails['players']

      // Checks if there is enough space for a player to join
      if (currentPlayers.length >= 4) {
        io.sockets.connected[socket.id].emit('full room', gameid);
      }

      // If enough space, add the new player and tell socket to enter room
      else {
        var newPlayer = new Player(username, socket.id);
        currentPlayers.push(newPlayer)
        io.sockets.connected[socket.id].emit('enter game room', gameid);

        // If a room is full, tell the owner to start the game
        if (currentPlayers.length == 4) {
          // Add start button logic here
          io.sockets.connected[currentPlayers[3].id].emit('start room', gameid, currentPlayers);
        }
      }
    });

    socket.on('disconnect', function() {
      console.log("Player " + currentLobbyClients[socket.id] + " disconnected");
      delete currentLobbyClients[socket.id];
      currentLobbyCount -= 1;
      console.log(currentLobbyClients);
    });
  }
  // END lobby 
  //
  //

  //
  //
  // Case: Entering a specific game room
  else if (!isNaN(urlLastPath)) {
    console.log("entering room with id " + urlLastPath);
    console.log(currentGames[urlLastPath]);
  } 
  // END game room 
  //
  //

  // Case: Test path
  else {

    socket.on('card clicked', function(cardInfo) {
      console.log('Card Clicked: ' + cardInfo);                // We print the statement in the console and
      io.emit('card clicked', [cardInfo[0], cardInfo[1]]); // io.emit sends this message to EVERYONE connected
    });

    socket.on('chat message', function(msg){  // If the socket that is connected sends a 'chat message'
      console.log('message: ' + msg);         // We print the statement in the console and
      console.log('players active: ' + Object.values(clients))
      io.emit('chat message', [clients[socket.id], msg]);           // io.emit sends this message to EVERYONE connected
      io.sockets.connected[lastSocket].emit("secret-message", msg[1]);
      // io.sockets.connected[clients.mheap.socket].emit('private-message',
    });
  }
})
