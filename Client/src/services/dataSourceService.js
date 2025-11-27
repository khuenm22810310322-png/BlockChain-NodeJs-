// Data Source Service - Hệ thống sử dụng 100% Chainlink Oracle

// Luôn xác định nguồn dữ liệu là Chainlink
export const addDataSourceInfo = (coins) => {
  return coins.map((coin) => {
    return {
      ...coin,
      dataSource: "chainlink",
      isChainlinkSupported: true,
    };
  });
};

// Thống kê nguồn dữ liệu (Luôn là 100% Chainlink)
export const getDataSourceStats = (coins) => {
  const total = coins.length;

  return {
    chainlink: {
      count: total,
      percentage: total > 0 ? 100 : 0,
    },
    coingecko: {
      count: 0,
      percentage: 0,
    },
    total,
  };
};
