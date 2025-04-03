import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom"; // Added useNavigate
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { ethers } from "ethers";
import { supabase } from "../../supabase";
import { FiMapPin, FiTag, FiCheckCircle, FiXCircle, FiLoader, FiExternalLink, FiInfo, FiShoppingCart, FiMessageSquare } from "react-icons/fi"; // Added icons

// --- REPLACE with your Deployed Novaland_F1 Contract Address ---
import contractABI from "./../../contractABI2.json"; // <--- MAKE SURE this is the ABI for Novaland_F1
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <--- *** REPLACE THIS ***

const DEFAULT_PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/600x400.png?text=Property+Image";

// --- Load Contract Function (Reads only initially) ---
async function loadContract(signer = null) { // Accept optional signer
    if (!window.ethereum) {
        console.error("MetaMask or compatible wallet not found.");
        return null;
    }
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        // If a signer is provided, use it for transactions, otherwise use provider for reads
        const contractInstance = new ethers.Contract(
            contractAddress,
            contractABI,
            signer || provider // Use signer if available, else provider
        );

        // Basic check for placeholder address
        if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
            throw new Error("Contract address needs to be updated in the source code.");
        }
        // Verify address is valid format
        if (!ethers.utils.isAddress(contractAddress)) {
             throw new Error(`Invalid Contract Address format: ${contractAddress}`);
        }

        return contractInstance;
    } catch (error) {
        console.error("Error loading contract:", error);
        // Re-throw specific errors for better feedback
        if (error.message.includes("Contract address needs to be updated")) {
            throw error;
        }
         if (error.message.includes("Invalid Contract Address format")) {
             throw error;
         }
        // Generic error for other issues
        throw new Error(`Failed to load contract: ${error.message}`);
    }
}


function PropertyInfo() {
    const { id } = useParams(); // Property ID from URL (string)
    const navigate = useNavigate(); // For navigation after purchase etc.
    const [property, setProperty] = useState(null);
    const [walletAddress, setWalletAddress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isOfferPending, setIsOfferPending] = useState(false);
    const [isBuying, setIsBuying] = useState(false); // State for purchase transaction
    const [buyError, setBuyError] = useState(''); // Specific error for purchase failures
    const [buySuccess, setBuySuccess] = useState(''); // Success message for purchase

    // Function to check offer status (unchanged from previous version)
    const checkOfferStatus = useCallback(async (propertyId, currentWalletAddress) => {
        // ... (Keep the same checkOfferStatus function logic using Supabase)
         if (!currentWalletAddress || !propertyId) return;
        try {
            const normalizedWallet = currentWalletAddress.toLowerCase();
            const numericPropertyId = parseInt(propertyId, 10);
            if (isNaN(numericPropertyId)) return;

            // console.log("Checking for offer:", { propertyId: numericPropertyId, buyer_wallet: normalizedWallet });
            const { data, error: dbError } = await supabase
                .from("threads")
                .select("status")
                .eq("property_id", numericPropertyId)
                .eq("buyer_wallet", normalizedWallet)
                .eq("status", "open")
                .limit(1);

            if (dbError) throw dbError;
            setIsOfferPending(data && data.length > 0);
        } catch (err) {
            console.error("Error checking offer status:", err.message);
        }
    }, []);

    // Fetch property data and check wallet
    useEffect(() => {
        const fetchPropertyAndCheckWallet = async () => {
            setLoading(true);
            setError(null);
            setProperty(null);
            setIsOfferPending(false);
            setBuyError(''); // Clear purchase status on reload
            setBuySuccess('');

            let currentWallet = null;

            // 1. Check Wallet Connection
            if (window.ethereum) {
                 try {
                     // Use eth_accounts to check without triggering connection prompt initially
                     const accounts = await window.ethereum.request({ method: "eth_accounts" });
                     if (accounts.length > 0) {
                         currentWallet = accounts[0];
                         setWalletAddress(currentWallet);
                     }
                 } catch (error) {
                     console.error("Error checking wallet connection:", error);
                     // Proceed without wallet, user can connect later
                 }
            } else {
                 console.warn("MetaMask not detected.");
            }


            // 2. Fetch Property Data from Novaland_F1
            try {
                const contract = await loadContract(); // Load with provider initially
                if (!contract) {
                     // loadContract throws specific errors now
                     throw new Error("Contract interaction unavailable."); // Generic if loadContract returned null unexpectedly
                 }

                // console.log(`Fetching all properties from ${contractAddress} to find ID: ${id}`);
                const allPropertiesData = await contract.FetchProperties();

                // Find using named property 'productID' (safer)
                const propertyData = allPropertiesData.find(
                    (p) => p && p.productID && p.productID.toString() === id
                );

                if (!propertyData) {
                    throw new Error(`Property with ID ${id} not found on contract ${contractAddress}.`);
                }

                 // console.log("Found property data (struct):", propertyData);

                 // --- Parse using named properties from Novaland_F1 struct ---
                 const location = Array.isArray(propertyData.location) ? propertyData.location : [];
                 const images = Array.isArray(propertyData.images) ? propertyData.images : [];
                 const documents = Array.isArray(propertyData.documents) ? propertyData.documents : [];

                const parsedProperty = {
                    productID: propertyData.productID.toString(), // Keep as string for consistency
                    owner: propertyData.owner,
                    price: ethers.utils.formatEther(propertyData.price), // Format price to ETH string
                    priceWei: propertyData.price, // Keep Wei for transactions
                    propertyTitle: propertyData.propertyTitle,
                    category: propertyData.category,
                    images: images.length > 0 ? images : [DEFAULT_PLACEHOLDER_IMAGE_URL],
                    location: location, // [country, state, city, pincode]
                    documents: documents, // Array of document URLs
                    description: propertyData.description,
                    nftId: propertyData.nftId || 'N/A', // Handle potentially empty NFT ID
                    isListed: propertyData.isListed,
                    // Derived display location
                    displayLocation: location.length >= 3 ? `${location[2]}, ${location[1]}` : (location.length > 0 ? location.join(', ') : "Location not specified"),
                };

                 // console.log("Parsed Property:", parsedProperty);
                setProperty(parsedProperty);

                // 3. Check Offer Status (pass parsed ID and current wallet)
                 if (currentWallet) {
                    await checkOfferStatus(parsedProperty.productID, currentWallet);
                 }

            } catch (err) {
                console.error("Error fetching property details:", err);
                setError(err.message || "Failed to fetch property details.");
            } finally {
                setLoading(false);
            }
        };

        fetchPropertyAndCheckWallet();

    }, [id, checkOfferStatus]); // Rerun if ID changes


    // Function to connect wallet
    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                // Request connection
                const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
                if (accounts.length > 0) {
                    const newAddress = accounts[0];
                    setWalletAddress(newAddress);
                    // Re-check offer status after connecting
                    if (property) {
                        await checkOfferStatus(property.productID, newAddress);
                    }
                    setError(null); // Clear potential previous errors like "connect wallet"
                    setBuyError(''); // Clear buy errors too
                }
            } catch (error) {
                console.error("Error connecting wallet:", error);
                 if (error.code === 4001) { // User rejected request
                    setError("Wallet connection request rejected.");
                 } else {
                     setError("Failed to connect wallet. Please ensure MetaMask is unlocked and try again.");
                 }
            }
        } else {
             setError("MetaMask not detected. Please install the browser extension.");
            alert("MetaMask not detected. Please install the browser extension."); // Also alert
        }
    };


    // --- Handle "Buy Now" ---
    const handleBuyNow = async () => {
        if (!property || !walletAddress) {
            setBuyError("Cannot initiate purchase. Ensure wallet is connected and property details are loaded.");
            return;
        }
        if (walletAddress.toLowerCase() === property.owner.toLowerCase()) {
             setBuyError("Owner cannot buy their own property.");
             return;
        }
        if (!property.isListed) {
            setBuyError("This property is not currently listed for sale.");
            return;
        }

        setIsBuying(true);
        setBuyError('');
        setBuySuccess('');

        try {
            // We need a signer to send a transaction
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const contractWithSigner = await loadContract(signer); // Get contract instance with signer

            if (!contractWithSigner) {
                throw new Error("Failed to initialize contract for purchase.");
            }

            console.log(`Attempting to purchase Property ID: ${property.productID} for ${property.price} ETH`);

            // Call the PurchaseProperty function, sending the required Ether (in Wei)
            const transaction = await contractWithSigner.PurchaseProperty(
                property.productID, // The uint256 ID
                {
                    value: property.priceWei, // Send price in Wei
                    gasLimit: 300000 // Set a reasonable gas limit, adjust if needed
                }
            );

            setBuySuccess("Purchase transaction sent. Waiting for confirmation...");
            console.log("Transaction sent:", transaction.hash);

            // Wait for the transaction to be mined
            const receipt = await transaction.wait();
            console.log("Transaction confirmed:", receipt);

            setBuySuccess(`Purchase successful! You are now the owner. Tx: ${receipt.transactionHash}`);
            setIsBuying(false);

            // Refresh property data or navigate away after a delay
            setTimeout(() => {
                // Option 1: Re-fetch data (will show user as owner, !isListed)
                // window.location.reload();
                // Option 2: Navigate to dashboard
                navigate('/dashboard');
            }, 4000); // Delay for user to read message

        } catch (error) {
            console.error("Purchase failed:", error);
            let message = "An error occurred during the purchase.";
             if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                message = "Transaction rejected in wallet.";
            } else if (error.reason) {
                 message = `Transaction failed: ${error.reason}`;
            } else if (error.data?.message) { // Check deeper for revert message
                message = `Transaction failed: ${error.data.message}`;
            } else if (error.message) {
                message = error.message; // Fallback to general error message
            }
             // Handle specific contract errors if needed (e.g., "Property is not listed for sale")
             if (message.includes("Property is not listed for sale")) {
                message = "This property is no longer listed for sale.";
             }
             if (message.includes("insufficient funds")) {
                message = "Insufficient funds in wallet for purchase and gas fees.";
             }

            setBuyError(message);
            setBuySuccess(''); // Clear success message
            setIsBuying(false);
        }
    };


    // Slider settings (unchanged)
    const sliderSettings = {
        dots: true,
        infinite: (property?.images?.length ?? 0) > 1,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 4000,
        fade: true,
        cssEase: 'linear',
        adaptiveHeight: true
    };

    // --- Render Logic ---
    if (loading) return <div className="flex justify-center items-center min-h-screen text-xl font-semibold text-indigo-700"><FiLoader className="animate-spin mr-3" size={24} />Loading Property Details...</div>;
    // Show general fetch errors prominently
    if (error && !property) return <div className="flex justify-center items-center min-h-screen text-xl font-semibold text-red-600 bg-red-50 p-10 rounded-md"><FiXCircle className="mr-3" size={24}/>Error: {error}</div>;
    if (!property) return <div className="flex justify-center items-center min-h-screen text-xl font-semibold text-gray-600">Property not found.</div>;

    // Determine if the current user is the owner
    const isOwner = walletAddress && property.owner && walletAddress.toLowerCase() === property.owner.toLowerCase();

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 text-gray-900 py-12">
            <div className="p-4 md:p-8 max-w-7xl mx-auto">

                {/* Property Title */}
                <h1 className="text-3xl md:text-5xl font-bold text-center mb-6 text-gray-800">{property.propertyTitle}</h1>
                <p className="text-center text-gray-500 mb-8 text-sm">Property ID: {property.productID} | NFT ID: {property.nftId}</p>


                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

                    {/* Left Side: Image Slider & Documents */}
                    <div className="w-full lg:w-[55%] xl:w-3/5"> {/* Slightly larger left side */}
                        {/* Image Slider */}
                        <div className="mb-8 shadow-xl rounded-lg overflow-hidden border border-gray-200 bg-white">
                            {property.images && property.images.length > 0 && property.images[0] !== DEFAULT_PLACEHOLDER_IMAGE_URL ? (
                                <Slider {...sliderSettings}>
                                    {property.images.map((image, index) => (
                                        <div key={index}>
                                            <img
                                                src={image}
                                                alt={`Property Image ${index + 1}`}
                                                className="w-full h-80 md:h-[500px] object-cover" // Increased height
                                                onError={(e) => { e.target.onerror = null; e.target.src=DEFAULT_PLACEHOLDER_IMAGE_URL }}
                                            />
                                        </div>
                                    ))}
                                </Slider>
                            ) : (
                                <img // Show placeholder if no images or only placeholder URL
                                    src={DEFAULT_PLACEHOLDER_IMAGE_URL}
                                    alt="Placeholder"
                                    className="w-full h-80 md:h-[500px] object-cover"
                                />
                            )}
                        </div>

                        {/* Documents Section */}
                        {property.documents && property.documents.length > 0 && (
                            <div className="bg-white p-5 rounded-lg shadow-md border border-gray-200">
                                <h3 className="text-xl font-semibold mb-4 text-gray-700">Attached Documents</h3>
                                <ul className="space-y-3">
                                    {property.documents.map((docUrl, index) => (
                                        <li key={index} className="flex items-center">
                                             <FiExternalLink className="text-indigo-500 mr-2 flex-shrink-0" />
                                            <a
                                                href={docUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                                                title={`View Document ${index + 1}`}
                                            >
                                                Document {index + 1} <span className="text-xs">(opens new tab)</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Details & Actions */}
                    <div className="w-full lg:w-[45%] xl:w-2/5 bg-white p-6 md:p-8 rounded-lg shadow-xl border border-gray-200 flex flex-col">
                        {/* Listing Status */}
                        <div className={`mb-4 p-3 rounded-md text-center font-medium text-sm ${property.isListed ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'}`}>
                             {property.isListed ? (
                                 <><FiCheckCircle className="inline mr-1 mb-0.5" /> Listed for Sale</>
                             ) : (
                                 <><FiXCircle className="inline mr-1 mb-0.5" /> Not Currently Listed</>
                             )}
                         </div>

                        {/* Location & Category */}
                         <div className="flex items-center text-lg text-gray-700 mb-3 border-b border-gray-200 pb-3">
                             <FiMapPin className="mr-2 text-indigo-600 flex-shrink-0" size={22}/>
                            <span className="font-semibold">{property.displayLocation || 'N/A'}</span>
                         </div>
                         <div className="flex items-center text-md text-gray-600 mb-5">
                             <FiTag className="mr-2 text-indigo-600 flex-shrink-0" size={20}/>
                             <span>{property.category}</span>
                        </div>

                        {/* Price */}
                        <div className="mb-6">
                             <span className="text-gray-500 text-sm block mb-1">Price</span>
                             <div className="text-4xl md:text-5xl font-bold text-indigo-700">
                                {property.price} ETH
                             </div>
                        </div>


                        {/* Description */}
                        <div className="mb-6 flex-grow"> {/* Allow description to take up space */}
                            <h3 className="text-xl font-semibold mb-2 text-gray-700">Description</h3>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{property.description || "No description provided."}</p>
                        </div>

                        {/* Owner Info */}
                         <div className="mb-6 border-t pt-4 mt-4">
                             <h3 className="text-lg font-semibold mb-2 text-gray-700">Owner</h3>
                             <p className="text-gray-600 text-xs break-all" title={property.owner}>{property.owner}</p>
                             {isOwner && <span className="text-xs text-green-600 font-medium block mt-1">(This is you)</span>}
                         </div>


                        {/* Action Buttons Area */}
                        <div className="mt-auto pt-5 border-t border-gray-200 space-y-4">

                            {/* Purchase Status Messages */}
                             {buyError && <p className="text-sm text-red-600 p-3 bg-red-50 border border-red-200 rounded text-center"><FiXCircle className="inline mr-1"/> {buyError}</p>}
                             {buySuccess && <p className="text-sm text-green-600 p-3 bg-green-50 border border-green-200 rounded text-center"><FiCheckCircle className="inline mr-1"/> {buySuccess}</p>}
                             {isBuying && <p className="text-sm text-blue-600 p-3 bg-blue-50 border border-blue-200 rounded text-center flex justify-center items-center"><FiLoader className="animate-spin mr-2" /> Processing Purchase...</p>}

                            {/* Connect Wallet Button */}
                            {!walletAddress && (
                                <button
                                    onClick={connectWallet}
                                    disabled={isBuying}
                                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50"
                                >
                                    Connect Wallet to Interact
                                </button>
                            )}

                            {/* Buttons shown when wallet is connected */}
                            {walletAddress && !isBuying && !buySuccess && (
                                <div className="space-y-3">
                                    {/* Buy Now Button */}
                                    {property.isListed && !isOwner && (
                                        <button
                                            onClick={handleBuyNow}
                                            className="w-full flex justify-center items-center px-6 py-3 bg-green-600 text-white rounded-lg text-base font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200 shadow-md"
                                        >
                                             <FiShoppingCart className="mr-2" /> Buy Now for {property.price} ETH
                                        </button>
                                    )}

                                     {/* Make Offer / Contact Owner Button */}
                                    {!isOwner && ( // Don't show offer button to owner
                                        <Link
                                            to="/make-offer" // Your route for the offer/messaging page
                                            state={{ // Pass data needed by the MakeOffer component
                                                buyerWallet: walletAddress,
                                                sellerWallet: property.owner,
                                                propertyId: property.productID,
                                                propertyTitle: property.propertyTitle,
                                                propertyPrice: property.price,
                                                propertyImage: property.images[0] ?? DEFAULT_PLACEHOLDER_IMAGE_URL
                                            }}
                                            className={`w-full inline-flex justify-center items-center text-center px-6 py-3 rounded-lg text-base font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 border ${
                                                isOfferPending
                                                    ? "bg-yellow-100 text-yellow-800 border-yellow-300 cursor-not-allowed" // Style for pending
                                                    : !property.isListed
                                                    ? "bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed" // Style for not listed
                                                    : "bg-indigo-600 text-white border-transparent hover:bg-indigo-700 focus:ring-indigo-500 shadow-md" // Active style
                                            }`}
                                            onClick={(e) => {
                                                if (isOfferPending || !property.isListed) {
                                                    e.preventDefault(); // Prevent navigation
                                                    if (isOfferPending) alert("You already have an open offer pending for this property.");
                                                    if (!property.isListed) alert("Cannot make an offer for a property that is not listed.");
                                                }
                                            }}
                                            aria-disabled={isOfferPending || !property.isListed}
                                        >
                                            <FiMessageSquare className="mr-2" />
                                             {isOfferPending ? "Offer Pending" : (property.isListed ? "Make Offer / Contact Owner" : "Make Offer (Not Listed)")}
                                        </Link>
                                    )}

                                     {/* Owner Actions (Example: Link to Update Page) */}
                                     {isOwner && (
                                         <Link
                                            to={`/update-property/${property.productID}`} // Link to your update route
                                            className="w-full inline-block text-center px-6 py-3 bg-purple-600 text-white rounded-lg text-base font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors duration-200 shadow-md"
                                        >
                                            Edit Property Details
                                        </Link>
                                     )}

                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PropertyInfo;