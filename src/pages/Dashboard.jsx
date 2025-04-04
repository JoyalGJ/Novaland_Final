import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useAddress, useMetamask, useDisconnect } from "@thirdweb-dev/react";
import { MessageSquare, Settings, LogOut, DollarSign, List, Edit, Trash2, Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./../../supabase";

import contractABI from "./../../contractABI2.json";
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424";

let setErrorMsgGlobal = () => {};

async function loadContract(needsSigner = false) {
	 if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") { console.error("Dashboard: Placeholder contract address detected."); setErrorMsgGlobal("Configuration Error: Contract address needs update."); return null; }
	if (!contractAddress || !ethers.utils.isAddress(contractAddress)) { console.error("Dashboard: Invalid or missing contract address:", contractAddress); setErrorMsgGlobal("Configuration Error: Invalid contract address."); return null; }
	 if (!contractABI || contractABI.length === 0) { console.error("Dashboard: Invalid or missing contract ABI."); setErrorMsgGlobal("Configuration Error: Invalid contract ABI."); return null; }
	if (!window.ethereum) { console.error("Dashboard: MetaMask not found."); if (needsSigner) { setErrorMsgGlobal("Please install MetaMask."); return null; } setErrorMsgGlobal("Please install MetaMask."); return null; }
	try {
		const provider = new ethers.providers.Web3Provider(window.ethereum);
		let contractInstance;
		if (needsSigner) {
			await provider.send("eth_requestAccounts", []);
			const signer = provider.getSigner();
			const connectedAddr = await signer.getAddress();
			if (!signer || !connectedAddr) { throw new Error("Signer not available."); }
			contractInstance = new ethers.Contract(contractAddress, contractABI, signer);
		} else { contractInstance = new ethers.Contract(contractAddress, contractABI, provider); }
		try { await contractInstance.propertyIndex(); console.log(`Dashboard: Connection OK ${needsSigner ? '(signer)' : '(read-only)'}.`); }
		catch (readError) { console.error("Dashboard: Failed contract read.", readError); setErrorMsgGlobal("Failed contract connection. Check network/details."); return null; }
		return contractInstance;
	} catch (error) {
		console.error("Dashboard: Error loading contract instance:", error);
		if (error.message.includes("Signer not available")) { setErrorMsgGlobal("Wallet connection issue."); }
		else if (error.message.includes("Configuration Error")) { setErrorMsgGlobal(error.message); }
		else { setErrorMsgGlobal(`Error initializing contract: ${error.message}`); }
		return null;
	}
}

const Dashboard = () => {
	const address = useAddress();
	const connectWithMetamask = useMetamask();
	const disconnect = useDisconnect();
	const navigate = useNavigate();

	const [user, setUser] = useState(null);
	const [myProperties, setMyProperties] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingUser, setIsLoadingUser] = useState(false);
	const [errorMsgState, setErrorMsgState] = useState("");
	const [actionStates, setActionStates] = useState({});

	useEffect(() => { setErrorMsgGlobal = setErrorMsgState; return () => { setErrorMsgGlobal = () => {}; }; }, []);

	const connectWallet = async () => {
		setErrorMsgState("");
		try { await connectWithMetamask(); }
		catch (error) { console.error("MetaMask Connection Error:", error); setErrorMsgState("Failed to connect MetaMask."); }
	};

	// --- Modified Logout Function ---
	const handleLogout = async () => {
		try {
			await disconnect(); // Use the thirdweb disconnect hook
			setUser(null); // Clear user state
			setMyProperties([]); // Clear properties
			setErrorMsgState(""); // Clear errors
			setActionStates({}); // Clear action states
            localStorage.removeItem("name"); // Clear local storage name
            localStorage.removeItem("email"); // Clear local storage email
            localStorage.removeItem("walletAddress"); // Clear local storage wallet
			console.log("Dashboard: Wallet disconnected and local storage cleared.");
			navigate('/'); // Redirect to home/login page after logout
		} catch (error) {
			console.error("Error disconnecting wallet:", error);
			setErrorMsgState("Failed to disconnect wallet. Please try again.");
		}
	};
    // --- End Modified Logout Function ---

	const fetchAndFilterUserProperties = useCallback(async (walletAddress) => {
		if (!walletAddress) return;
		setIsLoading(true);
		setErrorMsgState(""); setActionStates({});
		try {
			const contract = await loadContract(false); if (!contract) { throw new Error("Contract unavailable."); }
			const allPropertiesData = await contract.FetchProperties();
			if (!Array.isArray(allPropertiesData)) { throw new Error("Invalid data format from contract."); }
			const ownedProperties = allPropertiesData
				.filter(propertyStruct => propertyStruct?.owner?.toLowerCase() === walletAddress.toLowerCase())
				.map((propertyStruct, index) => {
					if (!propertyStruct || propertyStruct.length < 11) { console.warn(`Skipping incomplete struct ${index}`); return null; }
					try {
						const location = Array.isArray(propertyStruct.location) ? propertyStruct.location : [];
						const displayLocation = location.length >= 3 ? `${location[2]}, ${location[1]}` : (location.length > 0 ? location.join(', ') : "N/A");
						return {
							productID: propertyStruct.productID.toString(), name: propertyStruct.propertyTitle || "Untitled",
							locationString: displayLocation, category: propertyStruct.category || "Uncategorized",
							priceString: `${ethers.utils.formatEther(propertyStruct.price)} ETH`, isListed: propertyStruct.isListed,
						};
					} catch (mapError) { console.error(`Error parsing property ${index}`, mapError); return null; }
				})
				.filter(p => p !== null);
			setMyProperties(ownedProperties);
		} catch (error) {
			console.error("Dashboard: Error fetching user properties:", error);
			if (!errorMsgState) { setErrorMsgState(`Failed to load properties: ${error.message}`); }
			setMyProperties([]);
		} finally { setIsLoading(false); }
	}, [errorMsgState]);

	const handleDelist = async (productId) => {
		if (!address) { setErrorMsgState("Connect wallet first."); return; }
		setActionStates(prev => ({ ...prev, [productId]: { loading: true, error: null } })); setErrorMsgState("");
		try {
			const contract = await loadContract(true); if (!contract) { throw new Error("Contract connection failed."); }
			const tx = await contract.DelistProperty(productId);
			setActionStates(prev => ({ ...prev, [productId]: { loading: true, error: "Waiting..." } })); console.log(`Delist tx sent: ${tx.hash}`);
			await tx.wait();
			setActionStates(prev => ({ ...prev, [productId]: { loading: false, error: null } }));
			setMyProperties(prevProps => prevProps.map(prop => prop.productID === productId ? { ...prop, isListed: false } : prop ));
		} catch (error) {
			console.error(`Error delisting ${productId}:`, error);
			const revertReason = error.reason || error.data?.message || error.message || "Tx failed.";
			setErrorMsgState(""); setActionStates(prev => ({ ...prev, [productId]: { loading: false, error: `Delist fail: ${revertReason}` } }));
		}
	};

	useEffect(() => {
		const fetchUserData = async (walletAddr) => {
			setIsLoadingUser(true);
			setErrorMsgState("");
			setUser({ wallet: walletAddr });

			const lowerCaseWalletAddr = walletAddr.toLowerCase();

			try {
				const { data, error } = await supabase
					.from("users")
					.select("name, email, wallet_address")
					.eq("wallet_address", lowerCaseWalletAddr)
					.single();

				if (error && error.code !== 'PGRST116') {
					console.error("Supabase user fetch error:", error);
					setErrorMsgState("Error retrieving user profile.");
                    setUser({ wallet: walletAddr, name: 'Error', email: 'Error' });
				} else if (data) {
					setUser({
						name: data.name || 'Name Not Set',
						email: data.email || 'Email Not Set',
						wallet: data.wallet_address
					});
				} else {
					console.warn("User profile not found in Supabase for wallet:", lowerCaseWalletAddr);
					setUser({ wallet: walletAddr, name: null, email: null });
                    // Don't show profile not found as a blocking error, let property fetch proceed
                    // setErrorMsgState("Profile not found in database. Complete signup if needed.");
				}
			} catch (catchError) {
				console.error("Unexpected error fetching user profile:", catchError);
				setErrorMsgState("An unexpected error occurred loading profile.");
                setUser({ wallet: walletAddr, name: 'Error', email: 'Error' });
			} finally {
				setIsLoadingUser(false);
                fetchAndFilterUserProperties(walletAddr);
			}
		};

		if (address) {
			fetchUserData(address);
		} else {
			setUser(null); setMyProperties([]); setIsLoading(false); setIsLoadingUser(false);
			setErrorMsgState(""); setActionStates({}); console.log("Dashboard: Wallet disconnected.");
		}
	}, [address]); // Removed fetchAndFilterUserProperties from dependency array


	const showGlobalLoading = (isLoading || isLoadingUser) && address && myProperties.length === 0;

	if (!address) {
		return (
			<div className="w-full min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6 text-center">
				 <h1 className="text-4xl font-bold text-gray-800 mb-4">Property Dashboard</h1>
				 <p className="text-gray-600 mb-8 max-w-md">Connect your wallet to manage your assets.</p>
				 {errorMsgState && (<div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded text-sm">{errorMsgState}</div>)}
				<button onClick={connectWallet} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-10 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
					Connect Wallet
				</button>
			</div>
		);
	}

	return (
		<div className="w-full min-h-screen flex bg-gradient-to-br from-gray-100 to-blue-50">
			<aside className="w-64 bg-white text-gray-800 min-h-screen p-6 border-r border-gray-200 shadow-sm hidden md:flex md:flex-col">
				<h2 className="text-2xl font-semibold mb-8 text-gray-800">Dashboard</h2>
				<nav className="flex flex-col space-y-2 flex-grow">
					<Link to="/dashboard" className="flex items-center space-x-3 p-2 bg-indigo-50 text-indigo-700 font-medium rounded-md transition-colors border-l-4 border-indigo-600">
						<List className="w-5 h-5" /> <span>My Properties</span>
					</Link>
					<Link to="/chat" className="flex items-center space-x-3 p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
						<MessageSquare className="w-5 h-5" /> <span>Conversations</span>
					</Link>
				</nav>
				<div className="mt-auto pt-6">
					 {/* --- UPDATED Logout Button --- */}
					 <button onClick={handleLogout} className="flex w-full items-center space-x-3 p-2 hover:bg-red-50 text-red-600 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-red-300 font-medium">
						<LogOut className="w-5 h-5" /> <span>Logout</span>
					 </button>
                     {/* --- */}
				</div>
			</aside>

			<main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
				<section className="w-full max-w-6xl mx-auto bg-white rounded-lg p-6 shadow-md mb-8 border border-gray-200 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
					{isLoadingUser ? (
                         <div className="flex-grow text-center sm:text-left"><Loader2 className="w-5 h-5 animate-spin inline-block text-gray-500"/> Loading profile...</div>
                    ) : (
                        <div className="text-center sm:text-left flex-grow">
                            <h2 className="text-xl font-semibold text-gray-800">{user?.name ? user.name : 'User Profile'}</h2>
                            <p className="text-sm text-gray-500 break-all" title={user?.wallet}>
                                Wallet: <span className="font-mono">{user?.wallet ? `${user.wallet.substring(0, 6)}...${user.wallet.substring(user.wallet.length - 4)}` : "N/A"}</span>
                            </p>
                            {user?.email && user.email !== 'Email Not Set' && (
                                <p className="text-sm text-gray-500 break-all">
                                    Email: <span className="">{user.email}</span>
                                </p>
                            )}
                             {user && user.name === null && (
                                <p className="text-xs text-orange-600 mt-1">Profile details not found.</p>
                            )}
                        </div>
                    )}
				</section>

				 {showGlobalLoading && <div className="text-center p-6"><Loader2 className="w-8 h-8 animate-spin inline-block text-indigo-600" /> <span className="ml-2">Loading data...</span></div>}
				 {!isLoading && errorMsgState && !errorMsgState.startsWith("Profile not found") && (
					<div className="w-full max-w-6xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-center text-sm">
						 {errorMsgState}
					</div>
				 )}


				<section className="mt-6 w-full max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-md border border-gray-200">
					<div className="flex justify-between items-center mb-5 flex-wrap gap-4 border-b pb-3 border-gray-200">
						 <h3 className="text-2xl font-bold text-gray-800">My Properties</h3>
						 <Link to="/propertyform">
							<motion.button className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-2 px-5 rounded-md shadow-sm transition-all transform hover:scale-103 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 flex items-center" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
								+ List New Property
							</motion.button>
						</Link>
					</div>

					<div className="rounded-lg min-h-[200px] mt-4">
						{!isLoading && myProperties.length === 0 && (!errorMsgState || errorMsgState.startsWith("Profile not found")) && (
							<div className="text-center text-gray-500 py-10 px-4 bg-gray-50 rounded-md">
								<Info className="w-10 h-10 mx-auto mb-3 text-gray-400"/>
								You haven't listed any properties yet.
							</div>
						)}
						{!isLoading && myProperties.length > 0 && (
							<ul className="space-y-4">
								{myProperties.map((property) => {
									const actionState = actionStates[property.productID] || { loading: false, error: null };
									return (
										<li key={property.productID} className={`p-4 border ${actionState.error ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white'} rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-shadow hover:shadow-md`}>
											<div className="flex-grow">
												 <p className="font-semibold text-lg text-gray-800">{property.name}</p>
												 <p className="text-sm text-gray-600">{property.locationString} • <span className="text-gray-500">{property.category}</span></p>
												 <p className="text-md text-indigo-700 font-medium mt-1">{property.priceString}</p>
												 <span className={`text-xs font-medium mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full ${property.isListed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
													 {property.isListed ? <CheckCircle className="w-3 h-3 mr-1"/> : <AlertTriangle className="w-3 h-3 mr-1"/>}
													{property.isListed ? 'Listed' : 'Not Listed'}
												 </span>
												  {actionState.error && !actionState.loading && <p className="text-xs text-red-600 mt-1">{actionState.error}</p>}
											</div>
											<div className="flex-shrink-0 flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
												<Link to={`/property/${property.productID}`} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-md font-medium transition-colors"> View </Link>
												<Link to={`/edit-property/${property.productID}`} className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center"> <Edit className="w-3 h-3 mr-1" /> Edit </Link>
												{property.isListed && (
													<button onClick={() => handleDelist(property.productID)} disabled={actionState.loading} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center ${ actionState.loading ? 'bg-gray-200 text-gray-500 cursor-wait' : 'bg-red-100 text-red-700 hover:bg-red-200' }`}>
														 {actionState.loading ? (<Loader2 className="w-3 h-3 mr-1 animate-spin" />) : (<Trash2 className="w-3 h-3 mr-1" />)} {actionState.loading ? (actionState.error || 'Delisting...') : 'Delist'}
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