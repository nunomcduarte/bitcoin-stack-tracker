document.addEventListener('DOMContentLoaded', function() {
    // State management
    let transactions = [];
    let bitcoinPrice = 0;
    let selectedPrice = 0;
    
    // DOM Elements
    const transactionForm = document.getElementById('transaction-form');
    const transactionTypeInput = document.getElementById('transaction-type');
    const transactionDateInput = document.getElementById('transaction-date');
    const transactionAmountInput = document.getElementById('transaction-amount');
    const transactionPriceInput = document.getElementById('transaction-price');
    const transactionFeeInput = document.getElementById('transaction-fee');
    const transactionNotesInput = document.getElementById('transaction-notes');
    const transactionsBody = document.getElementById('transactions-body');
    
    // Dashboard Elements
    const totalBtcElement = document.getElementById('total-btc');
    const avgCostElement = document.getElementById('avg-cost');
    const totalInvestmentElement = document.getElementById('total-investment');
    const currentValueElement = document.getElementById('current-value');
    const unrealizedPlElement = document.getElementById('unrealized-pl');
    const realizedPlElement = document.getElementById('realized-pl');
    const shortTermGainElement = document.getElementById('short-term-gain');
    const longTermGainElement = document.getElementById('long-term-gain');
    
    // Price Selection Elements
    const priceOptionInputs = document.querySelectorAll('input[name="price-option"]');
    const selectedPriceElement = document.getElementById('selected-price');
    const manualPriceContainer = document.getElementById('manual-price-container');
    const pricePerBtcInput = document.getElementById('price-per-btc');
    
    // FIFO Calculator Elements
    const fifoYearSelect = document.getElementById('fifo-year-select');
    const fifoSaleSummary = document.getElementById('fifo-sale-summary');
    const fifoDetailsBody = document.getElementById('fifo-details-body');
    const fifoExplanation = document.getElementById('fifo-explanation');
    const calculateFifoBtn = document.getElementById('calculate-fifo-btn');
    const downloadReportBtn = document.getElementById('download-report-btn');
    
    // Initialize the form with current date
    const today = new Date();
    if (transactionDateInput) {
        transactionDateInput.valueAsDate = today;
    }
    
    // Load transactions from localStorage
    function loadTransactions() {
        const savedTransactions = localStorage.getItem('bitcoin-transactions');
        if (savedTransactions) {
            transactions = JSON.parse(savedTransactions);
            transactions.forEach(tx => {
                // Convert date strings back to Date objects
                tx.date = new Date(tx.date);
            });
            renderTransactions();
            updateDashboard();
            updateFifoYearOptions();
        } else {
            showEmptyState();
        }
    }
    
    // Save transactions to localStorage
    function saveTransactions() {
        localStorage.setItem('bitcoin-transactions', JSON.stringify(transactions));
    }
    
    // Show empty state when no transactions
    function showEmptyState() {
        if (transactionsBody && transactions.length === 0) {
            transactionsBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <p>No transactions yet. Add your first Bitcoin transaction above!</p>
                    </td>
                </tr>
            `;
        }
    }
    
    // Add a new transaction
    function addTransaction(transaction) {
        // Generate a unique ID for the transaction
        transaction.id = Date.now().toString();
        transactions.push(transaction);
        transactions.sort((a, b) => a.date - b.date); // Sort by date
        saveTransactions();
        renderTransactions();
        updateDashboard();
        updateFifoYearOptions();
        
        // Reset form
        if (transactionForm) {
            transactionForm.reset();
            if (transactionDateInput) {
                transactionDateInput.valueAsDate = today;
            }
            updateSelectedPrice();
        }
    }
    
    // Remove a transaction
    function removeTransaction(id) {
        transactions = transactions.filter(tx => tx.id !== id);
        saveTransactions();
        renderTransactions();
        updateDashboard();
        updateFifoYearOptions();
        
        if (transactions.length === 0) {
            showEmptyState();
        }
    }
    
    // Get available Bitcoin balance at a specific date
    function getAvailableBitcoinBalance(atDate) {
        let balance = 0;
        
        // Consider only transactions before or equal to the specified date
        transactions.forEach(tx => {
            if (tx.date <= atDate) {
                if (tx.type === 'buy') {
                    balance += tx.amount;
                } else if (tx.type === 'sell') {
                    balance -= tx.amount;
                }
            }
        });
        
        return balance;
    }
    
    // Calculate FIFO cost basis and gains/losses
    function calculateFIFO() {
        // Create a queue of buys (FIFO order)
        let buyQueue = [];
        let totalRealizedProfit = 0;
        let shortTermGains = 0;
        let longTermGains = 0;
        
        // Clone the transactions to not modify the original
        const txs = JSON.parse(JSON.stringify(transactions));
        
        txs.forEach(tx => {
            tx.date = new Date(tx.date);
            tx.profit = 0; // Initialize profit field
        });
        
        // Process all transactions for FIFO calculation
        txs.forEach(tx => {
            if (tx.type === 'buy') {
                // Add to buy queue with remaining amount
                buyQueue.push({
                    id: tx.id,
                    date: tx.date,
                    amount: tx.amount,
                    price: tx.price,
                    remainingAmount: tx.amount
                });
            } else if (tx.type === 'sell') {
                let remainingToSell = tx.amount;
                let costBasis = 0;
                
                // Handle case where selling without any buys (shouldn't happen in practice)
                if (buyQueue.length === 0) {
                    tx.profit = (tx.price * tx.amount) - tx.fee;
                    totalRealizedProfit += tx.profit;
                    return;
                }
                
                // Process the sell against the buy queue
                while (remainingToSell > 0 && buyQueue.length > 0) {
                    const oldestBuy = buyQueue[0];
                    
                    // Calculate how much BTC we can sell from this buy
                    const amountToSell = Math.min(remainingToSell, oldestBuy.remainingAmount);
                    
                    // Calculate cost basis for this portion
                    const portionCostBasis = amountToSell * oldestBuy.price;
                    costBasis += portionCostBasis;
                    
                    // Calculate revenue for this portion
                    const portionRevenue = amountToSell * tx.price;
                    
                    // Calculate profit for this portion
                    const portionProfit = portionRevenue - portionCostBasis;
                    
                    // Track if this is a long-term or short-term gain
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
                    
                    // If this buy is completely used, remove it from the queue
                    if (oldestBuy.remainingAmount <= 0.00000001) { // Allow for small rounding errors
                        buyQueue.shift();
                    }
                }
                
                // Calculate total sale revenue
                const totalRevenue = tx.price * tx.amount;
                
                // Calculate profit (revenue - cost basis - fee)
                tx.profit = totalRevenue - costBasis - tx.fee;
                totalRealizedProfit += tx.profit;
            }
        });
        
        // Update the original transactions with calculated profits
        transactions.forEach((originalTx, i) => {
            if (originalTx.type === 'sell') {
                const matchingTx = txs.find(t => t.id === originalTx.id);
                if (matchingTx) {
                    originalTx.profit = matchingTx.profit;
                }
            }
        });
        
        return {
            realizedProfit: totalRealizedProfit,
            shortTermGains,
            longTermGains,
            remainingBuyQueue: buyQueue
        };
    }
    
    // Calculate FIFO details for a specific sell transaction
    function calculateFIFODetailsForSale(saleId) {
        // Create a queue of buys (FIFO order)
        let buyQueue = [];
        let fifoDetails = [];
        let totalCostBasis = 0;
        let totalRevenue = 0;
        let shortTermGains = 0;
        let longTermGains = 0;
        
        // Find the sale transaction
        const saleTransaction = transactions.find(tx => tx.id === saleId && tx.type === 'sell');
        if (!saleTransaction) return null;
        
        // Clone the transactions up to the sale date
        const relevantTransactions = JSON.parse(JSON.stringify(
            transactions.filter(tx => tx.date <= saleTransaction.date)
        ));
        
        // First, add all buys to the queue
        relevantTransactions.forEach(tx => {
            tx.date = new Date(tx.date);
            
            if (tx.type === 'buy') {
                buyQueue.push({
                    id: tx.id,
                    date: tx.date,
                    amount: tx.amount,
                    price: tx.price,
                    remainingAmount: tx.amount
                });
            }
        });
        
        // Process all sales before our target sale (to get proper FIFO order)
        for (const tx of relevantTransactions) {
            if (tx.type === 'sell' && tx.id !== saleId) {
                let remainingToSell = tx.amount;
                
                while (remainingToSell > 0 && buyQueue.length > 0) {
                    const oldestBuy = buyQueue[0];
                    const amountToSell = Math.min(remainingToSell, oldestBuy.remainingAmount);
                    
                    // Update remaining amounts
                    remainingToSell -= amountToSell;
                    oldestBuy.remainingAmount -= amountToSell;
                    
                    // If this buy is completely used, remove it from the queue
                    if (oldestBuy.remainingAmount <= 0.00000001) {
                        buyQueue.shift();
                    }
                }
            }
        }
        
        // Now process our target sale
        let remainingToSell = saleTransaction.amount;
        
        while (remainingToSell > 0 && buyQueue.length > 0) {
            const oldestBuy = buyQueue[0];
            const amountToSell = Math.min(remainingToSell, oldestBuy.remainingAmount);
            
            // Calculate cost basis, revenue, and profit for this portion
            const portionCostBasis = amountToSell * oldestBuy.price;
            const portionRevenue = amountToSell * saleTransaction.price;
            const portionProfit = portionRevenue - portionCostBasis;
            
            // Calculate holding period
            const holdingPeriodDays = (saleTransaction.date - oldestBuy.date) / (1000 * 60 * 60 * 24);
            const isLongTerm = holdingPeriodDays >= 365;
            
            // Track gains by type
            if (isLongTerm) {
                longTermGains += portionProfit;
            } else {
                shortTermGains += portionProfit;
            }
            
            // Add this lot to FIFO details
            fifoDetails.push({
                buyDate: oldestBuy.date,
                buyPrice: oldestBuy.price,
                amount: amountToSell,
                costBasis: portionCostBasis,
                salePrice: saleTransaction.price,
                revenue: portionRevenue,
                holdingPeriod: holdingPeriodDays,
                profit: portionProfit,
                isLongTerm
            });
            
            // Update totals
            totalCostBasis += portionCostBasis;
            totalRevenue += portionRevenue;
            
            // Update remaining amounts
            remainingToSell -= amountToSell;
            oldestBuy.remainingAmount -= amountToSell;
            
            // If this buy is completely used, remove it from the queue
            if (oldestBuy.remainingAmount <= 0.00000001) {
                buyQueue.shift();
            }
        }
        
        // Calculate total profit (accounting for fees)
        const totalProfit = totalRevenue - totalCostBasis - saleTransaction.fee;
        
        return {
            saleTransaction,
            fifoDetails,
            totalCostBasis,
            totalRevenue,
            totalProfit,
            shortTermGains,
            longTermGains,
            fee: saleTransaction.fee
        };
    }
    
    // Calculate current portfolio stats
    function calculatePortfolioStats() {
        const fifoResult = calculateFIFO();
        const buyQueue = fifoResult.remainingBuyQueue;
        
        let totalBtc = 0;
        let totalInvestment = 0;
        
        // Calculate total BTC and investment from remaining buy queue
        buyQueue.forEach(buy => {
            totalBtc += buy.remainingAmount;
            totalInvestment += buy.remainingAmount * buy.price;
        });
        
        // Calculate average cost if we have any BTC
        const averageCost = totalBtc > 0 ? totalInvestment / totalBtc : 0;
        
        // Calculate current value and unrealized profit/loss
        const currentValue = totalBtc * bitcoinPrice;
        const unrealizedPL = currentValue - totalInvestment;
        
        return {
            totalBtc,
            averageCost,
            totalInvestment,
            currentValue,
            unrealizedPL,
            realizedPL: fifoResult.realizedProfit,
            shortTermGains: fifoResult.shortTermGains,
            longTermGains: fifoResult.longTermGains
        };
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
    
    // Format date for display
    function formatDate(date) {
        return date.toLocaleDateString();
    }
    
    // Format holding period for display
    function formatHoldingPeriod(days) {
        if (days < 30) {
            return `${Math.floor(days)} days`;
        } else if (days < 365) {
            return `${Math.floor(days / 30)} months, ${Math.floor(days % 30)} days`;
        } else {
            const years = Math.floor(days / 365);
            const months = Math.floor((days % 365) / 30);
            return `${years} ${years === 1 ? 'year' : 'years'}${months > 0 ? `, ${months} ${months === 1 ? 'month' : 'months'}` : ''}`;
        }
    }
    
    // Update the dashboard with latest stats
    function updateDashboard() {
        // Fetch current Bitcoin price
        fetchBitcoinPrice().then(() => {
            const stats = calculatePortfolioStats();
            
            // Update dashboard elements
            totalBtcElement.textContent = formatBTC(stats.totalBtc);
            avgCostElement.textContent = formatCurrency(stats.averageCost);
            totalInvestmentElement.textContent = formatCurrency(stats.totalInvestment);
            currentValueElement.textContent = formatCurrency(stats.currentValue);
            unrealizedPlElement.textContent = formatCurrency(stats.unrealizedPL);
            realizedPlElement.textContent = formatCurrency(stats.realizedPL);
            shortTermGainElement.textContent = formatCurrency(stats.shortTermGains);
            longTermGainElement.textContent = formatCurrency(stats.longTermGains);
            
            // Add appropriate classes for profit/loss styling
            unrealizedPlElement.className = 'value ' + (stats.unrealizedPL >= 0 ? 'profit' : 'loss');
            realizedPlElement.className = 'value ' + (stats.realizedPL >= 0 ? 'profit' : 'loss');
            
            // Update price display if using current price
            updateSelectedPrice();
        });
    }
    
    // Render the transactions table
    function renderTransactions() {
        transactionsBody.innerHTML = '';
        
        if (transactions.length === 0) {
            showEmptyState();
            return;
        }
        
        // Calculate profits using FIFO
        calculateFIFO();
        
        // Sort transactions newest first for display
        const sortedTransactions = [...transactions].sort((a, b) => b.date - a.date);
        
        // Add each transaction to the table
        sortedTransactions.forEach(tx => {
            const row = document.createElement('tr');
            
            // Format date
            const dateFormatted = tx.date.toLocaleDateString();
            
            // Calculate total in USD
            const totalUSD = tx.amount * tx.price;
            
            // Format profit/loss (only for sell transactions)
            let profitLossHTML = '-';
            if (tx.type === 'sell' && tx.profit !== undefined) {
                const profitClass = tx.profit >= 0 ? 'profit' : 'loss';
                profitLossHTML = `<span class="${profitClass}">${formatCurrency(tx.profit)}</span>`;
            }
            
            // Create row content
            row.innerHTML = `
                <td>${dateFormatted}</td>
                <td class="${tx.type}">${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</td>
                <td>${formatBTC(tx.amount)}</td>
                <td>${formatCurrency(tx.price)}</td>
                <td>${formatCurrency(totalUSD)}</td>
                <td>${formatCurrency(tx.fee)}</td>
                <td>${profitLossHTML}</td>
                <td class="actions">
                    <button class="delete-btn" data-id="${tx.id}">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            
            transactionsBody.appendChild(row);
        });
        
        // Add event listeners to delete buttons
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this transaction?')) {
                    removeTransaction(id);
                }
            });
        });
    }
    
    // Update FIFO year dropdown options
    function updateFifoYearOptions() {
        fifoYearSelect.innerHTML = '<option value="">-- Select a year --</option>';
        
        if (transactions.length === 0) {
            fifoSaleSummary.innerHTML = '<p>No transactions available for analysis</p>';
            fifoDetailsBody.innerHTML = '';
            return;
        }
        
        // Get unique years from all transactions
        const years = new Set();
        transactions.forEach(tx => {
            const year = tx.date.getFullYear();
            years.add(year);
        });
        
        // Sort years in descending order (newest first)
        const sortedYears = Array.from(years).sort((a, b) => b - a);
        
        // Add years to dropdown
        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            fifoYearSelect.appendChild(option);
        });
    }
    
    // Calculate FIFO details for a specific year
    function calculateFIFODetailsByYear(year) {
        // Create a queue of buys (FIFO order)
        let buyQueue = [];
        let fifoDetails = [];
        let totalCostBasis = 0;
        let totalRevenue = 0;
        let totalFees = 0;
        let shortTermGains = 0;
        let longTermGains = 0;
        
        if (!year) return null;
        
        // Get the date range for the selected year
        const startDate = new Date(year, 0, 1); // January 1st of the selected year
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999); // December 31st of the selected year
        
        // Clone all transactions up to the end of the year
        const relevantTransactions = JSON.parse(JSON.stringify(
            transactions.filter(tx => tx.date <= endDate)
        ));
        
        // First, add all buys to the queue
        relevantTransactions.forEach(tx => {
            tx.date = new Date(tx.date);
            
            if (tx.type === 'buy') {
                buyQueue.push({
                    id: tx.id,
                    date: tx.date,
                    amount: tx.amount,
                    price: tx.price,
                    remainingAmount: tx.amount
                });
            }
        });
        
        // Process all sales
        for (const tx of relevantTransactions) {
            if (tx.type === 'sell') {
                let remainingToSell = tx.amount;
                let sellCostBasis = 0;
                
                // Skip if buy queue is empty
                if (buyQueue.length === 0) {
                    continue;
                }
                
                // Store the details for this sell if it's in our target year
                const isInTargetYear = tx.date.getFullYear() === parseInt(year);
                
                // Process this sale against the buy queue
                while (remainingToSell > 0 && buyQueue.length > 0) {
                    const oldestBuy = buyQueue[0];
                    const amountToSell = Math.min(remainingToSell, oldestBuy.remainingAmount);
                    
                    // Calculate cost basis, revenue, and profit for this portion
                    const portionCostBasis = amountToSell * oldestBuy.price;
                    const portionRevenue = amountToSell * tx.price;
                    const portionProfit = portionRevenue - portionCostBasis;
                    
                    // Calculate holding period
                    const holdingPeriodDays = (tx.date - oldestBuy.date) / (1000 * 60 * 60 * 24);
                    const isLongTerm = holdingPeriodDays >= 365;
                    
                    // Only add to totals if the sale occurred in our target year
                    if (isInTargetYear) {
                        // Track gains by type
                        if (isLongTerm) {
                            longTermGains += portionProfit;
                        } else {
                            shortTermGains += portionProfit;
                        }
                        
                        // Add this lot to FIFO details
                        fifoDetails.push({
                            buyDate: oldestBuy.date,
                            sellDate: tx.date,
                            buyPrice: oldestBuy.price,
                            amount: amountToSell,
                            costBasis: portionCostBasis,
                            salePrice: tx.price,
                            revenue: portionRevenue,
                            holdingPeriod: holdingPeriodDays,
                            profit: portionProfit,
                            isLongTerm
                        });
                        
                        // Update totals
                        totalCostBasis += portionCostBasis;
                        totalRevenue += portionRevenue;
                        sellCostBasis += portionCostBasis;
                    }
                    
                    // Update remaining amounts
                    remainingToSell -= amountToSell;
                    oldestBuy.remainingAmount -= amountToSell;
                    
                    // If this buy is completely used, remove it from the queue
                    if (oldestBuy.remainingAmount <= 0.00000001) {
                        buyQueue.shift();
                    }
                }
                
                // Only add fee to totals if the sale occurred in our target year
                if (isInTargetYear) {
                    totalFees += tx.fee;
                }
            }
        }
        
        // Calculate total profit (accounting for fees)
        const totalProfit = totalRevenue - totalCostBasis - totalFees;
        
        return {
            year,
            fifoDetails,
            totalCostBasis,
            totalRevenue,
            totalProfit,
            totalFees,
            shortTermGains,
            longTermGains
        };
    }
    
    // Generate FIFO method explanation
    function generateFifoExplanation(fifoResult) {
        if (!fifoResult) return '';
        
        // General FIFO explanation
        let explanation = `
            <p><strong>What is the FIFO Method?</strong></p>
            <p>FIFO (First In, First Out) is an accounting method used to calculate gains or losses when selling assets like Bitcoin. Under FIFO, the first assets you purchased are considered the first ones sold.</p>
            
            <p><strong>How FIFO Works for Bitcoin:</strong></p>
            <ul>
                <li>When you sell Bitcoin, the cost basis is determined by your earliest purchases</li>
                <li>Your oldest Bitcoin purchases are "used up" first when calculating gains</li>
                <li>This continues in chronological order until the full amount of the sale is accounted for</li>
                <li>The holding period (time between purchase and sale) determines whether gains are short-term or long-term</li>
            </ul>
            
            <p><strong>Tax Categories:</strong></p>
            <ul>
                <li><span class="tax-category short-term">Short-term gains</span>: Bitcoin held for less than 1 year</li>
                <li><span class="tax-category long-term">Long-term gains</span>: Bitcoin held for 1 year or longer</li>
            </ul>
        `;
        
        // Specific details for this calculation
        if (fifoResult.fifoDetails.length > 0) {
            // Find examples from this year's calculations
            const shortTermExample = fifoResult.fifoDetails.find(detail => !detail.isLongTerm);
            const longTermExample = fifoResult.fifoDetails.find(detail => detail.isLongTerm);
            
            explanation += `<p><strong>Your ${fifoResult.year} FIFO Calculation Summary:</strong></p>`;
            
            // Add year-specific details
            explanation += `
                <p>For tax year ${fifoResult.year}, you had ${fifoResult.fifoDetails.length} Bitcoin sale lots that were calculated using FIFO.</p>
                <p>Total capital gains: ${formatCurrency(fifoResult.totalProfit)} (${formatCurrency(fifoResult.shortTermGains)} short-term, ${formatCurrency(fifoResult.longTermGains)} long-term)</p>
            `;
            
            // Add examples if available
            if (shortTermExample) {
                explanation += `
                    <div class="example">
                        <p><strong>Short-term Example:</strong></p>
                        <p>You bought ${formatBTC(shortTermExample.amount)} BTC on ${formatDate(shortTermExample.buyDate)} for ${formatCurrency(shortTermExample.buyPrice)} per BTC.</p>
                        <p>You sold this Bitcoin on ${formatDate(shortTermExample.sellDate)} for ${formatCurrency(shortTermExample.salePrice)} per BTC after holding for ${formatHoldingPeriod(shortTermExample.holdingPeriod)}.</p>
                        <p>This resulted in a ${shortTermExample.profit >= 0 ? 'profit' : 'loss'} of ${formatCurrency(shortTermExample.profit)}.</p>
                    </div>
                `;
            }
            
            if (longTermExample) {
                explanation += `
                    <div class="example">
                        <p><strong>Long-term Example:</strong></p>
                        <p>You bought ${formatBTC(longTermExample.amount)} BTC on ${formatDate(longTermExample.buyDate)} for ${formatCurrency(longTermExample.buyPrice)} per BTC.</p>
                        <p>You sold this Bitcoin on ${formatDate(longTermExample.sellDate)} for ${formatCurrency(longTermExample.salePrice)} per BTC after holding for ${formatHoldingPeriod(longTermExample.holdingPeriod)}.</p>
                        <p>This resulted in a ${longTermExample.profit >= 0 ? 'profit' : 'loss'} of ${formatCurrency(longTermExample.profit)}.</p>
                    </div>
                `;
            }
        }
        
        // Add tax disclaimer
        explanation += `
            <p><em>Disclaimer: This report is for informational purposes only and should not be considered tax advice. Please consult with a qualified tax professional regarding your specific situation.</em></p>
        `;
        
        return explanation;
    }
    
    // Generate tax report as HTML
    function generateTaxReport(fifoResult) {
        if (!fifoResult) return '';
        
        const reportDate = new Date().toLocaleDateString();
        
        let report = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bitcoin FIFO Tax Report - ${fifoResult.year}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 1000px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    h1, h2, h3 {
                        color: #f7931a;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 20px;
                    }
                    .summary {
                        background-color: #f9f9f9;
                        padding: 20px;
                        border-radius: 5px;
                        margin-bottom: 30px;
                    }
                    .profit {
                        color: #28a745;
                    }
                    .loss {
                        color: #dc3545;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 30px;
                    }
                    th, td {
                        padding: 12px 8px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .short-term {
                        color: #dc3545;
                    }
                    .long-term {
                        color: #28a745;
                    }
                    .explanation {
                        background-color: #f5f5f5;
                        padding: 20px;
                        border-radius: 5px;
                        margin-bottom: 30px;
                    }
                    .footer {
                        text-align: center;
                        font-size: 0.8rem;
                        color: #777;
                        margin-top: 50px;
                        border-top: 1px solid #ddd;
                        padding-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Bitcoin FIFO Tax Report</h1>
                    <p>Tax Year: ${fifoResult.year}</p>
                    <p>Report Generated: ${reportDate}</p>
                </div>
                
                <div class="summary">
                    <h2>Tax Year Summary</h2>
                    <p><strong>Total Capital Gains:</strong> <span class="${fifoResult.totalProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(fifoResult.totalProfit)}</span></p>
                    <p><strong>Short-term Gains:</strong> <span class="${fifoResult.shortTermGains >= 0 ? 'profit' : 'loss'}">${formatCurrency(fifoResult.shortTermGains)}</span></p>
                    <p><strong>Long-term Gains:</strong> <span class="${fifoResult.longTermGains >= 0 ? 'profit' : 'loss'}">${formatCurrency(fifoResult.longTermGains)}</span></p>
                    <p><strong>Total Sales Revenue:</strong> ${formatCurrency(fifoResult.totalRevenue)}</p>
                    <p><strong>Total Cost Basis:</strong> ${formatCurrency(fifoResult.totalCostBasis)}</p>
                    <p><strong>Total Fees:</strong> ${formatCurrency(fifoResult.totalFees)}</p>
                </div>
                
                <h2>FIFO Calculation Details</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Buy Date</th>
                            <th>BTC Amount</th>
                            <th>Buy Price</th>
                            <th>Cost Basis</th>
                            <th>Sell Date</th>
                            <th>Sell Price</th>
                            <th>Sale Revenue</th>
                            <th>Holding Period</th>
                            <th>Gain/Loss</th>
                            <th>Tax Category</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Sort details by sell date
        const sortedDetails = [...fifoResult.fifoDetails].sort((a, b) => a.sellDate - b.sellDate);
        
        // Add the transaction rows
        sortedDetails.forEach(detail => {
            report += `
                <tr>
                    <td>${formatDate(detail.buyDate)}</td>
                    <td>${formatBTC(detail.amount)}</td>
                    <td>${formatCurrency(detail.buyPrice)}</td>
                    <td>${formatCurrency(detail.costBasis)}</td>
                    <td>${formatDate(detail.sellDate)}</td>
                    <td>${formatCurrency(detail.salePrice)}</td>
                    <td>${formatCurrency(detail.revenue)}</td>
                    <td>${formatHoldingPeriod(detail.holdingPeriod)}</td>
                    <td class="${detail.profit >= 0 ? 'profit' : 'loss'}">${formatCurrency(detail.profit)}</td>
                    <td class="${detail.isLongTerm ? 'long-term' : 'short-term'}">${detail.isLongTerm ? 'Long-term' : 'Short-term'}</td>
                </tr>
            `;
        });
        
        // Close the table and add explanation
        report += `
                    </tbody>
                </table>
                
                <div class="explanation">
                    <h2>FIFO Method Explanation</h2>
                    ${generateFifoExplanation(fifoResult).replace(/<\/?p>/g, '')}
                </div>
                
                <div class="footer">
                    <p>Generated by Bitcoin Stack Tracker</p>
                    <p>This report is for informational purposes only and should not be considered tax advice. Please consult with a qualified tax professional regarding your specific situation.</p>
                </div>
            </body>
            </html>
        `;
        
        return report;
    }
    
    // Download tax report as HTML file
    function downloadTaxReport(fifoResult) {
        if (!fifoResult) return;
        
        const reportHTML = generateTaxReport(fifoResult);
        const blob = new Blob([reportHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bitcoin_FIFO_Tax_Report_${fifoResult.year}.html`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    // Render FIFO calculation details by year
    function renderFIFODetailsByYear(year) {
        if (!year) {
            fifoSaleSummary.innerHTML = '<p>Select a tax year and click Calculate Gains to view your capital gains for that year</p>';
            fifoDetailsBody.innerHTML = '';
            fifoExplanation.innerHTML = '';
            downloadReportBtn.style.display = 'none';
            return;
        }
        
        const fifoResult = calculateFIFODetailsByYear(year);
        
        if (!fifoResult || fifoResult.fifoDetails.length === 0) {
            fifoSaleSummary.innerHTML = '<p>No capital gains in the selected year</p>';
            fifoDetailsBody.innerHTML = '';
            fifoExplanation.innerHTML = '';
            downloadReportBtn.style.display = 'none';
            return;
        }
        
        // Render year summary
        fifoSaleSummary.innerHTML = `
            <div class="fifo-summary-item">
                <div class="label">Tax Year</div>
                <div class="value">${fifoResult.year}</div>
            </div>
            <div class="fifo-summary-item">
                <div class="label">Total Sales Revenue</div>
                <div class="value">${formatCurrency(fifoResult.totalRevenue)}</div>
            </div>
            <div class="fifo-summary-item">
                <div class="label">Total Cost Basis</div>
                <div class="value">${formatCurrency(fifoResult.totalCostBasis)}</div>
            </div>
            <div class="fifo-summary-item">
                <div class="label">Total Fees</div>
                <div class="value">${formatCurrency(fifoResult.totalFees)}</div>
            </div>
            <div class="fifo-summary-item">
                <div class="label">Total Capital Gains</div>
                <div class="value ${fifoResult.totalProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(fifoResult.totalProfit)}</div>
            </div>
            <div class="fifo-summary-item">
                <div class="label">Short-term Gains</div>
                <div class="value ${fifoResult.shortTermGains > 0 ? 'profit' : ''}">${formatCurrency(fifoResult.shortTermGains)}</div>
            </div>
            <div class="fifo-summary-item">
                <div class="label">Long-term Gains</div>
                <div class="value ${fifoResult.longTermGains > 0 ? 'profit' : ''}">${formatCurrency(fifoResult.longTermGains)}</div>
            </div>
        `;
        
        // Generate and add FIFO explanation
        fifoExplanation.innerHTML = generateFifoExplanation(fifoResult);
        
        // Render FIFO details table
        fifoDetailsBody.innerHTML = '';
        
        // Sort details by sell date
        fifoResult.fifoDetails.sort((a, b) => a.sellDate - b.sellDate);
        
        fifoResult.fifoDetails.forEach(detail => {
            const row = document.createElement('tr');
            row.className = 'lot-row';
            
            row.innerHTML = `
                <td>${formatDate(detail.buyDate)}</td>
                <td>${formatBTC(detail.amount)}</td>
                <td>${formatCurrency(detail.buyPrice)}</td>
                <td>${formatCurrency(detail.costBasis)}</td>
                <td>${formatDate(detail.sellDate)}</td>
                <td>${formatCurrency(detail.salePrice)}</td>
                <td>${formatCurrency(detail.revenue)}</td>
                <td class="holding-period">${formatHoldingPeriod(detail.holdingPeriod)}</td>
                <td class="${detail.profit >= 0 ? 'profit' : 'loss'}">${formatCurrency(detail.profit)}</td>
                <td class="tax-category ${detail.isLongTerm ? 'long-term' : 'short-term'}">${detail.isLongTerm ? 'Long-term' : 'Short-term'}</td>
            `;
            
            fifoDetailsBody.appendChild(row);
        });
        
        // Show download report button
        downloadReportBtn.style.display = 'block';
        
        // Store the fifoResult for later use with the download button
        downloadReportBtn.fifoResult = fifoResult;
    }
    
    // Handle calculate button click
    calculateFifoBtn.addEventListener('click', function() {
        const selectedYear = fifoYearSelect.value;
        if (!selectedYear) {
            alert('Please select a tax year first');
            return;
        }
        renderFIFODetailsByYear(selectedYear);
    });
    
    // Handle download report button click
    downloadReportBtn.addEventListener('click', function() {
        if (this.fifoResult) {
            downloadTaxReport(this.fifoResult);
        }
    });
    
    // Fetch current Bitcoin price from CoinGecko API
    async function fetchBitcoinPrice() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const data = await response.json();
            bitcoinPrice = data.bitcoin.usd;
            return bitcoinPrice;
        } catch (error) {
            console.error('Error fetching Bitcoin price:', error);
            
            // Use a fallback price if API fails
            if (bitcoinPrice === 0) {
                bitcoinPrice = 30000; // Fallback value
            }
            
            return bitcoinPrice;
        }
    }
    
    // Fetch historical Bitcoin price for a specific date
    async function fetchHistoricalPrice(date) {
        // Format date as DD-MM-YYYY for CoinGecko API
        const dateFormatted = date.toISOString().split('T')[0].split('-').reverse().join('-');
        
        // Add loading indicator
        selectedPriceElement.innerHTML = '<span class="loading-price"></span>';
        
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${dateFormatted}`);
            const data = await response.json();
            
            if (data.market_data && data.market_data.current_price) {
                return data.market_data.current_price.usd;
            } else {
                throw new Error('Historical price data not available');
            }
        } catch (error) {
            console.error('Error fetching historical price:', error);
            alert('Could not fetch historical price. Please enter price manually.');
            // Switch to manual price input
            document.getElementById('price-manual').checked = true;
            updatePriceSelectionUI();
            return 0;
        }
    }
    
    // Update the price based on the selected option
    async function updateSelectedPrice() {
        if (!priceOptionInputs.length || !transactionPriceInput) return;
        
        const selectedOption = document.querySelector('input[name="price-option"]:checked')?.value;
        if (!selectedOption) return;
        
        if (selectedOption === 'current') {
            // Fetch and use current price
            const price = await fetchBitcoinPrice();
            transactionPriceInput.value = price.toFixed(2);
        } else if (selectedOption === 'custom') {
            // Custom price will be entered by user
            transactionPriceInput.value = '';
            transactionPriceInput.focus();
        }
    }
    
    // Update UI based on price selection
    function updatePriceSelectionUI() {
        const selectedOption = document.querySelector('input[name="price-option"]:checked').value;
        
        // Show/hide manual price input
        if (selectedOption === 'manual') {
            manualPriceContainer.style.display = 'block';
        } else {
            manualPriceContainer.style.display = 'none';
        }
        
        // Update the price display
        updateSelectedPrice();
    }
    
    // Handle price selection change
    priceOptionInputs.forEach(input => {
        input.addEventListener('change', updatePriceSelectionUI);
    });
    
    // Handle manual price input
    pricePerBtcInput.addEventListener('input', function() {
        if (document.getElementById('price-manual').checked) {
            updateSelectedPrice();
        }
    });
    
    // Handle date change (for historical price)
    transactionDateInput.addEventListener('change', function() {
        if (document.getElementById('price-historical').checked) {
            updateSelectedPrice();
        }
    });
    
    // Handle form submission
    transactionForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const type = transactionTypeInput.value;
        const date = new Date(transactionDateInput.value);
        const amount = parseFloat(transactionAmountInput.value);
        const price = parseFloat(transactionPriceInput.value);
        const fee = parseFloat(transactionFeeInput.value || 0);
        const notes = transactionNotesInput.value;
        
        // Validate inputs
        if (!type || isNaN(date.getTime()) || isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) {
            alert('Please fill in all required fields with valid values.');
            return;
        }
        
        // Validate price
        if (selectedPrice <= 0) {
            alert('Please select a valid price.');
            return;
        }
        
        // For sell transactions, check if user has enough Bitcoin
        if (type === 'sell') {
            const transactionDate = new Date(date);
            const availableBtc = getAvailableBitcoinBalance(transactionDate);
            
            if (amount > availableBtc) {
                alert(`You cannot sell more Bitcoin than you own. Available: ${formatBTC(availableBtc)} BTC`);
                return;
            }
        }
        
        // Create transaction object
        const transaction = {
            type,
            date,
            amount,
            price: selectedPrice,
            fee,
            notes,
            profit: 0 // For sell transactions, will be calculated later
        };
        
        // Add transaction
        addTransaction(transaction);
        
        // Reset form
        transactionForm.reset();
        
        // Reset price selection to current
        document.getElementById('price-current').checked = true;
        updatePriceSelectionUI();
    });
    
    // Initialize
    fetchBitcoinPrice().then(() => {
        loadTransactions();
        updatePriceSelectionUI();
        updateFifoYearOptions();
    });
    
    // Refresh Bitcoin price every minute
    setInterval(fetchBitcoinPrice, 60000);
}); 