import React, { useState, useEffect } from "react";
import { Building2, TrendingUp, Wallet } from "lucide-react";
import { Signupcustom } from "../components/signupcustom";
import Footer from "../components/Footer";
import { useNavigate } from "react-router-dom";
import { supabase } from "./../../supabase";

function Home2({ connectWithMetamask }) {
    const navigate = useNavigate();

    const checkUserExists = async (wallet) => {
        const { data, error } = await supabase
            .from("users")
            .select("name, email")
            .eq("wallet_address", wallet)
            .single();

        if (error && error.code !== "PGRST116") {
            console.error("Error checking user:", error);
            return;
        }

        if (data) {
            // User Exists → Login
            console.log("User Found:", data);
            localStorage.setItem("name", data.name);
            localStorage.setItem("email", data.email || "");
            navigate("/");  // Redirect to main Home if user exists
        } else {
            // User Not Found → Show Signup Form

        }
    };

    const handleMetamask = async () => {
        try {
            const wallet = await connectWithMetamask();
            if (wallet) {
                checkUserExists(wallet);
            }
        } catch (error) {
            console.error("Error connecting with MetaMask:", error);
            // Handle connection error
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-tr from-blue-600 via-purple-500 to-yellow-400 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80')] bg-cover bg-center mix-blend-overlay opacity-20"></div>
                <div className="absolute inset-0 animate-shine"></div>

                {/* Flex container for text & signup form */}
                <div className="container mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center justify-between w-full">
                    {/* Left side - Text & CTA */}
                    <div className="max-w-2xl text-center md:text-left">
                        <h1 className="text-6xl md:text-7xl font-bold text-white mb-6">
                            Welcome to
                            <span className="block">the future of Real Estate</span>
                        </h1>
                        <p className="text-xl text-white/90 mb-8">
                            Transform your property journey with blockchain technology. Buy, sell, and invest in real estate with complete transparency and security.
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                            <button className="bg-white text-blue-600 px-8 py-4 rounded-full font-semibold hover:bg-opacity-90 transition-all">
                                Explore Properties
                            </button>
                            <button
                                className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-semibold hover:bg-white/10 transition-all"
                                onClick={handleMetamask}
                            >
                                Connect Wallet
                            </button>
                        </div>
                    </div>

                    {/* Right side - Signup Form */}
                    <div className="items-center z-20 w-full flex justify-center">
                        <div className="w-full max-w-lg">
                            {/* This will make it responsive */}
                            <Signupcustom />
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="py-24">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">
                            Why Choose Our Platform
                        </h2>
                        <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto"></div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                            <Wallet className="w-12 h-12 text-blue-600 mb-6" />
                            <h3 className="text-xl font-semibold mb-4">Secure Transactions</h3>
                            <p className="text-gray-600">
                                Blockchain-powered transactions ensure complete security and transparency.
                            </p>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                            <Building2 className="w-12 h-12 text-blue-600 mb-6" />
                            <h3 className="text-xl font-semibold mb-4">Smart Properties</h3>
                            <p className="text-gray-600">
                                Digital contracts and automated processes for seamless property management.
                            </p>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                            <TrendingUp className="w-12 h-12 text-blue-600 mb-6" />
                            <h3 className="text-xl font-semibold mb-4">Investment Growth</h3>
                            <p className="text-gray-600">
                                Track and maximize your real estate investments with real-time analytics.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
export default Home2;