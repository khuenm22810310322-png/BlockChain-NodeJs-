# Server README

This README contains quick notes about configuring Chainlink Feed Registry support for CryptoTrack backend.

## Feed Registry

The server can optionally use the Chainlink Feed Registry to resolve aggregator addresses on-chain instead of relying on static addresses in `.env`.

Environment variables to configure:

- `ALCHEMY_RPC_URL` - RPC endpoint used to query on-chain data (must match the network where Feed Registry is deployed).
- `FEED_REGISTRY_ADDRESS` - Feed Registry contract address on that network.
- `CHAINLINK_TOKEN_ADDRS` - Mapping of token symbol to token contract address used by the registry (format: `symbol:address;symbol2:address2`).
- `CHAINLINK_MAX_AGE_SECONDS` - Maximum age in seconds for Chainlink feed `updatedAt` before considering the feed stale.

Behavior:
- If `FEED_REGISTRY_ADDRESS` and `CHAINLINK_TOKEN_ADDRS` are set, the backend will attempt to resolve a feed with the registry first (e.g. `registry.getFeed(baseAddr, quoteAddr)`). If no aggregator is returned, it falls back to the static `FEED_*` environment variables.

Why use Feed Registry:
- Automatically discovers aggregator addresses without manual edits when Chainlink updates/expands supported feeds.
- Supports multiple quote assets (USD, ETH, etc.).

Notes and next steps:
- To support multiple chains, you can provide multiple registry addresses and RPC endpoints, and extend the feed registry util to select per-chain providers.
- Always verify token contract addresses and registry addresses from official Chainlink docs or data.chain.link.

*** End README