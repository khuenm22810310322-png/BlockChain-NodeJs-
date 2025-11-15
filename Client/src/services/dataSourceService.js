// Data Source Service - Quản lý nguồn dữ liệu và mapping
export const CHAINLINK_SUPPORTED_COINS = [
  'bitcoin',           // BTC/USD
  'ethereum',          // ETH/USD
  'binancecoin',       // BNB/USD
  'solana',            // SOL/USD
  'avalanche-2',       // AVAX/USD
  'matic-network',     // MATIC/USD
  'chainlink',         // LINK/USD
  'uniswap',           // UNI/USD
  'aave',              // AAVE/USD
  'compound-governance-token', // COMP/USD
  'maker',             // MKR/USD
  'synthetix-network-token', // SNX/USD
  'yearn-finance',     // YFI/USD
  'curve-dao-token',   // CRV/USD
  '1inch',            // 1INCH/USD
  'the-graph',         // GRT/USD
  'filecoin',          // FIL/USD
  'litecoin',          // LTC/USD
  'bitcoin-cash',      // BCH/USD
  'stellar',           // XLM/USD
  'cardano',           // ADA/USD
  'polkadot',          // DOT/USD
  'cosmos',            // ATOM/USD
  'algorand',          // ALGO/USD
  'vechain',           // VET/USD
  'tezos',             // XTZ/USD
  'monero',            // XMR/USD
  'zcash',             // ZEC/USD
  'dash',              // DASH/USD
  'dogecoin',          // DOGE/USD
];

// Chainlink Price Feed Addresses (Ethereum Mainnet)
export const CHAINLINK_FEED_ADDRESSES = {
  'bitcoin': '0xF4030086522a5bEEa4988F8c5EeB2D7E4b0C4C4C4', // BTC/USD
  'ethereum': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
  'binancecoin': '0x14e613AC84a31f709eadbdF89C6CC390fDc9540A', // BNB/USD
  'solana': '0x4ffC43a60e009B551865A93d224E51C31444A6D0', // SOL/USD
  'avalanche-2': '0x0A77230d17318075983913bC2145db16C7366156', // AVAX/USD
  'matic-network': '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676', // MATIC/USD
  'chainlink': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c', // LINK/USD
  'uniswap': '0x553303d460EE0afB37EdFf9BEe22F5eB88445589', // UNI/USD
  'aave': '0x547a514d5e3769680Ce22B2361c10Ea13619e8a9', // AAVE/USD
  'dogecoin': '0x2465CefD3b488BE410b941b1a4F1b1E4F31c5f2B', // DOGE/USD
};

// Kiểm tra coin có được hỗ trợ bởi Chainlink không
export const isChainlinkSupported = (coinId) => {
  return CHAINLINK_SUPPORTED_COINS.includes(coinId);
};

// Lấy nguồn dữ liệu cho coin
export const getDataSource = (coinId) => {
  return isChainlinkSupported(coinId) ? 'chainlink' : 'coingecko';
};

// Thêm thông tin nguồn dữ liệu vào coin data
export const addDataSourceInfo = (coins) => {
  return coins.map(coin => ({
    ...coin,
    dataSource: getDataSource(coin.id),
    isChainlinkSupported: isChainlinkSupported(coin.id)
  }));
};

// Lấy Chainlink feed address cho coin
export const getChainlinkFeedAddress = (coinId) => {
  return CHAINLINK_FEED_ADDRESSES[coinId] || null;
};

// Thống kê nguồn dữ liệu
export const getDataSourceStats = (coins) => {
  const chainlinkCount = coins.filter(coin => coin.dataSource === 'chainlink').length;
  const coingeckoCount = coins.filter(coin => coin.dataSource === 'coingecko').length;
  const total = coins.length;
  
  return {
    chainlink: {
      count: chainlinkCount,
      percentage: total > 0 ? Math.round((chainlinkCount / total) * 100) : 0
    },
    coingecko: {
      count: coingeckoCount,
      percentage: total > 0 ? Math.round((coingeckoCount / total) * 100) : 0
    },
    total
  };
};
