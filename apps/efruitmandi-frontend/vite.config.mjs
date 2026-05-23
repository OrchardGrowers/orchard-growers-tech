import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

const createClientEnv = (mode) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  const clientEnv = {
    NODE_ENV: mode === "development" ? "development" : "production",
    PUBLIC_URL: loadedEnv.PUBLIC_URL || "",
  };

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (key.startsWith("VITE_") && !/(SECRET|PASS|PASSWORD|TOKEN|AUTH|KEY)/i.test(key)) {
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
