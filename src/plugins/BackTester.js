


// // Create an instance of the MartingaleBotBacktester class
// const backtester = new MartingaleBotBacktester('BTC/USDT', 'Long', 50.00, 0.0125, 0.038, 8, 'RSI', 0.75, 1.00, 1.05, 0.1, 0.05, 0.02, historicalData);

// // Run the backtest
// backtester.runBacktest();


class MartingaleBotBacktester {
  constructor(ticker, side, leverage, priceSteps, tpTarget, maxSafetyOrders, startCondition, firstSafetyOrderRatio, priceStepsMultiplier, amountMultiplier, initialOrderMargin, safetyOrderMargin, slTarget, historicalData) {
    this.ticker = ticker;
    this.side = side;
    this.leverage = leverage;
    this.priceSteps = priceSteps;
    this.tpTarget = tpTarget;
    this.maxSafetyOrders = maxSafetyOrders;
    this.startCondition = startCondition;
    this.firstSafetyOrderRatio = firstSafetyOrderRatio;
    this.priceStepsMultiplier = priceStepsMultiplier;
    this.amountMultiplier = amountMultiplier;
    this.initialOrderMargin = initialOrderMargin;
    this.safetyOrderMargin = safetyOrderMargin;
    this.slTarget = slTarget;
    this.historicalData = historicalData;
    
    this.averageEntryPrice = 0;
    this.currentCycleIndex = 0;
    this.currentSafetyOrderIndex = 0;
    this.currentTpTarget = 0;
    this.profitLossHistory = [];
  }
  
  // Function to calculate the take profit price based on the average entry price
  calculateTakeProfitPrice() {
    if (this.side === 'Long') {
      return this.averageEntryPrice * (1 + this.tpTarget);
    } else if (this.side === 'Short') {
      return this.averageEntryPrice * (1 - this.tpTarget);
    }
  }
  
  // Function to calculate the stop loss price based on the initial order fill price
  calculateStopLossPrice(initialOrderFillPrice) {
    if (this.side === 'Long') {
      return initialOrderFillPrice * (1 - this.slTarget);
    } else if (this.side === 'Short') {
      return initialOrderFillPrice * (1 + this.slTarget);
    }
  }
  
  // Function to place an order
  placeOrder(orderType, price, amount) {
    // Your logic to simulate order placement goes here
    // This is where you would calculate the profit/loss of the order based on historical data
    // and update the profitLossHistory array
    
    // For example, you can calculate the profit/loss based on the entry and exit prices
    const entryPrice = this.averageEntryPrice;
    const exitPrice = price;
    const orderProfitLoss = (exitPrice - entryPrice) * amount;
    this.profitLossHistory.push(orderProfitLoss);
    
    // Simulating order placement by returning the order profit/loss
    return orderProfitLoss;
  }
  
  // Function to simulate the bot's trading cycle
  simulateTradingCycle(startIndex) {
    // Place the initial order
    const initialOrderAmount = this.initialOrderMargin * this.leverage;
    this.placeOrder('Initial', this.historicalData[startIndex].price, initialOrderAmount);
    
    // Place the safety orders
    let safetyOrderPrice = this.averageEntryPrice;
    for (let i = 0; i < this.maxSafetyOrders; i++) {
      this.currentSafetyOrderIndex++;
      safetyOrderPrice = safetyOrderPrice * (1 - (this.priceSteps * this.priceStepsMultiplier));
      const safetyOrderAmount = (this.initialOrderMargin * this.leverage * this.amountMultiplier) / (i + 1);
      this.placeOrder('Safety', safetyOrderPrice, safetyOrderAmount);
    }
    
    // Check if the take profit target has been reached
    const currentTpTarget = this.calculateTakeProfitPrice();
    if ((this.side === 'Long' && this.historicalData[startIndex].price >= currentTpTarget) || (this.side === 'Short' && this.historicalData[startIndex].price <= currentTpTarget)) {
      this.endCycle(startIndex);
      return;
    }
    
    // Check if the stop loss target has been reached
    const stopLossPrice = this.calculateStopLossPrice(this.historicalData[startIndex].price);
    if ((this.side === 'Long' && this.historicalData[startIndex].price <= stopLossPrice) || (this.side === 'Short' && this.historicalData[startIndex].price >= stopLossPrice)) {
      this.endCycle(startIndex);
      return;
    }
    
    // Continue with the safety order fills until the end of the cycle
    for (let i = startIndex + 1; i < this.historicalData.length; i++) {
      this.currentCycleIndex++;
      
      // Handle safety order fill event
      this.handleSafetyOrderFill(this.historicalData[i].price, this.historicalData[i].amount);
      
      // Check if the take profit target has been reached
      const currentTpTarget = this.calculateTakeProfitPrice();
      if ((this.side === 'Long' && this.historicalData[i].price >= currentTpTarget) || (this.side === 'Short' && this.historicalData[i].price <= currentTpTarget)) {
        this.endCycle(i);
        return;
      }
      
      // Check if the stop loss target has been reached
      const stopLossPrice = this.calculateStopLossPrice(this.historicalData[i].price);
      if ((this.side === 'Long' && this.historicalData[i].price <= stopLossPrice) || (this.side === 'Short' && this.historicalData[i].price >= stopLossPrice)) {
        this.endCycle(i);
        return;
      }
    }
  }
  
  // Function to handle safety order fill event
  handleSafetyOrderFill(price, amount) {
    // Update the average entry price
    const totalAmount = this.initialOrderMargin * this.leverage + (this.safetyOrderMargin * this.leverage * (this.currentSafetyOrderIndex - 1));
    this.averageEntryPrice = ((this.averageEntryPrice * totalAmount) + (price * amount)) / (totalAmount + amount);
    
    // Adjust the take profit target if the average entry price changes
    this.currentTpTarget = this.calculateTakeProfitPrice();
  }
  
  // Function to end the current cycle
  endCycle(endIndex) {
    // Your logic to close positions and handle the end of the cycle goes here
    
    // Calculate the maximum drawdown
    const maxDrawdown = this.calculateMaxDrawdown();
    
    // Calculate the backtested annual yield
    const totalProfitLoss = this.profitLossHistory.reduce((sum, profitLoss) => sum + profitLoss, 0);
    const backtestedAnnualYield = (totalProfitLoss / this.initialOrderMargin) * (365 / this.historicalData.length);
    
    // Determine if the bot would be liquidated
    const liquidated = totalProfitLoss < (this.initialOrderMargin * this.leverage * -1);
    
    // Output the backtest results
    console.log('Backtest Results:');
    console.log('-----------------');
    console.log('Backtested Annual Yield:', backtestedAnnualYield);
    console.log('Maximum Drawdown:', maxDrawdown);
    console.log('Liquidated:', liquidated);
    console.log('-----------------');
  }
  
  // Function to calculate the maximum drawdown
  calculateMaxDrawdown() {
    let maxDrawdown = 0;
    let peak = this.profitLossHistory[0];
    
    for (let i = 1; i < this.profitLossHistory.length; i++) {
      if (this.profitLossHistory[i] > peak) {
        peak = this.profitLossHistory[i];
      }
      
      const drawdown = (peak - this.profitLossHistory[i]) / peak;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }
  
  // Function to run the backtest
  runBacktest() {
    for (let i = 0; i < this.historicalData.length; i++) {
      if (i === 0) {
        this.averageEntryPrice = this.historicalData[i].price;
        this.currentTpTarget = this.calculateTakeProfitPrice();
      }
      
      if (this.historicalData[i].event === 'InitialOrderFill') {
        this.simulateTradingCycle(i);
      }
    }
  }
}
