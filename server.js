// ===============
// Requirements
// ===============
const express = require('express'),
      app = express(),
      server = require('http').createServer(app),
      logger = require('morgan'),
      bodyParser = require('body-parser'),
      errorHandler = require('errorhandler'),
      methodOverride = require('method-override')
      r			= require('rethinkdb'),
      sockio		= require("socket.io"),
      hostname		= process.env.HOSTNAME || 'localhost',
      publicDir		= process.argv[2] || __dirname + '/public',
      PORT = process.env.PORT || 5000;

// ===============
// Express Config
// ===============
app.use(logger('dev'));
app.set('port', PORT);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(methodOverride((req, res) => {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    const method = req.body._method;
    delete req.body._method;
    return method;
  }
}));
app.use(express.static(publicDir));
app.use(errorHandler({
    dumpExceptions: true,
    showStack: true
}));

app.start = app.listen = function(){
	return server.listen.apply(server, arguments)
}

app.start(PORT);
console.log("Server showing %s listening at http://%s:%s", publicDir, hostname, PORT);

// ===============
// Socket Config
// ===============

// Open Socket.io Connection
const io = sockio.listen(app.listen(PORT, hostname), {log: false});
console.log('App Socket listening on port ' + PORT);

// Log when users connect & disconnect
io.on('connection', function(socket) {
  console.log('a user connected');
  socket.on('disconnect', function() {
    console.log('a user disconnected');
  });
});

// ====================
// Routes
// ====================

// Respond to '/' route
app.get('/', function (req, res) {
  // Connect to RethinkDB
  r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
      if (err) throw err;
      connection = conn;
      console.log('Connected to database.')

      // Get 5 most recent posts
      r.table("posts").orderBy(r.desc('time')).limit(5)
      .run(connection, function(err, cursor) {
          if (err) throw err;
          cursor.toArray(function(err, result) {
              result = result.reverse();
              if (err) throw err;
              // Log JSON string for debugging
              var json = JSON.stringify(result, null, 2);
              console.log(json);
              // Render `home` view and pass in post data
              res.render('home', { title: 'Slack Socket.io Integration', message: 'Hello there!' , json: result});
              // Emit `all posts` event (Socket.io) with data objects
              io.emit('all posts', json);
          });
      });
  });
});

// Respond to '/posts' route with JSON API
app.get("/posts", function (req, res) {
  // Connect to RethinkDB
  r.connect().then(function(conn) {
      // Retrieve all post data
      return r.db('test').table('posts').orderBy(r.desc('time')).limit(25)
          .run(conn).finally(function() {
              // Close the connection
              conn.close();
          });
  })
  .then(function(cursor) { return cursor.toArray(); })
  // Respond with post data as JSON object
  .then(function(output) { res.json(output); })
  .error(function(err) { res.status(500).json({err: err}); })
});


// ========================
// Set Up Change Feed
// ========================

var connection = null;
// Connect to RethinkDB
r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
  if (err) throw err;
  connection = conn;
  console.log('Connected to database.')

  // Realtime Post Feed
  r.table('posts').changes().run(connection, function(err, cursor) {
      if (err) throw err;
      cursor.each(function(err, row) {
          if (err) throw err;
          // Log changed data object
          console.log(JSON.stringify(row, null, 2));
          // Emit `new post` event (Socket.io) with data object
          io.emit('new post', JSON.stringify(row, null, 2));
      });
  });

});
