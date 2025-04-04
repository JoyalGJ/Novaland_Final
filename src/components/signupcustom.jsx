import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ethers } from "ethers";
import { supabase } from "../../supabase";
import { useNavigate } from "react-router-dom";
import MetaMaskLogo from "../assets/metamask.svg"; // Ensure you have this logo
function Signupcustom() {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Connect MetaMask
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []); // Request wallet connection
      const signer = provider.getSigner();
      const address = (await signer.getAddress()).toLowerCase();

      console.log("Wallet Connected:", address);
      setWalletAddress(address);
      localStorage.setItem("walletAddress", address);

      checkUserExists(address);
    } catch (error) {
      console.error("MetaMask Connection Error:", error);
      alert("Error connecting MetaMask. Try again.");
    }
  };

  // Check if User Exists (Login)
  const checkUserExists = async (wallet) => {
    const { data, error } = await supabase
      .from("users")
      .select("name, email")
      .eq("wallet_address", wallet)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking user:", error);
      return;
    }

    if (data) {
      // User Exists → Login
      console.log("User  Found:", data);
      localStorage.setItem("name", data.name);
      localStorage.setItem("email", data.email || "");
      navigate("/"); // Redirect to home
    } else {
      // User Not Found → Show Signup Form
      setIsSignup(true);
    }
  };

  // Handle Signup
  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name || !walletAddress) return alert("Name and Wallet are required!");

    setLoading(true);

    const { error } = await supabase.from("users").insert([
      { name, email, wallet_address: walletAddress },
    ]);

    setLoading(false);
    if (error) {
      console.error("Signup Error:", error);
      return alert("Signup failed!");
    }

    // Save to local storage & login
    localStorage.setItem("name", name);
    localStorage.setItem("email", email || "");
    navigate("/"); // Redirect to home
  };

  useEffect(() => {
    const savedWallet = localStorage.getItem("walletAddress");
    if (savedWallet) {
      setWalletAddress(savedWallet);
      checkUserExists(savedWallet);
    }
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-md bg-white p-8 shadow-lg rounded-lg border">
        <h2 className="text-3xl font-bold text-gray-900 text-center">
          {isSignup ? "Sign Up" : "Login"}
        </h2>
        <div className="w-10 h-1 bg-gradient-to-r from-blue-500 to-yellow-500 mx-auto my-2"></div>

        {/* Form */}
        <form className="space-y-5 mt-6" onSubmit={handleSignup}>
          {isSignup && (
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="John Doe"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          {isSignup && (
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          {/* Wallet Address Field with Button */}
          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                value={walletAddress}
                readOnly
                className="cursor-not-allowed bg-gray-100 flex-1"
              />
              {!walletAddress ? (
                <Button
                  type="button"
                  className="flex items-center bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 text-xs"
                  onClick={connectWallet}
                >
                  <img src={MetaMaskLogo} alt="MetaMask" className="w-4 h-4 mr-1" />
                  Connect
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex items-center bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600 text-xs"
                  onClick={() => {
                    setWalletAddress("");
                    localStorage.removeItem("walletAddress");
                  }}
                >
                  ❌ Disconnect
                </Button>
              )}
            </div>
          </div>

          {/* Submit Button */}
          {isSignup && (
            <Button
              type="submit"
              className="w-full bg-blue-600 text-white hover:bg-blue-700 mt-2"
              disabled={loading}
            >
              {loading ? "Signing Up..." : "Sign Up"}
            </Button>
          )}
        </form>

        {/* Toggle Between Sign Up & Sign In */}
        <p className="text-center text-sm text-gray-500 mt-4">
          {isSignup ? "Already have an account? " : "New user? "}
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="underline text-blue-600 hover:no-underline"
          >
            {isSignup ? "Login" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}

export { Signupcustom };