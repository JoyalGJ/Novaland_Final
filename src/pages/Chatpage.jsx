import React, { useState, useEffect, useCallback, useRef } from "react"; // Added useRef
import { ethers } from "ethers";
import { supabase } from "../../supabase";
import moment from "moment";
import contractABI from "../../contractABI2.json"; // Make sure this ABI matches Novaland_F2
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faGift, faCheck, faTimes, faSpinner, faShoppingCart } from '@fortawesome/free-solid-svg-icons'; // Added faShoppingCart

// --- Use the correct contract address for Novaland_F2 ---
const CONTRACT_ADDRESS = "0x5CfF31C181B3C5b038F8319d4Af79d2C43F11424"; // <--- UPDATE THIS

// --- Updated fetchPropertyFromBlockchain to fetch and filter ---
// Remains inefficient but necessary without FetchPropertyById in the contract.
const fetchPropertyFromBlockchain = async (propertyId, provider) => {
    try {
        console.log(`Attempting to fetch blockchain details for property ID: ${propertyId}`);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
        const allProperties = await contract.FetchProperties();
        const property = allProperties.find(p => Number(p.productID) === Number(propertyId)); // Ensure type consistency

        if (!property) {
            console.warn(`Property with ID ${propertyId} not found on blockchain via FetchProperties.`);
            return null;
        }

        console.log(`Found property ${propertyId} details via FetchProperties:`, property);
        // Convert BigNumber price to number for easier use, ensure lowercase address
        return {
            productID: Number(property.productID),
            owner: property.owner.toLowerCase(),
            price: Number(ethers.utils.formatEther(property.price)), // Convert Wei to Ether number
            propertyTitle: property.propertyTitle,
            category: property.category,
            images: property.images,
            location: property.location,
            documents: property.documents,
            description: property.description,
            nftId: property.nftId,
            isListed: property.isListed
        };
    } catch (error) {
        console.error(`Error fetching property ID ${propertyId} from blockchain:`, error);
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
    const [isOfferPendingInThread, setIsOfferPendingInThread] = useState(false);
    const [propertyNames, setPropertyNames] = useState({});
    const [allPropertiesMap, setAllPropertiesMap] = useState({}); // Stores full property details (price in ETH)
    const [propertiesLoading, setPropertiesLoading] = useState(false);
    const [isOfferFormVisible, setIsOfferFormVisible] = useState(false);
    const [isBuyerView, setIsBuyerView] = useState(true);
    const [error, setError] = useState(null);
    const [unreadThreads, setUnreadThreads] = useState({});
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchaseStatus, setPurchaseStatus] = useState(null); // 'pending', 'confirming', 'success', 'failed'
    const [acceptedOfferId, setAcceptedOfferId] = useState(null); // Track which offer was accepted

    const messagesEndRef = useRef(null); // Ref for scrolling

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom(); // Scroll whenever messages change
    }, [messages]);


    function clearError() {
        setError(null);
        setPurchaseStatus(null);
    }

    const connectWallet = useCallback(async () => {
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
                setConnectedWallet("");
            }
        } else {
            console.error("MetaMask not found.");
            setError("MetaMask not found. Please install MetaMask browser extension.");
            setConnectedWallet("");
        }
    }, []);

    const fetchUserNames = useCallback(async (wallets) => {
        const uniqueWallets = [...new Set(wallets)].filter(Boolean).map(w => w.toLowerCase()).filter(w => !userNames[w]);
        if (uniqueWallets.length === 0) return;
        try {
            const { data, error: fetchError } = await supabase.from("users").select("wallet_address, name").in("wallet_address", uniqueWallets);
            if (fetchError) throw fetchError;
            const nameMap = data.reduce((acc, user) => {
                acc[user.wallet_address.toLowerCase()] = user.name || `${user.wallet_address.substring(0, 6)}...${user.wallet_address.slice(-4)}`;
                return acc;
            }, {});
            setUserNames(prev => ({ ...prev, ...nameMap }));
        } catch (err) {
            console.error("Error fetching user names:", err);
            // Don't set global error, maybe log or show subtle warning
        }
    }, [userNames]);

    // --- Updated fetchAllPropertiesFromContract ---
    const fetchAllPropertiesFromContract = useCallback(async () => {
        // Fetch only if needed and not already loading
        if (propertiesLoading || Object.keys(allPropertiesMap).length > 0 || !window.ethereum) return;

        setPropertiesLoading(true);
        clearError();
        console.log("Fetching all properties from contract...");
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
            const properties = await contract.FetchProperties();
            console.log("Raw properties fetched:", properties);

            const propMap = {};
            const walletsToFetch = new Set();

            properties.forEach(prop => {
                 const propertyId = Number(prop.productID);
                 if (propertyId !== undefined && !isNaN(propertyId) && prop.owner) {
                    const ownerAddress = prop.owner.toLowerCase();
                    propMap[propertyId] = {
                         productID: propertyId,
                         owner: ownerAddress,
                         price: Number(ethers.utils.formatEther(prop.price)), // Store price in ETH
                         propertyTitle: prop.propertyTitle || "Unnamed Property",
                         category: prop.category,
                         images: prop.images,
                         location: prop.location,
                         documents: prop.documents,
                         description: prop.description,
                         nftId: prop.nftId,
                         isListed: prop.isListed
                     };
                     walletsToFetch.add(ownerAddress);
                 } else {
                    console.warn("Skipping property with invalid ID or missing owner:", prop);
                 }
            });

            console.log("Processed properties map:", propMap);
            setAllPropertiesMap(propMap);
            fetchUserNames(Array.from(walletsToFetch)); // Fetch names for owners

        } catch (err) {
            console.error("Error fetching properties from contract:", err);
            setError("Failed to fetch property details from the blockchain. Property info may be incomplete or stale.");
            setAllPropertiesMap({}); // Clear map on error
        } finally {
            setPropertiesLoading(false);
        }
    }, [propertiesLoading, allPropertiesMap, fetchUserNames]);

    const fetchThreads = useCallback(async () => {
        if (!connectedWallet) return;
        clearError();
        try {
            console.log("Fetching threads for wallet:", connectedWallet);
            const { data, error: fetchError } = await supabase
                .from("threads")
                .select("*")
                .or(`buyer_wallet.eq.${connectedWallet},seller_wallet.eq.${connectedWallet}`)
                .order("created_at", { ascending: false });

            if (fetchError) throw fetchError;

            const fetchedThreads = data || [];
            console.log("Fetched threads:", fetchedThreads);
            setThreads(fetchedThreads);

            if (fetchedThreads.length > 0) {
                const wallets = fetchedThreads.flatMap(t => [t.buyer_wallet, t.seller_wallet].filter(Boolean));
                fetchUserNames(wallets);

                // Check for unread messages across all fetched threads
                const threadIds = fetchedThreads.map(t => t.id);
                 const { data: unreadCounts, error: countError } = await supabase
                    .rpc('count_unread_messages_per_thread', { user_wallet: connectedWallet, thread_ids: threadIds });

                 if (countError) {
                     console.error("Error fetching unread counts:", countError);
                 } else {
                     const unreadMap = (unreadCounts || []).reduce((acc, item) => {
                         if (item.unread_count > 0) {
                             acc[item.thread_id] = true;
                         }
                         return acc;
                     }, {});
                     setUnreadThreads(unreadMap);
                     console.log("Unread threads map:", unreadMap);
                 }
            } else {
                 setUnreadThreads({}); // No threads, no unreads
            }
        } catch (err) {
            console.error("Error fetching threads:", err);
            setError("Failed to load conversations.");
            setThreads([]);
             setUnreadThreads({});
        }
    }, [connectedWallet, fetchUserNames]); // Dependencies

    const fetchMessages = useCallback(async (threadId) => {
        if (!threadId || !connectedWallet) return;
        try {
            console.log(`Fetching messages for thread ${threadId}`);
            const { data, error: fetchError } = await supabase
                .from("messages")
                .select("*")
                .eq("thread_id", threadId)
                .order("created_at", { ascending: true });

            if (fetchError) throw fetchError;

            const sortedMessages = data ? [...data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : [];
            console.log(`Fetched ${sortedMessages.length} messages for thread ${threadId}`);
            setMessages(sortedMessages);

            // Check for pending or accepted offer in this thread
            let pending = false;
            let acceptedId = null;
            sortedMessages.forEach(msg => {
                if (msg.type === "offer") {
                     if (msg.status === "pending") {
                         pending = true;
                     } else if (msg.status === "accepted") {
                         acceptedId = msg.id; // Store the ID of the accepted offer
                     }
                }
            });
            setIsOfferPendingInThread(pending);
            setAcceptedOfferId(acceptedId); // Set the accepted offer ID for this thread
            console.log(`Thread ${threadId} - Offer Pending: ${pending}, Accepted Offer ID: ${acceptedId}`);


            if (data?.length > 0) {
                 const wallets = data.map(msg => msg.sender_wallet).filter(Boolean);
                 fetchUserNames(wallets);
            }
        } catch (err) {
            console.error("Error fetching messages:", err);
            setError("An error occurred loading messages.");
            setMessages([]);
            setIsOfferPendingInThread(false);
            setAcceptedOfferId(null);
        }
    }, [connectedWallet, fetchUserNames]); // Dependencies

    const markMessagesAsRead = useCallback(async (threadId) => {
        if (!threadId || !connectedWallet) return;
        // Optimistically remove from unread state
        setUnreadThreads(prev => {
            if (!prev[threadId]) return prev; // No change needed if already not marked unread
            const newState = { ...prev };
            delete newState[threadId];
            return newState;
        });
        try {
            // Update read status in DB
            const { error: updateError } = await supabase
                .from("messages")
                .update({ read: true })
                .eq('thread_id', threadId)
                .neq('sender_wallet', connectedWallet)
                .is('read', null); // Only update those that are not already read

            if (updateError) {
                console.error(`Error marking messages as read for thread ${threadId}:`, updateError);
                // Optionally re-add to unread state on failure? Or just log.
            } else {
                console.log(`Marked messages as read in thread ${threadId}`);
            }
        } catch (err) {
            console.error('Unexpected error in markMessagesAsRead:', err);
        }
    }, [connectedWallet]); // Dependencies

    const getThreadName = useCallback((thread) => {
        if (!thread || !connectedWallet) return "Unknown";
        const otherWallet = (thread.buyer_wallet?.toLowerCase() === connectedWallet ? thread.seller_wallet : thread.buyer_wallet)?.toLowerCase();
        return userNames[otherWallet] || `${otherWallet?.substring(0, 6)}...${otherWallet?.slice(-4)}` || "Unknown User";
    }, [connectedWallet, userNames]);

    const isThreadUnread = useCallback((thread) => !!unreadThreads[thread.id], [unreadThreads]);

    const determineThreadStyle = useCallback((thread) => {
        if (activeThread?.id === thread.id) {
            return 'bg-blue-100 ring-2 ring-blue-300';
        } else if (thread.status === "closed") {
            return 'bg-gray-100 text-gray-500 hover:bg-gray-200 opacity-75';
        } else {
            return 'hover:bg-gray-100';
        }
    }, [activeThread]);

    const getFilteredThreads = useCallback(() => {
        return threads.filter(thread => {
            const walletToCheck = isBuyerView ? thread.buyer_wallet : thread.seller_wallet;
            return walletToCheck?.toLowerCase() === connectedWallet?.toLowerCase();
        });
    }, [threads, isBuyerView, connectedWallet]);

    // --- Effects ---

    // Initial connect and listener setup
    useEffect(() => {
        connectWallet();
        const handleAccountsChanged = (accounts) => {
            console.log("Wallet account changed:", accounts);
            if (accounts.length === 0) {
                setConnectedWallet("");
                setThreads([]); setActiveThread(null); setMessages([]); setUserNames({});
                setPropertyNames({}); setAllPropertiesMap({}); setPropertiesLoading(false);
                setUnreadThreads({}); setError("Wallet disconnected."); setIsBuyerView(true);
            } else {
                // Reconnect or update if address changed
                if (accounts[0].toLowerCase() !== connectedWallet) {
                    connectWallet(); // This will reset state via the connectedWallet effect
                }
            }
        };
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }
        return () => {
            if (window.ethereum?.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, [connectWallet, connectedWallet]); // Added connectedWallet dependency here

    // Fetch data when wallet connects or view changes
     useEffect(() => {
        if (connectedWallet) {
            console.log("Connected wallet detected, fetching initial data.");
            fetchAllPropertiesFromContract(); // Fetch properties if map is empty
            fetchThreads(); // Fetch threads for the current view/wallet
        } else {
            // Clear state if wallet disconnects
            setThreads([]); setActiveThread(null); setMessages([]); setUserNames({});
            setPropertyNames({}); /* Keep properties map? */ setPropertiesLoading(false);
            setUnreadThreads({}); setIsBuyerView(true);
        }
        // Rerun when connectedWallet changes
    }, [connectedWallet, fetchAllPropertiesFromContract, fetchThreads]);

    // Map property names when threads or properties load/change
    useEffect(() => {
        const mapIsReady = Object.keys(allPropertiesMap).length > 0;
        if (threads.length > 0 && (mapIsReady || !propertiesLoading)) {
            console.log("Updating property names for threads...");
            const newPropertyNames = {};
            const missingPropertyIds = new Set();

            threads.forEach(thread => {
                const propertyId = thread.property_id;
                if (propertyId !== undefined && propertyId !== null) {
                    const propertyDetails = allPropertiesMap[propertyId];
                    if (propertyDetails) {
                        newPropertyNames[thread.id] = propertyDetails.propertyTitle || "Unnamed Property";
                    } else if (!propertiesLoading) {
                        newPropertyNames[thread.id] = "Unknown Property (Re-fetching...)";
                        missingPropertyIds.add(propertyId);
                    } else {
                        newPropertyNames[thread.id] = "Loading Property Info...";
                    }
                } else {
                    newPropertyNames[thread.id] = "Property ID Missing";
                }
            });

            // Only update state if needed
            if (JSON.stringify(newPropertyNames) !== JSON.stringify(propertyNames)) {
                setPropertyNames(newPropertyNames);
            }

            // Attempt to fetch details for missing properties individually
            if (missingPropertyIds.size > 0 && window.ethereum && !propertiesLoading) {
                 console.log("Found missing property IDs, attempting individual fetch:", [...missingPropertyIds]);
                 (async () => {
                    try {
                        const provider = new ethers.providers.Web3Provider(window.ethereum);
                        const fetchedProperties = {};
                        let fetchedCount = 0;

                        for (const id of missingPropertyIds) {
                            // Avoid re-fetching if already in map (async race condition)
                            if(!allPropertiesMap[id]) {
                                const propertyData = await fetchPropertyFromBlockchain(id, provider);
                                if (propertyData) {
                                    fetchedProperties[id] = propertyData;
                                    fetchedCount++;
                                }
                            }
                        }

                        if (fetchedCount > 0) {
                            console.log(`Adding ${fetchedCount} fetched missing properties to map.`);
                            setAllPropertiesMap(prev => ({ ...prev, ...fetchedProperties }));
                            // Property names will update automatically in the next render cycle due to map change
                        }
                    } catch (fetchError) {
                        console.error("Error fetching missing property details:", fetchError);
                        // Maybe show a subtle error that some property info couldn't be loaded
                    }
                 })();
            }
        } else if (threads.length > 0 && propertiesLoading) {
             // Show loading state for property names while properties are loading
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

    }, [threads, allPropertiesMap, propertiesLoading, propertyNames]); // Removed fetchPropertyFromBlockchain from deps


    // Fetch messages for active thread
    useEffect(() => {
        if (activeThread) {
            fetchMessages(activeThread.id);
            markMessagesAsRead(activeThread.id);
            setIsOfferFormVisible(false); // Hide offer form
            setPurchaseStatus(null); // Clear purchase status
            setError(null); // Clear errors
        } else {
            setMessages([]); // Clear messages when no thread is active
            setAcceptedOfferId(null); // Clear accepted offer ID
             setIsOfferPendingInThread(false); // Clear pending offer status
        }
    }, [activeThread, fetchMessages, markMessagesAsRead]); // Dependencies

    // Supabase Realtime Subscriptions
     useEffect(() => {
        if (!connectedWallet) return () => {}; // No subscription if not connected

        console.log("Setting up Supabase subscriptions for wallet:", connectedWallet);
        const myWalletLower = connectedWallet.toLowerCase();

        // Function to handle incoming message payload
        const handleIncomingMessage = (payload) => {
             console.log("Realtime: Message change detected", payload);
             const msg = payload.new || (payload.eventType === 'DELETE' ? payload.old : null);
             if (!msg) return;

             const isInsert = payload.eventType === 'INSERT';
             const isUpdate = payload.eventType === 'UPDATE';

             // Ignore own sent messages for inserts (already handled optimistically potentially)
             // But process own updates (e.g., offer status change initiated elsewhere)
             if (isInsert && msg.sender_wallet?.toLowerCase() === myWalletLower) {
                 console.log("Realtime: Ignoring own inserted message.");
                 return;
             }

             // Check if message relates to the active thread
             if (activeThread && msg.thread_id === activeThread.id) {
                 console.log("Realtime: Change in active thread, refetching messages & marking read.");
                 fetchMessages(activeThread.id);
                 markMessagesAsRead(activeThread.id); // Mark as read immediately if it's for the active thread
             } else {
                  // Message is for an inactive thread
                 // Mark thread as unread only if it's a new message from someone else
                 if (isInsert && msg.sender_wallet?.toLowerCase() !== myWalletLower) {
                     console.log(`Realtime: New message in inactive thread ${msg.thread_id}, marking unread.`);
                     setUnreadThreads(prev => ({ ...prev, [msg.thread_id]: true }));
                      // Optionally refetch threads list immediately if needed for sidebar update
                     // fetchThreads();
                 } else if (isUpdate) {
                     // If an offer status changed in an inactive thread, might need to refetch threads
                     // if thread status depends on it (e.g., showing 'Offer Accepted')
                     if (msg.type === 'offer' && (msg.status === 'accepted' || msg.status === 'rejected')) {
                         console.log("Realtime: Offer status changed in inactive thread, refetching threads list.");
                         fetchThreads();
                     }
                 }
             }

              // If an offer was accepted or rejected (anywhere), refetch threads as thread status might change
             if (msg.type === 'offer' && (msg.status === 'accepted' || msg.status === 'rejected')) {
                 // Use timeout to avoid potential race condition with message fetch for active thread
                 setTimeout(fetchThreads, 100);
             }
        };

        // Subscribe to messages channel
        const messagesSubscription = supabase.channel(`public:messages`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, handleIncomingMessage)
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') console.log('Realtime: Subscribed to messages channel');
                else console.error("Realtime: Error subscribing to messages:", err || status);
            });


         // Subscribe to threads channel (for changes involving the user)
         const threadsSubscription = supabase.channel(`public:threads:user=${myWalletLower}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'threads',
                filter: `buyer_wallet=eq.${myWalletLower}` // Filter for buyer
              }, (payload) => {
                 console.log("Realtime: Thread change detected (user as buyer)", payload);
                 fetchThreads(); // Refetch thread list
             })
             .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'threads',
                filter: `seller_wallet=eq.${myWalletLower}` // Filter for seller
              }, (payload) => {
                 console.log("Realtime: Thread change detected (user as seller)", payload);
                 fetchThreads(); // Refetch thread list
             })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') console.log('Realtime: Subscribed to relevant threads channel');
                else console.error("Realtime: Error subscribing to threads:", err || status);
            });

        return () => {
            console.log("Cleaning up Supabase subscriptions.");
            supabase.removeChannel(messagesSubscription);
            supabase.removeChannel(threadsSubscription);
        };
    }, [connectedWallet, activeThread, fetchMessages, fetchThreads, markMessagesAsRead]); // Dependencies

    // --- Event Handlers ---

    const handleSendMessage = useCallback(async () => {
        if (!newMessage.trim() || !activeThread || activeThread.status === "closed" || !connectedWallet || isPurchasing) return;
        clearError();
        const tempMessage = newMessage;
        setNewMessage(""); // Optimistic UI

        try {
            const { data, error: insertError } = await supabase.from("messages").insert({
                thread_id: activeThread.id,
                sender_wallet: connectedWallet,
                message: tempMessage,
                type: "message",
                read: null
            }).select(); // Select to get the inserted row

            if (insertError) throw insertError;

            // Manually add message to state for instant feedback (alternative to relying solely on subscription)
             if (data && data[0]) {
                 setMessages(prev => [...prev, data[0]]);
                 scrollToBottom(); // Scroll after adding message
             } else {
                 // Fallback if select fails or returns nothing unexpected
                  fetchMessages(activeThread.id); // Refetch as a fallback
             }

        } catch (err) {
            console.error("Error sending message:", err);
            setError("Failed to send message.");
            setNewMessage(tempMessage); // Revert
        }
    }, [newMessage, activeThread, connectedWallet, isPurchasing, fetchMessages]); // Added fetchMessages dependency

    const handleMakeOffer = useCallback(async () => {
        if (activeThread?.buyer_wallet?.toLowerCase() !== connectedWallet?.toLowerCase()) {
             setError("Only the buyer can make an offer."); return;
        }
        if (!offerPrice || !activeThread || activeThread.status === "closed" || isOfferPendingInThread || !connectedWallet || isPurchasing) {
             if (isOfferPendingInThread) setError("An offer is already pending.");
             else setError("Cannot make offer. Ensure price is valid and conversation is active/not closed.");
             return;
        }

        clearError();
        const price = parseFloat(offerPrice);
        if (isNaN(price) || price <= 0) {
            setError("Please enter a valid positive offer price."); return;
        }

        const tempOfferPrice = offerPrice;
        const tempOfferMessage = offerMessage;
        setIsOfferFormVisible(false); // Optimistic hide
        setOfferPrice(""); setOfferMessage("");

        try {
            const { data, error: insertError } = await supabase.from("messages").insert({
                thread_id: activeThread.id,
                sender_wallet: connectedWallet,
                message: tempOfferMessage,
                price: price,
                type: "offer",
                status: "pending",
                read: null
            }).select();

            if (insertError) throw insertError;

            setIsOfferPendingInThread(true); // Set pending status
             // Manually add message to state
             if (data && data[0]) {
                 setMessages(prev => [...prev, data[0]]);
                 scrollToBottom();
             } else {
                  fetchMessages(activeThread.id); // Fallback refetch
             }
        } catch (err) {
            console.error("Error making offer:", err);
            setError("Failed to submit offer.");
            setIsOfferFormVisible(true); // Re-show form on failure
            setOfferPrice(tempOfferPrice); setOfferMessage(tempOfferMessage);
        }
    }, [offerPrice, offerMessage, activeThread, isOfferPendingInThread, connectedWallet, isPurchasing, fetchMessages]); // Added fetchMessages

    // --- SELLER accepts offer (updates DB only) ---
    const handleAcceptOffer = useCallback(async (offerMessageToAccept) => {
         if (!activeThread || activeThread.status === "closed" || !connectedWallet || isPurchasing) return;
        if (activeThread.seller_wallet?.toLowerCase() !== connectedWallet?.toLowerCase()) {
            setError("Only the seller can accept offers."); return;
        }
        if (offerMessageToAccept.sender_wallet?.toLowerCase() === connectedWallet?.toLowerCase()) {
             setError("You cannot accept your own offer."); return;
        }
        if (offerMessageToAccept.status !== 'pending') {
             setError("This offer is not pending."); return;
        }

        clearError();
        console.log(`Seller accepting offer ${offerMessageToAccept.id} in thread ${activeThread.id} (Database Update Only)`);

        try {
            // Update the message status to "accepted"
            const { error: updateMsgError } = await supabase
                .from("messages")
                .update({ status: "accepted" })
                .eq("id", offerMessageToAccept.id);

            if (updateMsgError) throw updateMsgError;

            console.log("Offer status updated to 'accepted' in database.");
            // Realtime listener should handle UI updates for both buyer and seller.
            // Explicitly fetch messages here to ensure the accepted status and buyer's button appear.
            fetchMessages(activeThread.id);
            setIsOfferPendingInThread(false); // No longer pending
            setAcceptedOfferId(offerMessageToAccept.id); // Set accepted ID

             // Maybe update thread status to 'offer_accepted'? Optional.
            /*
            const { error: updateThreadError } = await supabase
                .from("threads")
                .update({ status: "offer_accepted" }) // Custom status
                .eq("id", activeThread.id);
            if (updateThreadError) console.warn("Could not update thread status to offer_accepted");
            */

        } catch (err) {
            console.error("Error accepting offer (database update):", err);
            setError("Failed to update offer status in database. Please try again.");
        }
        // NO blockchain interaction here
    }, [activeThread, connectedWallet, isPurchasing, fetchMessages]); // Added fetchMessages

    const handleRejectOffer = useCallback(async (offerId) => {
        if (!activeThread || activeThread.status === "closed" || !connectedWallet || isPurchasing) return;
         if (activeThread.seller_wallet?.toLowerCase() !== connectedWallet?.toLowerCase()) {
            setError("Only the seller can reject offers."); return;
        }

        clearError();
        try {
            const { error: updateError } = await supabase
                .from("messages")
                .update({ status: "rejected" })
                .eq("id", offerId)
                .eq("status", "pending"); // Ensure we only reject pending offers

            if (updateError) throw updateError;

            console.log("Offer rejected successfully in database.");
            fetchMessages(activeThread.id); // Refetch to show rejected status
            setIsOfferPendingInThread(false); // No longer pending (if it was this offer)

        } catch (err) {
            console.error("Error rejecting offer:", err);
            setError("Failed to reject offer.");
        }
    }, [activeThread, connectedWallet, fetchMessages, isPurchasing]);

    // --- BUYER proceeds to purchase (calls Blockchain) ---
    const handleProceedToPurchase = useCallback(async () => {
        if (!activeThread || activeThread.status === "closed" || !connectedWallet || isPurchasing || !acceptedOfferId) {
             console.warn("Proceed to purchase aborted. Conditions not met:", { activeThread, connectedWallet, isPurchasing, acceptedOfferId });
             setError("Cannot proceed with purchase. Ensure an offer is accepted and the conversation is active.");
             return;
         }
         // Ensure the current user is the BUYER
         if (activeThread.buyer_wallet?.toLowerCase() !== connectedWallet?.toLowerCase()) {
             setError("Only the buyer can initiate the purchase after an offer is accepted.");
             return;
         }

        clearError();
        setIsPurchasing(true);
        setPurchaseStatus('pending');
        const propertyIdToPurchase = activeThread.property_id;

        console.log(`Buyer proceeding to purchase property ${propertyIdToPurchase}. Accepted Offer ID: ${acceptedOfferId}`);

        if (!window.ethereum) {
            setError("MetaMask is not available."); setIsPurchasing(false); setPurchaseStatus('failed'); return;
        }

        try {
            // --- Step 1: Get Property Details (Especially Original Price and Status) ---
             let propertyDetails = allPropertiesMap[propertyIdToPurchase];
             if (!propertyDetails) {
                 console.log("Property details not in map, fetching from blockchain...");
                 setPurchaseStatus('Fetching latest property data...');
                 const provider = new ethers.providers.Web3Provider(window.ethereum);
                 propertyDetails = await fetchPropertyFromBlockchain(propertyIdToPurchase, provider);

                 if (propertyDetails) {
                      // Cache the fetched details
                     setAllPropertiesMap(prev => ({...prev, [propertyIdToPurchase]: propertyDetails}));
                 } else {
                     throw new Error("Failed to fetch property details from blockchain. Cannot proceed.");
                 }
             }

             // --- Step 2: Validate Conditions ---
             setPurchaseStatus('Validating purchase conditions...');
             if (!propertyDetails.isListed) {
                 throw new Error("Property is no longer listed for sale.");
             }
             if (propertyDetails.owner?.toLowerCase() !== activeThread.seller_wallet?.toLowerCase()) {
                 console.warn("Potential owner mismatch:", {cachedOwner: propertyDetails.owner, threadSeller: activeThread.seller_wallet});
                 throw new Error("Property owner may have changed. Cannot proceed.");
             }
             // Price MUST match the contract's listing price
             const requiredPriceETH = propertyDetails.price; // Price is already in ETH from map/fetch
             if (requiredPriceETH <= 0) {
                 throw new Error("Invalid property price found.");
             }
             const purchasePriceWei = ethers.utils.parseEther(requiredPriceETH.toString());
             console.log(`Contract requires ${requiredPriceETH} ETH ( ${purchasePriceWei.toString()} Wei )`);

            // --- Step 3: Blockchain Transaction (PurchaseProperty) ---
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
            const buyerAddress = connectedWallet; // Buyer calls, passes their own address

            console.log(`Calling PurchaseProperty(ID: ${propertyIdToPurchase}, Buyer: ${buyerAddress}) with value: ${purchasePriceWei.toString()} Wei`);
            setPurchaseStatus('Awaiting confirmation in MetaMask...');

            const tx = await contract.PurchaseProperty(
                propertyIdToPurchase,
                buyerAddress, // Pass buyer's address as the 'buyer' parameter
                { value: purchasePriceWei }
             );

            console.log("Purchase transaction sent:", tx.hash);
            setPurchaseStatus('Transaction sent, confirming on blockchain...');

            const receipt = await tx.wait();
            console.log("Purchase transaction confirmed:", receipt);

            if (receipt.status === 0) {
                 throw new Error("Blockchain transaction failed (reverted). Check transaction on Etherscan.");
            }

            console.log("Property purchase successful on blockchain!");
            setPurchaseStatus('success');

            // --- Step 4: Update Supabase Database (Thread Status) ---
            try {
                console.log(`Updating Supabase: Thread ${activeThread.id} to closed.`);
                const { error: updateThreadError } = await supabase
                    .from("threads")
                    .update({ status: "closed" })
                    .eq("id", activeThread.id);

                if (updateThreadError) {
                    console.error("Error updating thread status to closed:", updateThreadError);
                    // Don't overwrite success message, maybe log a warning
                    setError("Purchase successful, but failed to update conversation status in database. Refresh may be needed.");
                }

                 // --- Step 5: Update Local State ---
                fetchThreads(); // Refetch threads to get the updated status
                // Refetch messages? Not strictly necessary unless status change needs display
                // fetchMessages(activeThread.id);
                 // Update active thread state locally
                setActiveThread(prev => prev ? ({ ...prev, status: "closed" }) : null);
                // Refetch ALL properties to update owner/listing status globally in the app's cache
                 fetchAllPropertiesFromContract();


            } catch (dbError) {
                 console.error("Error updating database after successful purchase:", dbError);
                 setError("Blockchain purchase successful, but failed during database update. Property is yours, but conversation status may be outdated.");
                 // Still refetch data
                 fetchThreads();
                 setActiveThread(prev => prev ? ({ ...prev, status: "closed" }) : null); // Optimistic close
            }

        } catch (err) {
            console.error("Error during purchase process:", err);
            let userFriendlyError = "An unexpected error occurred during the purchase.";
             if (err.code === 4001) userFriendlyError = "Transaction rejected in MetaMask.";
             else if (err.message?.includes("reverted")) userFriendlyError = "Blockchain transaction failed. Possible reasons: Not listed, price mismatch, insufficient funds, owner changed, or other contract issue.";
             else if (err.message?.includes("insufficient funds")) userFriendlyError = "Insufficient funds for transaction + gas.";
            else if (err.message) userFriendlyError = `Purchase failed: ${err.message}`;
            setError(userFriendlyError);
            setPurchaseStatus('failed');
        } finally {
            setIsPurchasing(false); // Stop loading indicator
        }
    }, [activeThread, connectedWallet, isPurchasing, acceptedOfferId, allPropertiesMap, fetchThreads, fetchAllPropertiesFromContract]); // Dependencies


    // --- Render Logic ---

    return (
        <div className="flex h-screen bg-gray-100 font-sans">

            {/* Sidebar */}
            <aside className="w-1/3 max-w-sm border-r border-gray-200 bg-white shadow-sm flex flex-col">
                 {/* Header + View Toggle */}
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Conversations</h2>
                    {connectedWallet ? (
                        <div className="mb-2">
                            {/* View Toggle Buttons */}
                            <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
                                <button
                                    className={`flex-1 px-3 py-1.5 text-sm transition-colors duration-150 ${isBuyerView ? 'bg-blue-500 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    onClick={() => { setIsBuyerView(true); setActiveThread(null); }}
                                >
                                    Buying
                                </button>
                                <button
                                    className={`flex-1 px-3 py-1.5 text-sm transition-colors duration-150 ${!isBuyerView ? 'bg-blue-500 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    onClick={() => { setIsBuyerView(false); setActiveThread(null); }}
                                >
                                    Selling
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 truncate">Wallet: {connectedWallet}</p>
                        </div>
                    ) : (
                         <p className="text-sm text-gray-500">Connect wallet to view conversations.</p>
                    )}
                </div>

                {/* Thread List */}
                <div className="flex-grow overflow-y-auto">
                     {propertiesLoading && !threads.length && <p className="p-4 text-sm text-gray-500 text-center">Loading properties & conversations...</p>}
                     {!propertiesLoading && getFilteredThreads().length === 0 && !error && connectedWallet && (
                         <p className="p-4 text-sm text-gray-500 text-center">No conversations found for this view.</p>
                    )}
                    {getFilteredThreads().map((thread) => (
                        <div
                            key={thread.id}
                            className={`flex items-center gap-3 p-3 border-b border-gray-100 cursor-pointer transition-all duration-150 ${determineThreadStyle(thread)} ${isThreadUnread(thread) ? "font-bold" : ""}`}
                            onClick={() => {
                                if (activeThread?.id !== thread.id) {
                                     setActiveThread(thread);
                                }
                            }}
                        >
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${isThreadUnread(thread) ? 'bg-gradient-to-br from-blue-400 to-indigo-500' : 'bg-gradient-to-br from-gray-200 to-gray-300'}`}>
                                <span className={`text-lg font-bold ${isThreadUnread(thread) ? 'text-white' : 'text-gray-600'}`}>{getThreadName(thread)?.[0]?.toUpperCase() || '?'}</span>
                            </div>
                            <div className="flex-grow overflow-hidden">
                                <div className={`text-sm font-medium ${isThreadUnread(thread) ? 'text-gray-900' : 'text-gray-700'} truncate`}>{getThreadName(thread)}</div>
                                <div className="text-xs text-gray-500 truncate">{propertyNames[thread.id] || 'Loading Property...'}</div>
                                {thread.status === "closed" && <span className="text-xs text-red-500 font-medium block mt-0.5">Closed</span>}
                                {/* Optionally indicate accepted offer status here too */}
                                {/* {thread.status === "offer_accepted" && <span className="text-xs text-green-500 font-medium block mt-0.5">Offer Accepted</span>} */}
                            </div>
                            {isThreadUnread(thread) && (
                                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mr-1 shadow-md animate-pulse"></div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Chat Area */}
            <div className="w-2/3 flex-grow flex flex-col bg-gray-50">
                 {/* Global Error/Status Display */}
                 <div className="sticky top-0 z-10 p-2 space-y-2 bg-gray-50"> {/* Make errors sticky */}
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-2.5 rounded shadow-md relative animate-shake" role="alert">
                            <div className="flex justify-between items-center">
                                <div><strong className="font-bold">Error:</strong><span className="ml-2">{error}</span></div>
                                <button onClick={clearError} className="ml-4 text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
                            </div>
                        </div>
                    )}
                    {/* Detailed Purchase Status */}
                    {isPurchasing && purchaseStatus && purchaseStatus !== 'success' && purchaseStatus !== 'failed' && (
                         <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 px-4 py-2.5 rounded shadow-md flex items-center" role="status">
                             <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-3" />
                             <strong className="font-bold">Processing:</strong><span className="ml-2">{purchaseStatus}...</span>
                         </div>
                    )}
                     {/* Final Purchase Status (non-error) */}
                    {purchaseStatus === 'success' && !error && (
                        <div className={`bg-green-100 border-l-4 border-green-500 text-green-700 px-4 py-2.5 rounded shadow-md`} role="status">
                            <div className="flex justify-between items-center">
                                <div><strong className="font-bold">Success:</strong><span className="ml-2">Property purchased successfully!</span></div>
                                <button onClick={() => setPurchaseStatus(null)} className="ml-4 text-inherit hover:opacity-75 font-bold text-lg leading-none">×</button>
                            </div>
                        </div>
                    )}
                </div>


                {activeThread ? (
                    <>
                        {/* Chat Header */}
                        <div className="border-b border-gray-200 p-4 bg-white shadow-sm sticky top-0 z-10"> {/* Make header sticky */}
                            <h2 className="text-lg font-semibold text-gray-900">Chat with {getThreadName(activeThread)}</h2>
                            <p className="text-sm text-gray-600">Property: {propertyNames[activeThread.id] || 'Loading...'}</p>
                            {activeThread.status === "closed" && !isPurchasing && (
                                <div className="mt-1 text-sm font-semibold text-red-600">Conversation Closed</div>
                             )}
                             {/* Add explicit message if purchase failed but thread not closed yet */}
                              {purchaseStatus === 'failed' && activeThread.status !== 'closed' && (
                                <div className="mt-1 text-sm font-semibold text-red-600">Purchase Failed. See error above.</div>
                              )}
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender_wallet?.toLowerCase() === connectedWallet ? 'justify-end' : 'justify-start'}`}>
                                     <div className={`max-w-lg lg:max-w-xl xl:max-w-2xl`} >
                                        {/* Regular Message */}
                                        {msg.type === "message" && (
                                            <div className={`relative group px-3.5 py-2 rounded-xl shadow-sm ${msg.sender_wallet?.toLowerCase() === connectedWallet ? "bg-blue-500 text-white rounded-br-none" : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"}`}>
                                                <p className="text-sm break-words">{msg.message}</p>
                                                <span className={`text-xs mt-1 pt-1 block text-right opacity-70 ${msg.sender_wallet?.toLowerCase() === connectedWallet ? 'text-blue-100' : 'text-gray-400'}`}>{moment(msg.created_at).fromNow()}</span>
                                            </div>
                                        )}

                                        {/* Offer Message */}
                                        {msg.type === "offer" && (
                                            <div className={`bg-gradient-to-r ${msg.sender_wallet?.toLowerCase() === connectedWallet ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-green-50 to-green-100 border-green-200'} border rounded-lg shadow-md p-4 w-full my-2`}>
                                                <div className="mb-2 flex justify-between items-baseline">
                                                     <span className="text-base font-semibold text-gray-800">
                                                        {msg.sender_wallet?.toLowerCase() === connectedWallet ? 'Offer Sent:' : 'Offer Received:'}
                                                    </span>
                                                    <span className="text-lg font-bold text-indigo-700">{msg.price} ETH</span>
                                                </div>
                                                {msg.message && ( <p className="text-gray-700 text-sm mb-3 bg-white/50 p-2 rounded italic border-l-2 border-gray-300">"{msg.message}"</p> )}

                                                {/* Offer Status & Actions */}
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-2 pt-2 border-t border-gray-200/50 space-y-2 sm:space-y-0">
                                                    <span className="text-gray-500 text-xs">{moment(msg.created_at).fromNow()}</span>

                                                     {/* SELLER's Accept/Reject Buttons */}
                                                    {msg.status === "pending" && activeThread.status !== "closed" && activeThread.seller_wallet?.toLowerCase() === connectedWallet && !isPurchasing && (
                                                        <div className="flex gap-2 self-end sm:self-center">
                                                            <button onClick={() => handleAcceptOffer(msg)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-xs transition-colors duration-200 shadow-sm disabled:opacity-50" disabled={isPurchasing}>
                                                                <FontAwesomeIcon icon={faCheck} className="mr-1" /> Accept
                                                            </button>
                                                            <button onClick={() => handleRejectOffer(msg.id)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-xs transition-colors duration-200 shadow-sm disabled:opacity-50" disabled={isPurchasing}>
                                                                <FontAwesomeIcon icon={faTimes} className="mr-1" /> Reject
                                                            </button>
                                                        </div>
                                                    )}

                                                     {/* BUYER's Purchase Button */}
                                                    {msg.status === "accepted" && activeThread.status !== "closed" && activeThread.buyer_wallet?.toLowerCase() === connectedWallet && !isPurchasing && (
                                                         <div className="flex flex-col items-end sm:items-center w-full sm:w-auto">
                                                            <button onClick={handleProceedToPurchase} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-4 rounded text-sm transition-colors duration-200 shadow-sm disabled:opacity-50 flex items-center gap-2" disabled={isPurchasing}>
                                                                <FontAwesomeIcon icon={faShoppingCart} /> Proceed to Purchase
                                                            </button>
                                                             {/* Important Note about Price */}
                                                             <p className="text-xs text-orange-600 mt-1 text-right sm:text-center font-medium">Note: Purchase will use the original listing price ({allPropertiesMap[activeThread.property_id]?.price || '...'} ETH).</p>
                                                        </div>
                                                    )}

                                                    {/* Status Badge */}
                                                     <div className={`text-xs font-semibold py-0.5 px-2 rounded-full self-start sm:self-center ${
                                                            msg.status === "accepted" ? "bg-green-100 text-green-700 ring-1 ring-green-200" :
                                                            msg.status === "rejected" ? "bg-red-100 text-red-700 ring-1 ring-red-200" :
                                                            msg.status === "pending" ? "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200" : ""
                                                        }`}>
                                                            {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
                                                    </div>

                                                     {/* Indicate if action is blocked by purchase process */}
                                                     {(msg.status === "pending" || msg.status === "accepted") && isPurchasing && (
                                                        <span className="text-xs text-blue-500 font-medium self-start sm:self-center">Purchase in progress...</span>
                                                     )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                             {/* Scroll anchor */}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-200 shadow-sm sticky bottom-0"> {/* Make input sticky */}
                            {/* Offer Form */}
                             {isOfferFormVisible && activeThread.buyer_wallet?.toLowerCase() === connectedWallet && activeThread.status !== "closed" && (
                                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-inner animate-fadeIn" style={{ animationDuration: "0.3s" }}>
                                    {/* ... Offer form inputs (price, message) ... */}
                                     <h3 className="text-md font-semibold text-gray-800 mb-3">Make an Offer</h3>
                                     {/* Price Input */}
                                     <div className="mb-3">
                                        <label htmlFor="offerPrice" className="block text-gray-700 text-sm font-bold mb-1">Offer Price (ETH): <span className="text-red-500">*</span></label>
                                        <input type="number" id="offerPrice" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="e.g., 1.5" step="any" min="0.000001" className="input-style" required />
                                    </div>
                                     {/* Message Input */}
                                    <div className="mb-3">
                                        <label htmlFor="offerMessage" className="block text-gray-700 text-sm font-bold mb-1">Message (Optional):</label>
                                        <textarea id="offerMessage" value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} placeholder="Add an optional message..." rows={2} className="input-style"></textarea>
                                    </div>
                                     {/* Buttons */}
                                    <div className="flex gap-3 items-center">
                                        <button onClick={handleMakeOffer} className="btn-primary bg-green-500 hover:bg-green-600 disabled:bg-green-300" disabled={!offerPrice || isNaN(parseFloat(offerPrice)) || parseFloat(offerPrice) <= 0 || isOfferPendingInThread || isPurchasing}> Submit Offer </button>
                                        <button onClick={() => setIsOfferFormVisible(false)} className="btn-secondary bg-gray-400 hover:bg-gray-500"> Cancel </button>
                                         {isOfferPendingInThread && <p className="text-sm text-yellow-600 font-medium">An offer is currently pending.</p>}
                                    </div>
                                </div>
                            )}

                            {/* Main Input Row */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={activeThread.status === "closed" ? "Conversation closed" : (isPurchasing ? "Purchase in progress..." : "Type a message...")}
                                    className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    onKeyDown={(e) => { if (e.key === 'Enter' && newMessage.trim() && activeThread.status !== "closed" && !isPurchasing) { handleSendMessage(); } }}
                                    disabled={activeThread.status === "closed" || isPurchasing}
                                />
                                {/* Send Button */}
                                <button onClick={handleSendMessage} className="btn-icon bg-blue-500 hover:bg-blue-600 disabled:opacity-50" disabled={activeThread.status === "closed" || !newMessage.trim() || isPurchasing} title="Send Message"> <FontAwesomeIcon icon={faPaperPlane} /> </button>
                                {/* Make Offer Button */}
                                {activeThread.buyer_wallet?.toLowerCase() === connectedWallet && activeThread.status !== "closed" && (
                                    <button onClick={() => setIsOfferFormVisible(!isOfferFormVisible)} className="btn-icon bg-green-500 hover:bg-green-600 disabled:opacity-50" disabled={isOfferPendingInThread || isOfferFormVisible || isPurchasing || !!acceptedOfferId} title={isOfferFormVisible ? "Close Offer Form" : (isOfferPendingInThread ? "Offer Pending" : (acceptedOfferId ? "Offer Accepted" : "Make Offer"))} > <FontAwesomeIcon icon={faGift} /> </button>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                     // Placeholder when no chat is active
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center bg-gray-50">
                         {/* ... Placeholder content (same as before - connect wallet, loading, select conversation) ... */}
                         {!connectedWallet ? (
                            <>
                                 {/* Connect Wallet Prompt */}
                                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3zm0 2c2.761 0 5 1.194 5 2.667v1.333H7v-1.333C7 14.194 9.239 13 12 13z"></path><path d="M20.99 10.5l-1.414 1.414a.997.997 0 01-1.414 0l-1.414-1.414a5.985 5.985 0 00-8.484 0L6.858 11.914a.997.997 0 01-1.414 0l-1.414-1.414a7.963 7.963 0 0111.313 0l1.414 1.414a.997.997 0 010 1.414l-1.414 1.414a7.963 7.963 0 01-11.313 0L3.01 13.5"></path></svg>
                                <p className="text-lg text-gray-600 font-medium">Please connect your wallet</p>
                                <p className="text-sm text-gray-500 mt-1">Use MetaMask or another compatible wallet to view conversations.</p>
                                <button onClick={connectWallet} className="mt-4 btn-primary text-sm px-5"> Connect Wallet </button>
                            </>
                         ) : (propertiesLoading || (threads.length > 0 && Object.keys(propertyNames).length === 0 && !error)) ? (
                             <> {/* Loading State */}
                                 <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-500 mb-4" />
                                 <p className="text-gray-500 text-lg">Loading conversations...</p>
                             </>
                         ) : (getFilteredThreads().length === 0 && !error) ? (
                             <> {/* No Conversations State */}
                                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                <p className="text-gray-500 text-lg">You have no conversations in this view yet.</p>
                                <p className="text-sm text-gray-400 mt-1">Start a chat from a property listing.</p>
                            </>
                         ) : (
                             <> {/* Select Conversation State */}
                                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" ><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.04 8.25-6.75 8.25a9.753 9.753 0 01-4.556-1.226L3 21l1.976-5.174A9.753 9.753 0 013 12C3 7.444 6.04 3.75 9.75 3.75S16.5 7.444 16.5 12z" /></svg>
                                <p className="text-gray-500 text-lg">Select a conversation</p>
                                <p className="text-sm text-gray-400 mt-1">Choose a chat from the sidebar to view messages.</p>
                            </>
                         )}
                    </div>
                )}
            </div>

             {/* Add basic CSS for input/buttons if not using Tailwind components/plugins */}
            <style jsx>{`
                .input-style {
                     box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                     appearance: none;
                     border-width: 1px;
                     border-color: #e5e7eb; /* gray-200 */
                     border-radius: 0.375rem; /* rounded-md */
                     width: 100%;
                     padding-top: 0.5rem; padding-bottom: 0.5rem;
                     padding-left: 0.75rem; padding-right: 0.75rem;
                     color: #1f2937; /* gray-800 */
                     line-height: 1.5;
                }
                .input-style:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                     box-shadow: 0 0 0 2px #60a5fa; /* ring-2 ring-blue-400 */
                     border-color: transparent;
                }
                 .btn-primary {
                    font-weight: 700; padding: 0.5rem 1rem; border-radius: 0.375rem; outline: none; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transition: background-color 150ms; color: white;
                 }
                .btn-primary:focus { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5); } /* focus:ring-blue-300 focus:ring-opacity-50 */
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

                 .btn-secondary {
                     font-weight: 700; padding: 0.5rem 1rem; border-radius: 0.375rem; outline: none; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transition: background-color 150ms; color: white;
                 }
                .btn-secondary:focus { box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.5); } /* focus:ring-gray-300 focus:ring-opacity-50 */
                .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

                 .btn-icon {
                     font-weight: 700; padding: 0.75rem; border-radius: 9999px; /* rounded-full */ outline: none; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transition: background-color 150ms; color: white; display: flex; align-items: center; justify-content: center; aspect-ratio: 1 / 1;
                 }
                .btn-icon:disabled { opacity: 0.5; cursor: not-allowed; }

                 @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                 .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }

                 @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); } 20%, 40%, 60%, 80% { transform: translateX(5px); } }
                .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }

             `}</style>

        </div>
    );
}

export default ChatPage;