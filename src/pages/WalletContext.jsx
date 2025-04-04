import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useAddress, useMetamask, useDisconnect } from '@thirdweb-dev/react'; // Import needed hooks

const WalletContext = createContext();
export const useWallet = () => {
  return useContext(WalletContext);
};

export const WalletProvider = ({ children }) => {
  const address = useAddress();
  const connectWithMetamask = useMetamask();
  const disconnect = useDisconnect();
  const [isConnected, setIsConnected] = useState(false);
    const [signer, setSigner] = useState(null);

  useEffect(() => {
    setIsConnected(!!address); // Update isConnected based on address
  }, [address]);


  const connectWallet = async () => {
    try {
      await connectWithMetamask();
    } catch (error) {
      console.error("Error connecting:", error);
    }
  };

  const disconnectWallet = () => {
    disconnect();
  };

  const getSigner = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []); // Ensure accounts are requested
        const newSigner = provider.getSigner();
        setSigner(newSigner);
        return newSigner;
      } catch (error) {
        console.error("Error getting signer:", error);
        return null;
      }
    } else {
      console.error("MetaMask not installed");
      return null;
    }
  };


  const value = {
    address,
    isConnected,
    connectWallet,
    disconnectWallet,
    getSigner,
    signer,
    useWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};