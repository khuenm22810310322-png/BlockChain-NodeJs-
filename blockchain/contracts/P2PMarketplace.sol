// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
	function transferFrom(address from, address to, uint256 amount) external returns (bool);
	function transfer(address to, uint256 amount) external returns (bool);
	function allowance(address owner, address spender) external view returns (uint256);
	function balanceOf(address owner) external view returns (uint256);
}

interface IAggregator {
	function latestRoundData()
		external
		view
		returns (
			uint80 roundId,
			int256 answer,
			uint256 startedAt,
			uint256 updatedAt,
			uint80 answeredInRound
		);
}

contract P2PMarketplace {
	enum ListingStatus {
		Inactive,
		Active,
		Filled,
		Cancelled
	}

	struct Listing {
		address seller;
		address token; // asset being sold (ERC20)
		address paymentToken; // address(0) means native
		uint256 remainingAmount;
		uint256 pricePerUnit; // paymentToken per unit
		ListingStatus status;
		uint256 createdAt;
	}

	struct Trade {
		address buyer;
		uint256 listingId;
		uint256 amount;
		uint256 totalPaid;
		bool usedOraclePrice;
		uint256 timestamp;
	}

	address public owner;
	uint256 public nextListingId = 1;
	uint256 public nextTradeId = 1;
	mapping(uint256 => Listing) public listings;
	mapping(uint256 => Trade) public trades;
	IAggregator public priceFeed; // optional: used for buyAtMarket
	uint256 public maxStaleTime = 30 minutes;

	bool private locked;

	event ListingCreated(uint256 indexed listingId, address indexed seller, address token, address paymentToken, uint256 amount, uint256 pricePerUnit);
	event ListingUpdated(uint256 indexed listingId, uint256 remainingAmount, ListingStatus status);
	event TradeExecuted(uint256 indexed tradeId, uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPaid, bool usedOraclePrice);
	event ListingCancelled(uint256 indexed listingId, uint256 refundedAmount);
	event PriceFeedUpdated(address indexed feed);
	event MaxStaleUpdated(uint256 maxStaleTime);

	error NotSeller();
	error InvalidStatus();
	error InsufficientAmount();
	error InsufficientValue();
	error StaleOracle();
	error PriceNotPositive();

	modifier nonReentrant() {
		require(!locked, "REENTRANCY");
		locked = true;
		_;
		locked = false;
	}

	constructor(address _priceFeed) {
		owner = msg.sender;
		priceFeed = IAggregator(_priceFeed);
	}

	// --- Admin ---
	function setPriceFeed(address _priceFeed) external {
		require(msg.sender == owner, "NOT_OWNER");
		priceFeed = IAggregator(_priceFeed);
		emit PriceFeedUpdated(_priceFeed);
	}

	function setMaxStaleTime(uint256 _seconds) external {
		require(msg.sender == owner, "NOT_OWNER");
		maxStaleTime = _seconds;
		emit MaxStaleUpdated(_seconds);
	}

	// --- Listing ---
	function createListing(
		address token,
		address paymentToken,
		uint256 amount,
		uint256 pricePerUnit
	) external nonReentrant returns (uint256) {
		require(amount > 0, "AMOUNT");
		require(pricePerUnit > 0, "PRICE");

		// Lock assets
		require(IERC20(token).transferFrom(msg.sender, address(this), amount), "TRANSFER_IN");

		uint256 listingId = nextListingId++;
		listings[listingId] = Listing({
			seller: msg.sender,
			token: token,
			paymentToken: paymentToken,
			remainingAmount: amount,
			pricePerUnit: pricePerUnit,
			status: ListingStatus.Active,
			createdAt: block.timestamp
		});

		emit ListingCreated(listingId, msg.sender, token, paymentToken, amount, pricePerUnit);
		return listingId;
	}

	function cancelListing(uint256 listingId) external nonReentrant {
		Listing storage lst = listings[listingId];
		if (lst.seller != msg.sender) revert NotSeller();
		if (lst.status != ListingStatus.Active) revert InvalidStatus();

		lst.status = ListingStatus.Cancelled;
		uint256 refund = lst.remainingAmount;
		lst.remainingAmount = 0;
		require(IERC20(lst.token).transfer(msg.sender, refund), "REFUND_FAIL");
		emit ListingCancelled(listingId, refund);
		emit ListingUpdated(listingId, 0, lst.status);
	}

	// --- Buy fixed price ---
	function buy(uint256 listingId, uint256 amount) external payable nonReentrant returns (uint256) {
		return _buy(listingId, amount, false);
	}

	// --- Buy at oracle price ---
	function buyAtMarket(uint256 listingId, uint256 amount) external payable nonReentrant returns (uint256) {
		return _buy(listingId, amount, true);
	}

	function _buy(uint256 listingId, uint256 amount, bool useOracle) internal returns (uint256 tradeId) {
		require(amount > 0, "AMOUNT");
		Listing storage lst = listings[listingId];
		if (lst.status != ListingStatus.Active) revert InvalidStatus();
		if (amount > lst.remainingAmount) revert InsufficientAmount();

		uint256 pricePerUnit = lst.pricePerUnit;
		if (useOracle) {
			pricePerUnit = _getOraclePrice();
			if (pricePerUnit == 0) revert PriceNotPositive();
		}

		uint256 total = pricePerUnit * amount;

		// handle payment
		if (lst.paymentToken == address(0)) {
			if (msg.value < total) revert InsufficientValue();
			(bool ok, ) = lst.seller.call{value: total}("");
			require(ok, "PAY_NATIVE");
			if (msg.value > total) {
				(bool refundOk, ) = msg.sender.call{value: msg.value - total}("");
				require(refundOk, "REFUND_NATIVE");
			}
		} else {
			require(IERC20(lst.paymentToken).transferFrom(msg.sender, lst.seller, total), "PAY_ERC20");
		}

		// transfer asset to buyer
		require(IERC20(lst.token).transfer(msg.sender, amount), "TRANSFER_OUT");

		lst.remainingAmount -= amount;
		if (lst.remainingAmount == 0) {
			lst.status = ListingStatus.Filled;
		}

		tradeId = nextTradeId++;
		trades[tradeId] = Trade({
			buyer: msg.sender,
			listingId: listingId,
			amount: amount,
			totalPaid: total,
			usedOraclePrice: useOracle,
			timestamp: block.timestamp
		});

		emit TradeExecuted(tradeId, listingId, msg.sender, amount, total, useOracle);
		emit ListingUpdated(listingId, lst.remainingAmount, lst.status);
	}

	function _getOraclePrice() internal view returns (uint256) {
		require(address(priceFeed) != address(0), "NO_ORACLE");
		(, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
		if (answer <= 0) revert PriceNotPositive();
		if (maxStaleTime > 0 && block.timestamp - updatedAt > maxStaleTime) revert StaleOracle();
		return uint256(answer);
	}

	// --- Views ---
	function getListing(uint256 listingId) external view returns (Listing memory) {
		return listings[listingId];
	}

	function getTrade(uint256 tradeId) external view returns (Trade memory) {
		return trades[tradeId];
	}
}
