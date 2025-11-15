import StarOutlineIcon from "@mui/icons-material/StarOutline";
import StarIcon from "@mui/icons-material/Star";
import { Link as LinkIcon } from "@mui/icons-material";
import { TrendingUp as TrendingUpIcon } from "@mui/icons-material";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import getColor from "../utils/color";

const DataSourceIndicator = ({ source }) => {
  const isChainlink = source === "chainlink";
  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        isChainlink
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      }`}
    >
      {isChainlink ? (
        <>
          <LinkIcon className="w-3 h-3" />
          <span>Chainlink</span>
        </>
      ) : (
        <>
          <TrendingUpIcon className="w-3 h-3" />
          <span>CoinGecko</span>
        </>
      )}
    </div>
  );
};

const CoinCard = ({ coin, isStarred, toggleWatchlist, toggleForm }) => {
  const { isAuthenticated } = useAuth();
  const { currency, formatCurrency } = useCurrency();
  const pctColor = getColor(coin.price_change_percentage_24h);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col gap-3 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" />
          <div>
            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span>#{coin.market_cap_rank}</span>
              <span>{coin.name}</span>
              <span className="text-xs uppercase text-gray-500 dark:text-gray-400">{coin.symbol}</span>
            </div>
            <DataSourceIndicator source={coin.dataSource || "coingecko"} />
          </div>
        </div>
        <button
          className={`cursor-pointer ${
            !isStarred
              ? "text-gray-400 hover:text-amber-300 transition-all duration-200"
              : "text-amber-300"
          }`}
          onClick={() => {
            if (isAuthenticated) {
              toggleWatchlist(coin.id, coin.name);
            } else {
              toggleForm();
            }
          }}
          aria-label={isStarred ? "Remove from watchlist" : "Add to watchlist"}
        >
          {isStarred ? <StarIcon /> : <StarOutlineIcon />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500 dark:text-gray-400">Price</div>
        <div className="font-medium text-gray-900 dark:text-white">
          {formatCurrency(coin.current_price * currency[1], 6)}
        </div>

        <div className="text-gray-500 dark:text-gray-400">24h</div>
        <div className={`font-medium ${pctColor}`}>
          {coin.price_change_percentage_24h.toFixed(2)}%
        </div>

        <div className="text-gray-500 dark:text-gray-400">Market Cap</div>
        <div className="font-medium text-gray-900 dark:text-white">
          {formatCurrency((coin.market_cap * currency[1]).toFixed(2), 6)}
        </div>
      </div>

      <div className="mt-1">
        <button
          className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-all duration-200 cursor-pointer"
          onClick={() => toggleForm(coin)}
        >
          Add
        </button>
      </div>
    </div>
  );
};

const CoinGrid = ({ loading, error, coins, toggleWatchlist, watchlist, toggleForm }) => {
  if (loading) {
    return (
      <div className="text-center p-8 text-gray-500 dark:text-gray-400">Loading data...</div>
    );
  }
  if (error) {
    return (
      <div className="text-center p-8 text-red-500 dark:text-red-400">An Error Occured</div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {coins.map((coin) => (
        <CoinCard
          key={coin.id}
          coin={coin}
          isStarred={watchlist.includes(coin.id)}
          toggleWatchlist={toggleWatchlist}
          toggleForm={toggleForm}
        />)
      )}
    </div>
  );
};

export default CoinGrid;
