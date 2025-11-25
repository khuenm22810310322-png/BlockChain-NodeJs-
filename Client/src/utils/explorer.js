
export const getExplorerUrl = (txHash) => {
    // Check if we are in a local environment (e.g., localhost or 127.0.0.1)
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    
    if (isLocal) {
        // For Hardhat local network, there isn't a public explorer by default.
        // We can return null or a placeholder.
        // If using a local block explorer like Blockscout or similar, configure it here.
        return null; 
    }
    
    // Default to Sepolia Etherscan for testnet
    return `https://sepolia.etherscan.io/tx/${txHash}`;
};

export const getShortTxHash = (txHash) => {
    if (!txHash) return "";
    return `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
};
