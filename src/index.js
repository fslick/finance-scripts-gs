import "./base.js";
import "./yahooFinance.js";
import moment from "moment";

(async () => {
    const from = moment().subtract(5, "year").toDate();
    const to = moment().toDate();
    const result = await FETCH_QUOTES("AAPL", from, to);
    console.log(JSON.stringify(result, null, 4));
})();