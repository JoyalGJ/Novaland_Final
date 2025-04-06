import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAddress, useMetamask, useDisconnect } from '@thirdweb-dev/react';
import { ethers } from 'ethers';

const WalletContext = createContext();

export const useWallet = () => {
  return useContext(WalletContext);
};

export const WalletProvider = ({ children }) => {
  const address = useAddress();
  const connectWithMetamask = useMetamask();
  const disconnect = useDisconnect();

  const [signer, setSigner] = useState(null);
  const [walletError, setWalletError] = useState(null);

  const connectWallet = async () => {
    try {
      await connectWithMetamask();
      setWalletError(null); // Clear any previous error
    } catch (error) {
      console.error("Error connecting:", error);
      setWalletError(error.message || "Failed to connect wallet");
    }
  };

  const disconnectWallet = () => {
    disconnect();
    setSigner(null);
  };

  const getSigner = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
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
    isConnected: !!address,
    connectWallet,
    disconnectWallet,
    getSigner,
    signer,
    walletError,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
