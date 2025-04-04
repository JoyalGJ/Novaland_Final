import React, { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useAddress } from "@thirdweb-dev/react"; // Relies on <ThirdwebProvider> being set up correctly with clientId
import axios from 'axios';
import { FiX, FiLoader, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';

// --- STEP 1: VERIFY ABI PATH AND CONTENT ---
// Ensure this JSON file contains the correct ABI for the Novaland_F1 contract
// deployed at the address specified below.
import contractABI from "./../../contractABI2.json"; // <-- VERIFY/UPDATE PATH & FILENAME

// --- STEP 2: REPLACE WITH YOUR DEPLOYED CONTRACT ADDRESS ---
const contractAddress = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <--- *** REPLACE THIS ***
// --- Pinata Configuration (Ensure .env variables are set) ---
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY;
const PINATA_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/"; // Or your preferred gateway

// --- Helper function to upload a single file to Pinata ---
const uploadFileToPinata = async (file, fileType = 'File') => {
  if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
    throw new Error("Pinata API Key or Secret is missing in .env file. Cannot upload.");
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
      maxBodyLength: 'Infinity', // Allow large file uploads
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY
        // Content-Type is automatically set by Axios for FormData
      }
    });
    const ipfsHash = response.data.IpfsHash; // Added ipfsHash variable for clarity
    console.log(`Pinata ${fileType} upload successful: ${ipfsHash}`); // Log success with hash
    if (ipfsHash) {
      return `${PINATA_GATEWAY_URL}${ipfsHash}`; // Return full gateway URL
    } else {
      throw new Error(`Failed to get IPFS hash from Pinata response for ${file.name}.`);
    }
  } catch (error) {
    console.error(`Error uploading ${fileType} ('${file.name}') to Pinata:`, error.response ? error.response.data : error);
    const errorMsg = error.response?.data?.error || error.message || `Unknown Pinata upload error.`;
    throw new Error(`Pinata ${fileType} upload failed: ${errorMsg}`);
  }
};


// --- Load Contract Function (Gets Signer) ---
async function loadContract() {
    if (!window.ethereum) {
        throw new Error("MetaMask or compatible wallet not found. Please install MetaMask.");
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    // Request account access if needed (MetaMask prompts user)
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress(); // Check if signer is valid
    if (!signer || !userAddress) {
        throw new Error("Could not get wallet signer. Ensure your wallet is connected and unlocked.");
    }

     // Check if the contract address is valid
     if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") { // Keep placeholder check
         throw new Error("Configuration Error: Contract address placeholder needs to be replaced in the code.");
     }
     if (!ethers.utils.isAddress(contractAddress)) {
          throw new Error(`Configuration Error: Invalid Contract Address format: ${contractAddress}`);
     }
    // Ensure ABI is valid
    if (!contractABI || contractABI.length === 0) {
         throw new Error("Configuration Error: Contract ABI is missing or empty. Check the import path and file content.");
    }

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, contractABI, signer);

     // Test read to verify connection (optional but recommended)
     try {
        await contract.propertyIndex(); // Assumes 'propertyIndex' exists in Novaland_F1
     } catch(readError) {
        console.error("Contract read test failed:", readError);
        throw new Error("Failed to interact with the contract. Check ABI, address, and network connection.");
     }

    console.log("Contract loaded successfully with signer.");
    return contract;
}

// --- The React Component ---
const PropertyForm = () => {
  // This hook relies on <ThirdwebProvider> being correctly configured with clientId
  const address = useAddress();
  // *** ADDED stringAddress and gmapLink to state ***
  const [formData, setFormData] = useState({
    propertyTitle: "",
    category: "Apartment", // Default value
    price: "", // Expecting ETH value as string (e.g., "1.5")
    country: "",
    state: "",
    city: "",
    pinCode: "",
    stringAddress: "", // Added
    gmapLink: "",      // Added
    description: "",
    images: [], // Stores File objects for new images to upload
    documents: [], // Stores File objects for new documents to upload
  });
  const [nftId, setNftId] = useState(""); // State for the auto-generated unique ID
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(""); // User feedback (e.g., "Uploading...", "Submitting...")
  const [submissionError, setSubmissionError] = useState(""); // Detailed error messages

  // --- NFT ID Generation (Unchanged from provided code) ---
  const generateNftId = useCallback(() => {
    if (!formData.propertyTitle || !formData.category || !formData.price || !address) {
      setNftId(""); // Clear ID if required fields are missing
      return null;
    }
    // Combine details for hashing. Adding address increases uniqueness.
    const combinedString = `${formData.propertyTitle}-${formData.category}-${formData.price}-${address}`;
    try {
        const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(combinedString));
        setNftId(hash);
        return hash;
    } catch (e) {
        console.error("Error generating NFT ID hash:", e);
        setNftId("");
        setSubmissionError("Failed to generate property ID."); // Show error to user
        return null;
    }
  }, [formData.propertyTitle, formData.category, formData.price, address]);

  // --- Handle Form Input Changes (Added Document Logging) ---
  const handleChange = (e) => {
    const { name, value, type, files } = e.target;

    setFormData(prev => {
        let updatedValue = value;
        if (type === "file") {
            const fileList = Array.from(files); // Convert FileList to array
            if (name === "images") {
                // Append new files and enforce limit (max 6 images as per contract)
                const currentImages = prev.images || [];
                const combined = [...currentImages, ...fileList];
                updatedValue = combined.slice(0, 6);
                if (combined.length > 6) {
                    alert("Maximum 6 images allowed."); // User feedback
                }
            } else if (name === "documents") {
                // Append new files and enforce frontend limit (e.g., max 5 documents)
                const currentDocs = prev.documents || [];
                const combined = [...currentDocs, ...fileList];
                updatedValue = combined.slice(0, 5); // Keep max 5 documents
                // *** ADDED LOG ***
                console.log(`handleChange: Added ${fileList.length} documents. New 'documents' array to be set:`, updatedValue.map(f => f.name));
                 if (combined.length > 5) {
                    alert("Maximum 5 documents allowed."); // User feedback
                }
            }
        }
        // Update the corresponding field in formData state
        return { ...prev, [name]: updatedValue };
    });

     // IMPORTANT: Reset file input value after handling files.
     // This allows selecting the same file again if it was removed.
     if (type === "file") {
        e.target.value = null;
     }
  };

  // --- Auto-generate NFT ID when relevant form fields change (Unchanged from provided) ---
  useEffect(() => {
    // Debounce generation to avoid excessive hashing while user types
    const handler = setTimeout(() => {
      generateNftId();
    }, 300); // 300ms delay
    return () => clearTimeout(handler); // Cleanup timeout on unmount or when dependencies change
  }, [generateNftId]); // Re-run effect if generateNftId function changes (due to its dependencies changing)


  // --- Handle Form Submission (Incorporated new fields and logging) ---
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmissionStatus(""); // Clear previous messages
    setSubmissionError("");

    // --- Pre-submission Checks (Includes stringAddress check via isFormReady) ---
    if (!address) { setSubmissionError("Please connect your wallet first!"); return; }
    if (!isFormReady()) { setSubmissionError("Please fill in all required (*) fields and upload at least one image."); return; } // isFormReady checks stringAddress
    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) { setSubmissionError("File Upload Error: Pinata API Keys are not configured."); return; }
    if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") { setSubmissionError("Configuration Error: Contract address needs update."); return; }

    setIsSubmitting(true);
    setSubmissionStatus("Preparing submission...");

    // 1. Ensure NFT ID is generated (Keep as provided)
    let currentNftId = nftId;
    if (!currentNftId) { setSubmissionStatus("Generating unique property identifier..."); currentNftId = generateNftId(); if (!currentNftId) { if (!submissionError) setSubmissionError("Could not generate required unique Property ID."); setIsSubmitting(false); setSubmissionStatus(""); return; } }

    // *** UPDATED locationArray ***
    const locationArray = [
        formData.country.trim(), formData.state.trim(), formData.city.trim(), formData.pinCode.trim(),
        formData.stringAddress.trim(), // Added String Address
        formData.gmapLink.trim()       // Added GMap Link (send empty string if blank)
    ];

    let imageUrls = []; let documentUrls = [];

    try {
      // 2. Upload Images and Documents to Pinata (Keep logging from previous step)
      const imagesToUpload = formData.images || [];
      const documentsToUpload = formData.documents || [];
      const totalFiles = imagesToUpload.length + documentsToUpload.length;

      console.log(`handleSubmit: State check - Images: ${imagesToUpload.length}, Documents: ${documentsToUpload.length} (Names: ${documentsToUpload.map(d=>d.name).join(', ')})`); // LOG

      if (totalFiles > 0) {
          setSubmissionStatus(`Uploading ${totalFiles} file(s) via Pinata...`);
          console.log("handleSubmit: Starting Pinata uploads..."); // LOG

          const imageUploadPromises = imagesToUpload.map(file => uploadFileToPinata(file, 'Image').catch(err => { console.error(`Img upload fail: ${file.name}`, err); return { error: true, type: 'Image', fileName: file.name, message: err.message }; }));
          const documentUploadPromises = documentsToUpload.map(file => uploadFileToPinata(file, 'Document').catch(err => { console.error(`Doc upload fail: ${file.name}`, err); return { error: true, type: 'Document', fileName: file.name, message: err.message }; }));

          console.log(`handleSubmit: Waiting for ${imageUploadPromises.length} image and ${documentUploadPromises.length} document promises...`); // LOG
          const allUploadPromises = [...imageUploadPromises, ...documentUploadPromises];
          const results = await Promise.all(allUploadPromises);
          console.log("handleSubmit: All Pinata uploads settled. Results:", results); // LOG

          const failedUploads = results.filter(result => result && result.error);
          if (failedUploads.length > 0) { const errorMessages = failedUploads.map(f => `${f.type} '${f.fileName}': ${f.message}`).join("; "); throw new Error(`Failed to upload files: ${errorMessages}`); }

          imageUrls = results.slice(0, imagesToUpload.length).filter(url => typeof url === 'string');
          documentUrls = results.slice(imagesToUpload.length).filter(url => typeof url === 'string');
           if (imageUrls.length !== imagesToUpload.length || documentUrls.length !== documentsToUpload.length) { console.error("Mismatch in uploaded file URLs", { expectedImages: imagesToUpload.length, gotImages: imageUrls.length, expectedDocs: documentsToUpload.length, gotDocs: documentUrls.length }); throw new Error("File upload issue."); }
          console.log(`handleSubmit: Pinata uploads OK. Img URLs: ${imageUrls.length}, Doc URLs: ${documentUrls.length}`); // LOG
      } else { console.log("handleSubmit: No files selected for upload."); } // LOG


      // 3. Interact with Smart Contract (Passes updated locationArray)
      setSubmissionStatus("Connecting to smart contract...");
      const contract = await loadContract();
      let priceInWei;
      try { priceInWei = ethers.utils.parseUnits(formData.price.toString(), 'ether'); if (priceInWei.lte(0)) { throw new Error("Price must be positive."); } }
      catch (parseError) { throw new Error(`Invalid price format: '${formData.price}'.`); }

      setSubmissionStatus("Sending transaction to blockchain...");
      console.log("Calling contract.AddProperty with location:", locationArray); // LOG
      const transaction = await contract.AddProperty(
        address, priceInWei, formData.propertyTitle.trim(), formData.category, imageUrls,
        locationArray, // Pass updated array
        documentUrls, formData.description.trim(), currentNftId, { gasLimit: 4000000 }
      );

      setSubmissionStatus("Waiting for transaction confirmation..."); console.log("Tx Hash:", transaction.hash);
      const receipt = await transaction.wait(); console.log("Tx Receipt:", receipt);
      setSubmissionStatus("Property listed successfully!"); setSubmissionError("");
      alert(`Success! Tx Hash: ${receipt.transactionHash}`);

      // --- UPDATED Form Reset ---
      setFormData({
        propertyTitle: "", category: "Apartment", price: "", country: "", state: "",
        city: "", pinCode: "", stringAddress: "", gmapLink: "", // Clear new fields
        description: "", images: [], documents: [],
      });
      setNftId("");

    } catch (error) {
      // Error Handling (Keep as provided, including log)
      console.error("handleSubmit Error Caught:", error); // LOG
      let userMessage = error.message || 'Unexpected error.';
      if (error.message?.includes("Pinata") || error.message?.includes("File Upload Error")) { userMessage = error.message; }
      else if (error.message?.includes("Invalid price format") || error.message?.includes("Price must be")) { userMessage = error.message; }
      else if (error.code === 'ACTION_REJECTED' || error.code === 4001) { userMessage = "Transaction rejected."; }
      else if (error.reason) { userMessage = `Tx Failed: ${error.reason}`; if (error.reason.includes("NFT ID already exists")) { userMessage = "Tx Failed: Property ID exists."; } else if (error.reason.includes("maximum of 6 images")) { userMessage = "Tx Failed: Max 6 images."; } }
      else if (error.data?.message) { let nestedMsg = error.data.message; if (nestedMsg.includes("execution reverted")) { nestedMsg = nestedMsg.split("reverted: ")[1] || nestedMsg; } userMessage = `Tx Failed: ${nestedMsg}`; if(nestedMsg.includes("NFT ID already exists")) { userMessage = "Tx Failed: Property ID exists."; } }
      else if (error.message?.includes("Configuration Error")) { userMessage = error.message; }
      else if (error.message?.includes("wallet not found")) { userMessage = "Wallet not found."; }
      else if (error.code === 'CALL_EXCEPTION') { userMessage = "Contract call fail."; }
      setSubmissionError(userMessage); setSubmissionStatus("Submission failed.");
    } finally {
      setIsSubmitting(false);
       if (!submissionError) { setTimeout(() => setSubmissionStatus(""), 6000); }
    }
  }, [address, formData, nftId, generateNftId, submissionError]); // Removed isFormReady from deps


  // --- Function to remove an image ---
  const removeImage = (indexToRemove) => {
      setFormData(prev => ({ ...prev, images: prev.images.filter((_, index) => index !== indexToRemove) }));
  };

  // --- Function to remove a document (Added Logging) ---
    const removeDocument = (indexToRemove) => {
        console.log(`removeDocument: Removing document at index ${indexToRemove}`); // *** ADDED LOG ***
        setFormData(prev => {
            const updatedDocs = prev.documents.filter((_, index) => index !== indexToRemove);
            console.log(`removeDocument: New documents array:`, updatedDocs.map(d=>d.name)); // *** ADDED LOG ***
            return { ...prev, documents: updatedDocs };
        });
    };

  // --- Helper to check if form is ready (Includes stringAddress) ---
  const isFormReady = useCallback(() => {
      return !!( address && formData.propertyTitle.trim() && formData.category && formData.price && formData.country.trim() && formData.state.trim() && formData.city.trim() && formData.pinCode.trim() &&
          formData.stringAddress.trim() && // Added check
          formData.images.length > 0 && formData.images.length <= 6 && nftId );
  }, [address, formData, nftId]);


  // --- JSX Rendering (Added UI fields) ---
  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-gray-100 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
       {/* Configuration Warnings (Keep as provided) */}
       {(!PINATA_API_KEY || !PINATA_SECRET_API_KEY) && (<div className="w-full max-w-3xl mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm flex items-center shadow-sm"><FiAlertTriangle className="mr-2 flex-shrink-0"/> <strong>Config Warning:</strong> Pinata API keys missing. File uploads will fail.</div>)}
       {contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS" && (<div className="w-full max-w-3xl mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm flex items-center shadow-sm"><FiAlertTriangle className="mr-2 flex-shrink-0"/> <strong>Config Warning:</strong> Update contract address.</div>)}

      {/* Form Container */}
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-xl p-8 space-y-6 border border-gray-200">
        <h2 className="text-3xl font-extrabold text-center text-gray-900">List Your Property on Novaland</h2>

        {/* Form Element */}
        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Basic Property Details Section (Keep as provided) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div><label htmlFor="propertyTitle" className="block text-sm font-medium text-gray-700">Property Title <span className="text-red-500">*</span></label><input type="text" name="propertyTitle" id="propertyTitle" value={formData.propertyTitle} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/></div>
            <div><label htmlFor="category" className="block text-sm font-medium text-gray-700">Property Type <span className="text-red-500">*</span></label><select name="category" id="category" value={formData.category} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"><option value="Apartment">Apartment</option><option value="House">House</option><option value="Land">Land</option><option value="Commercial">Commercial</option></select></div>
            <div><label htmlFor="price" className="block text-sm font-medium text-gray-700">Price (ETH) <span className="text-red-500">*</span></label><input type="number" step="any" min="0.000001" name="price" id="price" value={formData.price} onChange={handleChange} required placeholder="e.g., 0.5" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
          </div>

          {/* --- Location Section (ADDED UI FIELDS) --- */}
          <fieldset className="border border-gray-300 p-4 rounded-md shadow-sm">
            <legend className="text-lg font-medium text-gray-900 px-2">Property Location</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-4">
                 {/* Keep existing fields */}
                 <div><label htmlFor="country" className="block text-xs font-medium text-gray-600">Country <span className="text-red-500">*</span></label><input type="text" name="country" id="country" value={formData.country} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                 <div><label htmlFor="state" className="block text-xs font-medium text-gray-600">State/Province <span className="text-red-500">*</span></label><input type="text" name="state" id="state" value={formData.state} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                 <div><label htmlFor="city" className="block text-xs font-medium text-gray-600">City/Town <span className="text-red-500">*</span></label><input type="text" name="city" id="city" value={formData.city} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                 <div><label htmlFor="pinCode" className="block text-xs font-medium text-gray-600">Pin Code <span className="text-red-500">*</span></label><input type="text" name="pinCode" id="pinCode" value={formData.pinCode} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>

                 {/* Added String Address Input */}
                 <div className="md:col-span-2">
                    <label htmlFor="stringAddress" className="block text-xs font-medium text-gray-600">Street Address / Full Address <span className="text-red-500">*</span></label>
                    <input type="text" name="stringAddress" id="stringAddress" value={formData.stringAddress} onChange={handleChange} required placeholder="e.g., 123 Blockchain Ave, Crypto City" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                 </div>

                 {/* Added GMap Link Input */}
                 <div className="md:col-span-2">
                    <label htmlFor="gmapLink" className="block text-xs font-medium text-gray-600">Google Maps Link (Optional)</label>
                    <input type="url" name="gmapLink" id="gmapLink" value={formData.gmapLink} onChange={handleChange} placeholder="https://maps.app.goo.gl/..." className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                 </div>
            </div>
          </fieldset>

          {/* Description (Keep as provided) */}
          <div><label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label><textarea name="description" id="description" value={formData.description} onChange={handleChange} rows="4" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Add details..."></textarea></div>

          {/* Image Upload (Keep as provided) */}
          <div className="p-4 border border-gray-200 rounded-md bg-gray-50/50 shadow-sm">
              <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-2">Property Images (Max 6) <span className="text-red-500">*</span></label>
              <input type="file" name="images" id="images" onChange={handleChange} multiple accept="image/jpeg, image/png, image/gif, image/webp" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"/>
              {formData.images.length > 0 && ( <p className="text-xs text-gray-500 mt-1">{formData.images.length} / 6 image(s) selected.</p>)}
              {formData.images.length > 0 && (<div className="mt-4 flex flex-wrap gap-3">{formData.images.map((image, index) => (<div key={index} className="w-20 h-20 relative border border-gray-300 rounded-md overflow-hidden group shadow-sm bg-gray-100"><img src={URL.createObjectURL(image)} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" onLoad={(e) => URL.revokeObjectURL(e.target.src)} /><button type="button" onClick={() => removeImage(index)} className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 text-xs opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 focus:ring-offset-0" aria-label="Remove image"><FiX size={10}/></button></div>))}</div>)}
              {formData.images.length === 0 && <p className="text-xs text-red-600 mt-1">Please upload at least one image.</p>}
          </div>

          {/* Document Upload (Keep as provided) */}
          <div className="p-4 border border-gray-200 rounded-md bg-gray-50/50 shadow-sm">
              <label htmlFor="documents" className="block text-sm font-medium text-gray-700 mb-2">Property Documents (Optional, Max 5)</label>
              <input type="file" name="documents" id="documents" onChange={handleChange} multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"/>
              {formData.documents.length > 0 && ( <p className="text-xs text-gray-500 mt-1">{formData.documents.length} / 5 document(s) selected.</p> )}
              {formData.documents.length > 0 && (<div className="mt-4 space-y-1"><ul className="list-none text-sm text-gray-600">{formData.documents.map((doc, index) => (<li key={index} className="flex justify-between items-center bg-white p-1.5 border border-gray-200 rounded text-xs group"><span className="truncate pr-2" title={doc.name}>{doc.name}</span><button type="button" onClick={() => removeDocument(index)} className="ml-2 text-red-500 hover:text-red-700 font-semibold opacity-50 group-hover:opacity-100 transition-opacity focus:outline-none" aria-label={`Remove ${doc.name}`}><FiX size={12}/></button></li>))}</ul></div>)}
          </div>

          {/* NFT ID Display (Keep as provided) */}
          <div><label htmlFor="nftIdDisplay" className="block text-sm font-medium text-gray-700">Unique Property ID <span className="text-red-500">*</span></label><input type="text" name="nftIdDisplay" id="nftIdDisplay" value={nftId} readOnly placeholder="Generates automatically" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm bg-gray-100 cursor-not-allowed text-xs p-2 font-mono"/>{nftId && <p className="text-xs text-green-600 mt-1 flex items-center"><FiCheckCircle size={12} className="mr-1"/> Ready</p>}{!nftId && formData.propertyTitle && formData.category && formData.price && (<p className="text-xs text-orange-500 mt-1 flex items-center"><FiLoader size={12} className="mr-1 animate-spin"/> Generating...</p>)}{!nftId && (!formData.propertyTitle || !formData.category || !formData.price) && (<p className="text-xs text-gray-500 mt-1">Requires Title, Type, Price.</p>)}</div>

          {/* Submission Status & Error Display (Keep as provided) */}
          <div className="min-h-[40px] mt-4">{isSubmitting && (<div className="text-sm p-3 rounded-md border bg-blue-50 border-blue-200 text-blue-700 text-center flex justify-center items-center shadow-sm"><FiLoader className="animate-spin mr-2"/> {submissionStatus || 'Processing...'}</div>)}{!isSubmitting && submissionError && (<div className="text-sm p-3 rounded-md border bg-red-50 border-red-200 text-red-700 text-center shadow-sm"><strong>Error:</strong> {submissionError}</div>)}{!isSubmitting && !submissionError && submissionStatus === "Property listed successfully!" && (<div className="text-sm p-3 rounded-md border bg-green-50 border-green-200 text-green-700 text-center shadow-sm"><FiCheckCircle className="inline mr-1 mb-0.5"/> {submissionStatus}</div>)}</div>

          {/* Submit Button (Keep as provided) */}
          <div className="pt-5 border-t border-gray-200">
            <button type="submit" className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" disabled={isSubmitting || !isFormReady() || contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS"}>
              {isSubmitting ? <FiLoader className="animate-spin mr-2"/> : null} {isSubmitting ? 'Processing...' : 'List Property'}
            </button>
             <div className="text-xs text-red-600 mt-2 text-center space-y-0.5">
                 {!address && <span>Connect wallet to list.</span>}
                 {/* Updated Hint */}
                 {address && !isFormReady() && <span>Fill all (*) fields including Address and upload 1+ image.</span>}
                 {contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS" && <span>Contract address needs config.</span>}
             </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PropertyForm;