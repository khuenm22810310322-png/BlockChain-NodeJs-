// Data Source Service - dựa trên dataSource từ backend, fallback nhẹ để hiển thị

// Nếu backend chưa gắn dataSource, suy luận đơn giản từ chainlinkPrice
export const addDataSourceInfo = (coins) => {
  return coins.map((coin) => {
    const ds = (coin.dataSource || (coin.chainlinkPrice ? "chainlink" : "coingecko")).toLowerCase();
    return {
      ...coin,
      dataSource: ds,
      isChainlinkSupported: ds === "chainlink",
    };
  });
};

// Thống kê nguồn dữ liệu
export const getDataSourceStats = (coins) => {
  const normalized = addDataSourceInfo(coins);
  const chainlinkCount = normalized.filter((c) => c.dataSource === "chainlink").length;
  const coingeckoCount = normalized.filter((c) => c.dataSource === "coingecko").length;
  const total = normalized.length;

  return {
    chainlink: {
      count: chainlinkCount,
      percentage: total > 0 ? Math.round((chainlinkCount / total) * 100) : 0,
    },
    coingecko: {
      count: coingeckoCount,
      percentage: total > 0 ? Math.round((coingeckoCount / total) * 100) : 0,
    },
    total,
  };
};
