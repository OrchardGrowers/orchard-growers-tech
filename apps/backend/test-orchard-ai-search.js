import dotenv from "dotenv";
import { searchGoogleProgrammable } from "./services/orchardAiSearchService.js";

dotenv.config();

const result = await searchGoogleProgrammable({
  category: "buyers",
  query: "apple fruit buyers Maharashtra phone email",
  fruit: "Apple",
  state: "Maharashtra",
  leadType: "Buyer",
  limit: 5,
});

console.log(JSON.stringify(result, null, 2));
