import { Link as LinkIcon } from "@mui/icons-material";
import { getDataSourceStats } from "../services/dataSourceService";

const DataSourceSummary = ({ coins }) => {
  const stats = getDataSourceStats(coins);
  
  if (stats.total === 0) return null;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Data Source Distribution
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div className="flex items-center gap-1">
              <LinkIcon className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Chainlink (Decentralized)
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {stats.chainlink.count} coins
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {stats.chainlink.percentage}%
            </div>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="flex h-2 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-2 transition-all duration-300"
              style={{ width: `${stats.chainlink.percentage}%` }}
            ></div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          <p>
            <strong>Chainlink:</strong> Decentralized price feeds from blockchain oracles
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataSourceSummary;
