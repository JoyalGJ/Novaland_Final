import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import axios from 'axios'; // Needed for Pinata uploads
import { useAddress } from '@thirdweb-dev/react';
import { FiX, FiLoader, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi'; // Icons

// --- REPLACE with your Deployed Novaland_F1 Contract Address & ABI ---
import contractABI from "./../../contractABI2.json"; // <--- MAKE SURE this is the ABI for Novaland_F1
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <--- *** REPLACE THIS ***

// --- Pinata Configuration ---
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY;
const PINATA_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";
// --- Helper: Upload single file to Pinata (Same as in UpdatePropertyForm) ---
const uploadFileToPinata = async (file, fileType = 'File') => {
    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
        throw new Error("Pinata API Key or Secret is missing. Cannot upload.");
    }
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    let data = new FormData();
    data.append('file', file);
    const metadata = JSON.stringify({ name: `PropertyUpdate_${fileType}_${file.name}_${Date.now()}` });
    data.append('pinataMetadata', metadata);
    const pinataOptions = JSON.stringify({ cidVersion: 1 });
    data.append('pinataOptions', pinataOptions);

    try {
        const response = await axios.post(url, data, {
            maxBodyLength: 'Infinity',
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_API_KEY
            }
        });
        console.log(`Pinata Update ${fileType} upload response:`, response.data);
        if (response.data.IpfsHash) {
            return `${PINATA_GATEWAY_URL}${response.data.IpfsHash}`;
        } else {
            throw new Error(`Failed to get IPFS hash from Pinata response for ${file.name}.`);
        }
    } catch (error) {
        console.error(`Error uploading Update ${fileType} to Pinata:`, error.response ? error.response.data : error);
        const errorMsg = error.response?.data?.error || error.message || `Unknown Pinata upload error for ${file.name}.`;
        throw new Error(`Pinata Update ${fileType} upload failed: ${errorMsg}`);
    }
};


// --- Load Contract Function (Needs Signer for Update) ---
async function loadContractWithSigner() {
    if (!window.ethereum) {
        throw new Error("MetaMask or compatible wallet not found.");
    }
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []); // Ensure connection
        const signer = provider.getSigner();
        if (!signer || !await signer.getAddress()) {
            throw new Error("Signer not available. Please ensure your wallet is connected and unlocked.");
        }

         // Basic check for placeholder address
         if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
             throw new Error("Contract address needs to be updated in the source code.");
         }
         // Verify address is valid format
         if (!ethers.utils.isAddress(contractAddress)) {
              throw new Error(`Invalid Contract Address format: ${contractAddress}`);
         }
        // Ensure ABI is loaded correctly
        if (!contractABI || contractABI.length === 0) {
             throw new Error("Contract ABI is missing or empty. Check contractABI_F1.json import.");
        }

        const contract = new ethers.Contract(contractAddress, contractABI, signer);
        await contract.propertyIndex(); // Simple read test to verify connection and ABI match
        return contract;

    } catch (error) {
        console.error("EditProperty: Error loading contract with signer:", error);
        // Make error messages more user-friendly
        if (error.message.includes("Contract address needs") || error.message.includes("Invalid Contract Address") || error.message.includes("Contract ABI is missing")) {
            throw new Error(`Configuration Error: ${error.message}`);
        }
        throw new Error(`Failed to load contract: ${error.message}`);
    }
}

// --- Fetch Property Details (Using FetchProperties Filter) ---
async function getPropertyDetails(productId) {
     // Use a read-only provider initially if possible, or just load with signer right away
     // For simplicity here, we load with signer, but could optimize later
     const contract = await loadContractWithSigner(); // Load with signer to get owner later too

     try {
         console.log("EditProperty: Fetching all properties to find ID:", productId);
         const allProps = await contract.FetchProperties();
         const foundProp = allProps.find(p => p.productID.toString() === productId); // Use named property

         if (!foundProp) {
             throw new Error(`Property with ID ${productId} not found.`);
         }
         console.log("EditProperty: Found property raw data:", foundProp);
         return foundProp; // Return the raw struct data (ethers v5+ returns object with named props & indices)

     } catch (e) {
         console.error("Error fetching and filtering property:", e);
         // Rethrow specific errors if needed
         if (e.message.includes("Property with ID")) throw e;
         throw new Error(`Could not retrieve details for property ${productId}. ${e.message}`);
     }
}


function EditProperty() {
    const { productId } = useParams();
    const address = useAddress();
    const navigate = useNavigate();

    // State for editable form fields
    const [formData, setFormData] = useState({
        propertyTitle: '',
        category: 'Apartment',
        description: '',
        // Location fields
        country: '',
        state: '',
        city: '',
        pinCode: '',
    });

    // State for file management
    const [existingImageUrls, setExistingImageUrls] = useState([]);
    const [newImageFiles, setNewImageFiles] = useState([]);
    const [existingDocumentUrls, setExistingDocumentUrls] = useState([]);
    const [newDocumentFiles, setNewDocumentFiles] = useState([]);

    // State for non-editable fetched data
    const [originalOwner, setOriginalOwner] = useState('');
    const [propertyPrice, setPropertyPrice] = useState(''); // Display only
    const [propertyNftId, setPropertyNftId] = useState(''); // Display only

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Fetch property data on component mount or when dependencies change
    const fetchPropertyData = useCallback(async () => {
        if (!productId) {
            setError("Property ID missing from URL.");
            setIsLoading(false);
            return;
        }
        if (!address) {
             setError("Please connect your wallet.");
             setIsLoading(false);
             return; // Don't fetch if wallet isn't connected
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const propData = await getPropertyDetails(productId); // Fetches raw struct

            // --- Verify Ownership ---
            const owner = propData.owner;
            setOriginalOwner(owner);
            if (owner.toLowerCase() !== address.toLowerCase()) {
                 throw new Error("Access Denied: You are not the owner of this property.");
            }

            // --- Populate Form State ---
            // Editable fields
            const location = Array.isArray(propData.location) ? propData.location : [];
            setFormData({
                propertyTitle: propData.propertyTitle || '',
                category: propData.category || 'Apartment',
                description: propData.description || '',
                country: location[0] || '',
                state: location[1] || '',
                city: location[2] || '',
                pinCode: location[3] || '',
            });

            // File Management State
            setExistingImageUrls(Array.isArray(propData.images) ? propData.images : []);
            setExistingDocumentUrls(Array.isArray(propData.documents) ? propData.documents : []);

            // Non-Editable State for Display
            setPropertyPrice(propData.price ? ethers.utils.formatEther(propData.price) : 'N/A');
            setPropertyNftId(propData.nftId || 'N/A');

        } catch (err) {
            console.error("Failed to fetch property data for editing:", err);
            setError(err.message || "Failed to load property data.");
            // Redirect if access denied
            if (err.message.includes("Access Denied")) {
                 setTimeout(() => navigate('/dashboard'), 3000);
            }
        } finally {
            setIsLoading(false);
        }
    }, [productId, address, navigate]); // Dependencies for fetching

    useEffect(() => {
        if (address) { // Only fetch if wallet is connected
           fetchPropertyData();
        } else {
            setIsLoading(false); // Don't show loading if wallet isn't connected
            setError("Please connect your wallet to edit properties.");
        }
    }, [fetchPropertyData, address]); // React to address changes as well

    // --- Input Handlers ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- File Handlers (Similar to UpdatePropertyForm) ---
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
             // Apply frontend limit (e.g., 5) even if contract doesn't enforce one
             if (existingDocumentUrls.length + combined.length > 5) {
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
        setError('');
        setSuccess('');

        if (!address || address.toLowerCase() !== originalOwner.toLowerCase()) {
            setError("Cannot submit: Wallet not connected or you are not the owner.");
            return;
        }
         if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
            setError("Pinata API Keys not configured. Cannot upload files.");
            return;
         }

        // Validation
        const totalImageCount = existingImageUrls.length + newImageFiles.length;
        if (totalImageCount === 0) {
            setError("At least one image is required.");
            return;
        }
         if (totalImageCount > 6) {
             setError("Cannot exceed 6 images in total.");
             return;
         }
        if (!formData.propertyTitle.trim() || !formData.category || !formData.country || !formData.state || !formData.city || !formData.pinCode) {
             setError("Please fill in Title, Category, and all Location details.");
             return;
         }

        setIsSubmitting(true);
        setSuccess("Preparing update...");

        try {
            // 1. Upload NEW files to Pinata
            setSuccess("Uploading new files...");
            const newImageUploadPromises = newImageFiles.map(file => uploadFileToPinata(file, 'Image'));
            const newDocumentUploadPromises = newDocumentFiles.map(file => uploadFileToPinata(file, 'Document'));

            const newImageUrls = await Promise.all(newImageUploadPromises);
            const newDocumentUrls = await Promise.all(newDocumentUploadPromises);
            setSuccess("File uploads complete.");

            // 2. Combine URLs: existing (kept) + new
            const finalImageUrls = [...existingImageUrls, ...newImageUrls];
            const finalDocumentUrls = [...existingDocumentUrls, ...newDocumentUrls];

            // 3. Construct location array
            const locationArray = [
                formData.country.trim(), formData.state.trim(), formData.city.trim(), formData.pinCode.trim()
            ];

            // 4. Call Smart Contract's UpdateProperty
            setSuccess("Connecting to contract...");
            const contract = await loadContractWithSigner();

            const numericProductId = ethers.BigNumber.from(productId);

            setSuccess("Sending update transaction...");
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

            // Arguments must match Novaland_F1.UpdateProperty signature
            const tx = await contract.UpdateProperty(
                address, // owner (address)
                numericProductId, // productId (uint256)
                formData.propertyTitle.trim(), // _propertyTitle (string)
                formData.category, // _category (string)
                finalImageUrls, // _images (string[])
                locationArray, // _location (string[])
                finalDocumentUrls, // _documents (string[])
                formData.description.trim(), // _description (string)
                { gasLimit: 4500000 } // Estimate gas, adjust as needed
            );

            setSuccess("Transaction sent! Waiting for confirmation...");
            const receipt = await tx.wait();
            console.log("Update transaction confirmed:", receipt);

            setSuccess(`Property updated successfully! Tx: ${receipt.transactionHash}. Redirecting...`);
             // Clear new file inputs after success
             setNewImageFiles([]);
             setNewDocumentFiles([]);
            setTimeout(() => navigate('/dashboard'), 3000); // Redirect after success

        } catch (err) {
            console.error("Update failed:", err);
            let message = "An error occurred during the update.";
             if (err.reason) { message = `Transaction failed: ${err.reason}`; }
             else if (err.code === 'ACTION_REJECTED') { message = "Transaction rejected in wallet."; }
             else if (err.data?.message) { message = `Transaction failed: ${err.data.message}`; }
             else if (err.message) { message = err.message; } // Includes Pinata/config errors

            setError(`Update Failed: ${message}`);
            setSuccess(''); // Clear success message on error
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Render Logic ---
    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><FiLoader className="w-10 h-10 animate-spin text-indigo-600" /> <span className="ml-3 text-lg text-gray-600">Loading property data...</span></div>;
    }

    // If not loading but error prevents form display (e.g., not owner, not found)
    if (!isLoading && error && (error.includes("Access Denied") || error.includes("not found") || error.includes("Please connect"))) {
       return (
            <div className="max-w-2xl mx-auto p-6 mt-10 bg-red-50 border border-red-300 rounded-lg shadow-md text-center">
                <FiAlertCircle className="text-red-600 w-12 h-12 mx-auto mb-4"/>
                <h2 className="text-xl font-semibold text-red-700 mb-2">Access Error</h2>
                <p className="text-red-600 mb-4">{error}</p>
                <button onClick={() => navigate('/dashboard')} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors">
                    Back to Dashboard
                </button>
            </div>
        );
    }

    // Render the form if loading is complete and no critical error occurred
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-100 to-indigo-50 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-2xl border border-gray-200">
                 <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">Edit Property Details</h1>
                 <p className="text-center text-gray-500 mb-6 text-sm">Property ID: {productId}</p>

                 {/* Display Non-Editable Info */}
                <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                     <div><span className="font-medium text-gray-600 block">Current Owner:</span><span className="text-indigo-800 break-words" title={originalOwner}>{originalOwner ? `${originalOwner.substring(0, 6)}...${originalOwner.substring(originalOwner.length - 4)}` : 'N/A'}</span></div>
                     <div><span className="font-medium text-gray-600 block">Registered Price:</span><span className="text-indigo-800 font-semibold">{propertyPrice} ETH</span></div>
                     <div><span className="font-medium text-gray-600 block">Unique NFT ID:</span><span className="text-indigo-800 break-all" title={propertyNftId}>{propertyNftId}</span></div>
                      <p className="text-xs text-gray-500 mt-1 italic md:col-span-3">
                            <FiInfo className="inline mr-1" /> Price and NFT ID cannot be changed.
                      </p>
                </div>

                 {/* Display transaction status messages */}
                 {error && !isSubmitting && <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded text-sm text-center">{error}</div>}
                 {success && !isSubmitting && <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-200 rounded text-sm text-center">{success}</div>}
                 {isSubmitting && <div className="mb-4 p-3 bg-blue-100 text-blue-700 border border-blue-200 rounded text-sm text-center flex justify-center items-center"><FiLoader className="animate-spin mr-2"/>{success || 'Processing...'}</div>}


                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* --- Basic Details --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="propertyTitle" className="block text-sm font-medium text-gray-700 mb-1">Property Title <span className="text-red-500">*</span></label>
                            <input type="text" id="propertyTitle" name="propertyTitle" value={formData.propertyTitle} onChange={handleInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                            <select id="category" name="category" value={formData.category} onChange={handleInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                                <option>Apartment</option>
                                <option>House</option>
                                <option>Land</option>
                                <option>Commercial</option>
                            </select>
                        </div>
                    </div>

                     {/* --- Location --- */}
                    <fieldset className="border border-gray-300 p-4 rounded-md shadow-sm">
                        <legend className="text-lg font-medium text-gray-800 px-2">Location Details <span className="text-red-500">*</span></legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-4">
                              <div><label htmlFor="country" className="block text-xs font-medium text-gray-600">Country:</label><input type="text" name="country" id="country" value={formData.country} onChange={handleInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                              <div><label htmlFor="state" className="block text-xs font-medium text-gray-600">State/Province:</label><input type="text" name="state" id="state" value={formData.state} onChange={handleInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                              <div><label htmlFor="city" className="block text-xs font-medium text-gray-600">City/Town:</label><input type="text" name="city" id="city" value={formData.city} onChange={handleInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                              <div><label htmlFor="pinCode" className="block text-xs font-medium text-gray-600">Pin Code:</label><input type="text" name="pinCode" id="pinCode" value={formData.pinCode} onChange={handleInputChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                        </div>
                    </fieldset>

                    {/* --- Description --- */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="4" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                    </div>

                    {/* --- Image Management --- */}
                     <div className="space-y-4 border p-4 rounded-md border-gray-200 bg-gray-50 shadow-sm">
                        <h3 className="text-lg font-medium text-gray-700">Manage Images (Max 6 total) <span className="text-red-500">*</span></h3>
                        {/* Existing Images */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Current Images:</label>
                            {existingImageUrls.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {existingImageUrls.map((url, index) => ( <div key={`existing-img-${index}`} className="relative w-24 h-24 border rounded overflow-hidden group shadow-sm"><img src={url} alt={`Existing ${index + 1}`} className="w-full h-full object-cover"/><button type="button" onClick={() => removeExistingImage(url)} title="Remove Image" className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"><FiX size={10}/></button></div> ))}
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
                                    {newImageFiles.map((file, index) => ( <div key={`new-img-${index}`} className="relative w-24 h-24 border rounded overflow-hidden group shadow-sm"><img src={URL.createObjectURL(file)} alt={`New ${index + 1}`} className="w-full h-full object-cover" onLoad={e => URL.revokeObjectURL(e.target.src)}/><button type="button" onClick={() => removeNewImage(index)} title="Remove Image" className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"><FiX size={10}/></button></div> ))}
                                </div>
                            )}
                        </div>
                        {(existingImageUrls.length + newImageFiles.length === 0) && <p className="text-xs text-red-500 mt-1">Please add or keep at least one image.</p>}
                    </div>


                    {/* --- Document Management --- */}
                     <div className="space-y-4 border p-4 rounded-md border-gray-200 bg-gray-50 shadow-sm">
                         <h3 className="text-lg font-medium text-gray-700">Manage Documents (Max 5 total)</h3>
                         {/* Existing Documents */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Current Documents:</label>
                            {existingDocumentUrls.length > 0 ? (
                                <ul className="list-none space-y-2 text-sm">
                                    {existingDocumentUrls.map((url, index) => ( <li key={`existing-doc-${index}`} className="flex justify-between items-center group bg-white p-2 border rounded shadow-sm"><a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate mr-2 flex-grow" title={url}>{`Document ${index + 1} (${url.substring(url.lastIndexOf('/') + 1).substring(0,20)}...)`}</a><button type="button" onClick={() => removeExistingDocument(url)} title="Remove Document" className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"><FiX size={14}/></button></li> ))}
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
                                    {newDocumentFiles.map((file, index) => ( <li key={`new-doc-${index}`} className="flex justify-between items-center group bg-white p-2 border rounded shadow-sm"><span className="text-gray-700 truncate mr-2 flex-grow" title={file.name}>{file.name}</span><button type="button" onClick={() => removeNewDocument(index)} title="Remove Document" className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"><FiX size={14}/></button></li> ))}
                                </ul>
                            )}
                        </div>
                    </div>


                    {/* --- Action Buttons --- */}
                    <div className="flex justify-end items-center pt-5 border-t border-gray-200 space-x-4">
                         <button
                             type="button"
                             onClick={() => navigate('/dashboard')} // Go back button
                             className="py-2 px-5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                             disabled={isSubmitting}
                         >
                             Cancel
                         </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !address || address.toLowerCase() !== originalOwner.toLowerCase()}
                            className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                        >
                             {isSubmitting && <FiLoader className="w-4 h-4 animate-spin mr-2"/>}
                            {isSubmitting ? 'Updating...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditProperty;