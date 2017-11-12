// ===============
// Dependencies
// ===============
const Slack = require('@slack/client'),
      Client = require('node-rest-client').Client,
      client = new Client(),
      R = require('ramda'),
      moment = require('moment'),
      r = require('rethinkdb');

// ===============
// Slack Options
// ===============
const slackToken = process.env.EXEC_SLACK_CLIENT_TOKEN;
const autoReconnect = true;
const autoMark = true;
const slack = new Slack(slackToken, autoReconnect, autoMark);

// ===============
// Bot Options
// ===============
const options = {
	is_running : true
}

// ===============
// Helper Functions
// ===============
const messageInfo = (info) => {
  console.log('\n===============');
  console.log('Sender: ' + info.sender);
  console.log('Is Admin: ' + info.is_admin);
  console.log('Text: ' + info.text);
  if (_.has(info.channel, 'name')) {
    console.log('Channel: ' + info.channel.name);
  } else {
    console.log('Channel: PRIVATE MESSAGE');
  }
  console.log('Time: ' + new Date);
  console.log('Is running: ' + options.is_running);
  return console.log('===============\n');
}

const cmd = (command, info, zombie, callback) => {
  if (options.is_running || zombie) {
    if (info.text === command) {
      return callback();
    }
  }
}

const publicForum = (info, zombie, callback) => {
  if (options.is_running || zombie) {
    if (R.has(info.channel, 'name')) {
      if (info.channel.name === 'public-forum') {
        return callback();
      }
    }
  }
}

// Setup connection variable for later use
const connection = null;

// Connect to RethinkDB then open Slack
r.connect({
  host: "localhost",
  port: 28015
}, function(err, conn) {
  if (err) {
    throw err;
  }
  connection = conn;
  console.log('Connected to database successfully.');
  r.db('test').tableCreate('posts').run(connection, function(err, result) {
    return console.log(JSON.stringify(result, null, 2));
  });

  // Slack Opened
  slack.on('open', function() {
    let channel, channels, id;
    channels = [];
    channels = (function() {
      var ref, results;
      ref = slack.channels;
      results = [];
      for (id in ref) {
        channel = ref[id];
        results.push("#" + channel.name);
      }
      return results;
    })();
    return console.log("Welcome to Slack. You are @" + slack.self.name + " of " + slack.team.name);
  });

  // Slack Message
  slack.on('message', function(message) {
    let info;
    if (!(R.has(message, 'subtype'))) {
      info = {
        channel_id: slack.getChannelGroupOrDMByID(message.channel),
        channel: slack.channels[message.channel],
        sender: slack.users[message.user].name,
        text: message.text,
        message: message,
        image: slack.users[message.user].profile.image_192
      };

      publicForum(info, false, function() {
        var author, cleanTime, content, image, now, time;
        content = info.text;
        image = info.image;
        time = new Date;
        now = time.getTime();
        cleanTime = moment(time).calendar();
        author = info.sender;
        return r.table('posts').insert([
          {
            content: content,
            time: now,
            cleanTime: cleanTime,
            image: image,
            author: author
          }
        ]).run(connection, function(err, result) {
          if (err) {
            throw err;
          }
          return console.log(JSON.stringify(result, null, 2));
        });
      });
      cmd('!off', info, true, function() {
        var response;
        options.is_running = false;
        response = 'Turning off!';
        return info.channel_id.send(response);
      });
      cmd('!on', info, true, function() {
        var response;
        options.is_running = true;
        response = 'Turning on!';
        return info.channel_id.send(response);
      });
      cmd('!hi', info, false, function() {
        var response;
        response = 'Hello';
        return info.channel_id.send(response);
      });
      messageInfo(info);
    }
  });
  slack.on('error', function(err) {
    return console.error("Error", err);
  });
  return slack.login();
});