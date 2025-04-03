import React, { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";

// --- STEP 1: Make sure this ABI file is generated from Novaland_F.sol ---
import contractABI from "./../contractABI2.json"; 

import { useAddress } from "@thirdweb-dev/react";
import { Search } from "lucide-react";
import banner from "./assets/banner.png"; // Make sure path is correct

// --- STEP 2: Use the CORRECT Deployed Novaland_F Contract Address ---
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <--- *** REPLACE THIS ***

// Placeholder image if a property has no images
const DEFAULT_PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/300x200.png?text=No+Image";

// --- Load Contract Function (Uses ABI for Novaland_F) ---
async function loadContract() {
    // Basic check for contract address validity
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
        console.error("Invalid or missing contract address:", contractAddress);
        setErrorMsg("Configuration Error: Invalid contract address provided."); // Inform user
        return null;
    }
    if (!contractABI || contractABI.length === 0) {
         console.error("Invalid or missing contract ABI.");
         setErrorMsg("Configuration Error: Invalid contract ABI provided."); // Inform user
         return null;
    }


    if (!window.ethereum) {
        console.error("MetaMask or compatible wallet not found.");
        setErrorMsg("Please install MetaMask or a compatible wallet.");
        return null;
    }
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        // Use provider for read-only calls (FetchProperties is view)
        const contract = new ethers.Contract(contractAddress, contractABI, provider);
        // Test connection by trying to read a public variable (like propertyIndex)
        try {
            await contract.propertyIndex(); // Simple read check
            console.log("Contract connection successful.");
        } catch (readError) {
             console.error("Failed to read from contract. Check address, ABI, and network.", readError);
             setErrorMsg("Failed to connect to the contract. Please ensure you are on the correct network and the contract address/ABI are correct.");
             return null;
        }

        return contract;
    } catch (error) {
        console.error("Error loading contract instance:", error);
         setErrorMsg(`Error initializing contract: ${error.message}`);
        return null; // Handle contract loading failure
    }
}

// --- fetchProperties Function (Should work as is with Novaland_F) ---
// Global error message setter (passed down from component)
let setErrorMsg = () => {}; // Placeholder

async function fetchProperties() {
    const contract = await loadContract();
    if (!contract) {
        console.error("Contract instance is not available for fetching.");
        // Error message should already be set by loadContract
        return []; // Return empty array if contract load failed
    }

    try {
        console.log("Fetching properties using Novaland_F ABI...");
        // Calls FetchProperties - same signature as Novaland_2
        const allPropertiesData = await contract.FetchProperties();
        console.log("Raw data received from Novaland_F FetchProperties:", allPropertiesData);

        // Process the array of structs - Indices match Novaland_F struct
        const processedProperties = allPropertiesData
            .map((propertyStruct, structIndex) => {
                 // Indices based on Novaland_F Property struct:
                 // 0: productID, 1: owner, 2: price, 3: propertyTitle, 4: category,
                 // 5: images, 6: location, 7: documents, 8: description, 9: nftId, 10: isListed

                 if (!propertyStruct || typeof propertyStruct !== 'object' || propertyStruct.length < 11) {
                     console.warn(`Skipping invalid property struct at index ${structIndex}:`, propertyStruct);
                    return null;
                 }

                try {
                    const images = Array.isArray(propertyStruct[5]) ? propertyStruct[5] : [];

                    return {
                        productID: propertyStruct[0].toString(),
                        owner: propertyStruct[1],
                        price: ethers.utils.formatEther(propertyStruct[2]), // Convert Wei to Ether string
                        propertyTitle: propertyStruct[3],
                        category: propertyStruct[4],
                        images: images,
                        location: propertyStruct[6],
                        documents: propertyStruct[7],
                        description: propertyStruct[8],
                        nftId: propertyStruct[9],
                        isListed: propertyStruct[10],
                        image: images.length > 0 ? images[0] : DEFAULT_PLACEHOLDER_IMAGE_URL,
                    };
                } catch (mapError) {
                     console.error(`Error processing property struct at index ${structIndex}:`, propertyStruct, mapError);
                     return null;
                }
            })
            .filter(p => p !== null && p.isListed); // Filter out nulls and only show listed (isListed=true) properties

        console.log("Processed and filtered properties:", processedProperties);
        return processedProperties;

    } catch (error) {
        console.error("Error fetching/processing properties from Novaland_F contract:", error);
        if (error.code === 'CALL_EXCEPTION') {
            console.error("Contract call failed. Double-check contract address, ABI, network, and if the contract is deployed correctly.");
             setErrorMsg("Error fetching properties. Please check network connection and contract status.");
        } else {
             setErrorMsg(`An error occurred: ${error.message}`);
        }
        return []; // Return empty array on error
    }
}


function Home() {
    const address = useAddress();
    const [properties, setProperties] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsgState, setErrorMsgState] = useState(""); // Renamed state setter
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredProperties, setFilteredProperties] = useState([]);

    // Pass the state setter to the fetch function scope
    useEffect(() => {
        setErrorMsg = setErrorMsgState;
        // Cleanup function to avoid setting state on unmounted component
        return () => { setErrorMsg = () => {}; };
    }, []);


    const loadProperties = useCallback(async () => {
        setIsLoading(true);
        setErrorMsgState(""); // Use the state setter
        setProperties([]);
        setFilteredProperties([]);
        console.log("Calling loadProperties for Novaland_F...");
        try {
            const fetchedProperties = await fetchProperties();
            // No explicit check for 'null' needed here as fetchProperties handles errors/returns []
            setProperties(fetchedProperties);
            setFilteredProperties(fetchedProperties);
            console.log("Novaland_F properties loaded successfully into state.");
            if (fetchedProperties.length === 0 && !errorMsgState) { // Check errorMsgState before setting 'no properties' message
                 // Optional: Set a message if fetch was successful but returned nothing
                 // setErrorMsgState("No listed properties found.");
                 console.log("Fetch successful, but no listed properties returned.")
            }

        } catch (error) {
            // Errors should ideally be caught within fetchProperties/loadContract and set via setErrorMsg
            console.error("Unexpected error in loadProperties callback:", error);
            // Set a generic error if not already set
             if (!errorMsgState) {
                 setErrorMsgState(`Failed to load properties: ${error.message}`);
             }
            setProperties([]);
            setFilteredProperties([]);
        } finally {
            setIsLoading(false);
        }
    }, [errorMsgState]); // Added errorMsgState as dependency? Maybe not needed if setErrorMsg handles it globally. Test this.

    // Initial load
    useEffect(() => {
        loadProperties();
    }, [loadProperties]); // Run once on mount

    // Filter properties when search term or properties list changes
    useEffect(() => {
        if (!searchTerm) {
            setFilteredProperties(properties);
            return;
        }
        const results = properties.filter((property) => {
            const searchableText = `
                ${property.propertyTitle} ${property.category} ${property.price} ${property.description} ${property.location ? property.location.join(' ') : ''}
            `.toLowerCase();
            return searchableText.includes(searchTerm.toLowerCase());
        });
        setFilteredProperties(results);
    }, [searchTerm, properties]);

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };

    // --- RENDER LOGIC (Remains the same) ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-purple-200 to-blue-300 text-gray-800 pb-10">
            {/* Banner Image */}
             <div className="flex justify-center items-center w-full h-[50vh] md:h-[60vh] px-4 py-6">
                 <img
                     src={banner}
                     className="w-full sm:w-11/12 md:w-4/5 max-h-full object-contain rounded-lg shadow-lg"
                     alt="Novaland Banner"
                 />
             </div>

             {/* Search Bar */}
             <div className="p-4 max-w-3xl mx-auto">
                  <div className="relative">
                      <input
                          type="text"
                          placeholder="Search by Title, Category, Price, Location..."
                          className="w-full p-3 pl-10 rounded-full shadow-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200"
                          value={searchTerm}
                          onChange={handleSearchChange}
                      />
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                          <Search className="text-gray-500" />
                      </div>
                  </div>
             </div>

            {/* Featured Properties Section */}
            <div className="p-6 max-w-7xl mx-auto">
                <h1 className="font-bold text-3xl md:text-4xl text-center text-purple-700 mb-8">
                    Featured Properties
                </h1>

                {/* Loading State */}
                {isLoading && (
                    <div className="text-center text-purple-600 font-semibold text-xl">
                        Loading Properties...
                    </div>
                )}

                {/* Error Message */}
                {!isLoading && errorMsgState && ( // Use errorMsgState here
                    <div className="text-center text-red-600 bg-red-100 p-4 rounded-md font-semibold">
                        {errorMsgState} {/* Display the error */}
                    </div>
                )}

                {/* Properties Grid */}
                 {!isLoading && !errorMsgState && ( // Check errorMsgState here too
                    <>
                        {/* Combined check for no results */}
                        {filteredProperties.length === 0 && (
                             <div className="text-center text-gray-600 mt-6">
                                 {searchTerm
                                     ? `No properties found matching your search term "${searchTerm}".`
                                     : properties.length === 0
                                         ? "No properties seem to be listed yet."
                                         : "No listed properties found matching the criteria." // Should not happen if properties > 0 and search = ''
                                 }
                             </div>
                        )}

                        {filteredProperties.length > 0 && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
                                {filteredProperties.map((property) => (
                                    <div
                                        key={property.productID || property.nftId}
                                        className="bg-white rounded-2xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105 border border-gray-100 flex flex-col"
                                    >
                                        <img
                                            src={property.image}
                                            alt={property.propertyTitle || 'Property Image'}
                                            className="w-full h-48 object-cover"
                                            onError={(e) => { e.target.onerror = null; e.target.src=DEFAULT_PLACEHOLDER_IMAGE_URL }}
                                        />
                                        <div className="p-4 flex flex-col flex-grow">
                                            <h2 className="text-xl font-semibold text-purple-800 mb-1 truncate" title={property.propertyTitle}>
                                                {property.propertyTitle}
                                            </h2>
                                            <p className="text-sm text-gray-500 mb-2">{property.category}</p>
                                             {property.location && property.location.length >= 3 && (
                                                 <p className="text-xs text-gray-500 mb-2 truncate" title={property.location.join(', ')}>
                                                     📍 {property.location[2]}, {property.location[1]} {/* City, State */}
                                                 </p>
                                             )}
                                            <p className="text-lg font-bold text-green-600 mt-auto">
                                                {property.price} ETH
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default Home;