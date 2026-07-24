import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
).version;
const BUILD_REVISION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local";
const APP_BUILD_ID = `${PACKAGE_VERSION}-${BUILD_REVISION}-${Date.now().toString(36)}`;

const PUBLIC_COMPAT_ENV = new Set([
  "REACT_APP_MSG91_EFRUITMANDI_WIDGET_ID",
  "REACT_APP_MSG91_EFRUITMANDI_TOKEN_AUTH",
  "REACT_APP_SOCKET_URL",
  "REACT_APP_GOOGLE_AUTH_URL",
  "REACT_APP_FACEBOOK_AUTH_URL",
  "REACT_APP_PAYMENT_PARTNER_ENABLED",
]);

const PUBLIC_VITE_ENV = new Set([
  "VITE_API_BASE_URL",
  "VITE_API_URL",
  "VITE_FILE_BASE_URL",
  "VITE_SOCKET_URL",
  "VITE_APP_NAME",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_GOOGLE_AUTH_URL",
  "VITE_FACEBOOK_APP_ID",
  "VITE_FACEBOOK_AUTH_URL",
  "VITE_MSG91_EFRUITMANDI_WIDGET_ID",
  "VITE_MSG91_EFRUITMANDI_TOKEN_AUTH",
  "VITE_OTP_EXPIRY_SECONDS",
  "VITE_PAYMENT_PARTNER_ENABLED",
]);

const createClientEnv = (mode) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  const clientEnv = {
    NODE_ENV: mode === "development" ? "development" : "production",
    PUBLIC_URL: loadedEnv.PUBLIC_URL || "",
  };

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (PUBLIC_VITE_ENV.has(key) || PUBLIC_COMPAT_ENV.has(key)) {
      clientEnv[key] = value;
    }
  }

  return clientEnv;
};

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: "load-js-as-jsx",
      async transform(code, id) {
        if (!/src\/.*\.js$/.test(id.replace(/\\/g, "/"))) return null;
        return transformWithEsbuild(code, id, {
          loader: "jsx",
          jsx: "automatic",
        });
      },
    },
    react(),
    {
      name: "inject-efruitmandi-build-id",
      apply: "build",
      closeBundle() {
        const workerPath = fileURLToPath(
          new URL("./build/pwa-service-worker.js", import.meta.url)
        );
        const workerSource = readFileSync(workerPath, "utf8");
        if (!workerSource.includes("__EFRUITMANDI_BUILD_ID__")) {
          throw new Error("Missing service-worker build ID placeholder");
        }
        writeFileSync(
          workerPath,
          workerSource.replaceAll("__EFRUITMANDI_BUILD_ID__", APP_BUILD_ID),
          "utf8"
        );
      },
    },
  ],
  publicDir: "public",
  build: {
    outDir: "build",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("node_modules")) return undefined;
          if (
            normalizedId.includes("/react/") ||
            normalizedId.includes("/react-dom/") ||
            normalizedId.includes("/react-router/") ||
            normalizedId.includes("/react-router-dom/") ||
            normalizedId.includes("/@remix-run/")
          ) {
            return "react-vendor";
          }
          if (normalizedId.includes("/react-helmet-async/")) {
            return "seo-vendor";
          }
          return undefined;
        },
      },
    },
  },
  define: {
    "process.env": JSON.stringify(createClientEnv(mode)),
    __EFRUITMANDI_BUILD_ID__: JSON.stringify(APP_BUILD_ID),
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
}));
