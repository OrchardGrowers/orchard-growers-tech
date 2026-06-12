import { safeFetch } from "./apiService";

const isDevelopment = process.env.NODE_ENV !== "production";

// 🔥 fallback if API fails
const fallbackCountries = [
  {
    name: "India",
    code: "IN",
    flag: "https://flagcdn.com/w40/in.png",
  },
  {
    name: "United States",
    code: "US",
    flag: "https://flagcdn.com/w40/us.png",
  },
];

export const getCountries = async () => {
  try {
    // 🧠 CACHE CHECK
    const cached = localStorage.getItem("countries");

    if (cached) {
      return JSON.parse(cached);
    }

    // 🌍 FETCH
    const data = await safeFetch(
      "https://restcountries.com/v3.1/all?fields=name,flags,cca2"
    );

    if (!Array.isArray(data)) {
      throw new Error("Invalid API response");
    }

    const list = data
      .map((c) => ({
        name: c.name?.common || "",
        code: c.cca2,
        flag: c.flags?.png,
      }))
      .filter((c) => c.code && c.flag)
      .sort((a, b) => a.name.localeCompare(b.name));

    // 💾 SAVE CACHE
    localStorage.setItem("countries", JSON.stringify(list));

    return list;
  } catch (err) {
    if (isDevelopment) {
      console.error("Country API failed, using fallback", err);
    }
    return fallbackCountries;
  }
};
