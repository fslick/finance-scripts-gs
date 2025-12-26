import "./base.js";
import "./yahooFinance.js";

(async () => {
    const date = new Date("2025-09-25T00:00:00.000Z");
    console.log(date);
    const price = await PRICE_OF("NFLX", date);
    console.log(price);
})();