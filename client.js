var client = require('socket.io-client');
var minimist = require('minimist');

var execSync = require('child_process').execSync;
var stdin = process.stdin;
stdin.setRawMode( true );
stdin.resume();
stdin.setEncoding( 'utf8' );

stdin.on( 'data', function(key) {
  // ctrl-c ( end of text )
  if ( key === '\u0003' ) {
    process.exit();
  }
});

var argv = minimist(process.argv.slice(2), { default: {user: 'admin', pass: 'admin'} });
var queryId = 0,
    sessionId,
    queries = {};

var queryResponse = function(data, cb, requestId) {
    console.log('Query '+requestId+'\t: '+data.length+' items');
    console.log(data);
    cb();
}

var submitQuery = function(socket, connectionId, resource, params) {
    var newQueryId = ++queryId;
    socket.emit('query', { type: resource, requestId: newQueryId, params: params });
    console.log('Starting Query '+newQueryId);
    queries[newQueryId] = connectionId+newQueryId;
    socket.on(connectionId+newQueryId, function(data, cb) {
        queryResponse(data, cb, newQueryId);
    });
}

var stopQuery = function() {

}

var resumeQuery = function(socket, queryId, resumeId) {
    console.log('Will resume query '+queryId+': '+resumeId);
    socket.emit('resumeQuery', {
        id: resumeId
    });
}

if (!argv['host']) {
    console.error('No host specified');
    process.exit(1);
} else {
    console.log('Connecting to '+argv['host']);
    var socket = client(argv['host'], {
        rejectUnauthorized: false,
        transports: [ 'websocket' ]
    });

    stdin.on( 'data', function( key ) {
      if (key === 'd') {
          console.log('Disabling Network...');
          execSync('ifdown ensp03')
      } else if (key === 'u') {
        console.log('Enabling Network...');
        execSync('ifup ensp03')
      }
    });

    socket.on('connect', function() {
        console.log('Connected');
        if (sessionId) {
            console.log('Authenticating using session '+sessionId);
            socket.emit('authentication', {
                sessionId: sessionId
            });
        } else {
            console.log('Authenticating using user/pass');
            socket.emit('authentication', {
                username: argv['user'],
                password: argv['pass']
            });
        }
    });

    socket.on('unauthorized', function(err) {
        console.log('Authorization failure');
        console.log('\t'+err.message);
    });

    socket.on('error', function(err) {
        console.log('Error');
        console.log(err);
    });

    socket.on('disconnect', function () {
        console.log('Disconnected');
    });

    socket.on('reconnecting', function (number) {
        console.log('Reconnecting (attempt ' + number + ')');
    });

    socket.on('reconnect_error', function (err) {
        console.log('Couldn\'t reconnect');
    });

    socket.on('reconnect', function() {
        console.log('Reconnected');
    });

    socket.on('sessionData', function(session) {
        console.log('Authentication successful');
        console.log('\tConnection: '+session.connectionId);
        console.log('\tSession: '+session.sessionId);
        sessionId = session.sessionId;
        var queryKeys = Object.keys(queries);
        if (queryKeys.length) {
            queryKeys.forEach(function(key) {
                resumeQuery(socket, key, queries[key]);
            });
        } else {
            //submitQuery(socket,session.connectionId, 'event', { element_id: [9010]});
            //submitQuery(socket,session.connectionId, 'alarm', { element_id: [9010]});
            submitQuery(socket,session.connectionId, 'stat', { element_id: [6583], metric_id: [1316], resolution: 30 });

        }
    });

    socket.on('queryError', function(err) {
        console.log('Query Error');
        console.log(err);
    });

    socket.on('queryEnd', function(data) {
        console.log('Query End');
        console.log(data);
    });

    socket.on('queryInfo', function(info) {
        console.log('Query info');
        console.log(info);
    });


}
