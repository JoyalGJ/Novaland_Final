import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { supabase } from "../../supabase";
import moment from "moment";
// --- IMPORTANT: Make sure contractABI.json contains the ABI for Novaland_F1 ---
import contractABI from "../../contractABI2.json"; // Assuming you renamed/updated this file
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faGift, faCheck, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons'; // Added faSpinner

// --- Use the correct contract address if it changed ---
const CONTRACT_ADDRESS = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // Update if necessary

// --- Updated function to fetch property details based on Novaland_F1 structure ---
// Note: Novaland_F1 doesn't have FetchProperty(id). This function now fetches ALL
// properties and filters, which is inefficient for single lookups but necessary
// without a dedicated contract function. Consider adding FetchPropertyById to your contract.
const fetchPropertyFromBlockchain = async (propertyId, provider, contract) => {
    try {
        console.log(`Attempting to fetch details for missing property ID: ${propertyId}`);
        // Fetch all properties as the new contract lacks a single property fetch function
        const allProperties = await contract.FetchProperties();
        const property = allProperties.find(p => Number(p.productID) === propertyId);

        if (!property) {
            console.warn(`Property with ID ${propertyId} not found on blockchain.`);
            return null;
        }

        console.log(`Found property ${propertyId} via FetchProperties:`, property);
        return {
            productID: Number(property.productID),
            owner: property.owner,
            price: Number(property.price), // Original listing price
            propertyTitle: property.propertyTitle,
            category: property.category,
            images: property.images,
            location: property.location, // Changed from propertyAddress
            documents: property.documents, // Added documents
            description: property.description,
            nftId: property.nftId,
            isListed: property.isListed // Added isListed
        };
    } catch (error) {
        console.error(`Error fetching property ID ${propertyId}:`, error);
        return null;
    }
};


function ChatPage() {
    const [threads, setThreads] = useState([]);
    const [messages, setMessages] = useState([]);
    const [activeThread, setActiveThread] = useState(null);
    const [newMessage, setNewMessage] = useState("");
    const [offerPrice, setOfferPrice] = useState("");
    const [offerMessage, setOfferMessage] = useState("");
    const [connectedWallet, setConnectedWallet] = useState("");
    const [userNames, setUserNames] = useState({});
    const [isOfferPendingInThread, setIsOfferPendingInThread] = useState(false); // Renamed for clarity
    const [propertyNames, setPropertyNames] = useState({});
    const [allPropertiesMap, setAllPropertiesMap] = useState({}); // Stores full property details
    const [propertiesLoading, setPropertiesLoading] = useState(false);
    const [isOfferFormVisible, setIsOfferFormVisible] = useState(false);
    const [isBuyerView, setIsBuyerView] = useState(true);
    const [error, setError] = useState(null);
    const [unreadThreads, setUnreadThreads] = useState({});
    const [isPurchasing, setIsPurchasing] = useState(false); // Loading state for purchase
    const [purchaseStatus, setPurchaseStatus] = useState(null); // e.g., 'pending', 'success', 'failed'


    function clearError() {
        setError(null);
        setPurchaseStatus(null); // Clear purchase status when clearing errors
    }

    const connectWallet = useCallback(async function connectWalletHandler() {
        clearError();
        if (window.ethereum) {
            try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                await provider.send("eth_requestAccounts", []);
                const signer = provider.getSigner();
                const account = await signer.getAddress();
                setConnectedWallet(account.toLowerCase());
                console.log("Wallet connected:", account.toLowerCase());
            } catch (err) {
                console.error("Error connecting wallet:", err);
                setError("Failed to connect wallet. Please ensure MetaMask is unlocked and try again.");
                setConnectedWallet(""); // Ensure wallet state is cleared on error
            }
        } else {
            console.error("MetaMask not found.");
            setError("MetaMask not found. Please install MetaMask browser extension.");
            setConnectedWallet("");
        }
    }, []);

    const fetchUserNames = useCallback(async function fetchUserNamesHandler(wallets) {
        const uniqueWallets = [...new Set(wallets)].filter(Boolean).filter(w => !userNames[w]);
        if (uniqueWallets.length === 0) return;
        try {
            const { data, error: fetchError } = await supabase.from("users").select("wallet_address, name").in("wallet_address", uniqueWallets);
            if (fetchError) {
                console.error("Error fetching user names:", fetchError);
                setError("Failed to fetch user details.");
                return;
            }
            const nameMap = data.reduce((acc, user) => {
                acc[user.wallet_address.toLowerCase()] = user.name || `${user.wallet_address.substring(0, 6)}...${user.wallet_address.slice(-4)}`;
                return acc;
            }, {});
            setUserNames(prev => ({ ...prev, ...nameMap }));
        } catch (err) {
            console.error("Error in fetchUserNames:", err);
            setError("An error occurred fetching user details.");
        }
    }, [userNames]);

    // --- Updated fetchAllPropertiesFromContract for Novaland_F1 ---
    const fetchAllPropertiesFromContract = useCallback(async function fetchAllPropertiesHandler() {
        if (propertiesLoading || Object.keys(allPropertiesMap).length > 0 || !window.ethereum) return;
        setPropertiesLoading(true);
        clearError();
        console.log("Fetching all properties from contract...");
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
            const properties = await contract.FetchProperties();
            console.log("Raw properties fetched:", properties);

            const propMap = properties.reduce((map, prop) => {
                 const propertyId = Number(prop.productID);
                 if (propertyId !== undefined && !isNaN(propertyId)) { // Ensure ID is a valid number
                     map[propertyId] = {
                         productID: propertyId,
                         owner: prop.owner.toLowerCase(), // Store addresses lowercase
                         price: Number(prop.price), // Original listing price
                         propertyTitle: prop.propertyTitle || "Unnamed Property",
                         category: prop.category,
                         images: prop.images,
                         location: prop.location, // Use location array
                         documents: prop.documents, // Add documents array
                         description: prop.description,
                         nftId: prop.nftId,
                         isListed: prop.isListed // Add isListed status
                     };
                 } else {
                    console.warn("Skipping property with invalid ID:", prop);
                 }
                 return map;
            }, {});
            console.log("Processed properties map:", propMap);
            setAllPropertiesMap(propMap);
        } catch (err) {
            console.error("Error fetching properties from contract:", err);
            setError("Failed to fetch property details from the blockchain. Property info may be incomplete.");
            setAllPropertiesMap({}); // Clear map on error
        } finally {
            setPropertiesLoading(false);
        }
    }, [propertiesLoading, allPropertiesMap]); // Dependencies

    const fetchThreads = useCallback(async function fetchThreadsHandler() {
        if (!connectedWallet) return;
        clearError(); // Clear previous errors
        try {
            console.log("Fetching threads for wallet:", connectedWallet);
            const { data, error: fetchError } = await supabase
                .from("threads")
                .select("*")
                .or(`buyer_wallet.eq.${connectedWallet},seller_wallet.eq.${connectedWallet}`)
                .order("created_at", { ascending: false });

            if (fetchError) {
                console.error("Error fetching threads:", fetchError);
                setError("Failed to load conversations.");
                return;
            }

            const fetchedThreads = data || [];
            console.log("Fetched threads:", fetchedThreads);
            setThreads(fetchedThreads);

            if (fetchedThreads.length > 0) {
                const wallets = fetchedThreads.flatMap(t => [t.buyer_wallet, t.seller_wallet]);
                fetchUserNames(wallets); // Fetch names for involved parties
            }
        } catch (err) {
            console.error("Error in fetchThreads:", err);
            setError("An unexpected error occurred loading conversations.");
        }
    }, [connectedWallet, fetchUserNames]); // Dependencies

    const fetchMessages = useCallback(async function fetchMessagesHandler(threadId) {
        if (!threadId || !connectedWallet) return;
        try {
            console.log(`Fetching messages for thread ${threadId}`);
            const { data, error: fetchError } = await supabase
                .from("messages")
                .select("*")
                .eq("thread_id", threadId)
                .order("created_at", { ascending: true });

            if (fetchError) {
                console.error("Error fetching messages:", fetchError);
                setError("Failed to load messages.");
                return;
            }

            const sortedMessages = data ? [...data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : [];
            console.log(`Fetched ${sortedMessages.length} messages for thread ${threadId}`);
            setMessages(sortedMessages);

            // Check if there's any *pending* offer in this specific thread (sent by anyone)
            const hasPendingOffer = sortedMessages.some(msg => msg.type === "offer" && msg.status === "pending");
            setIsOfferPendingInThread(hasPendingOffer); // Update thread-specific offer pending status
            console.log(`Is offer pending in thread ${threadId}?`, hasPendingOffer);

            if (data?.length > 0) {
                 const wallets = data.map(msg => msg.sender_wallet);
                 fetchUserNames(wallets);
            }
        } catch (err) {
            console.error("Error in fetchMessages:", err);
            setError("An error occurred loading messages.");
        }
    }, [connectedWallet, fetchUserNames]); // Dependencies

    const markMessagesAsRead = useCallback(async function markMessagesAsReadHandler(threadId) {
        if (!threadId || !connectedWallet) return;
        setUnreadThreads(prev => {
            const newState = { ...prev };
            delete newState[threadId];
            return newState;
        });
        try {
            // Find messages in this thread not sent by the current user and not marked as read
            const { data: unreadMessages, error: unreadError } = await supabase
                .from("messages")
                .select('id')
                .eq('thread_id', threadId)
                .neq('sender_wallet', connectedWallet)
                .is('read', null); // Check for null or false explicitly if needed

            if (unreadError) {
                console.error('Error fetching unread count:', unreadError);
                return; // Don't proceed if fetching fails
            }

            if (unreadMessages && unreadMessages.length > 0) {
                const messageIds = unreadMessages.map(msg => msg.id);
                console.log(`Marking ${messageIds.length} messages as read in thread ${threadId}`);
                const { error: updateError } = await supabase
                    .from("messages")
                    .update({ read: true })
                    .in('id', messageIds);

                if (updateError) {
                    console.error('Error marking messages as read:', updateError);
                    // Optionally set an error state here, but maybe not critical
                }
            } else {
                 console.log(`No unread messages to mark in thread ${threadId}`);
            }
        } catch (err) {
            console.error('Error in markMessagesAsRead:', err);
            // Handle unexpected errors if necessary
        }
    }, [connectedWallet]); // Dependencies

    const getThreadName = useCallback(function getThreadNameHandler(thread) {
        if (!thread || !connectedWallet) return "Unknown";
        const otherWallet = thread.buyer_wallet === connectedWallet ? thread.seller_wallet : thread.buyer_wallet;
        return userNames[otherWallet?.toLowerCase()] || `${otherWallet?.substring(0, 6)}...${otherWallet?.slice(-4)}`;
    }, [connectedWallet, userNames]);

    const isThreadUnread = useCallback(function isThreadUnreadHandler(thread) {
        return !!unreadThreads[thread.id];
    }, [unreadThreads]);

    const determineThreadStyle = useCallback(function determineThreadStyleHandler(thread) {
        if (activeThread?.id === thread.id) {
            return 'bg-blue-100 ring-2 ring-blue-300'; // Highlight active thread more clearly
        } else if (thread.status === "closed") {
            return 'bg-gray-100 text-gray-500 hover:bg-gray-200 opacity-75'; // Style closed threads
        } else {
            return 'hover:bg-gray-100';
        }
    }, [activeThread]);

    const getFilteredThreads = useCallback(function getFilteredThreadsHandler() {
        return threads.filter(thread => {
            const walletToCheck = isBuyerView ? thread.buyer_wallet : thread.seller_wallet;
            return walletToCheck?.toLowerCase() === connectedWallet?.toLowerCase();
        });
    }, [threads, isBuyerView, connectedWallet]);

    useEffect(() => {
        console.log("Component mounted, attempting wallet connection...");
        connectWallet();

        // Listener for account changes
        const handleAccountsChanged = (accounts) => {
            console.log("Wallet account changed:", accounts);
            if (accounts.length === 0) {
                console.log("Wallet disconnected.");
                setConnectedWallet(""); // Clear wallet state if disconnected
                // Reset application state that depends on the wallet
                setThreads([]);
                setActiveThread(null);
                setMessages([]);
                setUserNames({});
                setPropertyNames({});
                setAllPropertiesMap({});
                setPropertiesLoading(false);
                setUnreadThreads({});
                setError("Wallet disconnected. Please connect again.");
                setIsBuyerView(true);
            } else {
                connectWallet(); // Re-connect or update wallet address
            }
        };

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }

        // Cleanup listener on component unmount
        return () => {
            if (window.ethereum?.removeListener) { // Check if removeListener exists
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, [connectWallet]); // connectWallet is stable due to useCallback

    useEffect(() => {
        if (connectedWallet) {
            console.log("Connected wallet detected, fetching properties and threads.");
            // Fetch properties only if the map is empty
            if(Object.keys(allPropertiesMap).length === 0) {
                fetchAllPropertiesFromContract();
            }
            fetchThreads();
        } else {
            console.log("No connected wallet, clearing state.");
            // Clear state if wallet disconnects or isn't connected initially
            setThreads([]);
            setActiveThread(null);
            setMessages([]);
            setUserNames({});
            setPropertyNames({});
            // Do not clear allPropertiesMap here, maybe keep it cached? Or clear if desired.
            // setAllPropertiesMap({});
            setPropertiesLoading(false);
            setUnreadThreads({});
            // setError(null); // Keep potential connection errors visible
            setIsBuyerView(true);
        }
    }, [connectedWallet, fetchThreads, fetchAllPropertiesFromContract, allPropertiesMap]); // Added allPropertiesMap dependency

    // Effect to map property titles to threads
    useEffect(() => {
        const mapIsReady = Object.keys(allPropertiesMap).length > 0;
        const shouldUpdatePropertyNames = threads.length > 0 && (mapIsReady || !propertiesLoading);

        if (shouldUpdatePropertyNames) {
            console.log("Updating property names for threads...");
            const newPropertyNames = {};
            const missingPropertyIds = [];

            threads.forEach(thread => {
                const propertyId = thread.property_id;
                if (propertyId !== undefined && propertyId !== null) {
                    const propertyDetails = allPropertiesMap[propertyId];
                    if (propertyDetails) {
                        newPropertyNames[thread.id] = propertyDetails.propertyTitle || "Unnamed Property";
                    } else if (!propertiesLoading) {
                        // Property ID exists but details are not in the map, and not currently loading
                        newPropertyNames[thread.id] = "Unknown Property (Fetch Pending)";
                        if (!missingPropertyIds.includes(propertyId)) {
                             missingPropertyIds.push(propertyId);
                        }
                    } else {
                        // Properties are loading, or ID is invalid/missing
                        newPropertyNames[thread.id] = propertiesLoading ? "Loading Property Info..." : "Property Info Unavailable";
                    }
                } else {
                    newPropertyNames[thread.id] = "Property ID Missing";
                }
            });

            // Only update state if the names actually changed
            if (JSON.stringify(newPropertyNames) !== JSON.stringify(propertyNames)) {
                setPropertyNames(newPropertyNames);
            }

            // Attempt to fetch details for properties missing from the initial map
            const uniqueMissingIds = [...new Set(missingPropertyIds)];
            if (uniqueMissingIds.length > 0 && window.ethereum && !propertiesLoading) {
                 console.log("Found missing property IDs, attempting individual fetch:", uniqueMissingIds);
                 (async () => {
                    try {
                        const provider = new ethers.providers.Web3Provider(window.ethereum);
                        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
                        const fetchedProperties = {};

                        // This part is inefficient due to contract limitations
                        // Consider batching or adding FetchPropertyById to the contract
                        for (const id of uniqueMissingIds) {
                            const propertyData = await fetchPropertyFromBlockchain(id, provider, contract);
                            if (propertyData) {
                                fetchedProperties[id] = propertyData;
                                console.log(`Successfully fetched missing property ${id}`);
                            } else {
                                console.warn(`Failed to fetch missing property ${id}`);
                            }
                        }

                        if (Object.keys(fetchedProperties).length > 0) {
                            console.log("Adding fetched missing properties to map:", fetchedProperties);
                            setAllPropertiesMap(prev => ({
                                ...prev,
                                ...fetchedProperties
                            }));
                            // Trigger a re-run of this effect to update names immediately
                        }
                    } catch (fetchError) {
                        console.error("Error fetching missing property details:", fetchError);
                        // Avoid setting a general error, maybe log it or show a specific warning
                    }
                 })();
            }
        } else if (threads.length > 0 && propertiesLoading) {
             // If loading, ensure threads show loading state for property names
             setPropertyNames(prev => {
                 const updatedNames = { ...prev };
                 let changed = false;
                 threads.forEach(thread => {
                     if (!updatedNames[thread.id] || updatedNames[thread.id] !== "Loading Property Info...") {
                         updatedNames[thread.id] = "Loading Property Info...";
                         changed = true;
                     }
                 });
                 return changed ? updatedNames : prev;
             });
        }

    }, [threads, allPropertiesMap, propertiesLoading, propertyNames]); // Dependencies


    // Effect for active thread: fetch messages and mark as read
    useEffect(() => {
        if (activeThread) {
            console.log(`Active thread changed to ${activeThread.id}, fetching messages and marking read.`);
            fetchMessages(activeThread.id);
            markMessagesAsRead(activeThread.id);
            setIsOfferFormVisible(false); // Hide offer form when switching threads
            setPurchaseStatus(null); // Clear any purchase status message
        } else {
            console.log("No active thread, clearing messages.");
            setMessages([]);
        }
    }, [activeThread, fetchMessages, markMessagesAsRead]); // Dependencies


    // Effect for Supabase real-time subscriptions
    useEffect(() => {
        if (!connectedWallet) return () => {}; // No subscription if wallet not connected

        console.log("Setting up Supabase subscriptions for wallet:", connectedWallet);

        // Channel for thread changes relevant to the user
        const threadsChannel = supabase.channel(`public:threads:user=${connectedWallet}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: "threads" }, (payload) => {
                 console.log("Realtime: Thread change detected", payload);
                 const changedThread = payload.new || payload.old;
                 // Check if the change involves the current user
                 if (changedThread && (changedThread.buyer_wallet?.toLowerCase() === connectedWallet || changedThread.seller_wallet?.toLowerCase() === connectedWallet)) {
                     console.log("Realtime: Relevant thread change, refetching threads.");
                     fetchThreads(); // Refetch thread list
                 }
             }).subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log('Realtime: Subscribed to threads channel');
                 } else {
                    console.error("Realtime: Error subscribing to threads:", err || status);
                    setError("Connection issue: Real-time conversation updates may be delayed.");
                 }
            });

        // Channel for new messages or message updates
        const messagesChannel = supabase.channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: "messages" }, (payload) => {
                console.log("Realtime: New message inserted", payload);
                const newMessage = payload.new;
                // Ignore messages sent by the current user in real-time handler (they appear instantly via UI state)
                if (newMessage.sender_wallet?.toLowerCase() === connectedWallet) return;

                // Check if the message belongs to the currently active thread
                if (activeThread && newMessage.thread_id === activeThread.id) {
                    console.log("Realtime: New message in active thread, fetching messages and marking read.");
                    fetchMessages(activeThread.id); // Refetch messages for the active chat
                    markMessagesAsRead(activeThread.id); // Mark as read immediately
                } else {
                    // Message is for a different thread, mark that thread as unread and refetch threads list
                    console.log(`Realtime: New message in inactive thread ${newMessage.thread_id}, marking unread and refetching threads.`);
                    setUnreadThreads(prev => ({ ...prev, [newMessage.thread_id]: true }));
                    fetchThreads(); // Refetch threads to update sidebar potentially (e.g., last message preview if implemented)
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: "messages" }, (payload) => {
                 console.log("Realtime: Message update detected", payload);
                 const updatedMessage = payload.new;
                 // If the update is in the active thread, refetch messages (e.g., offer status change)
                 if (activeThread && updatedMessage.thread_id === activeThread.id) {
                      console.log("Realtime: Message update in active thread, refetching messages.");
                      fetchMessages(activeThread.id);
                 }
                 // Also refetch threads list if an offer is accepted/rejected, as thread status might change
                 if (updatedMessage.type === 'offer' && (updatedMessage.status === 'accepted' || updatedMessage.status === 'rejected')) {
                     console.log("Realtime: Offer status changed, refetching threads list.");
                     fetchThreads();
                 }
             }).subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log('Realtime: Subscribed to messages channel');
                 } else {
                    console.error("Realtime: Error subscribing to messages:", err || status);
                    setError("Connection issue: Real-time message updates may be delayed.");
                 }
             });

        // Cleanup function to remove channels on component unmount or wallet change
        return () => {
            console.log("Cleaning up Supabase subscriptions.");
            supabase.removeChannel(threadsChannel);
            supabase.removeChannel(messagesChannel);
        };
    }, [connectedWallet, activeThread, fetchMessages, fetchThreads, markMessagesAsRead]); // Dependencies


    // --- Event Handlers ---

    const handleSendMessage = useCallback(async function handleSendMessageHandler() {
        if (!newMessage.trim() || !activeThread || activeThread.status === "closed" || !connectedWallet) {
            console.warn("Send message aborted. Conditions not met:", { newMessage: !!newMessage.trim(), activeThread, status: activeThread?.status, connectedWallet });
            return;
        }
        clearError();
        const tempMessage = newMessage;
        setNewMessage(""); // Optimistic UI update

        try {
            console.log(`Sending message to thread ${activeThread.id}: "${tempMessage}"`);
            const { error: insertError } = await supabase.from("messages").insert({
                thread_id: activeThread.id,
                sender_wallet: connectedWallet,
                message: tempMessage,
                type: "message",
                read: null // Mark as unread initially for the recipient
            });

            if (insertError) {
                console.error("Error sending message:", insertError);
                setError("Failed to send message. Please try again.");
                setNewMessage(tempMessage); // Revert optimistic update
            } else {
                console.log("Message sent successfully.");
                // No need to manually fetch messages, real-time listener will handle it if active,
                // or it will be fetched when the thread becomes active.
                 // Manually add to local state for immediate feedback if not relying solely on subscriptions
                 // setMessages(prev => [...prev, { /* construct local message object */ }]);
            }
        } catch (err) {
            console.error("Unexpected error sending message:", err);
            setError("An unexpected error occurred while sending the message.");
            setNewMessage(tempMessage); // Revert optimistic update
        }
    }, [newMessage, activeThread, connectedWallet]);

    const handleMakeOffer = useCallback(async function handleMakeOfferHandler() {
        // Additional check: Only buyer can make offer
        if (activeThread?.buyer_wallet?.toLowerCase() !== connectedWallet?.toLowerCase()) {
             setError("Only the buyer can make an offer in this conversation.");
             return;
        }
         // Check if an offer is already pending in this specific thread
        if (!offerPrice || !activeThread || activeThread.status === "closed" || isOfferPendingInThread || !connectedWallet) {
            if (isOfferPendingInThread) setError("An offer is already pending in this conversation. Wait for it to be resolved.");
            else if (activeThread?.status === "closed") setError("Cannot make offer in a closed conversation.");
            else setError("Cannot make offer. Ensure price is valid and conversation is active.");
            console.warn("Make offer aborted. Conditions not met:", { offerPrice: !!offerPrice, activeThread, status: activeThread?.status, isOfferPendingInThread, connectedWallet });
            return;
        }

        clearError();
        const price = parseFloat(offerPrice);
        if (isNaN(price) || price <= 0) {
            setError("Please enter a valid positive offer price.");
            return;
        }

        const tempOfferPrice = offerPrice;
        const tempOfferMessage = offerMessage;

        // Hide form immediately (optimistic)
        setIsOfferFormVisible(false);
        setOfferPrice("");
        setOfferMessage("");

        try {
            console.log(`Making offer of ${price} ETH in thread ${activeThread.id}`);
            const { error: insertError } = await supabase.from("messages").insert({
                thread_id: activeThread.id,
                sender_wallet: connectedWallet,
                message: tempOfferMessage, // Optional message
                price: price,
                type: "offer",
                status: "pending",
                read: null // Mark as unread for recipient
            });

            if (insertError) {
                console.error("Error making offer:", insertError);
                setError("Failed to submit offer. Please try again.");
                // Re-show form and restore values on failure
                setIsOfferFormVisible(true);
                setOfferPrice(tempOfferPrice);
                setOfferMessage(tempOfferMessage);
                return; // Stop execution
            }

            console.log("Offer submitted successfully.");
            setIsOfferPendingInThread(true); // Set pending status for this thread
            // Real-time listener should update the message list

        } catch (err) {
            console.error("Unexpected error making offer:", err);
            setError("An unexpected error occurred while submitting the offer.");
            // Re-show form and restore values on failure
            setIsOfferFormVisible(true);
            setOfferPrice(tempOfferPrice);
            setOfferMessage(tempOfferMessage);
        }
    }, [offerPrice, offerMessage, activeThread, isOfferPendingInThread, connectedWallet]); // Dependencies


    // --- Updated handleAcceptOffer with Purchase Logic ---
    const handleAcceptOffer = useCallback(async function handleAcceptOfferHandler(offerMessage) {
        if (!activeThread || activeThread.status === "closed" || !connectedWallet || isPurchasing) {
            console.warn("Accept offer aborted. Conditions not met:", { activeThread, status: activeThread?.status, connectedWallet, isPurchasing });
            return;
        }
        // Ensure the current user is the SELLER to accept
        if (activeThread.seller_wallet?.toLowerCase() !== connectedWallet?.toLowerCase()) {
            setError("Only the seller can accept or reject offers.");
            return;
        }
        // Ensure the offer being accepted was NOT sent by the current user (seller)
        if (offerMessage.sender_wallet?.toLowerCase() === connectedWallet?.toLowerCase()) {
            setError("You cannot accept your own offer.");
            return;
        }
    
        clearError();
        setIsPurchasing(true); // Set loading state
        setPurchaseStatus('pending');
        console.log(`Attempting to accept offer ${offerMessage.id} and purchase property ${activeThread.property_id} for ${offerMessage.price} ETH`);
    
        if (!window.ethereum) {
            setError("MetaMask is not available. Please install or enable it.");
            setIsPurchasing(false);
            setPurchaseStatus('failed');
            return;
        }
    
        try {
            // --- Step 1: Blockchain Transaction (PurchaseProperty) ---
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
            const propertyIdToPurchase = activeThread.property_id;
            const purchasePriceWei = ethers.utils.parseEther(offerMessage.price.toString());
    
            // Fetch the buyer's address from the offerMessage
            const buyerAddress = offerMessage.sender_wallet; // This is the buyer's address
    
            console.log(`Calling PurchaseProperty for ID: ${propertyIdToPurchase} with value: ${purchasePriceWei.toString()} Wei and buyer: ${buyerAddress}`);
    
            // Send the transaction with the buyer's address
            const tx = await contract.PurchaseProperty(propertyIdToPurchase, buyerAddress, {
                value: purchasePriceWei
            });
    
            console.log("Purchase transaction sent:", tx.hash);
            setPurchaseStatus('Transaction sent, awaiting confirmation...');
    
            // Wait for the transaction to be mined
            const receipt = await tx.wait();
            console.log("Purchase transaction confirmed:", receipt);
    
            if (receipt.status === 0) {
                throw new Error("Blockchain transaction failed (reverted).");
            }
    
            console.log("Property purchase successful on blockchain!");
            setPurchaseStatus('success');
    
            // --- Step 2: Update Supabase Database (only after successful TX) ---
            try {
                console.log(`Updating Supabase: Message ${offerMessage.id} to accepted, Thread ${activeThread.id} to closed.`);
                // Update the message status to "accepted"
                const { error: updateMsgError } = await supabase
                    .from("messages")
                    .update({ status: "accepted" })
                    .eq("id", offerMessage.id);
    
                if (updateMsgError) {
                    // Log error but proceed, blockchain is source of truth for ownership
                    console.error("Error accepting offer (message update):", updateMsgError);
                    setError("Purchase successful, but failed to update message status in database.");
                }
    
                // Update the thread status to "closed"
                const { error: updateThreadError } = await supabase
                    .from("threads")
                    .update({ status: "closed" })
                    .eq("id", activeThread.id);
    
                if (updateThreadError) {
                    // Log error but proceed
                    console.error("Error accepting offer (thread update):", updateThreadError);
                    setError("Purchase successful, but failed to close conversation status in database.");
                }
    
                // --- Step 3: Update Local State ---
                // Refetch threads to get the updated status
                fetchThreads();
                // Refetch messages for the current thread to show 'accepted' status
                fetchMessages(activeThread.id);
                // Update active thread state locally for immediate feedback
                setActiveThread(prev => prev ? ({ ...prev, status: "closed" }) : null);
                setIsOfferPendingInThread(false); // No longer pending
                // Optionally, refetch all properties if ownership/listing status needs immediate update in other parts of the app
                // fetchAllPropertiesFromContract(); // Consider implications of immediate refetch
    
            } catch (dbError) {
                console.error("Error updating database after successful purchase:", dbError);
                setError("Blockchain purchase successful, but failed during database update. Please check property status.");
                // Still refetch data to try and sync state
                fetchThreads();
                fetchMessages(activeThread.id);
            }
    
        } catch (err) {
            console.error("Error during purchase process:", err);
            let userFriendlyError = "An unexpected error occurred during the purchase process.";
            if (err.code === 4001) { // User rejected transaction
                userFriendlyError = "Transaction rejected in MetaMask.";
            } else if (err.message?.includes("reverted")) {
                userFriendlyError = "Blockchain transaction failed. Possible reasons: Property not listed, insufficient funds, or other contract issue.";
            } else if (err.message?.includes("insufficient funds")) {
                userFriendlyError = "Insufficient funds for transaction.";
            } else if (err.message) {
                // Try to get a more specific message if available
                userFriendlyError = `Purchase failed: ${err.message.substring(0, 100)}...`; // Truncate long messages
            }
            setError(userFriendlyError);
            setPurchaseStatus('failed');
        } finally {
            setIsPurchasing(false); // Stop loading indicator
            // Don't clear purchaseStatus here, let it show success/failure until cleared otherwise
        }
    }, [activeThread, connectedWallet, isPurchasing, fetchThreads, fetchMessages]); // Dependencies


    const handleRejectOffer = useCallback(async function handleRejectOfferHandler(offerId) {
        if (!activeThread || activeThread.status === "closed" || !connectedWallet) {
            console.warn("Reject offer aborted. Conditions not met.");
            return;
        }
         // Ensure the current user is the SELLER to reject
        if (activeThread.seller_wallet?.toLowerCase() !== connectedWallet?.toLowerCase()) {
            setError("Only the seller can accept or reject offers.");
            return;
        }

        clearError();
        try {
            console.log(`Rejecting offer ${offerId} in thread ${activeThread.id}`);
            const { error: updateError } = await supabase
                .from("messages")
                .update({ status: "rejected" })
                .eq("id", offerId)
                // .neq('sender_wallet', connectedWallet) // Ensure seller doesn't reject own (shouldn't happen)
                ;

            if (updateError) {
                console.error("Error rejecting offer:", updateError);
                setError("Failed to reject offer. Please try again.");
                return;
            }

            console.log("Offer rejected successfully.");
            // Refetch messages to show the 'rejected' status
            fetchMessages(activeThread.id);
            setIsOfferPendingInThread(false); // Offer is no longer pending

        } catch (err) {
            console.error("Unexpected error rejecting offer:", err);
            setError("An unexpected error occurred while rejecting the offer.");
        }
    }, [activeThread, connectedWallet, fetchMessages]); // Dependencies


    // --- Render Logic ---

    return (
        <div className="flex h-screen bg-gray-100 font-sans"> {/* Changed bg */}

            {/* Sidebar */}
            <aside className="w-1/3 max-w-sm border-r border-gray-200 bg-white shadow-sm flex flex-col"> {/* Adjusted width */}
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Conversations</h2> {/* Adjusted size */}
                    {connectedWallet ? (
                        <div className="mb-4">
                            <label className="block text-gray-600 text-xs font-medium mb-1 uppercase tracking-wider">View as:</label> {/* Adjusted style */}
                            <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
                                 <button
                                     className={`flex-1 px-3 py-1.5 text-sm transition-colors duration-150 ${isBuyerView ? 'bg-blue-500 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                     onClick={() => { setIsBuyerView(true); setActiveThread(null); }} // Clear active thread on view switch
                                 >
                                     Buyer
                                 </button>
                                 <button
                                     className={`flex-1 px-3 py-1.5 text-sm transition-colors duration-150 ${!isBuyerView ? 'bg-blue-500 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                     onClick={() => { setIsBuyerView(false); setActiveThread(null); }} // Clear active thread on view switch
                                 >
                                     Seller
                                 </button>
                            </div>
                        </div>
                    ) : (
                         <p className="text-sm text-gray-500">Connect wallet to see conversations.</p>
                    )}
                </div>

                {/* Thread List */}
                <div className="flex-grow overflow-y-auto">
                     {propertiesLoading && <p className="p-4 text-sm text-gray-500 text-center">Loading properties...</p>}
                    {!propertiesLoading && getFilteredThreads().length === 0 && !error && connectedWallet && (
                         <p className="p-4 text-sm text-gray-500 text-center">No conversations found for this view.</p>
                    )}
                    {getFilteredThreads().map((thread) => (
                        <div
                            key={thread.id}
                            className={`flex items-center gap-3 p-3 border-b border-gray-100 cursor-pointer transition-all duration-150 ${determineThreadStyle(thread)} ${isThreadUnread(thread) ? "font-semibold" : ""}`}
                            onClick={() => {
                                clearError();
                                // Mark as read happens in useEffect for activeThread
                                setActiveThread(thread);
                            }}
                        >
                            {/* Placeholder Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-200 to-indigo-300 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <span className="text-lg font-bold text-indigo-700">{getThreadName(thread)?.[0]?.toUpperCase() || '?'}</span>
                            </div>
                            {/* Thread Info */}
                            <div className="flex-grow overflow-hidden">
                                <div className={`text-sm font-medium ${isThreadUnread(thread) ? 'text-gray-900' : 'text-gray-700'} truncate`}>{getThreadName(thread)}</div>
                                <div className="text-xs text-gray-500 truncate">{propertyNames[thread.id] || 'Loading Property...'}</div>
                                {thread.status === "closed" && <span className="text-xs text-red-500 font-medium block">Closed</span>}
                            </div>
                            {/* Unread Indicator */}
                            {isThreadUnread(thread) && (
                                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mr-1 shadow-md"></div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Chat Area */}
            <div className="w-2/3 flex-grow flex flex-col bg-gray-50"> {/* Adjusted width */}
                 {/* Global Error/Status Display Area */}
                 {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-2.5 m-4 rounded shadow-md relative" role="alert">
                        <div className="flex justify-between items-center">
                            <div><strong className="font-bold">Error:</strong><span className="ml-2">{error}</span></div>
                            <button onClick={clearError} className="ml-4 text-red-500 hover:text-red-700 font-bold text-lg">×</button> {/* Larger close button */}
                        </div>
                    </div>
                 )}
                 {purchaseStatus && purchaseStatus !== 'pending' && purchaseStatus !== 'Transaction sent, awaiting confirmation...' && !error && ( // Only show final status if no error displayed
                    <div className={`px-4 py-2.5 m-4 rounded shadow-md border-l-4 ${purchaseStatus === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-yellow-100 border-yellow-500 text-yellow-700'}`} role="status">
                         <div className="flex justify-between items-center">
                            <div><strong className="font-bold">{purchaseStatus === 'success' ? 'Success:' : 'Info:'}</strong><span className="ml-2">{purchaseStatus === 'success' ? 'Property purchased successfully!' : purchaseStatus}</span></div>
                            <button onClick={() => setPurchaseStatus(null)} className="ml-4 text-inherit hover:opacity-75 font-bold text-lg">×</button>
                        </div>
                    </div>
                 )}


                {activeThread ? (
                    <>
                        {/* Chat Header */}
                        <div className="border-b border-gray-200 p-4 bg-white shadow-sm">
                            <h2 className="text-lg font-semibold text-gray-900">Chat with {getThreadName(activeThread)}</h2>
                            <p className="text-sm text-gray-600">Property: {propertyNames[activeThread.id] || 'Loading...'}</p>
                             {/* Display explicit purchasing indicator here */}
                            {isPurchasing && (
                                <div className="mt-2 flex items-center text-sm text-blue-600 font-medium">
                                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                                    <span>{purchaseStatus || 'Processing Purchase...'}</span>
                                </div>
                            )}
                            {/* Indicate if the conversation is closed */}
                             {activeThread.status === "closed" && !isPurchasing && (
                                <div className="mt-1 text-sm font-semibold text-red-600">Conversation Closed</div>
                             )}
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"> {/* Added scroll-smooth */}
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender_wallet?.toLowerCase() === connectedWallet ? 'justify-end' : 'justify-start'}`}>
                                     <div className={`max-w-lg lg:max-w-xl xl:max-w-2xl`} >
                                        {/* Regular Message */}
                                        {msg.type === "message" && (
                                            <div className={`relative group px-3.5 py-2 rounded-xl shadow-sm ${msg.sender_wallet?.toLowerCase() === connectedWallet ? "bg-blue-500 text-white rounded-br-none" : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"}`}>
                                                <p className="text-sm break-words">{msg.message}</p>
                                                <span className={`text-xs mt-1 pt-1 block text-right opacity-70 ${msg.sender_wallet?.toLowerCase() === connectedWallet ? 'text-blue-100' : 'text-gray-400'}`}>{moment(msg.created_at).fromNow()}</span>
                                                {/* Optional: Read receipt indicator (simple example) */}
                                                {/* {msg.sender_wallet?.toLowerCase() === connectedWallet && msg.read && <span className="text-xs absolute bottom-1 right-1 text-blue-200">✓✓</span>} */}
                                            </div>
                                        )}

                                        {/* Offer Message */}
                                        {msg.type === "offer" && (
                                            <div className={`bg-gradient-to-r ${msg.sender_wallet?.toLowerCase() === connectedWallet ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-green-50 to-green-100 border-green-200'} border rounded-lg shadow-md p-4 w-full`}>
                                                <div className="mb-2 flex justify-between items-baseline">
                                                     <span className="text-base font-semibold text-gray-800">
                                                        {msg.sender_wallet?.toLowerCase() === connectedWallet ? 'Offer Sent:' : 'Offer Received:'}
                                                    </span>
                                                    <span className="text-lg font-bold text-indigo-700">{msg.price} ETH</span>
                                                </div>
                                                {msg.message && ( <p className="text-gray-700 text-sm mb-3 bg-white/50 p-2 rounded italic border-l-2 border-gray-300">"{msg.message}"</p> )}

                                                {/* Offer Status & Actions */}
                                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200/50">
                                                    <span className="text-gray-500 text-xs">{moment(msg.created_at).fromNow()}</span>
                                                    {/* Show Accept/Reject only if pending, thread open, and current user is the SELLER */}
                                                    {msg.status === "pending" && activeThread.status !== "closed" && activeThread.seller_wallet?.toLowerCase() === connectedWallet && !isPurchasing && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleAcceptOffer(msg)}
                                                                className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-50 text-xs transition-colors duration-200 shadow-sm disabled:opacity-50"
                                                                disabled={isPurchasing}
                                                            >
                                                                <FontAwesomeIcon icon={faCheck} className="mr-1" /> Accept
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectOffer(msg.id)}
                                                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 text-xs transition-colors duration-200 shadow-sm disabled:opacity-50"
                                                                disabled={isPurchasing}
                                                            >
                                                                <FontAwesomeIcon icon={faTimes} className="mr-1" /> Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                    {/* Show Status Badge */}
                                                    {msg.status !== "pending" && (
                                                        <span className={`text-xs font-semibold py-0.5 px-2 rounded-full ${
                                                            msg.status === "accepted" ? "bg-green-100 text-green-700 ring-1 ring-green-200" :
                                                            msg.status === "rejected" ? "bg-red-100 text-red-700 ring-1 ring-red-200" :
                                                            "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200" // Should ideally not show pending here
                                                        }`}>
                                                            {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
                                                        </span>
                                                    )}
                                                    {/* Indicate if this offer is pending but another action is in progress */}
                                                     {msg.status === "pending" && activeThread.seller_wallet?.toLowerCase() === connectedWallet && isPurchasing && (
                                                        <span className="text-xs text-blue-500 font-medium">Purchase in progress...</span>
                                                     )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                             {/* Scroll anchor for new messages (optional) */}
                            {/* <div ref={messagesEndRef} /> */}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-200 shadow-sm">
                            {/* Offer Form (conditionally rendered) */}
                             {isOfferFormVisible && activeThread.buyer_wallet?.toLowerCase() === connectedWallet && activeThread.status !== "closed" && (
                                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-inner animate-fadeIn" style={{ animationDuration: "0.3s" }}>
                                    <h3 className="text-md font-semibold text-gray-800 mb-3">Make an Offer</h3>
                                    <div className="mb-3">
                                        <label htmlFor="offerPrice" className="block text-gray-700 text-sm font-bold mb-1">Offer Price (ETH): <span className="text-red-500">*</span></label>
                                        <input
                                            type="number"
                                            id="offerPrice"
                                            value={offerPrice}
                                            onChange={(e) => setOfferPrice(e.target.value)}
                                            placeholder="e.g., 1.5"
                                            step="any"
                                            min="0.000001" // Minimum value slightly above 0
                                            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="offerMessage" className="block text-gray-700 text-sm font-bold mb-1">Message (Optional):</label>
                                        <textarea
                                            id="offerMessage"
                                            value={offerMessage}
                                            onChange={(e) => setOfferMessage(e.target.value)}
                                            placeholder="Add an optional message to your offer..."
                                            rows={2}
                                            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        ></textarea>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleMakeOffer}
                                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!offerPrice || isNaN(parseFloat(offerPrice)) || parseFloat(offerPrice) <= 0 || isOfferPendingInThread}
                                        >
                                            Submit Offer
                                        </button>
                                        <button
                                            onClick={() => setIsOfferFormVisible(false)}
                                            className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                     {isOfferPendingInThread && <p className="text-sm text-yellow-600 mt-2">An offer is currently pending resolution.</p>}
                                </div>
                            )}

                            {/* Main Input Row */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={activeThread.status === "closed" ? "Conversation closed" : "Type a message..."}
                                    className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    onKeyDown={(e) => { if (e.key === 'Enter' && newMessage.trim() && activeThread.status !== "closed") { handleSendMessage(); } }}
                                    disabled={activeThread.status === "closed" || isPurchasing}
                                />
                                {/* Send Button */}
                                <button
                                    onClick={handleSendMessage}
                                    className={`bg-blue-500 hover:bg-blue-600 text-white font-bold p-3 rounded-full focus:outline-none focus:shadow-outline transition-all duration-200 flex items-center justify-center aspect-square disabled:opacity-50 disabled:cursor-not-allowed`}
                                    disabled={activeThread.status === "closed" || !newMessage.trim() || isPurchasing}
                                    title="Send Message"
                                >
                                    <FontAwesomeIcon icon={faPaperPlane} />
                                </button>
                                {/* Make Offer Button (only visible to buyer, if no offer pending/form open) */}
                                {activeThread.buyer_wallet?.toLowerCase() === connectedWallet && (
                                    <button
                                        onClick={() => setIsOfferFormVisible(!isOfferFormVisible)}
                                        className={`bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full focus:outline-none focus:shadow-outline transition-all duration-200 flex items-center justify-center aspect-square disabled:opacity-50 disabled:cursor-not-allowed`}
                                        disabled={activeThread.status === "closed" || isOfferPendingInThread || isOfferFormVisible || isPurchasing}
                                        title={isOfferFormVisible ? "Close Offer Form" : (isOfferPendingInThread ? "Offer Pending" : "Make Offer")}
                                    >
                                        <FontAwesomeIcon icon={faGift} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                     // Placeholder when no chat is active
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center bg-gray-50">
                         {!connectedWallet ? (
                            <>
                                 <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3zm0 2c2.761 0 5 1.194 5 2.667v1.333H7v-1.333C7 14.194 9.239 13 12 13z"></path><path d="M20.99 10.5l-1.414 1.414a.997.997 0 01-1.414 0l-1.414-1.414a5.985 5.985 0 00-8.484 0L6.858 11.914a.997.997 0 01-1.414 0l-1.414-1.414a7.963 7.963 0 0111.313 0l1.414 1.414a.997.997 0 010 1.414l-1.414 1.414a7.963 7.963 0 01-11.313 0L3.01 13.5"></path></svg>
                                 <p className="text-lg text-gray-600 font-medium">Please connect your wallet</p>
                                <p className="text-sm text-gray-500 mt-1">Use MetaMask or another compatible wallet to start chatting.</p>
                                <button
                                    onClick={connectWallet}
                                    className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-5 rounded-full focus:outline-none focus:shadow-outline transition-colors duration-200 text-sm"
                                >
                                    Connect Wallet
                                </button>
                            </>
                         ) : (propertiesLoading || (threads.length > 0 && Object.keys(propertyNames).length === 0 && !error)) ? (
                             <>
                                 <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-500 mb-4" />
                                 <p className="text-gray-500 text-lg">Loading conversations...</p>
                             </>
                         ) : (threads.length === 0 && !error) ? (
                              <p className="text-gray-500 text-lg">You have no conversations yet.</p>
                         ) : (
                             <p className="text-gray-500 text-lg">Select a conversation from the list to start chatting.</p>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatPage;