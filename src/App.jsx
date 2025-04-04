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

import ChatPage from "./pages/Chatpage.jsx"; // Verify filename case sensitivity
import MakeOffer from "./components/MakeOffer.jsx";
import AboutPage from "./pages/AboutPage";

// Context & Services
import { useWallet } from './pages/WalletContext'; // Verify path
import { supabase } from "./../supabase"; // Verify path

function App() {
    const { address, isConnected, connectWallet } = useWallet();
    const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);

    // Effect to check MetaMask installation
     useEffect(() => {
        if (typeof window.ethereum !== 'undefined') {
            setIsMetaMaskInstalled(true);
        } else {
             setIsMetaMaskInstalled(false);
        }
        // Add any other initial setup logic here
    }, []);
    // --- (Keep rest of your existing useEffects) ---


    // --- Render MetaMask Install Prompt ---
    if (!isMetaMaskInstalled) {
        // Keep your existing MetaMask install prompt UI
         return <div>Please install MetaMask to use this application.</div>;
    }

    // --- Render Main Application ---
    return (
        <Router>
            <div className="flex flex-col min-h-screen">
                <Header
                    notificationCount={notificationCount}
                    isConnected={!!address} // Use context address for status
                    connectWallet={connectWallet} // Pass context connect function
                    walletAddress={address} // Pass context address
                />

                {/* --- TEMPORARY CONNECT BUTTON --- */}
                {/* Only show this button if the wallet is not connected */}
                {!address && (
                    <div style={{ padding: '1rem', textAlign: 'center', background: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
                        <button
                            onClick={connectWallet} // Call the connect function from the context
                            style={{
                                padding: '8px 16px',
                                cursor: 'pointer',
                                backgroundColor: '#4A90E2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: 'bold'
                            }}
                        >
                            Temporary Connect Button (App.jsx)
                        </button>
                         <p style={{ fontSize: '0.8rem', marginTop: '4px', color: '#666' }}>
                            (For testing purposes only)
                         </p>
                    </div>
                )}
                {/* --- END TEMPORARY CONNECT BUTTON --- */}

                <main className="flex-grow">
                    <Routes>
                        {/* Conditional Home Route (as provided by user - forcing Home) */}
                        <Route
                            path="/"
                            element={<Home />}
                            // element={address ? <Home /> : <Home2 connectWallet={connectWallet} />} // Original logic
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