import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // these test files use Node's own test runner (node --test, see "npm test"); vitest skips them
  test: {
    exclude: ['**/node_modules/**', 'demo/**', 'src/data/bucketDemo.test.js', 'src/data/glidePath.test.js', 'src/utils/bucketCheck.test.js',
      'src/utils/bucketRefill.test.js', 'src/utils/buyOpportunities.test.js', 'src/utils/fundsDashboard.test.js', 'src/utils/goalProjection.test.js',
      'src/utils/goalWithdrawal.test.js', 'src/utils/incomePlan.test.js', 'src/utils/mfMetrics.test.js', 'src/utils/retirementBuckets.test.js'],
  },
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: { main: 'index.html', goalPlanner: 'goal-planner/index.html' },   // second page: public goal planner
      output: {
        manualChunks: {
          'ag-grid': ['ag-grid-community', 'ag-grid-react'],
        },
      },
    },
  },
})
