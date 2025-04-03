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
    console.log(`Pinata ${fileType} upload successful:`, response.data.IpfsHash);
    if (response.data.IpfsHash) {
      return `${PINATA_GATEWAY_URL}${response.data.IpfsHash}`; // Return full gateway URL
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
     if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
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
  const [formData, setFormData] = useState({
    propertyTitle: "",
    category: "Apartment", // Default value
    price: "", // Expecting ETH value as string (e.g., "1.5")
    country: "",
    state: "",
    city: "",
    pinCode: "",
    description: "",
    images: [], // Stores File objects for new images to upload
    documents: [], // Stores File objects for new documents to upload
  });
  const [nftId, setNftId] = useState(""); // State for the auto-generated unique ID
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(""); // User feedback (e.g., "Uploading...", "Submitting...")
  const [submissionError, setSubmissionError] = useState(""); // Detailed error messages

  // --- NFT ID Generation ---
  // Creates a deterministic hash based on key property details and owner address.
  // The Novaland_F1 contract requires this ID and ensures its uniqueness on-chain.
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

  // --- Handle Form Input Changes ---
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

  // --- Auto-generate NFT ID when relevant form fields change ---
  useEffect(() => {
    // Debounce generation to avoid excessive hashing while user types
    const handler = setTimeout(() => {
      generateNftId();
    }, 300); // 300ms delay
    return () => clearTimeout(handler); // Cleanup timeout on unmount or when dependencies change
  }, [generateNftId]); // Re-run effect if generateNftId function changes (due to its dependencies changing)


  // --- Handle Form Submission ---
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmissionStatus(""); // Clear previous messages
    setSubmissionError("");

    // --- Pre-submission Checks ---
    if (!address) {
      setSubmissionError("Please connect your wallet first!");
      return;
    }
    if (!isFormReady()) { // Use helper function for validation
        setSubmissionError("Please fill in all required fields (*) and upload at least one image.");
        return;
    }
     if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
        setSubmissionError("File Upload Error: Pinata API Keys are not configured in the environment variables.");
        return;
     }
     if (contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS") {
        setSubmissionError("Configuration Error: Contract address needs to be updated in the code.");
        return;
     }

    setIsSubmitting(true);
    setSubmissionStatus("Preparing submission...");

    // 1. Ensure NFT ID is generated (should be ready due to useEffect, but double-check)
    let currentNftId = nftId;
    if (!currentNftId) {
        setSubmissionStatus("Generating unique property identifier...");
        currentNftId = generateNftId();
        if (!currentNftId) {
             // Error set by generateNftId if it failed
             if (!submissionError) setSubmissionError("Could not generate required unique Property ID.");
             setIsSubmitting(false);
             setSubmissionStatus("");
             return;
        }
        // No need to wait after generateNftId sets state synchronously now
    }

    // Construct Location Array from form data
    const locationArray = [
        formData.country.trim(), formData.state.trim(),
        formData.city.trim(), formData.pinCode.trim()
    ];

    let imageUrls = [];
    let documentUrls = [];

    try {
      // 2. Upload Images and Documents to Pinata
      const totalFiles = formData.images.length + formData.documents.length;
      if (totalFiles > 0) {
          setSubmissionStatus(`Uploading ${totalFiles} file(s) via Pinata...`);
          console.log("Starting Pinata uploads...");

          // Create upload promises, catching errors individually
          const imageUploadPromises = formData.images.map(file =>
             uploadFileToPinata(file, 'Image').catch(err => ({ error: true, type: 'Image', fileName: file.name, message: err.message }))
          );
          const documentUploadPromises = formData.documents.map(file =>
             uploadFileToPinata(file, 'Document').catch(err => ({ error: true, type: 'Document', fileName: file.name, message: err.message }))
          );

          // Wait for all uploads to settle (either resolve or reject)
          const results = await Promise.all([...imageUploadPromises, ...documentUploadPromises]);

          // Check if any upload failed
          const failedUploads = results.filter(result => result && result.error);
          if (failedUploads.length > 0) {
              const errorMessages = failedUploads.map(f => `${f.type} '${f.fileName}': ${f.message}`).join("; ");
              throw new Error(`Failed to upload files: ${errorMessages}`);
          }

          // Extract successful URLs
          imageUrls = results.slice(0, formData.images.length).filter(url => typeof url === 'string');
          documentUrls = results.slice(formData.images.length).filter(url => typeof url === 'string');

          // Sanity check URL counts
           if (imageUrls.length !== formData.images.length || documentUrls.length !== formData.documents.length) {
               console.error("Mismatch in expected vs actual uploaded file URLs", { imageUrls, documentUrls });
               throw new Error("File upload issue: Not all files processed correctly.");
           }
          console.log("Pinata uploads successful.");
      } else {
          console.log("No new files to upload.");
      }


      // 3. Interact with Novaland_F1 Smart Contract
      setSubmissionStatus("Connecting to smart contract...");
      const contract = await loadContract(); // Load contract with signer

      // Convert price (string ETH) to Wei (BigNumber) and validate
      let priceInWei;
      try {
          priceInWei = ethers.utils.parseUnits(formData.price.toString(), 'ether');
          if (priceInWei.lte(0)) {
                throw new Error("Price must be a positive value.");
          }
      } catch (parseError) {
           throw new Error(`Invalid price format: '${formData.price}'. Please enter a valid number (e.g., 0.5).`);
      }

      setSubmissionStatus("Sending transaction to blockchain...");
      console.log("Calling Novaland_F1.AddProperty with args:", {
         owner: address, price: priceInWei.toString(), _propertyTitle: formData.propertyTitle.trim(),
         _category: formData.category, _images: imageUrls, _location: locationArray,
         _documents: documentUrls, _description: formData.description.trim(), _nftId: currentNftId,
      });

      // Call AddProperty - ENSURE ARGUMENT ORDER MATCHES Novaland_F1.sol
      const transaction = await contract.AddProperty(
        address,        // owner (address)
        priceInWei,     // price (uint256)
        formData.propertyTitle.trim(), // _propertyTitle (string)
        formData.category,             // _category (string)
        imageUrls,                     // _images (string[])
        locationArray,                 // _location (string[])
        documentUrls,                  // _documents (string[])
        formData.description.trim(),   // _description (string)
        currentNftId,                  // _nftId (string)
        { gasLimit: 4000000 }          // Adjust gas limit based on testing
      );

      setSubmissionStatus("Waiting for transaction confirmation...");
      console.log("Transaction sent, Hash:", transaction.hash);
      const receipt = await transaction.wait(); // Wait for 1 confirmation
      console.log("Transaction confirmed, Receipt:", receipt);

      setSubmissionStatus("Property listed successfully!");
      setSubmissionError(""); // Clear any previous error on success
      alert(`Property listed successfully! Transaction Hash: ${receipt.transactionHash}`);

      // --- Reset Form ---
      setFormData({
        propertyTitle: "", category: "Apartment", price: "", country: "", state: "",
        city: "", pinCode: "", description: "", images: [], documents: [],
      });
      setNftId(""); // Clear generated ID

    } catch (error) {
      console.error("Error during submission process:", error);
      let userMessage = error.message || 'An unexpected error occurred.'; // Default message

      // --- Parse Specific Errors ---
      if (error.message?.includes("Pinata") || error.message?.includes("File Upload Error")) {
         // Keep detailed Pinata/upload error
         userMessage = error.message;
      } else if (error.message?.includes("Invalid price format") || error.message?.includes("Price must be")) {
         userMessage = error.message; // Show specific price error
      } else if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
          userMessage = "Transaction rejected in your wallet.";
      } else if (error.reason) { // Ethers v5+ standard revert reason
          userMessage = `Transaction Failed: ${error.reason}`;
           // Check for specific known contract revert reasons
           if (error.reason.includes("NFT ID already exists")) {
              userMessage = "Transaction Failed: A property with the generated Unique ID already exists. Please modify Title, Category, or Price slightly and try again.";
          } else if (error.reason.includes("maximum of 6 images")) {
               userMessage = "Transaction Failed: Exceeded the maximum limit of 6 images allowed by the contract.";
          }
      } else if (error.data?.message) { // Fallback check for deeper error messages
         let nestedMsg = error.data.message;
          if (nestedMsg.includes("execution reverted")) { // Clean up common prefixes
              nestedMsg = nestedMsg.split("execution reverted: ")[1] || nestedMsg;
          }
          userMessage = `Transaction Failed: ${nestedMsg}`;
          if(nestedMsg.includes("NFT ID already exists")) { // Check nested message too
               userMessage = "Transaction Failed: A property with the generated Unique ID already exists. Please modify Title, Category, or Price slightly and try again.";
          }
      } else if (error.message?.includes("Configuration Error")) {
          userMessage = error.message; // Show config errors clearly
      } else if (error.message?.includes("wallet not found")) {
          userMessage = "Wallet not found. Please install MetaMask.";
      } else if (error.code === 'CALL_EXCEPTION') {
          userMessage = "Failed to execute contract call. Check contract address, ABI, network, and if the contract is deployed correctly.";
      }

      setSubmissionError(userMessage);
      setSubmissionStatus("Submission failed."); // Set final status

    } finally {
      setIsSubmitting(false); // Re-enable button
       // Optionally clear status messages after a delay, unless there's a persistent error
       if (!submissionError) {
           setTimeout(() => setSubmissionStatus(""), 6000);
       }
    }
  }, [address, formData, nftId, generateNftId, submissionError]); // Added submissionError to dependencies of useCallback


  // --- Function to remove an image from the preview/upload list ---
  const removeImage = (indexToRemove) => {
      setFormData(prev => ({
          ...prev,
          images: prev.images.filter((_, index) => index !== indexToRemove)
      }));
  };

  // --- Function to remove a document from the preview/upload list ---
    const removeDocument = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            documents: prev.documents.filter((_, index) => index !== indexToRemove)
        }));
    };

  // --- Helper to check if form is ready for submission ---
  const isFormReady = useCallback(() => {
      // Checks if all required fields are filled and NFT ID is generated
      return !!( // Convert to boolean
          address &&
          formData.propertyTitle.trim() &&
          formData.category &&
          formData.price && // Basic check, more robust validation done in handleSubmit
          formData.country.trim() &&
          formData.state.trim() &&
          formData.city.trim() &&
          formData.pinCode.trim() &&
          formData.images.length > 0 &&
          formData.images.length <= 6 &&
          nftId // Must have a generated NFT ID
      );
  }, [address, formData, nftId]); // Dependencies for readiness check


  // --- JSX Rendering ---
  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-gray-100 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
       {/* Configuration Warnings */}
       {(!PINATA_API_KEY || !PINATA_SECRET_API_KEY) && (
           <div className="w-full max-w-3xl mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm flex items-center shadow-sm">
               <FiAlertTriangle className="mr-2 flex-shrink-0"/> <strong>Configuration Warning:</strong> Pinata API keys missing in <code>.env</code>. File uploads will fail.
           </div>
       )}
       {contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS" && (
            <div className="w-full max-w-3xl mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm flex items-center shadow-sm">
               <FiAlertTriangle className="mr-2 flex-shrink-0"/> <strong>Configuration Warning:</strong> Contract address needs to be updated in the code.
           </div>
       )}

      {/* Form Container */}
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-xl p-8 space-y-6 border border-gray-200">
        <h2 className="text-3xl font-extrabold text-center text-gray-900">
          List Your Property on Novaland
        </h2>

        {/* Form Element */}
        <form onSubmit={handleSubmit} className="space-y-7">
          {/* --- Basic Property Details Section --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <label htmlFor="propertyTitle" className="block text-sm font-medium text-gray-700">Property Title <span className="text-red-500">*</span></label>
              <input type="text" name="propertyTitle" id="propertyTitle" value={formData.propertyTitle} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
             <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">Property Type <span className="text-red-500">*</span></label>
                <select name="category" id="category" value={formData.category} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                    <option value="Apartment">Apartment</option>
                    <option value="House">House</option>
                    <option value="Land">Land</option>
                    <option value="Commercial">Commercial</option>
                </select>
             </div>
            <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price (ETH) <span className="text-red-500">*</span></label>
                <input type="number" step="any" min="0.000001" name="price" id="price" value={formData.price} onChange={handleChange} required placeholder="e.g., 0.5" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /> {/* Hide number spinners */}
            </div>
          </div>

          {/* --- Location Section --- */}
          <fieldset className="border border-gray-300 p-4 rounded-md shadow-sm">
            <legend className="text-lg font-medium text-gray-900 px-2">Property Location <span className="text-red-500">*</span></legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-4">
                 <div><label htmlFor="country" className="block text-xs font-medium text-gray-600">Country:</label><input type="text" name="country" id="country" value={formData.country} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                 <div><label htmlFor="state" className="block text-xs font-medium text-gray-600">State/Province:</label><input type="text" name="state" id="state" value={formData.state} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                 <div><label htmlFor="city" className="block text-xs font-medium text-gray-600">City/Town:</label><input type="text" name="city" id="city" value={formData.city} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                 <div><label htmlFor="pinCode" className="block text-xs font-medium text-gray-600">Pin Code:</label><input type="text" name="pinCode" id="pinCode" value={formData.pinCode} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
            </div>
          </fieldset>

          {/* --- Description --- */}
           <div>
               <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
               <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows="4" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Add details about features, landmarks, condition..."></textarea>
           </div>

          {/* --- Image Upload Section --- */}
           <div className="p-4 border border-gray-200 rounded-md bg-gray-50/50 shadow-sm">
               <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-2">
                   Property Images (Max 6) <span className="text-red-500">*</span>
               </label>
               <input type="file" name="images" id="images" onChange={handleChange} multiple accept="image/jpeg, image/png, image/gif, image/webp" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"/>
               {formData.images.length > 0 && ( <p className="text-xs text-gray-500 mt-1">{formData.images.length} / 6 image(s) selected.</p>)}
               {/* Image Previews */}
               {formData.images.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                        {formData.images.map((image, index) => (
                            <div key={index} className="w-20 h-20 relative border border-gray-300 rounded-md overflow-hidden group shadow-sm bg-gray-100">
                                <img src={URL.createObjectURL(image)} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" onLoad={(e) => URL.revokeObjectURL(e.target.src)} />
                                <button type="button" onClick={() => removeImage(index)} className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 text-xs opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 focus:ring-offset-0" aria-label="Remove image"><FiX size={10}/></button>
                            </div>
                        ))}
                    </div>
                )}
                {formData.images.length === 0 && <p className="text-xs text-red-600 mt-1">Please upload at least one image.</p>}
           </div>

           {/* --- Document Upload Section --- */}
            <div className="p-4 border border-gray-200 rounded-md bg-gray-50/50 shadow-sm">
               <label htmlFor="documents" className="block text-sm font-medium text-gray-700 mb-2">
                   Property Documents (Optional, Max 5)
               </label>
               <input type="file" name="documents" id="documents" onChange={handleChange} multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"/>
               {formData.documents.length > 0 && ( <p className="text-xs text-gray-500 mt-1">{formData.documents.length} / 5 document(s) selected.</p> )}
                {/* Document List */}
               {formData.documents.length > 0 && (
                   <div className="mt-4 space-y-1">
                       <ul className="list-none text-sm text-gray-600">
                           {formData.documents.map((doc, index) => (
                               <li key={index} className="flex justify-between items-center bg-white p-1.5 border border-gray-200 rounded text-xs group">
                                   <span className="truncate pr-2" title={doc.name}>{doc.name}</span>
                                   <button type="button" onClick={() => removeDocument(index)} className="ml-2 text-red-500 hover:text-red-700 font-semibold opacity-50 group-hover:opacity-100 transition-opacity focus:outline-none" aria-label={`Remove ${doc.name}`}><FiX size={12}/></button>
                               </li>
                           ))}
                       </ul>
                   </div>
               )}
           </div>

          {/* --- NFT ID Display Section --- */}
          <div>
            <label htmlFor="nftIdDisplay" className="block text-sm font-medium text-gray-700">
              Unique Property ID (Auto-Generated) <span className="text-red-500">*</span>
            </label>
            <input type="text" name="nftIdDisplay" id="nftIdDisplay" value={nftId} readOnly placeholder="Generates automatically from details" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm bg-gray-100 cursor-not-allowed text-xs p-2 font-mono"/>
             {nftId && <p className="text-xs text-green-600 mt-1 flex items-center"><FiCheckCircle size={12} className="mr-1"/> Ready</p>}
             {!nftId && formData.propertyTitle && formData.category && formData.price && (
                 <p className="text-xs text-orange-500 mt-1 flex items-center"><FiLoader size={12} className="mr-1 animate-spin"/> Generating ID...</p>
             )}
             {!nftId && (!formData.propertyTitle || !formData.category || !formData.price) && (
                 <p className="text-xs text-gray-500 mt-1">Requires Title, Type, and Price.</p>
             )}
          </div>

          {/* --- Submission Status & Error Display Area --- */}
          <div className="min-h-[40px] mt-4"> {/* Reserve space */}
              {isSubmitting && ( // Show loading state prominently
                   <div className="text-sm p-3 rounded-md border bg-blue-50 border-blue-200 text-blue-700 text-center flex justify-center items-center shadow-sm">
                      <FiLoader className="animate-spin mr-2"/> {submissionStatus || 'Processing...'}
                   </div>
              )}
              {!isSubmitting && submissionError && ( // Show error if not submitting
                 <div className="text-sm p-3 rounded-md border bg-red-50 border-red-200 text-red-700 text-center shadow-sm">
                    <strong>Error:</strong> {submissionError}
                 </div>
              )}
              {!isSubmitting && !submissionError && submissionStatus === "Property listed successfully!" && ( // Show success message
                 <div className="text-sm p-3 rounded-md border bg-green-50 border-green-200 text-green-700 text-center shadow-sm">
                   <FiCheckCircle className="inline mr-1 mb-0.5"/> {submissionStatus}
                 </div>
              )}
          </div>


          {/* --- Submit Button --- */}
          <div className="pt-5 border-t border-gray-200">
            <button
              type="submit"
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              disabled={isSubmitting || !isFormReady() || contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS"}
            >
              {isSubmitting ? <FiLoader className="animate-spin mr-2"/> : null}
              {isSubmitting ? 'Processing...' : 'List Property'}
            </button>
             {/* Hints for why button might be disabled */}
             <div className="text-xs text-red-600 mt-2 text-center space-y-0.5">
                 {!address && <span>Connect your wallet to list.</span>}
                 {address && !isFormReady() && <span>Please fill all required (*) fields and upload at least one image.</span>}
                 {contractAddress === "YOUR_NOVALAND_F1_CONTRACT_ADDRESS" && <span>Contract address configuration needed.</span>}
             </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PropertyForm;