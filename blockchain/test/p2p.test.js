const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("P2PMarketplace", function () {
	let owner, seller, buyer, token, payment, market;

	beforeEach(async () => {
		[owner, seller, buyer] = await ethers.getSigners();

		const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
		token = await ERC20Mock.deploy("Asset", "AST", seller.address, ethers.parseEther("1000"));
		payment = await ERC20Mock.deploy("Pay", "PAY", buyer.address, ethers.parseEther("1000"));

		const OracleMock = await ethers.getContractFactory("OracleMock");
		const oracle = await OracleMock.deploy(ethers.parseUnits("2", 18));

		const Market = await ethers.getContractFactory("P2PMarketplace");
		market = await Market.deploy(await oracle.getAddress());
	});

	it("creates listing and buys fixed price", async () => {
		await token.connect(seller).approve(market.getAddress(), ethers.parseEther("10"));
		const tx = await market.connect(seller).createListing(
			await token.getAddress(),
			ethers.ZeroAddress,
			ethers.parseEther("10"),
			ethers.parseEther("1")
		);
		const receipt = await tx.wait();
		const listingId = receipt.logs[0].args.listingId || 1n;

		const totalPrice = ethers.parseEther("2");
		await expect(
			market.connect(buyer).buy(listingId, ethers.parseEther("2"), { value: totalPrice })
		).to.emit(market, "TradeExecuted");

		const listing = await market.getListing(listingId);
		expect(listing.remainingAmount).to.equal(ethers.parseEther("8"));
	});
});
