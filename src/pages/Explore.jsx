import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiHome, FiMapPin, FiTag, FiUser, FiLoader, FiAlertCircle } from "react-icons/fi"; // Added icons
import { ethers } from "ethers";

// --- STEP 1: Update ABI import to point to Novaland_F1's ABI ---
import contractABI from "./../../contractABI2.json"; // <--- MAKE SURE this is the ABI for Novaland_F1

// --- STEP 2: Update Contract Address with your deployed Novaland_F1 address ---
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <--- *** REPLACE THIS ***

// Placeholder image if a property has no images
const DEFAULT_PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/300x200.png?text=Property+Image";

// Global error message setter (passed down from component)
let setErrorMsgGlobal = () => {}; // Placeholder

// --- Load Contract Function (Targets Novaland_F1) ---
async function loadContract() {
    // Basic check for placeholder address
     if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
         console.error("Explore: Placeholder contract address detected.");
         setErrorMsgGlobal("Configuration Error: Contract address needs to be updated in the code.");
         return null;
     }
    // Check address format validity
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
        console.error("Explore: Invalid or missing contract address:", contractAddress);
        setErrorMsgGlobal("Configuration Error: Invalid contract address provided.");
        return null;
    }
     // Check ABI validity
     if (!contractABI || contractABI.length === 0) {
         console.error("Explore: Invalid or missing contract ABI.");
         setErrorMsgGlobal("Configuration Error: Invalid contract ABI provided (check import path).");
         return null;
     }

    // Check for MetaMask
    if (!window.ethereum) {
        console.warn("Explore: MetaMask or compatible wallet not found.");
         // Don't necessarily block read-only access, but user can't transact
         // setErrorMsgGlobal("Please install MetaMask or a compatible wallet to interact fully.");
         // Proceed with read-only provider if possible
    }

    try {
        // Use provider for read-only calls (FetchProperties is view)
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(contractAddress, contractABI, provider);

        // Test connection with a simple read call (propertyIndex exists in Novaland_F1)
        try {
            await contract.propertyIndex();
            console.log("Explore: Connection to Novaland_F1 contract successful.");
        } catch (readError) {
             console.error("Explore: Failed to read from contract. Check address, ABI, and network.", readError);
             setErrorMsgGlobal("Failed to connect to the contract. Please ensure you are on the correct network and the contract details are correct.");
             return null;
        }

        return contract;
    } catch (error) {
        console.error("Explore: Error loading contract instance:", error);
        setErrorMsgGlobal(`Error initializing contract: ${error.message}`);
        return null;
    }
}

// --- fetchProperties Function (Should work as is with Novaland_F1 struct) ---
async function fetchProperties() {
    const contract = await loadContract();
    if (!contract) {
        console.error("Explore: Contract instance is not available for fetching.");
        // Error message is already set by loadContract
        return []; // Return empty array on contract load failure
    }

    try {
        console.log("Explore: Fetching properties from Novaland_F1 contract...");
        // Calls FetchProperties - returns array of Property structs
        const allPropertiesData = await contract.FetchProperties();
        // console.log("Explore: Raw data received from Novaland_F1 FetchProperties:", allPropertiesData);

        // Process the array of structs - Indices match Novaland_F1 struct
        const processedProperties = allPropertiesData
            .map((propertyStruct, structIndex) => {
                 // Indices based on Novaland_F1 Property struct:
                 // 0: productID (uint256), 1: owner (address), 2: price (uint256),
                 // 3: propertyTitle (string), 4: category (string), 5: images (string[]),
                 // 6: location (string[]), 7: documents (string[]), 8: description (string),
                 // 9: nftId (string), 10: isListed (bool)

                 // Basic validation of the struct format received
                 if (!propertyStruct || typeof propertyStruct !== 'object' || propertyStruct.length < 11) {
                     console.warn(`Explore: Skipping invalid or incomplete property struct at index ${structIndex}:`, propertyStruct);
                    return null;
                 }

                try {
                    // Safely access array elements
                    const images = Array.isArray(propertyStruct[5]) ? propertyStruct[5] : [];
                    const location = Array.isArray(propertyStruct[6]) ? propertyStruct[6] : [];
                    const priceWei = propertyStruct[2]; // Keep as BigNumber initially for safety

                    // Format price only if valid
                    let formattedPrice = 'N/A';
                    if (priceWei && ethers.BigNumber.isBigNumber(priceWei)) {
                        formattedPrice = ethers.utils.formatEther(priceWei);
                    } else {
                        console.warn(`Explore: Invalid price format for property index ${structIndex}:`, priceWei);
                    }

                    return {
                        productID: propertyStruct[0].toString(),
                        owner: propertyStruct[1],
                        price: formattedPrice, // Use formatted price
                        propertyTitle: propertyStruct[3] || "Untitled Property", // Add fallback
                        category: propertyStruct[4] || "Uncategorized", // Add fallback
                        images: images,
                        location: location,
                        // documents: Array.isArray(propertyStruct[7]) ? propertyStruct[7] : [], // Get documents if needed later
                        description: propertyStruct[8] || "",
                        nftId: propertyStruct[9] || 'N/A', // Handle potentially missing nftId
                        isListed: propertyStruct[10], // Boolean status
                        // --- Derived fields for display ---
                        image: images.length > 0 ? images[0] : DEFAULT_PLACEHOLDER_IMAGE_URL,
                        displayLocation: location.length >= 3 ? `${location[2]}, ${location[1]}` : (location.length > 0 ? location.join(', ') : "Location N/A"),
                        city: location.length >= 3 ? location[2] : null,
                    };
                } catch (mapError) {
                     console.error(`Explore: Error processing property struct at index ${structIndex}:`, propertyStruct, mapError);
                     return null; // Skip property if mapping fails
                }
            })
            .filter(p => p !== null && p.isListed === true); // Explicitly filter for properties where isListed is true

        console.log(`Explore: Processed and found ${processedProperties.length} listed properties.`);
        return processedProperties;

    } catch (error) {
        console.error("Explore: Error fetching/processing properties from Novaland_F1 contract:", error);
        // Provide more specific feedback based on common errors
        if (error.code === 'CALL_EXCEPTION') {
            console.error("Explore: Contract call failed. Potential issues: Incorrect address, ABI mismatch, wrong network, or contract reverted.");
             setErrorMsgGlobal("Error fetching properties. Please verify network connection and contract status.");
        } else {
             setErrorMsgGlobal(`An error occurred while fetching properties: ${error.message}`);
        }
        return []; // Return empty array on error
    }
}


function Explore() {
    const [hovered, setHovered] = useState(null);
    const [selectedType, setSelectedType] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("");
    const [allProperties, setAllProperties] = useState([]); // Stores all fetched *listed* properties
    const [currentProperties, setCurrentProperties] = useState([]); // Stores currently filtered properties for display
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsgState, setErrorMsgState] = useState(""); // Component's local error state
    const [uniqueCities, setUniqueCities] = useState([]);

    const propertiesPerPage = 12;

     // Link the global error setter to the component's state setter on mount
     useEffect(() => {
         setErrorMsgGlobal = setErrorMsgState;
         // Cleanup on unmount
         return () => { setErrorMsgGlobal = () => {}; };
     }, []);


    // Fetch properties on initial load
    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        setErrorMsgState(""); // Reset local error state before fetch
        setAllProperties([]);
        setCurrentProperties([]);
        setUniqueCities([]);

        try {
            // fetchProperties now handles its own errors and returns [] if needed
            const fetchedProperties = await fetchProperties();

            setAllProperties(fetchedProperties);
            setCurrentProperties(fetchedProperties); // Initially show all listed properties

            // Generate unique city list from fetched properties
            const cities = new Set(
                fetchedProperties
                    .map(p => p.city) // City derived during mapping
                    .filter(city => city) // Filter out null/empty cities
            );
             // Sort cities alphabetically, keeping 'All Locations' first
            setUniqueCities(['All Locations', ...Array.from(cities).sort()]);

            if (fetchedProperties.length === 0 && !errorMsgState) { // Check if error was already set
                console.log("Explore: Fetch successful, but no listed properties were returned from the contract.");
                // Optional: Set a specific info message instead of error
                // setErrorMsgState("No properties are currently listed for sale.");
            }

        } catch (error) {
             // This catch block might be redundant if fetchProperties handles all errors
             // but serves as a final safety net.
             console.error("Explore: Unexpected error in fetchInitialData callback:", error);
              if (!errorMsgState) { // Only set error if not already set by fetchProperties
                  setErrorMsgState(`Failed to load properties: ${error.message}`);
              }
             setAllProperties([]);
             setCurrentProperties([]);
             setUniqueCities([]); // Ensure filters are cleared on error
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Dependencies removed, fetchInitialData is called once in the next useEffect

    // Effect to run the initial data fetch
    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // --- Filtering Logic (Applies filters to the 'allProperties' list) ---
    useEffect(() => {
        // Don't filter while loading or if there was an initial fetch error
        if (isLoading || errorMsgState) return;

        // console.log(`Explore Filtering by Type: '${selectedType}', Location: '${selectedLocation}'`);

        const filtered = allProperties.filter((property) => {
            // Check type match (true if no type selected or if property category matches)
            const typeMatch = !selectedType || property.category === selectedType;
            // Check location match (true if 'All Locations' or no location selected, or if property city matches)
            const locationMatch = !selectedLocation || selectedLocation === 'All Locations' || property.city === selectedLocation;
            // Property must match both filters
            return typeMatch && locationMatch;
        });

        // console.log("Explore: Filtered properties count:", filtered.length);
        setCurrentProperties(filtered);
        setCurrentPage(1); // Reset to first page whenever filters change

    }, [selectedType, selectedLocation, allProperties, isLoading, errorMsgState]);


    // --- Event Handlers for Filter Changes ---
    const handleTypeSelection = (type) => {
        setSelectedType(prev => prev === type ? "" : type); // Toggle selection or clear if same type clicked again
    };

    const handleLocationSelection = (location) => {
        setSelectedLocation(location); // Set selected location (includes 'All Locations')
    };

    // --- Pagination Calculation ---
    const displayedProperties = currentProperties.slice(
        (currentPage - 1) * propertiesPerPage,
        currentPage * propertiesPerPage
    );
    const totalPages = Math.ceil(currentProperties.length / propertiesPerPage);

    // Available property types for the filter UI
    const propertyTypes = ["Apartment", "House", "Land", "Commercial"];

    // --- RENDER LOGIC ---
    return (
        <div className="flex flex-col md:flex-row p-4 md:p-6 min-h-screen bg-gray-50">
            {/* Left Sidebar for Filters */}
            <aside className="w-full md:w-1/4 lg:w-1/5 p-4 md:p-5 bg-white rounded-lg shadow-lg mb-6 md:mb-0 md:mr-6 border border-gray-200 max-h-[90vh] overflow-y-auto sticky top-4"> {/* Made sidebar sticky */}
                <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6 sticky top-0 bg-white py-3 border-b border-gray-200 z-10">
                    Filter Properties
                </h2>

                {/* Property Type Filter */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">
                        Property Type
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {propertyTypes.map((type) => (
                            <button
                                key={type}
                                onClick={() => handleTypeSelection(type)}
                                className={`w-full p-2 text-sm rounded-md transition-colors border ${
                                    selectedType === type
                                        ? "bg-indigo-600 text-white border-indigo-700 font-medium shadow-sm"
                                        : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-indigo-50 hover:border-indigo-300"
                                } focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1`}
                            >
                                {type}
                            </button>
                        ))}
                         {selectedType && (
                             <button
                                onClick={() => handleTypeSelection("")} // Clear filter
                                className="col-span-2 mt-2 w-full p-1.5 text-xs text-center text-red-600 hover:bg-red-50 rounded-md border border-red-200 font-medium"
                            >
                                Clear Type Filter
                            </button>
                         )}
                    </div>
                </div>

                {/* Location Filter (Dynamic Cities) */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">
                        Location (City)
                    </h3>
                    <div className="space-y-1.5">
                        {uniqueCities.length > 0 ? uniqueCities.map((city) => (
                            <button
                                key={city}
                                onClick={() => handleLocationSelection(city)}
                                className={`w-full p-2 text-left text-sm rounded-md transition-colors border ${
                                    selectedLocation === city
                                        ? "bg-indigo-600 text-white border-indigo-700 font-medium shadow-sm"
                                        : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-indigo-50 hover:border-indigo-300"
                                } focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 truncate`}
                                title={city}
                            >
                                {city}
                            </button>
                        )) : isLoading ? ( // Show loading specifically for locations
                            <p className="text-sm text-gray-500 italic">Loading locations...</p>
                        ) : ( // Show if no locations found after loading (and no error)
                             !errorMsgState && <p className="text-sm text-gray-500 italic">No locations found.</p>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="w-full md:w-3/4 lg:w-4/5">
                {/* Header Section */}
                <header className="p-4 w-full h-auto text-left mb-6 bg-white rounded-lg shadow border border-gray-200">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
                        Explore Properties
                    </h1>
                     <p className="text-gray-600 text-sm mt-1">
                         {/* Dynamically update count based on filters */}
                         {isLoading ? "Loading..." :
                         errorMsgState ? "Error loading data." :
                         currentProperties.length > 0 ? `Showing ${displayedProperties.length} of ${currentProperties.length} listed properties` :
                         allProperties.length === 0 ? "No properties listed yet." : "No properties match filters."
                         }
                        {/* Display active filters */}
                        {selectedType && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Type: {selectedType}</span>}
                        {selectedLocation && selectedLocation !== 'All Locations' && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Location: {selectedLocation}</span>}
                    </p>
                </header>

                {/* Loading State Overlay or Placeholder */}
                {isLoading && (
                    <div className="flex justify-center items-center h-64 text-indigo-600 font-semibold text-xl p-10">
                        <FiLoader className="animate-spin mr-3" size={24} /> Loading Properties...
                    </div>
                )}

                {/* Error Message Display */}
                 {!isLoading && errorMsgState && (
                     <div className="text-center text-red-700 bg-red-100 p-4 rounded-md font-semibold border border-red-200 flex justify-center items-center">
                        <FiAlertCircle className="mr-2" size={20} /> {errorMsgState}
                     </div>
                 )}

                {/* No Data / Filter Message */}
                 {!isLoading && !errorMsgState && currentProperties.length === 0 && (
                    <div className="text-center text-gray-500 p-10 bg-white rounded-lg shadow border">
                        {allProperties.length === 0 ? "No properties seem to be listed for sale at the moment." : "No properties found matching your current filters. Try broadening your search!"}
                    </div>
                )}


                {/* Properties Grid (only render if not loading, no error, and properties exist) */}
                {!isLoading && !errorMsgState && currentProperties.length > 0 && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"> {/* Adjusted gap and columns for potentially more items */}
                            {displayedProperties.map((p, index) => {
                                const image = p.image || DEFAULT_PLACEHOLDER_IMAGE_URL; // Ensure fallback
                                const key = p.productID || p.nftId || `prop-${index}`; // Use productID as primary key

                                return (
                                    // Property Card
                                    <motion.div
                                        key={key}
                                        className="relative bg-white shadow-md hover:shadow-lg rounded-lg overflow-hidden cursor-pointer transition-shadow duration-300 border border-gray-200 flex flex-col"
                                        onMouseEnter={() => setHovered(key)}
                                        onMouseLeave={() => setHovered(null)}
                                        layout // Animate layout changes (like filtering)
                                    >
                                        {/* Image Section */}
                                        <div className="w-full h-48 overflow-hidden">
                                            <img
                                                src={image}
                                                alt={p.propertyTitle}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" // Subtle zoom on hover (requires group class on parent if used)
                                                // Add error handling for images
                                                onError={(e) => { if (e.target.src !== DEFAULT_PLACEHOLDER_IMAGE_URL) e.target.src = DEFAULT_PLACEHOLDER_IMAGE_URL; }}
                                            />
                                        </div>


                                        {/* Content Section */}
                                        <div className="p-4 flex-grow flex flex-col">
                                            <h2 className="font-semibold text-md text-gray-800 mb-1 truncate" title={p.propertyTitle}>
                                                {p.propertyTitle}
                                            </h2>
                                            <p className="text-xs text-gray-600 flex items-center mb-1" title={p.displayLocation}>
                                                <FiMapPin className="mr-1 text-indigo-600 flex-shrink-0" size={12} />
                                                <span className="truncate">{p.displayLocation}</span>
                                            </p>
                                             <p className="text-xs text-gray-500 flex items-center mb-3">
                                                <FiTag className="mr-1 text-indigo-600 flex-shrink-0" size={12}/>
                                                {p.category}
                                            </p>
                                            {/* Price pushed to bottom */}
                                            <p className="text-indigo-700 font-bold text-lg mt-auto pt-2">
                                                {p.price !== 'N/A' ? `${p.price} ETH` : 'Price Not Available'}
                                            </p>
                                        </div>

                                        {/* "View Details" Button - Always visible but styled */}
                                         <Link
                                             to={`/property/${p.productID}`} // Link uses productID
                                             className="block w-full text-center bg-indigo-100 text-indigo-700 py-2 px-4 hover:bg-indigo-600 hover:text-white transition-colors text-sm font-medium border-t border-indigo-200"
                                         >
                                             View Details
                                         </Link>

                                         {/* Hover Effect Div (Optional - Consider simplifying if View Details is always visible) */}
                                         {/* If you keep hover, ensure it doesn't obscure the button */}
                                         {/* ... (Hover logic might be removed or simplified) ... */}
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Pagination Controls */}
                         {totalPages > 1 && (
                             <nav className="flex justify-center items-center mt-8 pt-4 border-t border-gray-200 space-x-3" aria-label="Pagination">
                                <button
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                >
                                    ← Previous
                                </button>
                                <span className="px-4 py-2 text-sm text-gray-700 font-medium">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                >
                                    Next →
                                </button>
                            </nav>
                         )}
                    </>
                )}
            </main>
        </div>
    );
}

export default Explore;