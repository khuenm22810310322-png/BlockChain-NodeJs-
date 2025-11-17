import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { BrowserRouter } from "react-router-dom";
import { CurrencyProvider } from "./context/CurrencyContext.jsx";
import { WalletProvider } from "./context/WalletContext.jsx";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<CurrencyProvider>
			<AuthProvider>
				<WalletProvider>
					<BrowserRouter>
						<App />
					</BrowserRouter>
				</WalletProvider>
			</AuthProvider>
		</CurrencyProvider>
	</StrictMode>
);
