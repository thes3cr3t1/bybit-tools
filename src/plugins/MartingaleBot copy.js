const { ideahub } = require("googleapis/build/src/apis/ideahub");
const { typeOf } = require("mathjs");

class MartingaleBot {
  constructor(params, bybitApi) {
    this.ticker = params.ticker;
    this.side = params.side;
    this.leverage = params.leverage;
    this.tpTarget = params.tpTarget;
    this.maxSafetyOrders = params.maxSafetyOrders;
    this.priceStepsMultiplier = params.priceStepsMultiplier;
    this.amountMultiplier = params.amountMultiplier;
    this.initialOrderMargin = params.initialOrderMargin;
    this.slTarget = params.slTarget;
    this.decimals = params.decimals;
    this.roundTo = params.roundTo;
    this.priceOffset = params.priceOffset;
    this.bybitApi = bybitApi;

    this.initialSize = 0;
    this.InitialEntryPrice = 0;
    this.currentCycleIndex = 0;
    this.monitorPositionTimer = 0;
    this.ordersPlaced = false;
    this.positionOpened = false;
    this.PositionSize = 0;
    this.entryPrice = 0;
    this.noPositionTimer = 0;
    this.positionStatus = "";  
    
  }
  
  // Function to place an order
  placeOrder(orderType, price, amount, takeProfitPrice) {
    // Your API call to place the order goes here
    console.log(` ${this.ticker} Placing ${orderType} order: Price: ${price}, Amount: ${amount}, Take_Profit ${takeProfitPrice}` );


    var data = {
      side:'Buy',
      symbol: this.ticker,
      price: price,
      order_type: 'Limit',
      qty: amount,
      take_profit: takeProfitPrice,
      time_in_force:'GoodTillCancel',
      close_on_trigger	: false,
      reduce_only: false,
    }

    this.bybitApi.placeOrderLinear(data);
                                    
  }
  

roundUpToNearest(value) {
  const roundedValue = typeof this.roundTo === 'number' ? this.roundTo : parseFloat(this.roundTo);

  if (isNaN(roundedValue)) {
      console.error("Invalid value of this.roundTo:", this.roundTo);
      return value;
  }

  const decimalPlaces = roundedValue % 1 === 0 ? 0 : roundedValue.toString().split('.')[1].length;

  const roundedVal = Math.ceil(value / roundedValue) * roundedValue;
  const roundedValueAsString = decimalPlaces === 0 ? roundedVal.toString() : roundedVal.toFixed(decimalPlaces);

  return parseFloat(roundedValueAsString);
}


  CheckOpenPosition(){

    //Check if we alreday have an open position
    const symbolToFind = this.ticker;
    const position = this.bybitApi.openPositionLinear.find(item => item.symbol === symbolToFind);

    return position;
  }
 
  // Function to start a new trading cycle
  startNewCycle() {
   
    var newStartPrice = 0;
    var updatedStartPrice = 0;
    var slPriceSafety = 0;

    // Your logic to close positions and handle the end of the cycle goes here

                    const reScanMarkets = async () => {
                      try {
                        console.log("Re-Scanning available markets in order to obtain latest indicator values.")
                        const data = await this.bybitApi.MarketScan();
                        console.log(data);
                        return data;
                    
                      } catch (error) {
                        // Handle any errors that occur during the API call
                        console.error('Error scanning markets', error);
                      }
                };

                const fetchTickers = async () => {
                        try {
                        
                          // Cancel remaining buy orders for the current ticker
                          const data = await this.bybitApi.getTickers(this.ticker);
                          newStartPrice = parseFloat(data.result[0].bid_price);
                          return newStartPrice;
                      
                        } catch (error) {
                          // Handle any errors that occur during the API call
                          console.error('Error fetching tickers and ending cycle:', error);
                        }
                };

                const executeAfterFetch = async () => {
                  try {

                    const rsiValues = await reScanMarkets();   
                    this.bybitApi.rsiValue = rsiValues;

                     // Step 1: Create a new array with price_24h_pcnt and symbol
                    const tickersWithPcnt = this.bybitApi.Tickers.map(ticker => ({
                      price_24h_pcnt: ticker.price_24h_pcnt,
                      symbol: ticker.symbol
                    }));

                    // Step 2: Sort the array in descending order based on price_24h_pcnt
                    tickersWithPcnt.sort((a, b) => b.price_24h_pcnt - a.price_24h_pcnt);

                    // Step 3: Extract the top 20 items
                    const top20Tickers = tickersWithPcnt.slice(0, 20);

                    // Step 4: Create a new array with only symbols from top20Tickers
                    const symbolsOnly = top20Tickers.map(ticker => ticker.symbol);

                   // console.log(symbolsOnly);

                    // Step 5: Filter the symbolsOnly array to get the top 10 symbols with the highest volume_24h values
                    const top10Symbols = symbolsOnly
                      .map(symbol => ({
                        symbol: symbol,
                        price_24h_pcnt: tickersWithPcnt.find(ticker => ticker.symbol === symbol).price_24h_pcnt
                      }))
                      .sort((a, b) => b.price_24h_pcnt - a.price_24h_pcnt)
                      .slice(0, 10)
                      .map(item => item.symbol);

                    // Step 6: Filter the top10Symbols array to get the symbols with the highest volume_24h values
                    const top10SymbolsWithVolume = top10Symbols
                      .map(symbol => ({
                        symbol: symbol,
                        volume_24h: this.bybitApi.Tickers.find(ticker => ticker.symbol === symbol).volume_24h
                      }))
                      .sort((a, b) => b.volume_24h - a.volume_24h);

                    // Step 8: Sort the top10SymbolsWithVolume array based on RSI values
                    const sortedTop10Symbols = top10SymbolsWithVolume.sort((a, b) => {
                      const rsiA = this.bybitApi.rsiValues[a.symbol][this.bybitApi.rsiValues[a.symbol].length - 1];
                      const rsiB = this.bybitApi.rsiValues[b.symbol][this.bybitApi.rsiValues[b.symbol].length - 1];
                      return rsiA - rsiB;
                    });

                    // Now sortedTop10Symbols contains the top 10 symbols with the highest price_24h_pcnt values,
                    // highest volume_24h values, ordered by the lowest RSI value at the beginning and the highest RSI value at the end
                    console.log(sortedTop10Symbols);

                    // Find a ticker that ends with "usdt"
                    for (const symbolInfo of sortedTop10Symbols) {
                      if (symbolInfo.symbol.toLowerCase().endsWith('usdt')) {
                        this.ticker = symbolInfo.symbol;
                        break;
                      }
                    }

                   // console.log('Selected ticker:', this.ticker);

                    var position = this.CheckOpenPosition();

                    if (position) {
                        console.log("Bot already running, monitoring the position now... ");
                        this.positionStatus = "Bot already running, monitoring the position now... ";
                        this.positionOpened = true;
                        const self = this;
                        this.monitorPositionTimer = setInterval(() => self.MonitorPosition(), 2000);
                    }else{

                            const newStartPrice = await fetchTickers();
                            var ATR = parseFloat(this.bybitApi.atrValues[this.ticker]);
                            this.priceStepsMultiplier = ATR;
                            this.tpTarget = ATR * 6;
                            this.slTarget = ATR * 10;

                            updatedStartPrice = newStartPrice * (1 - (ATR/3) / 100);

                            updatedStartPrice = newStartPrice;

                            console.log("Got Start Price for  " + this.ticker +  " Price is : " + updatedStartPrice);

                            this.InitialEntryPrice = updatedStartPrice;

                            var SymbolInfo = this.bybitApi.AllSymbols.get(this.ticker);
                            var testTickSize = SymbolInfo.tickSize
                            this.roundTo = parseFloat(SymbolInfo.minQty);
                            this.decimals = SymbolInfo.priceFraction;
                            
                            console.log(this.ticker  + " Ticksize " + testTickSize + " StepSize " + this.roundTo + " Decimals " + this.decimals + " Price Steps Multiplier " + this.priceStepsMultiplier + " ATR " + ATR) ;

                            //Ensure we have no open orders for this.ticker
                            this.bybitApi.cancelAllOpenOrdersLinear(this.ticker);

                            this.currentCycleIndex++;
                            this.currentSafetyOrderIndex = 0;

                            var takeProfitAmount = 10;
                            var takeProfitPrice  = this.InitialEntryPrice * (1 + this.tpTarget / 100);
                            var Position_Size = takeProfitAmount / (takeProfitPrice - this.InitialEntryPrice)

                            this.initialOrderMargin=(Position_Size * this.InitialEntryPrice) / this.leverage;

                            // Place the initial order
                            const initialOrderAmount = this.roundUpToNearest((this.initialOrderMargin * this.leverage) / this.InitialEntryPrice);
                         
                            console.log("InitialMargin " + this.initialOrderMargin);

                            setTimeout(() => {
                              this.placeOrder('Initial', this.InitialEntryPrice.toFixed(this.decimals),  initialOrderAmount, takeProfitPrice.toFixed(this.decimals));
                            }, 1250);
                         
                         
                        
                            // Calculate the safety order prices
                            const safetyOrderPrices = [];
                            const safetyOrderAmounts = [];
                           
                            //add the initial order to the array but skip it from the calulations in the following loop by starting the index at 1 instead of 0
                            safetyOrderPrices.push( (this.InitialEntryPrice - this.InitialEntryPrice * (this.priceStepsMultiplier / 100)).toFixed(this.decimals));
                        
                            for (let i = 1; i < this.maxSafetyOrders; i++) {
                              const previousSafetyOrderPrice = safetyOrderPrices[i - 1];
                              safetyOrderPrices.push((previousSafetyOrderPrice - previousSafetyOrderPrice * (this.priceStepsMultiplier / 100)).toFixed(this.decimals));
                              safetyOrderAmounts.push((this.initialOrderMargin * this.leverage * this.amountMultiplier) / safetyOrderPrices[i -1]);
                            }
                              
                            safetyOrderAmounts.push((this.initialOrderMargin * this.leverage * this.amountMultiplier) / safetyOrderPrices[this.maxSafetyOrders -1]);

                            let averageEntryPrice = this.InitialEntryPrice;
                            let totalAmount = initialOrderAmount;

                                  // Place the safety orders
                                  var currentSafetyOrderIndex = 0;
                                   
                                  for (let i = 0; i < this.maxSafetyOrders; i++) {
                                    currentSafetyOrderIndex++;

                                    const currentIndex = currentSafetyOrderIndex;
                                    const safetyOrderPrice  = parseFloat(safetyOrderPrices[i]);
                                    const safetyOrderAmount = this.roundUpToNearest(safetyOrderAmounts[i]);

                                    totalAmount += safetyOrderAmount;
                                    averageEntryPrice = (averageEntryPrice * totalAmount + safetyOrderPrice * safetyOrderAmount) / (totalAmount + safetyOrderAmount);
                                                                
                                    // Calculate the price change needed for the desired profit
                                    const takeProfitPrice = averageEntryPrice + (takeProfitAmount / totalAmount);

                                     setTimeout(() => {
                                      this.placeOrder(`Safety ${currentIndex}`, safetyOrderPrice.toFixed(this.decimals), safetyOrderAmount, takeProfitPrice.toFixed(this.decimals));
                                    }, 750);

                                  }

                                this.ordersPlaced = true;
                                const self = this;
                                this.monitorPositionTimer = setInterval(() => self.MonitorPosition(), 2000);
                            }
              
                  } catch (error) {
                    // Handle any errors that occur during the execution
                    console.error('Error executing after fetch:', error);
                  }
                };
                
                //check if there is already an openposition 
                var position = this.CheckOpenPosition();

                if (position) {
                  console.log("Bot already running, monitoring the position now... ");
                  this.positionOpened = true;
                 
                  const self = this;
                  this.monitorPositionTimer = setInterval(() => self.MonitorPosition(), 2000);
                }else{
                     console.log("Bot is not running, starting a new cycle!");
                     this.positionStatus = "Bot is not running, starting a new cycle!";
                     executeAfterFetch();
                 }
    
  }

  MonitorPosition(){

    var position = this.CheckOpenPosition();
   
    if (position) {
       
       //Position is open
       console.log(this.ticker + " Bot running");
       this.positionStatus = this.ticker + " Bot running";
       console.log(position);
       clearTimeout(this.noPositionTimer); 
       this.noPositionTimer = null;

       if(this.positionOpened == false){
        this.entryPrice = position.entry_price;
        this.PositionSize= position.size;
        this.positionOpened = true;
       }
     

       //watch for changes to the entry price and or order size

       if(parseFloat(position.entry_price) != parseFloat(this.entry_price)){
        this.entry_price = position.entry_price;
        var slPriceSafety = position.entry_price - (0.5 / position.size);
        //var slPriceSafety = position.entry_price * (1 - this.slTarget / 100);
        console.log("setting stop for " +  this.ticker +  " to " + slPriceSafety.toFixed(this.decimals));

        this.bybitApi.setTradingStops(0, slPriceSafety.toFixed(this.decimals), 0, "LinearPerpetual", this.ticker);
       }

       //if the entry price has changed or the position size has changend then update the stops
    }else{
      console.log("No open " + this.ticker + " Position");
      this.positionStatus = "No open " + this.ticker + " Position";

      if(!this.noPositionTimer) {
        console.log("Setting a timer");
        this.noPositionTimer = setTimeout(() => {
          console.log("Timer expired, ending cycle");
          this.ticker + " Timer expired, ending cycle"
          this.endCycle();
        }, 5 * 60 * 1000); // 10 minutes
      }

    }
    
    if(!position && this.positionOpened == true){
      clearInterval(this.monitorPositionTimer);
      this.position = 0;
      this.endCycle();
    }
  }


// Function to end the current cycle
endCycle() {
      this.bybitApi.cancelAllOpenOrdersLinear(this.ticker);
      console.log(`Ending ${this.ticker} Bot Cycle. Cancelling Any Remaining Open Orders`);
      this.positionOpened = false;
      this.ordersPlaced = false;
      var newStartPrice = 0;

      setTimeout(() => {
        this.startNewCycle(this.priceOffset);
      }, 2000);


     }


}

//   //const takeProfitPrice = this.InitialEntryPrice + (this.tpTarget / initialOrderAmount);

  module.exports = MartingaleBot;

  
