const API_TIMEOUT = 8000;
const isDevelopment = process.env.NODE_ENV !== "production";

// 🔐 Generic fetch with timeout + safety
export const safeFetch = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    return data;
  } catch (err) {
    if (isDevelopment) {
      console.error("API Error:", err.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
