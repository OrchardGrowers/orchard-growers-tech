import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

console.log("API Key Loaded :", !!process.env.GOOGLE_PROGRAMMABLE_SEARCH_API_KEY);
console.log("CX Loaded      :", !!process.env.GOOGLE_CX_BUYERS);

try {
  const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
    headers: {
      "x-goog-api-key": process.env.GOOGLE_PROGRAMMABLE_SEARCH_API_KEY,
    },
    params: {
      cx: process.env.GOOGLE_CX_BUYERS,
      q: "apple fruit buyers",
      num: 1,
    },
  });

  console.log(JSON.stringify(response.data, null, 2));
} catch (err) {
  console.log("Status:", err.response?.status);
  console.log(JSON.stringify(err.response?.data || err.message, null, 2));
}
