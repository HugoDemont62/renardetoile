import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasmPlugin from 'vite-plugin-wasm' // installer : npm i -D vite-plugin-wasm

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    wasmPlugin()],
})
