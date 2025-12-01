class Http {
    static get(url) {
        const syncRequest = require('sync-request');
        const response = syncRequest('GET', url);
        return JSON.parse(response.getBody('utf8'));
    }
}

class Logger {
    static log(message) {
        console.log(message);
    }
}
