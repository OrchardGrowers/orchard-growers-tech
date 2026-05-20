const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const command = process.argv[2] || "start";
const appRoot = path.resolve(__dirname, "..");
const nodeEnv = command === "build" ? "production" : "development";

process.env.NODE_ENV = process.env.NODE_ENV || nodeEnv;

[
  `.env.${process.env.NODE_ENV}.local`,
  ".env.local",
  `.env.${process.env.NODE_ENV}`,
  ".env",
].forEach((fileName) => {
  const filePath = path.join(appRoot, fileName);
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  Object.entries(parsed).forEach(([key, value]) => {
    if (process.env[key] === undefined) process.env[key] = value;
  });
});

const mapEnv = (viteKey, reactKey) => {
  if (process.env[viteKey] && !process.env[reactKey]) {
    process.env[reactKey] = process.env[viteKey];
  }
};

mapEnv("VITE_API_BASE_URL", "REACT_APP_API_BASE_URL");
mapEnv("VITE_MSG91_ORCHARD_WIDGET_ID", "REACT_APP_MSG91_ORCHARD_WIDGET_ID");
mapEnv("VITE_MSG91_ORCHARD_TOKEN_AUTH", "REACT_APP_MSG91_ORCHARD_TOKEN_AUTH");
mapEnv("VITE_MSG91_EFRUITMANDI_WIDGET_ID", "REACT_APP_MSG91_EFRUITMANDI_WIDGET_ID");
mapEnv("VITE_MSG91_EFRUITMANDI_TOKEN_AUTH", "REACT_APP_MSG91_EFRUITMANDI_TOKEN_AUTH");

if (!process.env.REACT_APP_API_BASE_URL) {
  console.warn("Missing VITE_API_BASE_URL for eFruitMandi frontend.");
}

if (!["start", "build", "test"].includes(command)) {
  throw new Error(`Unsupported react-scripts command: ${command}`);
}

require(`react-scripts/scripts/${command}`);
