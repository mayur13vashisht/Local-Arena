import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expose both VITE_ and Supabase-integration (NEXT_PUBLIC_) prefixed vars to the client.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
