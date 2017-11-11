// Requirements
const express = require('express'),
      app = express(),
      server = require('http').createServer(app),
      logger = require('morgan'),
      bodyParser = require('body-parser'),
      errorHandler = require('errorhandler'),
      methodOverride = require('method-override')
      hostname		= process.env.HOSTNAME || 'localhost',
      publicDir		= process.argv[2] || __dirname + '/public',
      PORT = process.env.PORT || 5000;

// Middleware
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

// Listen
app.start(PORT);
console.log("Server showing %s listening at http://%s:%s", publicDir, hostname, PORT);
