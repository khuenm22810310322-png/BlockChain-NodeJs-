import MarketplaceShop from "../components/MarketplaceShop";

const Marketplace = () => {
	return (
		<div className="p-4 pb-24 font-sans bg-gray-50 dark:bg-gray-900 dark:text-gray-200 min-h-screen">
			<div className="w-full max-w-7xl mx-auto mt-6">
				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
					<MarketplaceShop />
				</div>
			</div>
		</div>
	);
};

export default Marketplace;
