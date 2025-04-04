import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

// --- STEP 1: Update ABI import to point to Novaland_F1's ABI ---
import contractABI from "./../../contractABI2.json"; // <-- Make sure this path is correct for Novaland_F1 ABI

import { useAddress, useMetamask, useDisconnect } from "@thirdweb-dev/react";
import { MessageSquare, Settings, LogOut, DollarSign, List, Edit, Trash2, Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react"; // Added Info icon
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";

// --- STEP 2: Update Contract Address with your deployed Novaland_F1 address ---
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <--- *** REPLACE THIS ***

// Global error message setter
let setErrorMsgGlobal = () => {};

// --- Load Contract Function (Targets Novaland_F1) ---
async function loadContract(needsSigner = false) {
    // Basic check for placeholder address
     if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
         console.error("Dashboard: Placeholder contract address detected.");
         setErrorMsgGlobal("Configuration Error: Contract address needs to be updated in the code.");
         return null;
     }
    // Check address format validity
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
        console.error("Dashboard: Invalid or missing contract address:", contractAddress);
        setErrorMsgGlobal("Configuration Error: Invalid contract address provided.");
        return null;
    }
     // Check ABI validity
     if (!contractABI || contractABI.length === 0) {
         console.error("Dashboard: Invalid or missing contract ABI.");
         setErrorMsgGlobal("Configuration Error: Invalid contract ABI provided (check import path for contractABI_F1.json).");
         return null;
     }

    // Check for MetaMask
    if (!window.ethereum) {
        console.error("Dashboard: MetaMask or compatible wallet not found.");
        // Allow read-only access even without MetaMask if applicable, but signer needed for actions
        if (needsSigner) {
            setErrorMsgGlobal("Please install MetaMask or a compatible wallet to perform actions.");
            return null;
        }
         // For read-only, we might proceed, but it's safer to require it
         setErrorMsgGlobal("Please install MetaMask or a compatible wallet.");
         return null;
    }

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        let contractInstance;

        if (needsSigner) {
            await provider.send("eth_requestAccounts", []); // Ensure user is connected
            const signer = provider.getSigner();
            const connectedAddr = await signer.getAddress(); // Verify signer
            if (!signer || !connectedAddr) {
                 throw new Error("Signer not available or wallet not connected properly.");
            }
            contractInstance = new ethers.Contract(contractAddress, contractABI, signer);
        } else {
            // Use provider for read-only
            contractInstance = new ethers.Contract(contractAddress, contractABI, provider);
        }

        // Test connection with a simple read call (propertyIndex exists in Novaland_F1)
        try {
            await contractInstance.propertyIndex();
            console.log(`Dashboard: Connection to Novaland_F1 contract successful ${needsSigner ? '(with signer)' : '(read-only)'}.`);
        } catch (readError) {
            console.error("Dashboard: Failed initial read from contract. Check address, ABI, and network.", readError);
            setErrorMsgGlobal("Failed to connect to the contract. Please ensure you are on the correct network and contract details are correct.");
            return null;
        }

        return contractInstance;
    } catch (error) {
        console.error("Dashboard: Error loading contract instance:", error);
        if (error.message.includes("Signer not available")) {
             setErrorMsgGlobal("Wallet connection issue. Please reconnect your wallet.");
        } else if (error.message.includes("Configuration Error")) {
             setErrorMsgGlobal(error.message); // Show specific config error
        } else {
            setErrorMsgGlobal(`Error initializing contract: ${error.message}`);
        }
        return null;
    }
}


const Dashboard = () => {
    const address = useAddress();
    const connectWithMetamask = useMetamask();
    const disconnect = useDisconnect();
    const navigate = useNavigate();

    const [user, setUser] = useState(null); // Basic user info (address)
    const [myProperties, setMyProperties] = useState([]); // Array of properties owned by the user
    const [isLoading, setIsLoading] = useState(false); // Loading state for fetching properties
    const [errorMsgState, setErrorMsgState] = useState(""); // General error messages for the dashboard
    const [actionStates, setActionStates] = useState({}); // Tracks state per property action (e.g., delisting)

    // Link global error setter to local state
    useEffect(() => {
        setErrorMsgGlobal = setErrorMsgState;
        return () => { setErrorMsgGlobal = () => {}; };
    }, []);

    // Connect Wallet Function
    const connectWallet = async () => {
        setErrorMsgState(""); // Clear previous errors
        try {
            await connectWithMetamask();
            // User data will be fetched by the useEffect watching `address`
        } catch (error) {
            console.error("MetaMask Connection Error:", error);
            setErrorMsgState("Failed to connect MetaMask. Please try again or ensure it's installed.");
        }
    };

    // Disconnect Wallet Function
    const disconnectWallet = async () => {
        try {
            await disconnect();
            // Reset state managed by address useEffect
            setUser(null);
            setMyProperties([]);
            setErrorMsgState("");
            setActionStates({});
        } catch (error) {
            console.error("Error disconnecting wallet:", error);
            setErrorMsgState("Failed to disconnect wallet.");
        }
    };

    // --- Fetch and Filter User Properties (Works with Novaland_F1 struct) ---
    const fetchAndFilterUserProperties = useCallback(async (walletAddress) => {
        if (!walletAddress) {
            console.warn("Dashboard: fetchAndFilter called without walletAddress.");
            return;
        }

        setIsLoading(true);
        setErrorMsgState("");
        setActionStates({}); // Reset action states on fetch
        // setMyProperties([]); // Clear properties before fetching? Or show stale briefly?

        try {
            const contract = await loadContract(false); // Load read-only
            if (!contract) {
                // Error message is set by loadContract via setErrorMsgGlobal
                throw new Error("Contract instance unavailable."); // Prevent further execution
            }

            console.log("Dashboard: Fetching all properties from Novaland_F1...");
            const allPropertiesData = await contract.FetchProperties();

            if (!Array.isArray(allPropertiesData)) {
                console.error("Dashboard: Received non-array data from FetchProperties:", allPropertiesData);
                throw new Error("Received invalid data format from the smart contract.");
            }

            const ownedProperties = allPropertiesData
                // Filter by owner address (case-insensitive)
                .filter(propertyStruct => propertyStruct && propertyStruct.owner && // Check owner exists
                        propertyStruct.owner.toLowerCase() === walletAddress.toLowerCase())
                // Map the raw struct to a simpler object for UI state
                .map((propertyStruct, index) => {
                    // --- Indices based on Novaland_F1 struct ---
                    // 0: productID (uint256), 1: owner (address), 2: price (uint256)
                    // 3: propertyTitle (string), 4: category (string), 5: images (string[])
                    // 6: location (string[]), 7: documents (string[]), 8: description (string)
                    // 9: nftId (string), 10: isListed (bool)
                    if (!propertyStruct || propertyStruct.length < 11) {
                        console.warn(`Dashboard: Skipping incomplete struct at filtered index ${index}:`, propertyStruct);
                        return null; // Skip incomplete data
                    }
                    try {
                        const location = Array.isArray(propertyStruct.location) ? propertyStruct.location : [];
                        const displayLocation = location.length >= 3 ? `${location[2]}, ${location[1]}` : (location.length > 0 ? location.join(', ') : "N/A");

                        return {
                            productID: propertyStruct.productID.toString(),
                            name: propertyStruct.propertyTitle || "Untitled Property", // Fallback
                            locationString: displayLocation,
                            category: propertyStruct.category || "Uncategorized", // Fallback
                            priceString: `${ethers.utils.formatEther(propertyStruct.price)} ETH`,
                            isListed: propertyStruct.isListed, // Boolean status
                        };
                    } catch (mapError) {
                         console.error(`Dashboard: Error parsing property struct at filtered index ${index}:`, propertyStruct, mapError);
                         return null; // Skip if parsing fails
                    }
                })
                .filter(p => p !== null); // Remove any nulls from mapping/filtering errors

            console.log("Dashboard: Filtered Owned Properties:", ownedProperties);
            setMyProperties(ownedProperties);

        } catch (error) {
            console.error("Dashboard: Error fetching or processing user properties:", error);
             // Only set error if not already set by loadContract
             if (!errorMsgState) {
                 setErrorMsgState(`Failed to load your properties: ${error.message}`);
             }
            setMyProperties([]); // Clear properties on error
        } finally {
            setIsLoading(false);
        }
    }, [errorMsgState]); // Include errorMsgState to potentially allow retry if error clears? Review dependency logic.

    // --- Handle Delist Action (Works with Novaland_F1 DelistProperty) ---
    const handleDelist = async (productId) => {
        if (!address) {
            setErrorMsgState("Please connect your wallet first.");
            return;
        }
        setActionStates(prev => ({ ...prev, [productId]: { loading: true, error: null } }));
        setErrorMsgState(""); // Clear general errors when attempting an action

        try {
            const contract = await loadContract(true); // Need signer
            if (!contract) {
                 // Error set by loadContract
                throw new Error("Contract connection failed.");
            }

            console.log(`Dashboard: Attempting to delist property ID: ${productId} using Novaland_F1`);
            const tx = await contract.DelistProperty(productId); // Call Novaland_F1 function

            setActionStates(prev => ({ ...prev, [productId]: { loading: true, error: "Waiting for confirmation..." } }));
            console.log(`Dashboard: Delist transaction sent: ${tx.hash}`);

            await tx.wait(); // Wait for confirmation

            console.log(`Dashboard: Property ${productId} successfully delisted.`);
            setActionStates(prev => ({ ...prev, [productId]: { loading: false, error: null } }));

            // Update UI - Optimistic update is faster for user feedback
            setMyProperties(prevProps => prevProps.map(prop =>
                prop.productID === productId ? { ...prop, isListed: false } : prop
            ));
            // Optionally: await fetchAndFilterUserProperties(address); // Re-fetch for guaranteed consistency

        } catch (error) {
            console.error(`Dashboard: Error delisting property ${productId}:`, error);
            const revertReason = error.reason || error.data?.message || error.message || "Transaction failed or rejected.";
            // Prioritize specific action error over general dashboard error
            setErrorMsgState(""); // Clear general error
            setActionStates(prev => ({ ...prev, [productId]: { loading: false, error: `Delist failed: ${revertReason}` } }));
        }
    };

    // Effect to load user data and properties when address becomes available or changes
    useEffect(() => {
        if (address) {
            console.log("Dashboard: Wallet address detected:", address);
            setUser({ name: "Connected User", wallet: address }); // Basic user info
            fetchAndFilterUserProperties(address);
        } else {
            // Reset state when disconnected
            setUser(null);
            setMyProperties([]);
            setIsLoading(false); // Not loading if no address
            setErrorMsgState(""); // Clear errors
            setActionStates({});
            console.log("Dashboard: Wallet disconnected or not yet available.");
        }
    }, [address, fetchAndFilterUserProperties]);


    // --- Render Logic ---

    // Display loading state for the entire dashboard if address is present but properties are loading
    const showGlobalLoading = isLoading && address && myProperties.length === 0;

    // Render Connect Prompt if no address
    if (!address) {
        return (
            <div className="w-full min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6 text-center">
                 <h1 className="text-4xl font-bold text-gray-800 mb-4">Your Property Dashboard</h1>
                 <p className="text-gray-600 mb-8 max-w-md">
                     Connect your wallet to view and manage your real estate assets on the blockchain.
                 </p>
                 {/* Display connection error if any */}
                 {errorMsgState && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded text-sm">
                        {errorMsgState}
                    </div>
                 )}
                <button
                    onClick={connectWallet}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-10 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    Connect Wallet
                </button>
            </div>
        );
    }

    // Main Dashboard View (Rendered when address is available)
    return (
        <div className="w-full min-h-screen flex bg-gradient-to-br from-gray-100 to-blue-50">
            {/* Left Sidebar */}
            <aside className="w-64 bg-white text-gray-800 min-h-screen p-6 border-r border-gray-200 shadow-sm hidden md:flex md:flex-col"> {/* Ensure flex-col for sticky footer */}
                <h2 className="text-2xl font-semibold mb-8 text-gray-800">Dashboard</h2>
                <nav className="flex flex-col space-y-2 flex-grow"> {/* flex-grow pushes logout down */}
                    <Link to="/dashboard" className="flex items-center space-x-3 p-2 bg-indigo-50 text-indigo-700 font-medium rounded-md transition-colors border-l-4 border-indigo-600">
                        <List className="w-5 h-5" /> <span>My Properties</span>
                    </Link>
                    <Link to="/chat" className="flex items-center space-x-3 p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                        <MessageSquare className="w-5 h-5" /> <span>Conversations</span>
                    </Link>
                    {/* Add other links here */}
                </nav>
                {/* Logout Button at the bottom */}
                <div className="mt-auto pt-6">
                     <button
                        onClick={disconnectWallet}
                        className="flex w-full items-center space-x-3 p-2 hover:bg-red-50 text-red-600 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-red-300 font-medium"
                     >
                        <LogOut className="w-5 h-5" /> <span>Logout</span>
                     </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
                {/* Profile Box */}
                <section className="w-full max-w-6xl mx-auto bg-white rounded-lg p-6 shadow-md mb-8 border border-gray-200 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
                    <div className="text-center sm:text-left flex-grow">
                        <h2 className="text-xl font-semibold text-gray-800">{user?.name ?? "User"}</h2>
                        <p className="text-sm text-gray-500 break-all" title={user?.wallet}>
                            Wallet: <span className="font-mono">{user?.wallet ? `${user.wallet.substring(0, 6)}...${user.wallet.substring(user.wallet.length - 4)}` : "N/A"}</span>
                        </p>
                    </div>
                     {/* Maybe add a settings link */}
                     {/* <Link to="/settings" className="text-gray-400 hover:text-indigo-600 ml-auto flex-shrink-0" title="Settings">
                        <Settings className="w-5 h-5"/>
                     </Link> */}
                </section>

                {/* Display General Loading/Error for Property List */}
                 {showGlobalLoading && <div className="text-center p-6"><Loader2 className="w-8 h-8 animate-spin inline-block text-indigo-600" /> <span className="ml-2">Loading your properties...</span></div>}
                 {!isLoading && errorMsgState && (
                    <div className="w-full max-w-6xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-center text-sm">
                         {errorMsgState}
                    </div>
                 )}


                {/* Property Listings Section */}
                <section className="mt-6 w-full max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-5 flex-wrap gap-4 border-b pb-3 border-gray-200">
                         <h3 className="text-2xl font-bold text-gray-800">My Properties</h3>
                         <Link to="/propertyform">
                            <motion.button
                                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-2 px-5 rounded-md shadow-sm transition-all transform hover:scale-103 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 flex items-center"
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                            >
                                + List New Property
                            </motion.button>
                        </Link>
                    </div>

                    {/* Property Display Area */}
                    <div className="rounded-lg min-h-[200px] mt-4">
                         {/* Show only when not loading and no error prevents display */}
                        {!isLoading && !errorMsgState && myProperties.length === 0 && (
                            <div className="text-center text-gray-500 py-10 px-4 bg-gray-50 rounded-md">
                                <Info className="w-10 h-10 mx-auto mb-3 text-gray-400"/>
                                You haven't listed any properties yet. <br/> Click 'List New Property' to get started!
                            </div>
                        )}
                        {/* Render list if not loading, no error, and properties exist */}
                        {!isLoading && !errorMsgState && myProperties.length > 0 && (
                            <ul className="space-y-4">
                                {myProperties.map((property) => {
                                    const actionState = actionStates[property.productID] || { loading: false, error: null };
                                    return (
                                        <li
                                            key={property.productID}
                                            className={`p-4 border ${actionState.error ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white'} rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-shadow hover:shadow-md`}
                                        >
                                            {/* Property Info */}
                                            <div className="flex-grow">
                                                 <p className="font-semibold text-lg text-gray-800">{property.name}</p>
                                                 <p className="text-sm text-gray-600">{property.locationString} • <span className="text-gray-500">{property.category}</span></p>
                                                 <p className="text-md text-indigo-700 font-medium mt-1">{property.priceString}</p>
                                                 <span className={`text-xs font-medium mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full ${property.isListed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                     {property.isListed ? <CheckCircle className="w-3 h-3 mr-1"/> : <AlertTriangle className="w-3 h-3 mr-1"/>}
                                                    {property.isListed ? 'Listed for Sale' : 'Not Listed'}
                                                 </span>
                                                 {/* Display specific action error below property info */}
                                                  {actionState.error && !actionState.loading && <p className="text-xs text-red-600 mt-1">{actionState.error}</p>}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex-shrink-0 flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
                                                <Link
                                                    to={`/property/${property.productID}`}
                                                    className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-md font-medium transition-colors"
                                                >
                                                    View
                                                </Link>
                                                <Link
                                                    to={`/edit-property/${property.productID}`} // Navigate to edit page
                                                    className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center"
                                                >
                                                    <Edit className="w-3 h-3 mr-1" /> Edit
                                                </Link>
                                                {/* Delist Button - Show only if listed */}
                                                {property.isListed && (
                                                    <button
                                                        onClick={() => handleDelist(property.productID)}
                                                        disabled={actionState.loading}
                                                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center ${
                                                            actionState.loading
                                                                ? 'bg-gray-200 text-gray-500 cursor-wait' // More specific cursor
                                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                        }`}
                                                    >
                                                         {actionState.loading ? (
                                                             <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                         ) : (
                                                             <Trash2 className="w-3 h-3 mr-1" />
                                                         )}
                                                         {actionState.loading ? (actionState.error || 'Delisting...') : 'Delist'}
                                                     </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Dashboard;