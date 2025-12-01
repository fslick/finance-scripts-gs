let __fetchJsonFromYF = (yahooSymbol, monthsAgo) => {
    if (!yahooSymbol) {
        throw new Error("yahooSymbol is required");
    }

    // Current time (in seconds since Unix epoch)
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);

    // Five years ago 
    const defaultDaysAgo = 5 * 365 + 5;
    const ago = monthsAgo 
        ? new Date(now.getFullYear(), now.getMonth() - monthsAgo, now.getDate()) 
        : new Date(now.getTime() - defaultDaysAgo * 24 * 60 * 60 * 1000);
    const period1 = Math.floor(ago.getTime() / 1000);

    // Build URL
    const baseUrl = "https://query1.finance.yahoo.com/v8/finance/chart/";
    const symbolPath = encodeURIComponent(yahooSymbol);

    const params = [
        "events=" + encodeURIComponent("capitalGain|div|split"),
        "formatted=true",
        "includeAdjustedClose=true",
        "interval=1d",
        "period1=" + period1,
        "period2=" + period2,
        "symbol=" + encodeURIComponent(yahooSymbol),
        "userYfid=true",
        "lang=en-US",
        "region=US"
    ].join("&");

    const url = baseUrl + symbolPath + "?" + params;
    Logger.log("url: " + url);

    // Fetch raw JSON
    const response = Http.get(url);

    const statusCode = response.getResponseCode();
    if (statusCode < 200 || statusCode >= 300) {
        throw new Error("HTTP error " + statusCode + " from Yahoo Finance: " + response.getContentText());
    }

    const jsonText = response.getContentText();
    return JSON.parse(jsonText);
};

let __normalizeDate = (d) => {
    // Normalize any Date-like input to 00:00:00 UTC for that calendar day
    const raw = new Date(d);
    return new Date(Date.UTC(
        raw.getUTCFullYear(),
        raw.getUTCMonth(),
        raw.getUTCDate()
    ));
};

let __parseJsonWithQuotes = (json) => {
    const timestamps = json.chart.result[0].timestamp;
    const closePrices = json.chart.result[0].indicators.quote[0].close;
    if (timestamps.length !== closePrices.length) {
        throw new Error('Timestamps and close prices length mismatch');
    }
    const zipped = timestamps
        .map((ts, i) => ({ timestamp: ts, close: closePrices[i] }))
        .filter(item => item.timestamp != null && item.close != null)
        .map(item => {
            const raw = new Date(item.timestamp * 1000);
            const date = __normalizeDate(raw);
            return {
                date,
                close: item.close,
                // timestamp: item.timestamp
            };
        });
    return zipped;
};

let __closeBefore = (targetDate, quotes) => {
    // Normalize targetDate to 00:00:00 UTC for comparison
    const normalized = __normalizeDate(targetDate);
    // Binary search for the last quote with date < targetDate
    let lo = 0, hi = quotes.length - 1;
    let result = -1;
    while (lo <= hi) {
        const mid = lo + ((hi - lo) >> 1);
        if (quotes[mid].date < normalized) {
            result = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return result >= 0 ? quotes[result].close : undefined;
};

let __closeAt = (targetDate, quotes) => {
    // Normalize targetDate to 00:00:00 UTC for comparison
    const normalized = __normalizeDate(targetDate);

    // Binary search for the last quote with date <= targetDate
    let lo = 0, hi = quotes.length - 1;
    let result = -1;

    while (lo <= hi) {
        const mid = lo + ((hi - lo) >> 1);
        if (quotes[mid].date <= normalized) {
            result = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    return result >= 0 ? quotes[result].close : undefined;
};

let FETCH_QUOTES = (yahooSymbol, monthsAgo) => {
    const json = __fetchJsonFromYF(yahooSymbol, monthsAgo);
    const quotes = __parseJsonWithQuotes(json);
    const arrays = quotes.map(q => [q.date, q.close]);
    return [
        ["Date", "Close"],
        ...arrays
    ];
};

let GET_PERFORMANCES = (yahooSymbol) => {
    const json = __fetchJsonFromYF(yahooSymbol);
    const quotes = __parseJsonWithQuotes(json);
    const now = new Date();
    const targetDates = [
        new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
        new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
        new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
        new Date(now.getFullYear(), 0, 1),
        new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
        new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()),
        new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()),
        new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
    ].map(d => __normalizeDate(d));
    const lastPrice = quotes[quotes.length - 1].close;
    const performances = targetDates.map(d => {
        const close = __closeBefore(d, quotes);
        return close !== undefined ? ((lastPrice / close) - 1) : undefined;
    });
    return performances;
};

// Make functions globally available for Node.js (when using require)
// This also makes them compatible with Google Apps Script
if (typeof global !== 'undefined') {
    global.__fetchJsonFromYF = __fetchJsonFromYF;
    global.__normalizeDate = __normalizeDate;
    global.__parseJsonWithQuotes = __parseJsonWithQuotes;
    global.__closeBefore = __closeBefore;
    global.__closeAt = __closeAt;
    global.FETCH_QUOTES = FETCH_QUOTES;
    global.GET_PERFORMANCES = GET_PERFORMANCES;
}