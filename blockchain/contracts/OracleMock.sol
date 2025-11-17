// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract OracleMock {
	int256 public price;
	uint256 public updatedAt;

	constructor(int256 _price) {
		price = _price;
		updatedAt = block.timestamp;
	}

	function latestRoundData()
		external
		view
		returns (
			uint80 roundId,
			int256 answer,
			uint256 startedAt,
			uint256 _updatedAt,
			uint80 answeredInRound
		)
	{
		return (0, price, updatedAt, updatedAt, 0);
	}

	function setPrice(int256 _price) external {
		price = _price;
		updatedAt = block.timestamp;
	}
}
