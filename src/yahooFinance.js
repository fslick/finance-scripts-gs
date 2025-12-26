let __fetchJsonFromYF = async (yahooSymbol) => {
    if (!yahooSymbol) {
        throw new Error("yahooSymbol is required");
    }

    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);

    // 61 months ago (approx 5 years + 1 month)
    const monthsAgo = 61;
    const fromDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, now.getDate());
    const period1 = Math.floor(fromDate.getTime() / 1000);

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
    const text = await Http.get(url);

    return JSON.parse(text);
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

let PRICE_OF = async (yahooSymbol, date) => {
    const json = await __fetchJsonFromYF(yahooSymbol);
    const quotes = __parseJsonWithQuotes(json);

    const targetDate = date ? __normalizeDate(date) : __normalizeDate(new Date());
    const cached = Cache.get(yahooSymbol + ":" + targetDate.toISOString());
    if (cached !== null) {
        return cached ? Number(cached) : cached;
    }

    const close = __closeAt(targetDate, quotes);
    Cache.put(yahooSymbol + ":" + targetDate.toISOString(), close ? close.toString() : null);
    return close ? Number(close) : close;
}

let FETCH_QUOTES = async (yahooSymbol, monthsAgo) => {
    const json = await __fetchJsonFromYF(yahooSymbol);
    let quotes = __parseJsonWithQuotes(json);

    if (monthsAgo) {
        const now = new Date();
        const cutoffDate = __normalizeDate(new Date(now.getFullYear(), now.getMonth() - monthsAgo, now.getDate()));
        quotes = quotes.filter(q => q.date >= cutoffDate);
    }
    const arrays = quotes.map(q => [q.date, q.close]);
    return [
        ["Date", "Close"],
        ...arrays
    ];
};

let GET_PERFORMANCES = async (yahooSymbol) => {
    const json = await __fetchJsonFromYF(yahooSymbol);
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
    global.PRICE_OF = PRICE_OF;
    global.FETCH_QUOTES = FETCH_QUOTES;
    global.GET_PERFORMANCES = GET_PERFORMANCES;
}