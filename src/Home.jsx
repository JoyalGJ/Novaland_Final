import React, { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
// --- ADDED MISSING IMPORT ---
import { Link } from 'react-router-dom';

import contractABI from "./../contractABI2.json";

import { useAddress } from "@thirdweb-dev/react";
import { Search } from "lucide-react";
import banner from "./assets/banner.png";

const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424";

const DEFAULT_PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/300x200.png?text=No+Image";

let setErrorMsg = () => {}; // Placeholder

async function loadContract() {
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
        console.error("Invalid or missing contract address:", contractAddress);
        setErrorMsg("Configuration Error: Invalid contract address provided.");
        return null;
    }
    if (!contractABI || contractABI.length === 0) {
         console.error("Invalid or missing contract ABI.");
         setErrorMsg("Configuration Error: Invalid contract ABI provided.");
         return null;
    }

    if (!window.ethereum) {
        console.error("MetaMask or compatible wallet not found.");
        setErrorMsg("Please install MetaMask or a compatible wallet.");
        return null;
    }
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(contractAddress, contractABI, provider);
        try {
            await contract.propertyIndex();
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
        return null;
    }
}

async function fetchProperties() {
    const contract = await loadContract();
    if (!contract) {
        console.error("Contract instance is not available for fetching.");
        return [];
    }

    try {
        console.log("Fetching properties using Novaland_F ABI...");
        const allPropertiesData = await contract.FetchProperties();
        console.log("Raw data received from Novaland_F FetchProperties:", allPropertiesData);

        const processedProperties = allPropertiesData
            .map((propertyStruct, structIndex) => {
                 if (!propertyStruct || typeof propertyStruct !== 'object' || propertyStruct.length < 11) {
                     console.warn(`Skipping invalid property struct at index ${structIndex}:`, propertyStruct);
                    return null;
                 }

                try {
                    const images = Array.isArray(propertyStruct[5]) ? propertyStruct[5] : [];
                    return {
                        productID: propertyStruct[0].toString(),
                        owner: propertyStruct[1],
                        price: ethers.utils.formatEther(propertyStruct[2]),
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
            .filter(p => p !== null && p.isListed);

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
        return [];
    }
}

function Home() {
    const address = useAddress();
    const [properties, setProperties] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsgState, setErrorMsgState] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredProperties, setFilteredProperties] = useState([]);

    useEffect(() => {
        setErrorMsg = setErrorMsgState;
        return () => { setErrorMsg = () => {}; };
    }, []);


    const loadProperties = useCallback(async () => {
        setIsLoading(true);
        setErrorMsgState("");
        setProperties([]);
        setFilteredProperties([]);
        console.log("Calling loadProperties for Novaland_F...");
        try {
            const fetchedProperties = await fetchProperties();
            setProperties(fetchedProperties);
            setFilteredProperties(fetchedProperties);
            console.log("Novaland_F properties loaded successfully into state.");
            if (fetchedProperties.length === 0 && !errorMsgState) {
                 console.log("Fetch successful, but no listed properties returned.")
            }

        } catch (error) {
             if (!errorMsgState) {
                 setErrorMsgState(`Failed to load properties: ${error.message}`);
             }
            setProperties([]);
            setFilteredProperties([]);
        } finally {
            setIsLoading(false);
        }
    }, [errorMsgState]);

    useEffect(() => {
        loadProperties();
    }, [loadProperties]);

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-purple-200 to-blue-300 text-gray-800 pb-10">
             <div className="flex justify-center items-center w-full h-[50vh] md:h-[60vh] px-4 py-6">
                 <img
                     src={banner}
                     className="w-full sm:w-11/12 md:w-4/5 max-h-full object-contain rounded-lg shadow-lg"
                     alt="Novaland Banner"
                 />
             </div>

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

            <div className="p-6 max-w-7xl mx-auto">
                <h1 className="font-bold text-3xl md:text-4xl text-center text-purple-700 mb-8">
                    Latest Properties
                </h1>

                {isLoading && (
                    <div className="text-center text-purple-600 font-semibold text-xl">
                        Loading Properties...
                    </div>
                )}

                {!isLoading && errorMsgState && (
                    <div className="text-center text-red-600 bg-red-100 p-4 rounded-md font-semibold">
                        {errorMsgState}
                    </div>
                )}

                 {!isLoading && !errorMsgState && (
                    <>
                        {filteredProperties.length === 0 && (
                             <div className="text-center text-gray-600 mt-6">
                                 {searchTerm
                                     ? `No properties found matching your search term "${searchTerm}".`
                                     : properties.length === 0
                                         ? "No properties seem to be listed yet."
                                         : "No listed properties found matching the criteria."
                                 }
                             </div>
                        )}

                        {filteredProperties.length > 0 && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
                                {filteredProperties.map((property) => (
                                    // CARD 
                                    <div
                                        key={property.productID || property.nftId}
                                        className="bg-white rounded-2xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105 border border-gray-100 flex flex-col"
                                    >
                                        <Link
                                             to={`/property/${property.productID}`}
                                             className="block group"
                                         >
                                            <img
                                                src={property.image}
                                                alt={property.propertyTitle || 'Property Image'}
                                                className="w-full h-48 object-cover"
                                                onError={(e) => { e.target.onerror = null; e.target.src=DEFAULT_PLACEHOLDER_IMAGE_URL }}
                                            />
                                            <div className="p-4 flex flex-col flex-grow">
                                                <h2 className="text-xl font-semibold text-purple-800 mb-1 truncate group-hover:text-indigo-600" title={property.propertyTitle}> {/* Example hover effect */}
                                                    {property.propertyTitle}
                                                </h2>
                                                <p className="text-sm text-gray-500 mb-2">{property.category}</p>
                                                 {property.location && property.location.length >= 3 && (
                                                     <p className="text-xs text-gray-500 mb-2 truncate" title={property.location.join(', ')}>
                                                         📍 {property.location[2]}, {property.location[1]}
                                                     </p>
                                                 )}
                                                <p className="text-lg font-bold text-green-600 mt-auto">
                                                    {property.price} ETH
                                                </p>
                                            </div>
                                        </Link>
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