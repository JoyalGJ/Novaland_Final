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
import { useWallet } from './pages/WalletContext'; // Assuming correct path
import { supabase } from "./../supabase"; // Assuming correct path

function App() {
    // Use state from context
    const { address, isConnected, connectWallet } = useWallet();
    const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);

    // Example useEffect to check MetaMask installation (keep your existing logic)
    useEffect(() => {
        if (typeof window.ethereum !== 'undefined') {
            setIsMetaMaskInstalled(true);
        } else {
             setIsMetaMaskInstalled(false);
        }
        // Add any other initial setup logic here
    }, []);


    // --- Render MetaMask Install Prompt ---
    if (!isMetaMaskInstalled) {
       // Simple fallback, keep your existing prompt logic
        return <div>Please install MetaMask to use this application.</div>;
    }

    // --- Render Main Application ---
    return (
        <Router>
            <div className="flex flex-col min-h-screen">
                <Header
                    notificationCount={notificationCount}
                    isConnected={!!address} // Use context address to determine connected status
                    connectWallet={connectWallet} // Pass context connect function
                    walletAddress={address} // Pass context address
                />

                {/* --- TEMPORARY CONNECT BUTTON --- */}
                {!address && ( // Only show if not connected
                    <div style={{ padding: '1rem', textAlign: 'center', background: '#eee' }}>
                        <button
                            onClick={connectWallet}
                            style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: 'lightblue' }}
                        >
                            Temporary Connect (App.jsx)
                        </button>
                    </div>
                )}
                {/* --- END TEMPORARY CONNECT BUTTON --- */}

                <main className="flex-grow">
                    <Routes>
                        {/* Conditional Home Route (as provided by user) */}
                        <Route
                            path="/"
                            element={<Home />} // User forced Home here
                            //element={isConnected ? <Home /> : <Home2 connectWallet={connectWallet} />} // Original logic commented out by user
                        />

                        {/* Protected Routes using context address */}
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