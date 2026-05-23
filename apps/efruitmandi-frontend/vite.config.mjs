import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

const ENV_MAPPINGS = {
  VITE_API_BASE_URL: "REACT_APP_API_BASE_URL",
  VITE_API_URL: "REACT_APP_API_URL",
  VITE_GOOGLE_AUTH_URL: "REACT_APP_GOOGLE_AUTH_URL",
  VITE_FACEBOOK_AUTH_URL: "REACT_APP_FACEBOOK_AUTH_URL",
  VITE_APP_NAME: "REACT_APP_NAME",
  VITE_MSG91_ORCHARD_WIDGET_ID: "REACT_APP_MSG91_ORCHARD_WIDGET_ID",
  VITE_MSG91_ORCHARD_TOKEN_AUTH: "REACT_APP_MSG91_ORCHARD_TOKEN_AUTH",
  VITE_MSG91_EFRUITMANDI_WIDGET_ID: "REACT_APP_MSG91_EFRUITMANDI_WIDGET_ID",
  VITE_MSG91_EFRUITMANDI_TOKEN_AUTH: "REACT_APP_MSG91_EFRUITMANDI_TOKEN_AUTH",
};

const createClientEnv = (mode) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  const clientEnv = {
    NODE_ENV: mode === "development" ? "development" : "production",
    PUBLIC_URL: loadedEnv.PUBLIC_URL || "",
  };

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (key.startsWith("VITE_") || key.startsWith("REACT_APP_")) {
      clientEnv[key] = value;
    }
  }

  for (const [viteKey, reactKey] of Object.entries(ENV_MAPPINGS)) {
    if (clientEnv[viteKey] && !clientEnv[reactKey]) {
      clientEnv[reactKey] = clientEnv[viteKey];
    }
    if (clientEnv[reactKey] && !clientEnv[viteKey]) {
      clientEnv[viteKey] = clientEnv[reactKey];
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
