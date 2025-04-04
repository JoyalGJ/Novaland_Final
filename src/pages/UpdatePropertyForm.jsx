import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import axios from 'axios';
import { useAddress } from '@thirdweb-dev/react';
import contractABI from './../../contractABI2.json'; // <--- MAKE SURE this is the ABI for Novaland_F1
import { FiX, FiInfo } from 'react-icons/fi'; // Icon for removing files and info
// --- REPLACE with your Deployed Novaland_F1 Contract Address ---
const contractAddress = "0x47F4fe72d3d23a2EEa030EB8B2BC17417fb651d4"; // <--- *** REPLACE THIS ***

// --- Pinata Configuration (ensure these are set in your .env) ---
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY;
const PINATA_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

// --- Helper: Upload single file to Pinata ---
// ... (Keep the same uploadFileToPinata function - unchanged)
const uploadFileToPinata = async (file, fileType = 'File') => {
    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
        throw new Error("Pinata API Key or Secret is missing. Cannot upload.");
    }
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    let data = new FormData();
    data.append('file', file);
    const metadata = JSON.stringify({ name: `Property${fileType}_${file.name}_${Date.now()}` });
    data.append('pinataMetadata', metadata);
    const pinataOptions = JSON.stringify({ cidVersion: 1 });
    data.append('pinataOptions', pinataOptions);

    try {
        const response = await axios.post(url, data, {
            maxBodyLength: 'Infinity', // Adjusted for potential large files
            headers: {
                'Content-Type': `multipart/form-data; boundary=${data._boundary}`, // Recommended by Pinata
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_API_KEY
            }
        });
        console.log(`Pinata ${fileType} upload response:`, response.data);
        if (response.data.IpfsHash) {
            return `${PINATA_GATEWAY_URL}${response.data.IpfsHash}`;
        } else {
            throw new Error(`Failed to get IPFS hash from Pinata response for ${file.name}.`);
        }
    } catch (error) {
        console.error(`Error uploading ${fileType} to Pinata:`, error.response ? error.response.data : error);
        const errorMsg = error.response?.data?.error || error.message || `Unknown Pinata upload error for ${file.name}.`;
        throw new Error(`Pinata ${fileType} upload failed: ${errorMsg}`);
    }
};

// --- Helper: Load Contract ---
// ... (Keep the same loadContract function - unchanged, assuming ABI/Address are updated)
async function loadContract() {
    if (!window.ethereum) {
        console.error("MetaMask or compatible wallet not found."); return null;
    }
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        if (!contractABI || contractABI.length === 0) throw new Error("Contract ABI is missing or empty.");
        if (!ethers.utils.isAddress(contractAddress)) throw new Error(`Invalid Contract Address: ${contractAddress}. Please replace placeholder.`);
        return new ethers.Contract(contractAddress, contractABI, signer);
    } catch (error) {
        console.error("Error loading contract:", error);
        // Provide more specific feedback if the address is the placeholder
        if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
             throw new Error("Contract address is still the placeholder. Please update it in the code.");
        }
        throw error; // Re-throw the error after logging
    }
}


function UpdatePropertyForm() {
    const { productId } = useParams(); // Get property ID from URL
    const navigate = useNavigate(); // Hook for navigation
    const address = useAddress(); // Connected wallet address

    // Editable form data
    const [formData, setFormData] = useState({
        propertyTitle: '',
        category: 'Apartment', // Default category
        country: '',
        state: '',
        city: '',
        pinCode: '',
        description: '',
    });

    // Non-editable data fetched from contract
    const [originalOwner, setOriginalOwner] = useState('');
    const [propertyPrice, setPropertyPrice] = useState(''); // Store price (string for display)
    const [propertyNftId, setPropertyNftId] = useState(''); // Store NFT ID
    const [isListed, setIsListed] = useState(false); // Store listing status

    // File management state
    const [existingImageUrls, setExistingImageUrls] = useState([]);
    const [newImageFiles, setNewImageFiles] = useState([]); // Stores new File objects for images
    const [existingDocumentUrls, setExistingDocumentUrls] = useState([]);
    const [newDocumentFiles, setNewDocumentFiles] = useState([]); // Stores new File objects for documents

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // --- Fetch Existing Property Data ---
    useEffect(() => {
        const fetchPropertyData = async () => {
            if (!productId) {
                setErrorMsg("Property ID is missing from URL.");
                setIsLoading(false);
                return;
            }
             // Basic check for placeholder address
             if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
                 setErrorMsg("Contract address needs to be updated in the source code.");
                 setIsLoading(false);
                 return;
             }

            setIsLoading(true);
            setErrorMsg('');
            setSuccessMsg(''); // Clear previous messages

            try {
                const contract = await loadContract();
                 if (!contract) {
                    // Error is thrown and caught below if loadContract fails
                    throw new Error("Could not initialize contract interaction.");
                 }


                // Fetch all properties - Novaland_F1 returns array of Property structs
                const allProperties = await contract.FetchProperties();

                // Find the specific property by productId (which is uint256)
                // Ethers v5/v6 returns structs with named properties and array indices
                const propertyData = allProperties.find(p => p && p.productID && p.productID.toString() === productId);

                if (!propertyData) {
                    throw new Error(`Property with ID ${productId} not found on the blockchain.`);
                }

                 // --- Check Ownership ---
                 const owner = propertyData.owner;
                 setOriginalOwner(owner);
                 if (!address || owner.toLowerCase() !== address.toLowerCase()) {
                     setErrorMsg("Access Denied: You are not the current owner of this property and cannot edit it.");
                     setIsLoading(false);
                     return; // Stop further processing
                 }

                 console.log("Fetched Property Data:", propertyData);

                // --- Parse and set state using named properties from the struct ---
                const location = Array.isArray(propertyData.location) ? propertyData.location : [];

                setFormData({
                    propertyTitle: propertyData.propertyTitle || '',
                    category: propertyData.category || 'Apartment', // Fallback default
                    country: location[0] || '',
                    state: location[1] || '',
                    city: location[2] || '',
                    pinCode: location[3] || '',
                    description: propertyData.description || '',
                });

                // Set non-editable fields
                setPropertyPrice(propertyData.price ? ethers.utils.formatEther(propertyData.price) : '0'); // Format price from Wei
                setPropertyNftId(propertyData.nftId || 'N/A');
                setIsListed(propertyData.isListed || false);

                // Set file URLs
                setExistingImageUrls(Array.isArray(propertyData.images) ? propertyData.images : []);
                setExistingDocumentUrls(Array.isArray(propertyData.documents) ? propertyData.documents : []);

            } catch (error) {
                console.error("Error fetching property data:", error);
                 setErrorMsg(`Failed to load property details: ${error.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        // Fetch data only if address is available (wallet connected)
        if (address) {
            fetchPropertyData();
        } else {
             setErrorMsg("Please connect your wallet to load property data.");
             setIsLoading(false);
        }

    }, [productId, address]); // Refetch if productId or connected address changes


    // --- Input Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- File Handling ---
    // handleFileChange, removeExistingImage, removeNewImage, etc. remain the same
    // Make sure the limits match UI text (Images: Max 6, Documents: Max 5)
    const handleFileChange = (e) => {
        const { name, files } = e.target;
        const fileList = Array.from(files);

        if (name === 'newImages') {
            const combined = [...newImageFiles, ...fileList];
            if (existingImageUrls.length + combined.length > 6) {
                alert("Maximum 6 images allowed (including existing and new).");
                setNewImageFiles(combined.slice(0, 6 - existingImageUrls.length));
            } else {
                setNewImageFiles(combined);
            }
        } else if (name === 'newDocuments') {
            const combined = [...newDocumentFiles, ...fileList];
             if (existingDocumentUrls.length + combined.length > 5) { // Frontend limit
                 alert("Maximum 5 documents allowed (including existing and new).");
                 setNewDocumentFiles(combined.slice(0, 5 - existingDocumentUrls.length));
             } else {
                setNewDocumentFiles(combined);
             }
        }
        e.target.value = null; // Allow re-selecting same file
    };

    const removeExistingImage = (urlToRemove) => setExistingImageUrls(prev => prev.filter(url => url !== urlToRemove));
    const removeNewImage = (indexToRemove) => setNewImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    const removeExistingDocument = (urlToRemove) => setExistingDocumentUrls(prev => prev.filter(url => url !== urlToRemove));
    const removeNewDocument = (indexToRemove) => setNewDocumentFiles(prev => prev.filter((_, index) => index !== indexToRemove));


    // --- Form Submission ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!address) {
            setErrorMsg("Wallet not connected. Cannot submit update.");
            return;
        }
         if (originalOwner.toLowerCase() !== address.toLowerCase()) {
             setErrorMsg("Verification Failed: You are no longer the owner of this property.");
             return;
         }
         if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
              setErrorMsg("Contract address needs to be updated before submitting.");
              return;
         }
         if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
            setErrorMsg("Pinata API Keys not configured. Cannot upload files.");
            return;
         }

        // Validation
        const totalImageCount = existingImageUrls.length + newImageFiles.length;
        if (totalImageCount === 0) {
            setErrorMsg("At least one image is required.");
            return;
        }
         if (totalImageCount > 6) { // Re-check just in case
             setErrorMsg("Cannot exceed 6 images in total.");
             return;
         }
         if (!formData.country || !formData.state || !formData.city || !formData.pinCode) {
             setErrorMsg("Please fill in all location details (Country, State, City, Pin Code).");
             return;
         }
          if (!formData.propertyTitle.trim()) {
             setErrorMsg("Property Title cannot be empty.");
             return;
         }


        setIsSubmitting(true);
        setSuccessMsg("Preparing update...");

        try {
            // 1. Upload NEW files to Pinata
            setSuccessMsg("Uploading new files to IPFS via Pinata...");
            const newImageUploadPromises = newImageFiles.map(file => uploadFileToPinata(file, 'Image'));
            const newDocumentUploadPromises = newDocumentFiles.map(file => uploadFileToPinata(file, 'Document'));

            const newImageUrls = await Promise.all(newImageUploadPromises);
            const newDocumentUrls = await Promise.all(newDocumentUploadPromises);
            setSuccessMsg("File uploads complete. Combining data...");

            // 2. Combine URLs: existing (kept) + new
            const finalImageUrls = [...existingImageUrls, ...newImageUrls];
            const finalDocumentUrls = [...existingDocumentUrls, ...newDocumentUrls];

            // 3. Construct location array
            const locationArray = [
                formData.country.trim(),
                formData.state.trim(),
                formData.city.trim(),
                formData.pinCode.trim()
            ];

            // 4. Call Smart Contract's UpdateProperty function
            setSuccessMsg("Connecting to the smart contract...");
            const contract = await loadContract();
            if (!contract) throw new Error("Could not load contract for update.");

            const numericProductId = ethers.BigNumber.from(productId); // Ensure ID is BigNumber

            setSuccessMsg("Sending update transaction to the blockchain...");
             console.log("Calling Novaland_F1.UpdateProperty with:", {
                 owner: address, // Current owner (msg.sender checked by contract too)
                 productId: numericProductId.toString(),
                 _propertyTitle: formData.propertyTitle.trim(),
                 _category: formData.category,
                 _images: finalImageUrls,
                 _location: locationArray,
                 _documents: finalDocumentUrls,
                 _description: formData.description.trim(),
             });

            const transaction = await contract.UpdateProperty(
                address, // owner (param required by function)
                numericProductId, // productId (uint256)
                formData.propertyTitle.trim(), // _propertyTitle (string)
                formData.category, // _category (string)
                finalImageUrls, // _images (string[])
                locationArray, // _location (string[])
                finalDocumentUrls, // _documents (string[])
                formData.description.trim(), // _description (string)
                 { gasLimit: 4500000 } // Estimate gas; updating arrays can be costly. Adjust if needed.
            );

             setSuccessMsg("Transaction sent. Waiting for confirmation (this may take a moment)...");
            const receipt = await transaction.wait();
             console.log("Transaction successful:", receipt);

            setSuccessMsg(`Property updated successfully! Transaction Hash: ${receipt.transactionHash}. The property is now marked as listed.`);
             // Update local state to reflect changes (optional but good UX)
             setIsListed(true); // Contract sets it to true on update
             setNewImageFiles([]); // Clear the new file inputs
             setNewDocumentFiles([]);

            // Optionally navigate back after a delay
            setTimeout(() => navigate('/dashboard'), 3000);

        } catch (error) {
            console.error("Error updating property:", error);
            let userMessage = `Update failed: ${error.message}`;
             // Attempt to extract revert reason
             if (error.reason) { // Ethers v5+ often includes reason
                 userMessage = `Transaction failed: ${error.reason}`;
             } else if (error.data?.message) { // Check deeper for message
                let revertReason = error.data.message;
                if (revertReason.includes("execution reverted: ")) {
                    revertReason = revertReason.split("execution reverted: ")[1];
                } else if (revertReason.includes("reverted with reason string '")) {
                     revertReason = revertReason.split("reverted with reason string '")[1].slice(0,-1); // Extract message
                 }
                 userMessage = `Transaction failed: ${revertReason}`;
             } else if (error.code === 'ACTION_REJECTED') {
                 userMessage = "Transaction rejected in wallet.";
             } else if (error.message.includes("Pinata")) {
                 userMessage = `File upload error: ${error.message}`;
             } else if (error.message.includes("Invalid Contract Address") || error.message.includes("placeholder")) {
                 userMessage = error.message; // Show specific address error
             }
            setErrorMsg(userMessage);
            setSuccessMsg(''); // Clear any temporary success message
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Render Logic ---
    if (isLoading) return <div className="text-center p-10 text-gray-600">Loading property data... Please wait.</div>;

    // Show error prominently if loading failed or not owner and not submitting
    if (!isLoading && errorMsg && !isSubmitting && (!originalOwner || originalOwner.toLowerCase() !== address?.toLowerCase())) {
         return (
            <div className="max-w-2xl mx-auto p-6 mt-10 bg-red-50 border border-red-300 rounded-lg shadow-md text-center">
                <h2 className="text-xl font-semibold text-red-700 mb-4">Error Loading Property</h2>
                <p className="text-red-600 mb-4">{errorMsg}</p>
                 {!address && <p className="text-sm text-gray-600 mb-4">Please ensure your wallet is connected.</p>}
                 {address && originalOwner && originalOwner.toLowerCase() !== address.toLowerCase() &&
                     <p className="text-sm text-gray-600 mb-4">Only the owner ({originalOwner}) can edit this property.</p>
                 }
                <button onClick={() => navigate('/dashboard')} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors">
                    Back to Dashboard
                </button>
            </div>
        );
    }

    // Main form render
    return (
         <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-2xl border border-gray-200">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">
                    Update Property Details
                </h2>
                 <p className="text-center text-gray-500 mb-8 text-sm">Property ID: {productId}</p>

                {/* Display Non-Editable Info */}
                <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                     <div>
                         <span className="font-medium text-gray-600 block">Current Owner:</span>
                         <span className="text-indigo-800 break-words" title={originalOwner}>{originalOwner ? `${originalOwner.substring(0, 6)}...${originalOwner.substring(originalOwner.length - 4)}` : 'N/A'}</span>
                     </div>
                    <div>
                        <span className="font-medium text-gray-600 block">Registered Price:</span>
                        <span className="text-indigo-800 font-semibold">{propertyPrice} ETH</span>
                    </div>
                     <div>
                         <span className="font-medium text-gray-600 block">Unique NFT ID:</span>
                         <span className="text-indigo-800 break-all" title={propertyNftId}>{propertyNftId}</span>
                     </div>
                     <div className="md:col-span-3">
                        <span className="font-medium text-gray-600 block">Listing Status:</span>
                         <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${isListed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                             {isListed ? 'Currently Listed' : 'Currently Delisted / Not For Sale'}
                         </span>
                         <p className="text-xs text-gray-500 mt-1 italic">
                            <FiInfo className="inline mr-1" /> Price and NFT ID cannot be changed here. Updating details will automatically re-list the property if it was delisted.
                        </p>
                     </div>
                </div>


                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                             <label htmlFor="propertyTitle" className="block text-sm font-medium text-gray-700 mb-1">Property Title <span className="text-red-500">*</span></label>
                             <input type="text" name="propertyTitle" id="propertyTitle" value={formData.propertyTitle} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                         </div>
                         <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Property Type <span className="text-red-500">*</span></label>
                             <select name="category" id="category" value={formData.category} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                                 <option value="Apartment">Apartment</option>
                                 <option value="House">House</option>
                                 <option value="Land">Land</option>
                                 <option value="Commercial">Commercial</option>
                             </select>
                         </div>
                    </div>

                     {/* Location Section */}
                    <fieldset className="border border-gray-300 p-4 rounded-md shadow-sm">
                        <legend className="text-lg font-medium text-gray-800 px-2">Location Details <span className="text-red-500">*</span></legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-4">
                             <div><label htmlFor="country" className="block text-xs font-medium text-gray-600">Country:</label><input type="text" name="country" id="country" value={formData.country} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                             <div><label htmlFor="state" className="block text-xs font-medium text-gray-600">State/Province:</label><input type="text" name="state" id="state" value={formData.state} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                             <div><label htmlFor="city" className="block text-xs font-medium text-gray-600">City/Town:</label><input type="text" name="city" id="city" value={formData.city} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                             <div><label htmlFor="pinCode" className="block text-xs font-medium text-gray-600">Pin Code:</label><input type="text" name="pinCode" id="pinCode" value={formData.pinCode} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                         </div>
                    </fieldset>

                     {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows="4" placeholder="Provide a detailed description of the property..." className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                    </div>

                     {/* --- Image Management --- */}
                     <div className="space-y-4 border p-4 rounded-md border-gray-200 bg-gray-50 shadow-sm">
                         <h3 className="text-lg font-medium text-gray-700">Manage Images (Max 6 total) <span className="text-red-500">*</span></h3>
                         {/* Existing Images */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Current Images:</label>
                            {existingImageUrls.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {existingImageUrls.map((url, index) => (
                                        <div key={`existing-img-${index}`} className="relative w-24 h-24 border rounded overflow-hidden group shadow-sm">
                                             <img src={url} alt={`Existing ${index + 1}`} className="w-full h-full object-cover"/>
                                             <button type="button" onClick={() => removeExistingImage(url)} title="Remove Image" className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1">
                                                 <FiX size={10}/>
                                             </button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-gray-500 italic">No existing images.</p>}
                        </div>
                         {/* Add New Images */}
                         <div>
                             <label htmlFor="newImages" className="block text-sm font-medium text-gray-600">Add New Images:</label>
                             <input type="file" name="newImages" id="newImages" multiple accept="image/jpeg, image/png, image/gif, image/webp" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" disabled={(existingImageUrls.length + newImageFiles.length) >= 6}/>
                             {(existingImageUrls.length + newImageFiles.length) >= 6 && <p className="text-xs text-yellow-600 mt-1">Maximum number of images reached.</p>}
                             {/* Preview New Images */}
                             {newImageFiles.length > 0 && (
                                 <div className="mt-3 flex flex-wrap gap-3">
                                     {newImageFiles.map((file, index) => (
                                        <div key={`new-img-${index}`} className="relative w-24 h-24 border rounded overflow-hidden group shadow-sm">
                                             <img src={URL.createObjectURL(file)} alt={`New ${index + 1}`} className="w-full h-full object-cover" onLoad={e => URL.revokeObjectURL(e.target.src)}/>
                                             <button type="button" onClick={() => removeNewImage(index)} title="Remove Image" className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1">
                                                  <FiX size={10}/>
                                             </button>
                                        </div>
                                    ))}
                                 </div>
                             )}
                         </div>
                         {(existingImageUrls.length + newImageFiles.length === 0) && <p className="text-xs text-red-500 mt-1">Please add at least one image.</p>}
                    </div>


                    {/* --- Document Management --- */}
                     <div className="space-y-4 border p-4 rounded-md border-gray-200 bg-gray-50 shadow-sm">
                         <h3 className="text-lg font-medium text-gray-700">Manage Documents (Max 5 total)</h3>
                          {/* Existing Documents */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Current Documents:</label>
                             {existingDocumentUrls.length > 0 ? (
                                <ul className="list-none space-y-2 text-sm">
                                    {existingDocumentUrls.map((url, index) => (
                                        <li key={`existing-doc-${index}`} className="flex justify-between items-center group bg-white p-2 border rounded shadow-sm">
                                             <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate mr-2 flex-grow" title={url}>
                                                {/* Extract filename or use index */}
                                                {`Document ${index + 1} (${url.substring(url.lastIndexOf('/') + 1).substring(0,20)}...)`}
                                            </a>
                                             <button type="button" onClick={() => removeExistingDocument(url)} title="Remove Document" className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                                                  <FiX size={14}/>
                                             </button>
                                        </li>
                                    ))}
                                </ul>
                             ) : <p className="text-xs text-gray-500 italic">No existing documents.</p>}
                        </div>
                         {/* Add New Documents */}
                         <div>
                             <label htmlFor="newDocuments" className="block text-sm font-medium text-gray-600">Add New Documents:</label>
                             <input type="file" name="newDocuments" id="newDocuments" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300 cursor-pointer" disabled={(existingDocumentUrls.length + newDocumentFiles.length) >= 5}/>
                              {(existingDocumentUrls.length + newDocumentFiles.length) >= 5 && <p className="text-xs text-yellow-600 mt-1">Maximum number of documents reached.</p>}
                             {/* List New Documents */}
                             {newDocumentFiles.length > 0 && (
                                 <ul className="mt-3 list-none space-y-2 text-sm">
                                     {newDocumentFiles.map((file, index) => (
                                        <li key={`new-doc-${index}`} className="flex justify-between items-center group bg-white p-2 border rounded shadow-sm">
                                             <span className="text-gray-700 truncate mr-2 flex-grow" title={file.name}>{file.name}</span>
                                             <button type="button" onClick={() => removeNewDocument(index)} title="Remove Document" className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                                                  <FiX size={14}/>
                                             </button>
                                        </li>
                                    ))}
                                 </ul>
                             )}
                         </div>
                    </div>


                    {/* Submission Area */}
                    <div className="pt-6 border-t border-gray-200">
                        {/* Status Messages */}
                         {errorMsg && <p className="text-sm text-red-600 mb-4 p-3 bg-red-50 border border-red-200 rounded text-center">{errorMsg}</p>}
                         {successMsg && <p className="text-sm text-green-600 mb-4 p-3 bg-green-50 border border-green-200 rounded text-center">{successMsg}</p>}

                         <div className="flex flex-col sm:flex-row justify-end items-center space-y-3 sm:space-y-0 sm:space-x-4">
                             <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="w-full sm:w-auto bg-gray-200 text-gray-800 py-2 px-5 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-60"
                                disabled={isSubmitting}
                             >
                                Cancel
                             </button>
                             <button
                                type="submit"
                                className="w-full sm:w-auto bg-indigo-600 text-white py-2 px-8 rounded-md shadow-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                                disabled={isSubmitting || !address || (originalOwner && originalOwner.toLowerCase() !== address.toLowerCase()) || contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS" }
                              >
                                 {isSubmitting ? (
                                     <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Updating...
                                    </>
                                 ) : 'Update Property'}
                            </button>
                        </div>
                         {/* Disable reason hint */}
                         {(!address || (originalOwner && originalOwner.toLowerCase() !== address.toLowerCase())) &&
                           <p className="text-xs text-yellow-700 text-right mt-2">Update disabled: Wallet not connected or you are not the owner.</p>
                         }
                         {contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS" &&
                            <p className="text-xs text-red-600 text-right mt-2">Update disabled: Contract address needs to be set in the code.</p>
                         }
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UpdatePropertyForm;