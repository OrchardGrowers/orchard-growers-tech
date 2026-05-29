import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

const PUBLIC_COMPAT_ENV = new Set([
  "REACT_APP_MSG91_EFRUITMANDI_WIDGET_ID",
  "REACT_APP_MSG91_EFRUITMANDI_TOKEN_AUTH",
  "REACT_APP_SOCKET_URL",
  "REACT_APP_GOOGLE_AUTH_URL",
  "REACT_APP_FACEBOOK_AUTH_URL",
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
  ],
  publicDir: "public",
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  define: {
    "process.env": JSON.stringify(createClientEnv(mode)),
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
}));
