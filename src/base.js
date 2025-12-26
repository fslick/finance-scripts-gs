class Http {
    static async get(url) {
        const response = await fetch(url);
        return await response.text();
    }
}

class Logger {
    static log(message) {
        console.log(message);
    }
}

const cache = new Map();

class Cache {
    static get(key) {
        if (!cache.has(key)) {
            return null;
        }
        return cache.get(key);
    }

    static put(key, value) {
        cache.set(key, value);
    }
}

global.Http = Http;
global.Logger = Logger;
global.Cache = Cache;