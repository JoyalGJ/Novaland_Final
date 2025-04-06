import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AlertTriangle, Download } from 'lucide-react';

import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./Home";
import Home2 from "./pages/Home2";
import Explore from "./pages/Explore";
import PropertyInfo from "./pages/PropertyInfo";
import Dashboard from "./pages/Dashboard";
import PropertyForm from "./pages/PropertyForm";
import Editproperty from "./pages/Editproperty";
import ChatPage from "./pages/Chatpage";
import MakeOffer from "./components/MakeOffer";
import AboutPage from "./pages/AboutPage";

import { useWallet } from './pages/WalletContext';

function App() {
  const { address, connectWallet } = useWallet();
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (typeof window.ethereum === 'undefined' || !window.ethereum.isMetaMask) {
      console.log("MetaMask is not installed.");
      setIsMetaMaskInstalled(false);
    } else {
      console.log("MetaMask is installed.");
      setIsMetaMaskInstalled(true);

      const handleAccountsChanged = (accounts) => {
        console.log("App.js detected accountsChanged:", accounts);
        // No need to update state here since context handles it
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  if (!isMetaMaskInstalled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-100 to-orange-100 text-gray-800 p-6">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
        <h1 className="text-3xl font-bold mb-4 text-center">MetaMask Required</h1>
        <p className="text-lg text-center mb-8 max-w-md">
          To use this decentralized application, you need the MetaMask browser extension.
        </p>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200"
        >
          <Download className="w-5 h-5" />
          Install MetaMask
        </a>
        <p className="text-sm text-gray-600 mt-6">
          Refresh this page after installation.
        </p>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Header
          notificationCount={notificationCount}
          isConnected={!!address}
          connectWallet={connectWallet}
          walletAddress={address}
        />

        <main className="flex-grow">
          <Routes>
            <Route
              path="/"
              element={address ? <Home /> : <Home2 connectWithMetamask={connectWallet} />}
            />
            <Route path="/explore" element={address ? <Explore /> : <Navigate to="/" replace />} />
            <Route path="/property/:id" element={address ? <PropertyInfo /> : <Navigate to="/" replace />} />
            <Route path="/dashboard" element={address ? <Dashboard /> : <Navigate to="/" replace />} />
            <Route path="/make-offer" element={address ? <MakeOffer /> : <Navigate to="/" replace />} />
            <Route path="/chat" element={address ? <ChatPage /> : <Navigate to="/" replace />} />
            <Route path="/propertyform" element={address ? <PropertyForm /> : <Navigate to="/" replace />} />
            <Route path="/edit-property/:productId" element={address ? <Editproperty /> : <Navigate to="/" replace />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
