var client = require('socket.io-client');
var minimist = require('minimist');

var argv = minimist(process.argv.slice(2), { default: {user: 'admin', pass: 'admin'} });
var queryId = 0;

var queryResponse = function(data, cb, requestId) {
    console.log('Query '+requestId+'\t: '+data.length+' items');
    cb();
}

var submitQuery = function(socket, connectionId, resource, params) {
    var newQueryId = ++queryId;
    socket.emit('query', { type: resource, requestId: newQueryId, params: params });
    socket.on(connectionId+newQueryId, function(data, cb) {
        queryResponse(data, cb, newQueryId);
    });
}

if (!argv['host']) {
    console.error('No host specified');
    process.exit(1);
} else {
    console.log('Connecting to '+argv['host']);
    var socket = client(argv['host'], {
        reconnectionDelay: 5000,
        rejectUnauthorized: false,
        transports: [ 'websocket' ]
    });

    socket.on('connect', function() {
        console.log('Connected');
        console.log('Authenticating using user/pass');
        socket.emit('authentication', {
            username: argv['user'],
            password: argv['pass']
        });
    });

    socket.on('reconnect', function() {
        console.log('Reconnected');
    });

    socket.on('sessionData', function(session) {
        console.log('Authentication successful');
        console.log('\tConnection: '+session.connectionId);
        console.log('\tSession: '+session.sessionId);
        submitQuery(socket,session.connectionId, 'event', { element_id: [9010]});
        submitQuery(socket,session.connectionId, 'alarm', { element_id: [9010]});
    });

    socket.on('queryError', function(err) {
        console.log('Query Error');
        console.log(err);
    });

    socket.on('unauthorized', function(err) {
        console.log('Authorization failure');
        console.log('\t'+err.message);
    });

}
