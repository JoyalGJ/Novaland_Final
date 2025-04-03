import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Core Components & Pages
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./Home"; // Main view when connected
import Home2 from "./pages/Home2"; // Landing/Connect view when disconnected
import Explore from "./pages/Explore.jsx";
import PropertyInfo from "./pages/PropertyInfo";
import Dashboard from "./pages/Dashboard";
import PropertyForm from "./pages/PropertyForm";
import Editproperty from "./pages/Editproperty";
// <-- IMPORT PurchasePage

import ChatPage from "./pages/ChatPage.jsx";
import MakeOffer from "./components/MakeOffer.jsx";
import AboutPage from "./pages/AboutPage";

// Context & Services
import { useWallet } from './pages/WalletContext';
import { supabase } from "./../supabase";

function App() {
    const { address, isConnected, connectWallet } = useWallet();
    const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);

    // ... (rest of your useEffects and logic remain the same) ...

    // --- Render MetaMask Install Prompt ---
    if (!isMetaMaskInstalled) {
        // ... (MetaMask install prompt code remains the same) ...
    }

    // --- Render Main Application ---
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
                        {/* Conditional Home Route */}
                        <Route
                            path="/"
                            element={address ? <Home /> : <Home2 connectWallet={connectWallet} />}
                        />

                        {/* Protected Routes */}
                        <Route path="/explore" element={address ? <Explore /> : <Navigate to="/" replace />} />
                        <Route path="/property/:id" element={address ? <PropertyInfo /> : <Navigate to="/" replace />} />
                        <Route path="/dashboard" element={address ? <Dashboard /> : <Navigate to="/" replace />} />
                        <Route path="/make-offer" element={address ? <MakeOffer /> : <Navigate to="/" replace />} />
                        <Route path="/chat" element={address ? <ChatPage /> : <Navigate to="/" replace />} />
                        <Route path="/propertyform" element={address ? <PropertyForm /> : <Navigate to="/" replace />} />
                        <Route path="/edit-property/:productId" element={address ? <Editproperty /> : <Navigate to="/" replace />} />

                        {/* --- ADDED ROUTE FOR PURCHASE PAGE --- */}
                        
                        {/* ------------------------------------ */}

                        {/* Public Routes */}
                        <Route path="/about" element={<AboutPage />} />

                        {/* Catch-all Route */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
}

export default App;