import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ThirdwebProvider } from '@thirdweb-dev/react'
import App from './App'

import { WalletProvider } from './pages/WalletContext'



createRoot(document.getElementById('root')).render(
  <ThirdwebProvider>
   <WalletProvider>
    <StrictMode>
     <App />
    </ StrictMode>
  </WalletProvider>
  </ThirdwebProvider >
)
