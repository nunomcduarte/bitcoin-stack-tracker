document.addEventListener('DOMContentLoaded', function() {
    // Dashboard Elements
    const currentBtcPriceElement = document.getElementById('current-btc-price');
    const priceUpdateTimeElement = document.getElementById('price-update-time');
    const totalBtcElement = document.getElementById('total-btc');
    const avgCostElement = document.getElementById('avg-cost');
    const totalInvestmentElement = document.getElementById('total-investment');
    const unrealizedPlElement = document.getElementById('unrealized-pl');
    const plPercentageElement = document.getElementById('pl-percentage');
    const currentValueElement = document.getElementById('current-value');
    const realizedPlElement = document.getElementById('realized-pl');
    const shortTermGainElement = document.getElementById('short-term-gain');
    const longTermGainElement = document.getElementById('long-term-gain');
    const recentTransactionsBody = document.getElementById('recent-transactions-body');
    
    // Initialize portfolio data and Bitcoin price
    let transactions = [];
    let bitcoinPrice = 0;
    
    // Load transactions from localStorage
    function loadTransactions() {
        const savedTransactions = localStorage.getItem('bitcoin-transactions');
        if (savedTransactions) {
            transactions = JSON.parse(savedTransactions);
            transactions.forEach(tx => {
                // Convert date strings back to Date objects
                tx.date = new Date(tx.date);
            });
            
            // Sort transactions by date, newest first (for recent transactions display)
            transactions.sort((a, b) => b.date - a.date);
            
            updateDashboard();
            renderRecentTransactions();
        } else {
            showEmptyState();
        }
    }
    
    // Show empty state when no transactions
    function showEmptyState() {
        recentTransactionsBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <p>No transactions yet. Add your first Bitcoin transaction on the Transactions page.</p>
                </td>
            </tr>
        `;
    }
    
    // Format currency for display
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
    
    // Format BTC amount for display
    function formatBTC(amount) {
        return amount.toFixed(8);
    }
    
    // Format percentage for display
    function formatPercentage(percentage) {
        return (percentage * 100).toFixed(2) + '%';
    }
    
    // Calculate current portfolio stats
    function calculatePortfolioStats() {
        let totalBtc = 0;
        let totalInvestment = 0;
        let totalRealizedProfit = 0;
        let shortTermGains = 0;
        let longTermGains = 0;
        
        // Create a queue for FIFO calculation
        let buyQueue = [];
        
        // Clone the transactions to not modify the original
        const txs = JSON.parse(JSON.stringify(transactions));
        
        // Convert dates back to Date objects
        txs.forEach(tx => {
            tx.date = new Date(tx.date);
        });
        
        // Process all transactions for FIFO calculation
        txs.forEach(tx => {
            if (tx.type === 'buy') {
                // Add to total BTC and investment
                totalBtc += tx.amount;
                totalInvestment += (tx.amount * tx.price) + tx.fee;
                
                // Add to buy queue with remaining amount
                buyQueue.push({
                    id: tx.id,
                    date: tx.date,
                    amount: tx.amount,
                    price: tx.price,
                    remainingAmount: tx.amount
                });
            } else if (tx.type === 'sell') {
                // Subtract from total BTC
                totalBtc -= tx.amount;
                
                let remainingToSell = tx.amount;
                let costBasis = 0;
                
                // Skip if no buys
                if (buyQueue.length === 0) return;
                
                // Process the sell against the buy queue
                while (remainingToSell > 0 && buyQueue.length > 0) {
                    const oldestBuy = buyQueue[0];
                    
                    const amountToSell = Math.min(remainingToSell, oldestBuy.remainingAmount);
                    
                    // Calculate cost basis for this portion
                    const portionCostBasis = amountToSell * oldestBuy.price;
                    costBasis += portionCostBasis;
                    
                    // Calculate revenue and profit
                    const portionRevenue = amountToSell * tx.price;
                    const portionProfit = portionRevenue - portionCostBasis;
                    
                    // Determine gain type (short-term or long-term)
                    const holdingPeriodDays = (tx.date - oldestBuy.date) / (1000 * 60 * 60 * 24);
                    const isLongTerm = holdingPeriodDays >= 365;
                    
                    if (isLongTerm) {
                        longTermGains += portionProfit;
                    } else {
                        shortTermGains += portionProfit;
                    }
                    
                    // Update remaining amounts
                    remainingToSell -= amountToSell;
                    oldestBuy.remainingAmount -= amountToSell;
                    
                    // If buy is used up, remove it
                    if (oldestBuy.remainingAmount <= 0.00000001) {
                        buyQueue.shift();
                    }
                }
                
                // Calculate total profit for this sale
                const totalRevenue = tx.price * tx.amount;
                const saleProfit = totalRevenue - costBasis - tx.fee;
                totalRealizedProfit += saleProfit;
            }
        });
        
        // Calculate average cost (if we have any BTC)
        const averageCost = totalBtc > 0 ? totalInvestment / totalBtc : 0;
        
        // Calculate current value and unrealized P/L
        const currentValue = totalBtc * bitcoinPrice;
        const unrealizedPL = currentValue - totalInvestment;
        
        // Calculate P/L percentage
        const plPercentage = totalInvestment > 0 ? unrealizedPL / totalInvestment : 0;
        
        return {
            totalBtc,
            averageCost,
            totalInvestment,
            currentValue,
            unrealizedPL,
            plPercentage,
            realizedPL: totalRealizedProfit,
            shortTermGains,
            longTermGains
        };
    }
    
    // Update dashboard with latest stats
    function updateDashboard() {
        const stats = calculatePortfolioStats();
        
        // Update Bitcoin price display
        currentBtcPriceElement.textContent = formatCurrency(bitcoinPrice);
        priceUpdateTimeElement.textContent = new Date().toLocaleTimeString();
        
        // Update dashboard stats
        totalBtcElement.textContent = formatBTC(stats.totalBtc);
        avgCostElement.textContent = formatCurrency(stats.averageCost);
        totalInvestmentElement.textContent = formatCurrency(stats.totalInvestment);
        unrealizedPlElement.textContent = formatCurrency(stats.unrealizedPL);
        currentValueElement.textContent = formatCurrency(stats.currentValue);
        realizedPlElement.textContent = formatCurrency(stats.realizedPL);
        shortTermGainElement.textContent = formatCurrency(stats.shortTermGains);
        longTermGainElement.textContent = formatCurrency(stats.longTermGains);
        
        // Update P/L percentage with color coding
        plPercentageElement.textContent = formatPercentage(stats.plPercentage);
        if (stats.plPercentage > 0) {
            plPercentageElement.className = 'card-percentage positive';
            plPercentageElement.textContent = '+' + plPercentageElement.textContent;
        } else if (stats.plPercentage < 0) {
            plPercentageElement.className = 'card-percentage negative';
        } else {
            plPercentageElement.className = 'card-percentage';
        }
        
        // Add appropriate classes for profit/loss styling
        unrealizedPlElement.className = 'card-value ' + (stats.unrealizedPL >= 0 ? 'profit' : 'loss');
        realizedPlElement.className = 'value-amount ' + (stats.realizedPL >= 0 ? 'profit' : 'loss');
        shortTermGainElement.className = 'value-amount ' + (stats.shortTermGains >= 0 ? 'profit' : 'loss');
        longTermGainElement.className = 'value-amount ' + (stats.longTermGains >= 0 ? 'profit' : 'loss');
    }
    
    // Render recent transactions
    function renderRecentTransactions() {
        if (transactions.length === 0) {
            showEmptyState();
            return;
        }
        
        recentTransactionsBody.innerHTML = '';
        
        // Show only the 5 most recent transactions
        const recentTransactions = transactions.slice(0, 5);
        
        recentTransactions.forEach(tx => {
            const row = document.createElement('tr');
            
            // Format date
            const dateFormatted = tx.date.toLocaleDateString();
            
            // Calculate total in USD
            const totalUSD = tx.amount * tx.price;
            
            // Create row content
            row.innerHTML = `
                <td>${dateFormatted}</td>
                <td class="${tx.type}">${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</td>
                <td>${formatBTC(tx.amount)}</td>
                <td>${formatCurrency(tx.price)}</td>
                <td>${formatCurrency(totalUSD)}</td>
            `;
            
            recentTransactionsBody.appendChild(row);
        });
    }
    
    // Fetch current Bitcoin price from CoinGecko API
    async function fetchBitcoinPrice() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const data = await response.json();
            bitcoinPrice = data.bitcoin.usd;
            
            // Update dashboard after getting the price
            updateDashboard();
            
            return bitcoinPrice;
        } catch (error) {
            console.error('Error fetching Bitcoin price:', error);
            
            // Use a fallback price if API fails
            if (bitcoinPrice === 0) {
                bitcoinPrice = 30000; // Fallback value
                updateDashboard();
            }
            
            return bitcoinPrice;
        }
    }
    
    // Initialize dashboard
    fetchBitcoinPrice().then(() => {
        loadTransactions();
    });
    
    // Refresh Bitcoin price and dashboard every minute
    setInterval(() => {
        fetchBitcoinPrice();
    }, 60000);
}); 