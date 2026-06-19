// Test if Vite reads tsconfig.json paths
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [{
    name: 'test-plugin',
    configResolved(config) {
      console.log('Vite resolved alias:', JSON.stringify(config.resolve?.alias, null, 2))
      console.log('Vite tsconfigPaths:', config.resolve?.tsconfigPaths)
    },
    resolveId(id) {
      console.log('[test-plugin] resolveId:', id)
      return null
    }
  }],
  build: {
    outDir: '/tmp/vite-test-out',
    rollupOptions: {
      input: 'src/index.html',
    }
  }
})
