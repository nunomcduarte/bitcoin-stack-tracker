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
    const change24hElement = document.getElementById('change-24h');
    const realizedPlElement = document.getElementById('realized-pl');
    const shortTermGainElement = document.getElementById('short-term-gain');
    const longTermGainElement = document.getElementById('long-term-gain');
    const btcDominanceElement = document.getElementById('btc-dominance');
    const volume24hElement = document.getElementById('volume-24h');
    const recentTransactionsBody = document.getElementById('recent-transactions-body');
    const portfolioChartCanvas = document.getElementById('portfolio-value-chart');
    const periodButtons = document.querySelectorAll('.period-btn');
    
    // Initialize portfolio data and Bitcoin price
    let transactions = [];
    let bitcoinPrice = 0;
    let previousDayPrice = 0;
    let portfolioChart = null;
    let currentPeriod = 'week';
    let portfolioHistory = [];
    
    // Add event listeners to period buttons
    if (periodButtons) {
        periodButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                periodButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                // Update current period
                currentPeriod = this.getAttribute('data-period');
                // Render chart with new period
                renderPortfolioChart();
            });
        });
    }
    
    // Load transactions from localStorage
    function loadTransactions() {
        const savedTransactions = localStorage.getItem('bitcoin-transactions');
        console.log('Dashboard loading transactions:', savedTransactions);
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
            generatePortfolioHistory();
            renderPortfolioChart();
            fetchMarketData();
        } else {
            showEmptyState();
        }
    }
    
    // Add a storage event listener to reload transactions when they change
    window.addEventListener('storage', function(e) {
        if (e.key === 'bitcoin-transactions') {
            console.log('Dashboard detected transaction data change');
            loadTransactions();
        }
    });
    
    // Show empty state when no transactions
    function showEmptyState() {
        if (recentTransactionsBody) {
            recentTransactionsBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <p>No transactions yet. Add your first Bitcoin transaction on the Transactions page.</p>
                    </td>
                </tr>
            `;
        }
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
        
        // Calculate 24h change
        const previousValue = totalBtc * previousDayPrice;
        const change24h = currentValue - previousValue;
        
        return {
            totalBtc,
            averageCost,
            totalInvestment,
            currentValue,
            unrealizedPL,
            plPercentage,
            realizedPL: totalRealizedProfit,
            shortTermGains,
            longTermGains,
            change24h
        };
    }
    
    // Generate portfolio value history data
    function generatePortfolioHistory() {
        if (transactions.length === 0) {
            portfolioHistory = [];
            return;
        }
        
        // Clone and sort transactions by date (oldest first)
        const sortedTransactions = [...transactions]
            .sort((a, b) => new Date(a.date) - new Date(b.date));
            
        const firstDate = new Date(sortedTransactions[0].date);
        const today = new Date();
        const dataPoints = [];
        
        // Set first date to beginning of the day
        firstDate.setHours(0, 0, 0, 0);
        
        // Set start date based on first transaction date or 1 year ago, whichever is more recent
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        
        const simulationStartDate = firstDate < oneYearAgo ? oneYearAgo : firstDate;
        
        let currentDay = new Date(simulationStartDate);
        let btcHoldings = 0;
        let costBasis = 0;
        
        // Calculate BTC holdings up to simulation start date
        sortedTransactions.forEach(tx => {
            if (tx.date < simulationStartDate) {
                if (tx.type === 'buy') {
                    btcHoldings += tx.amount;
                    costBasis += (tx.amount * tx.price) + tx.fee;
                } else if (tx.type === 'sell') {
                    btcHoldings -= tx.amount;
                    costBasis = btcHoldings > 0 ? (costBasis * (btcHoldings / (btcHoldings + tx.amount))) : 0;
                }
            }
        });
        
        // Loop through each day from simulation start to today
        while (currentDay <= today) {
            const dayTransactions = sortedTransactions.filter(tx => 
                new Date(tx.date).toDateString() === currentDay.toDateString() &&
                tx.date >= simulationStartDate
            );
            
            // Process day's transactions
            dayTransactions.forEach(tx => {
                if (tx.type === 'buy') {
                    btcHoldings += tx.amount;
                    costBasis += (tx.amount * tx.price) + tx.fee;
                } else if (tx.type === 'sell') {
                    btcHoldings -= tx.amount;
                    // This is a simplified approach - ideally would use FIFO for cost basis
                    costBasis = btcHoldings > 0 ? (costBasis * (btcHoldings / (btcHoldings + tx.amount))) : 0;
                }
            });
            
            // For demonstration, we'll use a simple price model with some random variation
            // In a real app, you'd fetch historical prices from an API
            const daysFromToday = Math.floor((today - currentDay) / (1000 * 60 * 60 * 24));
            
            // Base price changes with a smoothed curve
            const baseChange = Math.pow(1.05, daysFromToday / 30);
            // Add slight noise but keep it smooth
            const noise = Math.sin(daysFromToday * 0.1) * 0.05 + Math.sin(daysFromToday * 0.05) * 0.025;
            const estimatedPrice = bitcoinPrice / (baseChange * (1 + noise));
            
            const portfolioValue = btcHoldings * estimatedPrice;
            
            // Add data point
            dataPoints.push({
                date: new Date(currentDay),
                value: portfolioValue
            });
            
            // Move to next day
            currentDay.setDate(currentDay.getDate() + 1);
        }
        
        portfolioHistory = dataPoints;
    }
    
    // Filter portfolio history based on selected period
    function getFilteredPortfolioHistory() {
        if (!portfolioHistory.length) return [];
        
        const today = new Date();
        let startDate;
        
        switch (currentPeriod) {
            case 'week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(today);
                startDate.setMonth(today.getMonth() - 1);
                break;
            case 'year':
                startDate = new Date(today);
                startDate.setFullYear(today.getFullYear() - 1);
                break;
            default:
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
        }
        
        return portfolioHistory.filter(point => point.date >= startDate);
    }
    
    // Render the portfolio value chart
    function renderPortfolioChart() {
        if (!portfolioChartCanvas) return;
        
        const filteredHistory = getFilteredPortfolioHistory();
        
        if (filteredHistory.length === 0) return;
        
        // Prepare data for Chart.js
        const labels = filteredHistory.map(point => {
            const date = new Date(point.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        const values = filteredHistory.map(point => point.value);
        
        // Create gradient fill
        const ctx = portfolioChartCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(247, 147, 26, 0.2)');
        gradient.addColorStop(1, 'rgba(247, 147, 26, 0)');
        
        // Destroy existing chart if there is one
        if (portfolioChart) {
            portfolioChart.destroy();
        }
        
        // Create new chart
        portfolioChart = new Chart(portfolioChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Portfolio Value (USD)',
                    data: values,
                    borderColor: '#f7931a',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#f7931a',
                    tension: 0.4, // Increase tension for smoother curve
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatCurrency(context.raw);
                            }
                        },
                        backgroundColor: '#1a1a1a',
                        titleColor: '#f7931a',
                        bodyColor: '#eee',
                        borderColor: '#333',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            maxTicksLimit: currentPeriod === 'week' ? 7 : (currentPeriod === 'month' ? 10 : 12),
                            font: {
                                size: 10
                            },
                            color: '#888'
                        }
                    },
                    y: {
                        beginAtZero: false, // Better scale for portfolio value
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            },
                            font: {
                                size: 10
                            },
                            color: '#888'
                        }
                    }
                },
                elements: {
                    line: {
                        tension: 0.4 // Smooth the line curve
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 1000
                }
            }
        });
    }
    
    // Fetch market data
    async function fetchMarketData() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/global');
            const data = await response.json();
            
            if (data && data.data) {
                const btcDominance = data.data.market_cap_percentage.btc;
                const totalVolume = data.data.total_volume.usd;
                
                if (btcDominanceElement) {
                    btcDominanceElement.textContent = formatPercentage(btcDominance / 100);
                }
                
                if (volume24hElement) {
                    volume24hElement.textContent = formatCurrency(totalVolume);
                }
            }
        } catch (error) {
            console.error('Error fetching market data:', error);
            
            // Set fallback values
            if (btcDominanceElement) btcDominanceElement.textContent = '42.5%';
            if (volume24hElement) volume24hElement.textContent = '$35.8B';
        }
    }
    
    // Update dashboard with latest stats
    function updateDashboard() {
        const stats = calculatePortfolioStats();
        
        // Update Bitcoin price display
        if (currentBtcPriceElement) {
            currentBtcPriceElement.textContent = formatCurrency(bitcoinPrice);
        }
        if (priceUpdateTimeElement) {
            priceUpdateTimeElement.textContent = new Date().toLocaleTimeString();
        }
        
        // Update dashboard stats
        if (totalBtcElement) totalBtcElement.textContent = formatBTC(stats.totalBtc);
        if (avgCostElement) avgCostElement.textContent = formatCurrency(stats.averageCost);
        if (totalInvestmentElement) totalInvestmentElement.textContent = formatCurrency(stats.totalInvestment);
        if (unrealizedPlElement) unrealizedPlElement.textContent = formatCurrency(stats.unrealizedPL);
        if (currentValueElement) currentValueElement.textContent = formatCurrency(stats.currentValue);
        if (realizedPlElement) realizedPlElement.textContent = formatCurrency(stats.realizedPL);
        if (shortTermGainElement) shortTermGainElement.textContent = formatCurrency(stats.shortTermGains);
        if (longTermGainElement) longTermGainElement.textContent = formatCurrency(stats.longTermGains);
        
        // Update 24h change
        if (change24hElement) {
            change24hElement.textContent = formatCurrency(stats.change24h);
            
            if (stats.change24h > 0) {
                change24hElement.className = 'value-amount profit';
                change24hElement.textContent = '+' + change24hElement.textContent;
            } else if (stats.change24h < 0) {
                change24hElement.className = 'value-amount loss';
            } else {
                change24hElement.className = 'value-amount';
            }
        }
        
        // Update P/L percentage with color coding
        if (plPercentageElement) {
            plPercentageElement.textContent = formatPercentage(stats.plPercentage);
            if (stats.plPercentage > 0) {
                plPercentageElement.className = 'card-percentage positive';
                plPercentageElement.textContent = '+' + plPercentageElement.textContent;
            } else if (stats.plPercentage < 0) {
                plPercentageElement.className = 'card-percentage negative';
            } else {
                plPercentageElement.className = 'card-percentage';
            }
        }
        
        // Add appropriate classes for profit/loss styling
        if (unrealizedPlElement) {
            unrealizedPlElement.className = 'card-value ' + (stats.unrealizedPL >= 0 ? 'profit' : 'loss');
        }
        if (realizedPlElement) {
            realizedPlElement.className = 'value-amount ' + (stats.realizedPL >= 0 ? 'profit' : 'loss');
        }
        if (shortTermGainElement) {
            shortTermGainElement.className = 'value-amount ' + (stats.shortTermGains >= 0 ? 'profit' : 'loss');
        }
        if (longTermGainElement) {
            longTermGainElement.className = 'value-amount ' + (stats.longTermGains >= 0 ? 'profit' : 'loss');
        }
    }
    
    // Render recent transactions
    function renderRecentTransactions() {
        if (!recentTransactionsBody) return;
        
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
            // Fetch current price
            const currentResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const currentData = await currentResponse.json();
            bitcoinPrice = currentData.bitcoin.usd;
            
            // Fetch previous day price (using another endpoint for simplicity)
            // In a real app, you would use the historical endpoint with a specific date
            try {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                // Get yesterday's price
                previousDayPrice = bitcoinPrice * 0.98; // Fallback: assume 2% less than today
                
                // Try to get actual historical data
                const historicalResponse = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=daily`);
                const historicalData = await historicalResponse.json();
                
                if (historicalData && historicalData.prices && historicalData.prices.length > 1) {
                    // Get yesterday's price from the response
                    previousDayPrice = historicalData.prices[0][1];
                }
            } catch (error) {
                console.error('Error fetching historical price:', error);
                // Keep the fallback price if error
            }
            
            // Update dashboard after getting the price
            updateDashboard();
            
            return bitcoinPrice;
        } catch (error) {
            console.error('Error fetching Bitcoin price:', error);
            
            // Use a fallback price if API fails
            if (bitcoinPrice === 0) {
                bitcoinPrice = 30000; // Fallback value
                previousDayPrice = 29500; // Fallback previous day value
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
        fetchBitcoinPrice().then(() => {
            updateDashboard();
            
            // Check for updated transactions
            loadTransactions();
            
            // Regenerate portfolio history and render chart when price changes
            generatePortfolioHistory();
            if (portfolioChart) {
                renderPortfolioChart();
            }
        });
    }, 60000);
}); 