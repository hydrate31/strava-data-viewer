import { defineConfig } from "$fresh/server.ts";
import authPlugin from "./plugins/auth.ts";

export default defineConfig({
    port: 3000,
    plugins: [
        authPlugin
    ]
});
