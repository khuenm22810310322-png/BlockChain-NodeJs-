const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const address = "0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f";

async function check() {
    try {
        const code = await provider.getCode(address);
        console.log("Code at " + address + ":", code === "0x" ? "Empty (Not Deployed)" : "Exists (" + code.length + " bytes)");
    } catch (e) {
        console.error("Error:", e.message);
    }
}
check();
