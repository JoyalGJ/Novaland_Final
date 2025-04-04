import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiHome, FiMapPin, FiTag, FiUser, FiLoader, FiAlertCircle } from "react-icons/fi";
import { ethers } from "ethers";

import contractABI from "./../../contractABI2.json";
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424";

const DEFAULT_PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/300x200.png?text=Property+Image";

let setErrorMsgGlobal = () => {};

async function loadContract() {
     if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") { console.error("Explore: Placeholder contract address detected."); setErrorMsgGlobal("Config Error: Contract address needs update."); return null; }
    if (!contractAddress || !ethers.utils.isAddress(contractAddress)) { console.error("Explore: Invalid or missing contract address:", contractAddress); setErrorMsgGlobal("Config Error: Invalid contract address."); return null; }
     if (!contractABI || contractABI.length === 0) { console.error("Explore: Invalid or missing contract ABI."); setErrorMsgGlobal("Config Error: Invalid contract ABI."); return null; }
    if (!window.ethereum) { console.warn("Explore: MetaMask not found."); }
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(contractAddress, contractABI, provider);
        try { await contract.propertyIndex(); console.log("Explore: Connection OK."); }
        catch (readError) { console.error("Explore: Failed contract read.", readError); setErrorMsgGlobal("Failed contract connection. Check network/details."); return null; }
        return contract;
    } catch (error) { console.error("Explore: Error loading contract instance:", error); setErrorMsgGlobal(`Error initializing contract: ${error.message}`); return null; }
}

async function fetchProperties() {
    const contract = await loadContract();
    if (!contract) { console.error("Explore: Contract instance unavailable for fetch."); return []; }
    try {
        console.log("Explore: Fetching properties...");
        const allPropertiesData = await contract.FetchProperties();
        const processedProperties = allPropertiesData
            .map((propertyStruct, structIndex) => {
                 if (!propertyStruct || typeof propertyStruct !== 'object' || propertyStruct.length < 11) { console.warn(`Explore: Skipping invalid struct ${structIndex}`); return null; }
                try {
                    const images = Array.isArray(propertyStruct[5]) ? propertyStruct[5] : [];
                    const location = Array.isArray(propertyStruct[6]) ? propertyStruct[6] : [];
                    const priceWei = propertyStruct[2];
                    let formattedPrice = 'N/A';
                    let priceNumber = null; // Store numeric price for filtering
                    if (priceWei && ethers.BigNumber.isBigNumber(priceWei)) {
                        formattedPrice = ethers.utils.formatEther(priceWei);
                        try { priceNumber = parseFloat(formattedPrice); } // Try to parse for filtering
                        catch(e) { console.warn(`Could not parse price ${formattedPrice} to float`); }
                    } else { console.warn(`Explore: Invalid price format ${structIndex}`); }
                    return {
                        productID: propertyStruct[0].toString(), owner: propertyStruct[1], price: formattedPrice, priceNumeric: priceNumber, // Add numeric price
                        propertyTitle: propertyStruct[3] || "Untitled", category: propertyStruct[4] || "Uncategorized",
                        images: images, location: location, description: propertyStruct[8] || "",
                        nftId: propertyStruct[9] || 'N/A', isListed: propertyStruct[10],
                        image: images.length > 0 ? images[0] : DEFAULT_PLACEHOLDER_IMAGE_URL,
                        displayLocation: location.length >= 3 ? `${location[2]}, ${location[1]}` : (location.length > 0 ? location.join(', ') : "N/A"),
                        city: location.length >= 3 ? location[2] : null,
                    };
                } catch (mapError) { console.error(`Explore: Error processing struct ${structIndex}`, mapError); return null; }
            })
            .filter(p => p !== null && p.isListed === true);
        console.log(`Explore: Found ${processedProperties.length} listed properties.`);
        return processedProperties;
    } catch (error) {
        console.error("Explore: Error fetching properties:", error);
        if (error.code === 'CALL_EXCEPTION') { setErrorMsgGlobal("Error fetching. Check network/contract."); }
        else { setErrorMsgGlobal(`Fetch error: ${error.message}`); }
        return [];
    }
}

function Explore() {
    const [hovered, setHovered] = useState(null);
    const [selectedType, setSelectedType] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("");
    // *** ADDED Price Filter State ***
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });
    // ---
    const [allProperties, setAllProperties] = useState([]);
    const [currentProperties, setCurrentProperties] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsgState, setErrorMsgState] = useState("");
    const [uniqueCities, setUniqueCities] = useState([]);

    const propertiesPerPage = 12;

     useEffect(() => { setErrorMsgGlobal = setErrorMsgState; return () => { setErrorMsgGlobal = () => {}; }; }, []);

    const fetchInitialData = useCallback(async () => {
        setIsLoading(true); setErrorMsgState(""); setAllProperties([]); setCurrentProperties([]); setUniqueCities([]);
        try {
            const fetchedProperties = await fetchProperties();
            setAllProperties(fetchedProperties); setCurrentProperties(fetchedProperties);
            const cities = new Set(fetchedProperties.map(p => p.city).filter(Boolean));
            setUniqueCities(['All Locations', ...Array.from(cities).sort()]);
            if (fetchedProperties.length === 0 && !errorMsgState) { console.log("Explore: Fetch OK, 0 listed."); }
        } catch (error) { if (!errorMsgState) { setErrorMsgState(`Failed load: ${error.message}`); } setAllProperties([]); setCurrentProperties([]); setUniqueCities([]); }
        finally { setIsLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

    // --- Filtering Logic (Includes Price) ---
    useEffect(() => {
        if (isLoading || errorMsgState) return;

        const minPrice = priceRange.min !== '' ? parseFloat(priceRange.min) : null;
        const maxPrice = priceRange.max !== '' ? parseFloat(priceRange.max) : null;

        // console.log(`Filtering by Type: '${selectedType}', Loc: '${selectedLocation}', Price: ${minPrice}-${maxPrice}`);

        const filtered = allProperties.filter((property) => {
            const typeMatch = !selectedType || property.category === selectedType;
            const locationMatch = !selectedLocation || selectedLocation === 'All Locations' || property.city === selectedLocation;

            // *** ADDED Price Check ***
            const priceNumeric = property.priceNumeric; // Use the pre-parsed numeric price
            let priceMatch = true; // Assume true initially
            if (priceNumeric !== null) { // Only filter if property has a valid numeric price
                if (minPrice !== null && priceNumeric < minPrice) {
                    priceMatch = false;
                }
                if (maxPrice !== null && priceNumeric > maxPrice) {
                    priceMatch = false;
                }
            } else {
                // Decide how to handle properties with N/A price - exclude them if a price filter is set?
                if (minPrice !== null || maxPrice !== null) {
                     priceMatch = false; // Exclude if price filter is active but property price is N/A
                }
            }
            // ---

            return typeMatch && locationMatch && priceMatch; // Must match all filters
        });

        setCurrentProperties(filtered);
        setCurrentPage(1);

    }, [selectedType, selectedLocation, priceRange, allProperties, isLoading, errorMsgState]); // Added priceRange dependency


    // --- Event Handlers ---
    const handleTypeSelection = (type) => { setSelectedType(prev => prev === type ? "" : type); };
    const handleLocationSelection = (location) => { setSelectedLocation(location); };

    // *** ADDED Price Filter Handlers ***
    const handlePriceChange = (e) => {
        const { name, value } = e.target;
        // Allow only numbers and a single decimal point
        if (/^\d*\.?\d*$/.test(value)) {
            setPriceRange(prev => ({ ...prev, [name]: value }));
        }
    };
    const clearPriceFilter = () => {
         setPriceRange({ min: '', max: '' });
    }
    // ---

    // --- Pagination Calculation ---
    const displayedProperties = currentProperties.slice((currentPage - 1) * propertiesPerPage, currentPage * propertiesPerPage);
    const totalPages = Math.ceil(currentProperties.length / propertiesPerPage);

    const propertyTypes = ["Apartment", "House", "Land", "Commercial"];

    return (
        <div className="flex flex-col md:flex-row p-4 md:p-6 min-h-screen bg-gray-50">
            {/* Left Sidebar */}
            <aside className="w-full md:w-1/4 lg:w-1/5 p-4 md:p-5 bg-white rounded-lg shadow-lg mb-6 md:mb-0 md:mr-6 border border-gray-200 max-h-[90vh] overflow-y-auto sticky top-4">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6 sticky top-0 bg-white py-3 border-b border-gray-200 z-10">Filter Properties</h2>

                {/* Property Type Filter */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Property Type</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {propertyTypes.map((type) => ( <button key={type} onClick={() => handleTypeSelection(type)} className={`w-full p-2 text-sm rounded-md transition-colors border ${ selectedType === type ? "bg-indigo-600 text-white border-indigo-700 font-medium shadow-sm" : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-indigo-50 hover:border-indigo-300" } focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1`}>{type}</button> ))}
                         {selectedType && ( <button onClick={() => handleTypeSelection("")} className="col-span-2 mt-2 w-full p-1.5 text-xs text-center text-red-600 hover:bg-red-50 rounded-md border border-red-200 font-medium">Clear Type</button> )}
                    </div>
                </div>

                {/* *** ADDED Price Filter UI *** */}
                 <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Price Range (ETH)</h3>
                    <div className="flex items-center space-x-2">
                         <input
                            type="text" // Use text to allow decimals easily, validation done in handler
                            name="min"
                            placeholder="Min"
                            value={priceRange.min}
                            onChange={handlePriceChange}
                            className="w-1/2 p-2 text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            pattern="\d*\.?\d*" // HTML pattern for basic guidance
                        />
                         <span className="text-gray-500">-</span>
                         <input
                            type="text"
                            name="max"
                            placeholder="Max"
                            value={priceRange.max}
                            onChange={handlePriceChange}
                            className="w-1/2 p-2 text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            pattern="\d*\.?\d*"
                        />
                    </div>
                    {(priceRange.min || priceRange.max) && (
                         <button
                            onClick={clearPriceFilter}
                            className="mt-2 w-full p-1.5 text-xs text-center text-red-600 hover:bg-red-50 rounded-md border border-red-200 font-medium"
                        >
                            Clear Price Filter
                        </button>
                    )}
                 </div>
                 {/* --- */}


                {/* Location Filter */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Location (City)</h3>
                    <div className="space-y-1.5">
                        {uniqueCities.length > 0 ? uniqueCities.map((city) => ( <button key={city} onClick={() => handleLocationSelection(city)} className={`w-full p-2 text-left text-sm rounded-md transition-colors border ${ selectedLocation === city ? "bg-indigo-600 text-white border-indigo-700 font-medium shadow-sm" : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-indigo-50 hover:border-indigo-300" } focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 truncate`} title={city}>{city}</button> )) : isLoading ? ( <p className="text-sm text-gray-500 italic">Loading locations...</p> ) : ( !errorMsgState && <p className="text-sm text-gray-500 italic">No locations found.</p> )}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="w-full md:w-3/4 lg:w-4/5">
                {/* Header Section */}
                <header className="p-4 w-full h-auto text-left mb-6 bg-white rounded-lg shadow border border-gray-200">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Explore Properties</h1>
                     <p className="text-gray-600 text-sm mt-1">
                         {isLoading ? "Loading..." : errorMsgState ? "Error." : currentProperties.length > 0 ? `Showing ${displayedProperties.length} of ${currentProperties.length}` : allProperties.length === 0 ? "None listed." : "No matches."}
                        {/* Active Filters Display */}
                        {selectedType && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Type: {selectedType}</span>}
                        {selectedLocation && selectedLocation !== 'All Locations' && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Loc: {selectedLocation}</span>}
                        {/* *** ADDED Price Filter Display *** */}
                        {(priceRange.min || priceRange.max) && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Price: {priceRange.min || '0'} - {priceRange.max || 'Any'} ETH
                            </span>
                        )}
                        {/* --- */}
                    </p>
                </header>

                {/* Loading/Error/No Data */}
                {isLoading && (<div className="flex justify-center items-center h-64 text-indigo-600 font-semibold text-xl p-10"><FiLoader className="animate-spin mr-3" size={24} /> Loading...</div>)}
                 {!isLoading && errorMsgState && (<div className="text-center text-red-700 bg-red-100 p-4 rounded-md font-semibold border border-red-200 flex justify-center items-center"><FiAlertCircle className="mr-2" size={20} /> {errorMsgState}</div>)}
                 {!isLoading && !errorMsgState && currentProperties.length === 0 && (<div className="text-center text-gray-500 p-10 bg-white rounded-lg shadow border">{allProperties.length === 0 ? "No properties listed." : "No properties match filters."}</div>)}

                {/* Properties Grid */}
                {!isLoading && !errorMsgState && currentProperties.length > 0 && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {displayedProperties.map((p, index) => {
                                const image = p.image || DEFAULT_PLACEHOLDER_IMAGE_URL;
                                const key = p.productID || p.nftId || `prop-${index}`;
                                return (
                                    <motion.div key={key} className="relative bg-white shadow-md hover:shadow-lg rounded-lg overflow-hidden cursor-pointer transition-shadow duration-300 border border-gray-200 flex flex-col" onMouseEnter={() => setHovered(key)} onMouseLeave={() => setHovered(null)} layout>
                                        <div className="w-full h-48 overflow-hidden"> <img src={image} alt={p.propertyTitle} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onError={(e) => { if (e.target.src !== DEFAULT_PLACEHOLDER_IMAGE_URL) e.target.src = DEFAULT_PLACEHOLDER_IMAGE_URL; }} /> </div>
                                        <div className="p-4 flex-grow flex flex-col">
                                            <h2 className="font-semibold text-md text-gray-800 mb-1 truncate" title={p.propertyTitle}>{p.propertyTitle}</h2>
                                            <p className="text-xs text-gray-600 flex items-center mb-1" title={p.displayLocation}><FiMapPin className="mr-1 text-indigo-600 flex-shrink-0" size={12} /> <span className="truncate">{p.displayLocation}</span></p>
                                             <p className="text-xs text-gray-500 flex items-center mb-3"><FiTag className="mr-1 text-indigo-600 flex-shrink-0" size={12}/> {p.category}</p>
                                            <p className="text-indigo-700 font-bold text-lg mt-auto pt-2">{p.price !== 'N/A' ? `${p.price} ETH` : 'N/A'}</p>
                                        </div>
                                         <Link to={`/property/${p.productID}`} className="block w-full text-center bg-indigo-100 text-indigo-700 py-2 px-4 hover:bg-indigo-600 hover:text-white transition-colors text-sm font-medium border-t border-indigo-200">View Details</Link>
                                    </motion.div>
                                );
                            })}
                        </div>

                         {totalPages > 1 && (
                             <nav className="flex justify-center items-center mt-8 pt-4 border-t border-gray-200 space-x-3" aria-label="Pagination">
                                <button className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>← Prev</button>
                                <span className="px-4 py-2 text-sm text-gray-700 font-medium">Page {currentPage} of {totalPages}</span>
                                <button className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next →</button>
                            </nav>
                         )}
                    </>
                )}
            </main>
        </div>
    );
}
export default Explore;