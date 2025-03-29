document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const calculatorForm = document.getElementById('calculator-form');
    const sellAmountInput = document.getElementById('sell-amount');
    const sellPriceInput = document.getElementById('sell-price');
    const sellDateInput = document.getElementById('sell-date');
    const useCurrentPriceBtn = document.getElementById('use-current-price');
    
    const calculationResults = document.querySelector('.calculation-results');
    const totalProceedsElement = document.getElementById('total-proceeds');
    const costBasisElement = document.getElementById('cost-basis');
    const totalGainLossElement = document.getElementById('total-gain-loss');
    const calculationBody = document.getElementById('calculation-body');
    
    // Initialize with current date
    const today = new Date();
    sellDateInput.valueAsDate = today;
    
    // Initialize with current price button
    useCurrentPriceBtn.addEventListener('click', function() {
        fetchBitcoinPrice().then(price => {
            sellPriceInput.value = price.toFixed(2);
        });
    });
    
    // Fetch current Bitcoin price
    async function fetchBitcoinPrice() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const data = await response.json();
            return data.bitcoin.usd;
        } catch (error) {
            console.error('Error fetching Bitcoin price:', error);
            return 30000; // Fallback value
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
    
    // Calculate holding period in days
    function calculateHoldingPeriod(buyDate, sellDate) {
        const diffTime = Math.abs(sellDate - buyDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // Determine if holding period is short or long term
    function getHoldingPeriodType(days) {
        return days >= 365 ? 'Long-term' : 'Short-term';
    }
    
    // Calculate tax implications using FIFO method
    function calculateFIFO(sellAmount, sellPrice, sellDate) {
        const savedTransactions = localStorage.getItem('bitcoin-transactions');
        if (!savedTransactions) {
            return { error: 'No transactions found in your records.' };
        }
        
        let transactions = JSON.parse(savedTransactions);
        
        // Convert date strings to Date objects
        transactions.forEach(tx => {
            tx.date = new Date(tx.date);
        });
        
        // Filter for buy transactions only and sort by date (oldest first - FIFO)
        const buyTransactions = transactions
            .filter(tx => tx.type === 'buy')
            .sort((a, b) => a.date - b.date);
        
        if (buyTransactions.length === 0) {
            return { error: 'No buy transactions found in your records.' };
        }
        
        // Check if we have enough BTC to sell
        const totalBtcAvailable = buyTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        const totalBtcSold = transactions
            .filter(tx => tx.type === 'sell')
            .reduce((sum, tx) => sum + tx.amount, 0);
        
        const btcAvailable = totalBtcAvailable - totalBtcSold;
        
        if (btcAvailable < sellAmount) {
            return { error: `You only have ${formatBTC(btcAvailable)} BTC available to sell.` };
        }
        
        // Convert sell date string to Date object
        sellDate = new Date(sellDate);
        
        // Calculate FIFO
        let remainingToSell = sellAmount;
        let totalProceeds = 0;
        let totalCostBasis = 0;
        let calculations = [];
        
        // Create a copy of buy transactions to track remaining amounts
        const buyQueue = buyTransactions.map(tx => ({
            ...tx,
            remainingAmount: tx.amount
        }));
        
        while (remainingToSell > 0 && buyQueue.length > 0) {
            const oldestBuy = buyQueue[0];
            
            // Skip if this buy has been fully used
            if (oldestBuy.remainingAmount <= 0) {
                buyQueue.shift();
                continue;
            }
            
            // Calculate how much BTC to use from this buy
            const amountToUse = Math.min(remainingToSell, oldestBuy.remainingAmount);
            
            // Calculate cost basis for this portion
            const portionCostBasis = amountToUse * oldestBuy.price;
            
            // Calculate proceeds for this portion
            const portionProceeds = amountToUse * sellPrice;
            
            // Calculate gain/loss
            const gainLoss = portionProceeds - portionCostBasis;
            
            // Calculate holding period
            const holdingPeriodDays = calculateHoldingPeriod(oldestBuy.date, sellDate);
            const holdingPeriodType = getHoldingPeriodType(holdingPeriodDays);
            
            // Add calculation
            calculations.push({
                buyDate: oldestBuy.date,
                amountUsed: amountToUse,
                buyPrice: oldestBuy.price,
                costBasis: portionCostBasis,
                proceeds: portionProceeds,
                gainLoss: gainLoss,
                holdingPeriodDays: holdingPeriodDays,
                holdingPeriodType: holdingPeriodType
            });
            
            // Update totals
            totalProceeds += portionProceeds;
            totalCostBasis += portionCostBasis;
            
            // Update remaining amounts
            remainingToSell -= amountToUse;
            oldestBuy.remainingAmount -= amountToUse;
            
            // Remove buy if fully used
            if (oldestBuy.remainingAmount <= 0) {
                buyQueue.shift();
            }
        }
        
        return {
            totalProceeds,
            totalCostBasis,
            totalGainLoss: totalProceeds - totalCostBasis,
            calculations
        };
    }
    
    // Handle form submission
    calculatorForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const sellAmount = parseFloat(sellAmountInput.value);
        const sellPrice = parseFloat(sellPriceInput.value);
        const sellDate = sellDateInput.value;
        
        // Validate inputs
        if (isNaN(sellAmount) || sellAmount <= 0 || isNaN(sellPrice) || sellPrice <= 0 || !sellDate) {
            alert('Please enter valid values for all fields.');
            return;
        }
        
        // Calculate FIFO
        const result = calculateFIFO(sellAmount, sellPrice, sellDate);
        
        if (result.error) {
            alert(result.error);
            return;
        }
        
        // Display results
        totalProceedsElement.textContent = formatCurrency(result.totalProceeds);
        costBasisElement.textContent = formatCurrency(result.totalCostBasis);
        totalGainLossElement.textContent = formatCurrency(result.totalGainLoss);
        
        // Apply color to gain/loss
        if (result.totalGainLoss > 0) {
            totalGainLossElement.className = 'summary-value profit';
        } else if (result.totalGainLoss < 0) {
            totalGainLossElement.className = 'summary-value loss';
        } else {
            totalGainLossElement.className = 'summary-value';
        }
        
        // Clear previous results
        calculationBody.innerHTML = '';
        
        // Add calculation rows
        result.calculations.forEach(calc => {
            const row = document.createElement('tr');
            
            // Format date
            const buyDateFormatted = calc.buyDate.toLocaleDateString();
            
            // Create row content
            row.innerHTML = `
                <td>${buyDateFormatted}</td>
                <td>${formatBTC(calc.amountUsed)}</td>
                <td>${formatCurrency(calc.buyPrice)}</td>
                <td>${formatCurrency(calc.costBasis)}</td>
                <td>${formatCurrency(calc.proceeds)}</td>
                <td class="${calc.gainLoss >= 0 ? 'profit' : 'loss'}">${formatCurrency(calc.gainLoss)}</td>
                <td>${calc.holdingPeriodDays} days</td>
                <td>${calc.holdingPeriodType}</td>
            `;
            
            calculationBody.appendChild(row);
        });
        
        // Show results section
        calculationResults.style.display = 'block';
        
        // Scroll to results
        calculationResults.scrollIntoView({ behavior: 'smooth' });
    });
    
    // Initialize with current price
    fetchBitcoinPrice().then(price => {
        sellPriceInput.value = price.toFixed(2);
    });
}); 