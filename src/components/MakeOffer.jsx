import { useState, useEffect, useCallback } from "react"; // Added useCallback
import { useAddress, useMetamask } from "@thirdweb-dev/react";
import { useLocation, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

// --- STEP 1: Make sure this ABI file is generated from Novaland_F.sol ---
import contractABI from "./../../contractABI2.json";
// <-- UPDATE FILENAME IF NEEDED
// --- UI Imports (Assuming these are shadcn/ui or similar) ---
import { Button } from "./ui/button"; // Assuming Button exists
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react"; // For loading indicator

// --- Supabase Client (Keep your existing credentials) ---
const supabaseUrl = "https://kogvbpflziyhhdunpkty.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZ3ZicGZseml5aGhkdW5wa3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1MzEyNTQsImV4cCI6MjA1NzEwNzI1NH0.9YNHdz5TzmL3nFsQbGl6WBEIkTaP3q5bn4-hplpziWQ";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- STEP 2: Use the CORRECT Deployed Novaland_F Contract Address ---

const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <-- IMPORTANT: Replace this!

// Placeholder image
const DEFAULT_PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/600x400.png?text=Property";

// --- Load Contract Function ---
async function loadContract(setComponentError) { // Pass error setter
  setComponentError(null); // Clear previous errors on load attempt
  // Basic validation
  if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
    console.error("MakeOffer: Invalid or missing contract address:", contractAddress);
    setComponentError("Configuration Error: Invalid contract address provided.");
    return null;
  }
  if (!contractABI || contractABI.length === 0) {
    console.error("MakeOffer: Invalid or missing contract ABI.");
    setComponentError("Configuration Error: Invalid contract ABI provided.");
    return null;
  }
  if (!window.ethereum) {
    console.error("MakeOffer: MetaMask not found.");
    setComponentError("Please install MetaMask or a compatible wallet.");
    return null;
  }
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    // No signer needed just to fetch property details
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
     await contract.propertyIndex(); // Test read access
     console.log("MakeOffer: Contract loaded successfully (read-only).");
    return contract;
  } catch (error) {
    console.error("MakeOffer: Error loading contract:", error);
    setComponentError(`Failed to load contract: ${error.message}`);
    return null;
  }
}

function MakeOffer() {
  const address = useAddress(); // Connected wallet address
  const connectWithMetamask = useMetamask();
  const navigate = useNavigate();
  const location = useLocation(); // Access state passed from previous page

  // --- State Variables ---
  const [offerPrice, setOfferPrice] = useState(""); // Use specific name
  const [message, setMessage] = useState("");
  const [property, setProperty] = useState(null); // Stores fetched property details
  const [loading, setLoading] = useState(true); // Loading state for fetching property
  const [submitting, setSubmitting] = useState(false); // Loading state for submitting offer
  const [error, setError] = useState(null); // Error messages
  const [success, setSuccess] = useState(null); // Success messages

  // --- Extract Data from Location State ---
  const state = location.state || {}; // Get state passed via navigate
  const propertyId = state.propertyId ?? null; // Property ID (should be a string)
  const sellerWallet = state.sellerWallet ?? null; // Owner's wallet
  // buyerWallet is the currently connected 'address'

  // --- Fetch Property Details ---
  const fetchProperty = useCallback(async () => {
    if (!propertyId) {
        setError("No property ID provided to make an offer.");
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);
    setProperty(null); // Clear previous

    try {
      const contract = await loadContract(setError); // Pass error setter
      if (!contract) {
          // Error is already set by loadContract
           setLoading(false);
          return; // Stop if contract didn't load
      }

      console.log(`MakeOffer: Fetching all properties to find ID: ${propertyId}`);
      // Fetch ALL properties (inefficient, ideally use a getPropertyById function in contract)
      const allPropertiesData = await contract.FetchProperties();

      if (!Array.isArray(allPropertiesData)) {
          throw new Error("Received invalid data format from contract.");
      }

      // Find the specific property by productID (index 0)
      const propertyStruct = allPropertiesData.find(
          (struct) => struct && struct[0] && struct[0].toString() === propertyId
      );

      if (!propertyStruct || propertyStruct.length < 11) { // Check length based on Novaland_F struct
        throw new Error(`Property with ID ${propertyId} not found or data incomplete.`);
      }

      console.log("MakeOffer: Found property struct:", propertyStruct);

      // Parse the found property struct (Indices from Novaland_F)
      // 0: productID, 1: owner, 2: price, 3: propertyTitle, 4: category, 5: images...
      const images = Array.isArray(propertyStruct[5]) ? propertyStruct[5] : [];

      setProperty({
        productID: propertyStruct[0].toString(),
        propertyTitle: propertyStruct[3],
        // Store price in ETH string for display, could also store Wei if needed elsewhere
        priceDisplay: ethers.utils.formatEther(propertyStruct[2]),
        // Use first image or placeholder for display
        displayImage: images.length > 0 ? images[0] : DEFAULT_PLACEHOLDER_IMAGE_URL,
      });

    } catch (err) {
      console.error("MakeOffer: Error fetching property data:", err);
      setError(err.message || "Failed to fetch property details.");
    } finally {
      setLoading(false);
    }
  }, [propertyId]); // Depend only on propertyId

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]); // Run fetchProperty when the component mounts or fetchProperty changes


  // --- Handle Offer Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null); // Clear previous submission errors
    setSuccess(null);

    if (!address) {
      setError("Please connect your wallet before submitting an offer.");
      // Prompt connection without reloading the page ideally
      try {
        await connectWithMetamask();
         // If connect succeeds, the 'address' state will update, but might need a re-submit trigger
         setError("Wallet connected. Please try submitting again.");
      } catch(connectError) {
          setError("Failed to connect wallet. Please try again.");
      }
      setSubmitting(false);
      return;
    }

    if (!propertyId || !sellerWallet) {
        setError("Missing property or seller information. Cannot submit offer.");
        setSubmitting(false);
        return;
    }

    // Validate offer price
    const numericPrice = parseFloat(offerPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
        setError("Please enter a valid positive offer price.");
        setSubmitting(false);
        return;
    }

    try {
        console.log("MakeOffer: Submitting offer details:", {
            buyer: address,
            seller: sellerWallet,
            propertyId: propertyId, // Use the string ID for Supabase consistency? Or ensure number? Check DB schema.
            price: numericPrice,
            message: message
        });

      // Check for existing thread (or create one) - Logic remains the same
      const { data: existingThread } = await supabase
        .from("threads") // Ensure table name is correct
        .select("id")
        .eq("buyer_wallet", address.toLowerCase()) // Use consistent casing
        .eq("seller_wallet", sellerWallet.toLowerCase()) // Use consistent casing
        .eq("property_id", parseInt(propertyId, 10)) // Assuming property_id is integer in DB
        .maybeSingle(); // Use maybeSingle to handle 0 or 1 result without error

      let threadId = existingThread ? existingThread.id : null;

      if (!existingThread) {
        console.log("MakeOffer: Creating new thread...");
        const { data: newThread, error: threadInsertError } = await supabase
          .from("threads")
          .insert([
            {
              buyer_wallet: address.toLowerCase(),
              seller_wallet: sellerWallet.toLowerCase(),
              property_id: parseInt(propertyId, 10), // Store as integer
              // Consider adding property_title here if useful for querying threads later
            },
          ])
          .select("id")
          .single(); // Expect exactly one row back

        if (threadInsertError) throw threadInsertError; // Throw Supabase error
        if (!newThread || !newThread.id) throw new Error("Failed to create conversation thread.");
        threadId = newThread.id;
         console.log("MakeOffer: New thread created with ID:", threadId);
      } else {
           console.log("MakeOffer: Using existing thread ID:", threadId);
      }

      // Insert the offer message - Logic remains the same
       console.log("MakeOffer: Inserting offer message into thread:", threadId);
      const { error: messageInsertError } = await supabase
        .from("messages") // Ensure table name is correct
        .insert([
          {
            thread_id: threadId,
            sender_wallet: address.toLowerCase(), // Consistent casing
            message: message || "No message provided", // Default message
            price: numericPrice, // Store numeric price
            type: "offer", // Mark message as an offer
            status: "pending", // Initial status
          },
        ]);

      if (messageInsertError) throw messageInsertError; // Throw Supabase error

      console.log("MakeOffer: Offer submitted successfully to Supabase.");
      setSuccess("Offer submitted successfully!");

      // Optionally navigate away or show success state
      // navigate("/explore"); // Navigate back to explore page
       setTimeout(() => navigate(`/chat/${threadId}`), 2000); // Navigate to chat after delay


    } catch (err) {
      console.error("MakeOffer: Error submitting offer:", err);
      setError(`Failed to submit offer: ${err.message || "Please try again."}`);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Render Logic ---
  return (
    <motion.div
        className="p-6 md:p-10 max-w-2xl mx-auto bg-white rounded-xl shadow-lg border border-gray-100 my-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
    >

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
            Make an Offer
        </h1>

        {loading && (
             <div className="text-center py-10 text-gray-600">
                 <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
                 Loading property details...
             </div>
        )}

        {error && !loading && ( // Show fetch error only if not loading
            <div className="text-center py-10 text-red-600 bg-red-50 p-4 rounded border border-red-200">
                Error: {error}
            </div>
        )}

        {property && !loading && ( // Show property card and form if property loaded
            <>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                >
                    <Card className="mb-6 shadow-md rounded-lg overflow-hidden border border-gray-200">
                        <img
                            src={property.displayImage}
                            alt={property.propertyTitle}
                            className="w-full h-60 object-cover"
                            onError={(e) => { e.target.onerror = null; e.target.src=DEFAULT_PLACEHOLDER_IMAGE_URL }}
                        />
                        <CardContent className="p-4">
                            <h3 className="text-xl font-semibold mb-1 text-gray-800">{property.propertyTitle}</h3>
                            {/* Display contract list price for reference */}
                             <p className="text-md text-gray-500">
                                Current List Price: <span className="font-medium text-gray-700">{property.priceDisplay} ETH</span>
                             </p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    {address && (
                        <p className="text-xs text-gray-500 text-center break-all">
                            Offering from Wallet: <span className="font-medium text-gray-700">{address}</span>
                        </p>
                    )}

                     {/* Display submission feedback */}
                     {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200 text-center">{error}</p>}
                     {success && <p className="text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200 text-center">{success}</p>}


                    {/* Offer Price Input */}
                    <div>
                        <label htmlFor="offerPrice" className="block text-sm font-medium text-gray-700 mb-1">Your Offer Price (ETH)</label>
                        <Input
                            id="offerPrice"
                            type="number"
                            step="any" // Allow any decimal for ETH
                            value={offerPrice}
                            onChange={(e) => setOfferPrice(e.target.value)} // Store as string initially
                            placeholder="e.g., 1.25"
                            required
                            className="border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 p-2 rounded-md shadow-sm"
                            disabled={submitting || !!success} // Disable after success
                        />
                    </div>

                    {/* Message Input */}
                    <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                        <Textarea
                            id="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Include any terms or questions..."
                            rows={3}
                            className="border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 p-2 rounded-md shadow-sm"
                            disabled={submitting || !!success} // Disable after success
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                         {!address ? (
                             <Button type="button" onClick={connectWithMetamask} className="w-full bg-blue-600 hover:bg-blue-700">
                                Connect Wallet to Make Offer
                             </Button>
                         ) : (
                            <Button
                                type="submit"
                                disabled={submitting || !!success} // Disable button while submitting or after success
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                                    </>
                                ) : success ? (
                                     "Offer Submitted!"
                                ) : (
                                     "Submit Offer"
                                )}
                            </Button>
                        )}
                    </div>
                </motion.form>
            </>
        )}
    </motion.div>
  );
}

export default MakeOffer;