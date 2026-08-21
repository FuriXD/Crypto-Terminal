Project: Crypto Market Terminal — live market dashboard styled like a trading terminal, using CoinGecko's free public API (no key required, generous rate limit). More complex than the weather app because it involves: sortable/filterable data across 20+ items, an actual inline sparkline chart per row (mini price-history line, rendered from raw data — not a chart library), color-coded gain/loss logic, and large-number formatting (market cap in B/M).
Data aggregation client-side (average % change across the dataset — not just displaying raw API fields)
Custom-drawn sparkline charts from raw price arrays — no chart library, pure SVG math
Combined filter + sort working together on the same dataset
Real edge case: rate-limit handling (429 response)