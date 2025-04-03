import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // Assuming you have this plugin correctly configured if using Tailwind directly via Vite plugin
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()], // Ensure tailwindcss() is correctly set up if you are using it this way
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // --- ADD THIS SERVER CONFIGURATION ---
  server: {
    // Make the server listen on all addresses, necessary for Ngrok/Docker/etc.
    host: true, // or '0.0.0.0'
    // Explicitly allow requests from your Ngrok host
    allowedHosts: [
      '9faf-2409-40f3-22-c619-f8fc-402d-b331-b0d1.ngrok-free.app',
      'certain-humpback-awfully.ngrok-free.app',
      // You can add more hosts here if needed, e.g., custom domains
      // 'localhost', // Usually allowed by default, but good to be explicit if needed
    ],
    // Optional: If you are running into HMR (Hot Module Replacement) issues with Ngrok/Docker
    // hmr: {
    //   protocol: 'wss', // Use secure websockets
    //   host: '9faf-2409-40f3-22-c619-f8fc-402d-b331-b0d1.ngrok-free.app', // Your ngrok host
    //   clientPort: 443 // Standard HTTPS port
    // }
  },
  // --- END SERVER CONFIGURATION ---
});