# Bitcoin Stack Tracker

A simple web application to track your Bitcoin purchases and sales, helping you calculate profits, losses, and capital gains using the FIFO (First In, First Out) method.

## Features

- **Track Bitcoin Transactions**: Record all your Bitcoin purchases and sales with detailed information
- **FIFO Calculation**: Automatically calculates cost basis and gains using the FIFO accounting method
- **Capital Gains Tracking**: Distinguishes between short-term (<1 year) and long-term (>1 year) capital gains
- **Portfolio Dashboard**: View your total Bitcoin holdings, average cost, and current value
- **Persistent Storage**: All your data is stored locally in your browser

## How to Use

1. Simply open the `index.html` file in a modern web browser
2. Add your Bitcoin purchase and sale transactions using the form
3. View your portfolio summary and transaction history
4. All data is stored locally in your browser's localStorage

## FIFO Calculation Explained

The application uses the FIFO (First In, First Out) method to calculate your cost basis and capital gains:

1. When you sell Bitcoin, the application assumes you're selling the oldest Bitcoin in your portfolio first
2. The profit or loss is calculated as: (Sell Price - Buy Price) × Amount Sold - Fees
3. Capital gains are classified as short-term (held less than 1 year) or long-term (held more than 1 year)

## Development

This is a simple client-side application built with vanilla JavaScript, HTML, and CSS. No build steps or dependencies are required. Bitcoin price data is fetched from the CoinGecko API.

## Disclaimer

This application is for educational and informational purposes only. It is not financial advice, and the calculations may not be suitable for tax reporting in your jurisdiction. Always consult with a qualified tax professional.

## License

MIT 