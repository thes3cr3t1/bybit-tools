const { typeOf } = require("mathjs");

const EventEmitter = require('events');
const CryptoJS  =  require('crypto-js');
const ReconnectingWebSocket =  require('reconnecting-websocket');
class MartingaleBot extends EventEmitter {

 
  constructor(params, bybitApi) {

    super(); 

    this.params = params;
    this.bybitApi = bybitApi;

    this.ticker = params.ticker;
    this.side = params.side;
    this.priceSteps = params.priceSteps,
    this.tpTarget = params.tpTarget;
    this.leverage = params.leverage;
    this.initialOrderMargin = params.initialOrderMargin;
    this.safetyOrderMargin = params.safetyOrderMargin
  
    this.maxSafetyOrders = params.maxSafetyOrders;
    this.priceOffset = params.priceOffset;
    this.priceStepsMultiplier = params.priceStepsMultiplier;
    this.amountMultiplier = params.amountMultiplier;
    this.investedMargin = params.investedMargin,
    this.slTarget = params.slTarget;

    this.decimals = params.decimals;
    this.roundTo = params.roundTo;

    this.initialSize = 0;
    this.InitialEntryPrice = 0;
    this.monitorPositionTimer = 0;
    
    this.PositionSize = 0;
    this.entryPrice = 0;
    this.noPositionTimer = 0;
    this.tickSize = 0;
    this.movedToBreakeven = false;
    this.wsUrl = 'wss://stream.bybit.com/realtime';
    this.ws=null;
    this.ohlc = [];
    this.rsi = [];
    this._rsi = null; 

    //Status
   
    this.ordersPlaced = params.ordersPlaced !== undefined ? params.ordersPlaced: false;
    this.positionOpened = params.positionOpened !== undefined ? params.positionOpened : false;

    this.currentCycleIndex = 0;
    this.positionStatus = ""; 
    this.startPrice = 0;
    this.position = 0;
    this.startTime = 0;

    
  }
  
  // Function to start a new trading cycle
  async startNewCycle() {
   
        if (!this.ws) {
          this.openWebsocket();
         }

        this.currentCycleIndex++;

        var SymbolInfo = this.bybitApi.AllSymbols.get(this.ticker);

        console.log(SymbolInfo);
     
        this.tickSize =  parseFloat(SymbolInfo.tickSize);
        this.roundTo  = parseFloat(SymbolInfo.minQty);
        this.decimals = parseFloat(SymbolInfo.priceFraction);

        var position = this.CheckOpenPosition();

        if (position) {
          console.log(this.ticker + " Bot already running, monitoring the position now... ");
          this.positionOpened = true;
          const self = this;
          this.monitorPositionTimer = setInterval(() => self.MonitorPosition(), 2000);
        }else if (this.ordersPlaced == true) {
             console.log("Orders are already placed, ending cycle and starting new cycle.")
             
             this.restartCycle()
        }else{
            
              this.positionStatus = "Starting Cycle " +  this.currentCycleIndex;
              console.log(this.ticker + " Bot is not running, starting a new cycle!");

              const [safetyOrderAmounts, safetyOrderPrices] = await this.calculateOrders();

              let averageEntryPrice = safetyOrderPrices[0];
              let totalAmount = safetyOrderAmounts[0];
              var stopLossPrice = 0;
      
                    // Place the safety orders
                    var currentSafetyOrderIndex = 0;
                      
                    for (let i = 0; i < this.maxSafetyOrders + 1; i++) {
                                    
                      const currentIndex = currentSafetyOrderIndex;
                      const safetyOrderPrice  = safetyOrderPrices[i];
                      const safetyOrderAmount = safetyOrderAmounts[i];
                  
                      totalAmount += safetyOrderAmount;
                      averageEntryPrice = (averageEntryPrice * (totalAmount - safetyOrderAmount) + safetyOrderPrice * safetyOrderAmount) / totalAmount;

                      averageEntryPrice = this.roundPriceToTicksize(averageEntryPrice);
                             
                      const takeProfitPrice = this.side == "Long" ? averageEntryPrice * (1 + this.tpTarget / 100) : averageEntryPrice * (1 - this.tpTarget / 100);
                   
                      this.positionStatus = "Placing Orders " + this.maxSafetyOrders;
                      if (currentSafetyOrderIndex == this.maxSafetyOrders) {
                          stopLossPrice = this.side == "Long" ? safetyOrderPrice * (1 - this.slTarget / 100) : safetyOrderPrice * (1 + this.slTarget / 100);
                      }
                  
                    //  setTimeout(() => {
                          this.placeOrder(`Safety ${currentIndex}`, safetyOrderPrice, safetyOrderAmount, takeProfitPrice.toFixed(this.decimals), stopLossPrice.toFixed(this.decimals));
                   //   }, 750);

                      currentSafetyOrderIndex++;
                  }

                    //orders placed start monitoring the position
                    this.ordersPlaced = true;
                    const self = this;
                    this.monitorPositionTimer = setInterval(() => self.MonitorPosition(), 1000);
          }
  }

  

  async calculateBreakevenPrice(moveTobreakeven){

    const price = await this.getCurrentPrice();

    var takerFeeToOpenUSD = ((this.position.size/this.position.avgPrice) * 0.0006) * this.position.avgPrice;
    var takerFeeToCloseUSD = ((this.position.size/this.position.takeProfit) * 0.0006) * this.position.takeProfit;

    var Reward = 0;
    var direction = this.position.side;
    var breakevenPrice = parseFloat(this.position.avgPrice);
    var totalTakerFee = 0;

      do{
          Reward = this.position.size * (Math.abs(this.position.avgPrice - breakevenPrice)) / breakevenPrice;
          var takerFeeToCloseUSD = ((this.position.size/breakevenPrice) * 0.0006) * breakevenPrice;

          totalTakerFee = (takerFeeToOpenUSD + takerFeeToCloseUSD);
          direction == "Buy" ? breakevenPrice += 0.5 : breakevenPrice -= 0.5;
      }while(Reward < totalTakerFee);

      breakevenPrice = this.roundPriceToTicksize(breakevenPrice);

   // console.log("Total Taker Fee " + parseFloat(totalTakerFee).toFixed(this.decimals) + " Breakeven Price " + breakevenPrice);

        if(moveTobreakeven == true){

          var rsi = this.rsi[this.rsi.length-1];

          // console.log(rsi);
      

          if(this.position.side == "Buy" && price > breakevenPrice && this.movedToBreakeven == false && rsi> 80){
            console.log("Moving to breakeven");
            var tp = this.position.takeProfit;
            this.bybitApi.cancelAllOpenOrdersV5(this.ticker);
            this.bybitApi.setTradingStops(tp, breakevenPrice, null);
              setTimeout(() => {
                this.bybitApi.setTradingStops(tp, breakevenPrice, null);   }, 750);
                this.movedToBreakeven = true;
          }
  
          if(this.position.side == "Sell" && price < breakevenPrice && this.movedToBreakeven == false && rsi < 20){
            console.log("Moving to breakeven");
            var tp = this.position.takeProfit;
            this.bybitApi.cancelAllOpenOrdersV5(this.ticker);
            setTimeout(() => {
              this.bybitApi.setTradingStops(tp, breakevenPrice, null);   }, 750);
              this.movedToBreakeven = true;
  
          }
        }

    return breakevenPrice;
  
   }

  async MonitorPosition(){

    var position = this.CheckOpenPosition();
    this.position = position;
   
    if (position) {
       //console.log(position);
       this.positionStatus = this.ticker + " Position Open";
     
       clearTimeout(this.noPositionTimer); 
       this.noPositionTimer = null;

       if(this.positionOpened == false){
          this.entryPrice = position.entry_price;
          this.PositionSize= position.size;
          this.positionOpened = true;
       }
     
       //watch for changes to the entry price and or order size
       //if the entry price has changed or the position size has changed then update the stops

       if(parseFloat(position.entry_price) != parseFloat(this.entry_price)){
        this.entry_price = position.entry_price;
        var slPriceSafety = position.entry_price - (0.5 / position.size);
       }
       
       //move to breakeven if in profit
       this.calculateBreakevenPrice(true);

     
    }else{
     // console.log("Orders placed, No open Position");
      this.positionStatus = "Orders placed, No open Position";
      
      //if no orders have been filled after N timeperiod, restart the bot.
      if(!this.noPositionTimer) {
        console.log("Setting a timer, if a position isnt open when the timer expiers orders will be cancelled and palced again.");
        this.noPositionTimer = setTimeout(() => {
          console.log("Timer expired, ending cycle");
          this.positionStatus = this.ticker + " Timer expired, ending cycle";
          this.restartCycle();
        }, 5 * 60 * 1000); // 10 minutes
      }

    }
    
    if(!position && this.positionOpened == true){
      clearInterval(this.monitorPositionTimer);
      this.position = 0;
      this.endCycle();
    }
  }

  CheckOpenPosition() {

    var symbol = this.ticker;
    // Check if we already have an open position
    //console.log(symbol + ": Checking for open position");
  
    // Define the categories you want to check
    const categoriesToCheck = ["inverse", "linear"];
  
    for (const category of categoriesToCheck) {
      if (this.bybitApi.openPositionV5[category]) {
        const positionData = this.bybitApi.openPositionV5[category][symbol];
        if (positionData) {
          //console.log(`Position data for ${symbol} found in category ${category}:`);
          
          return positionData;
        }
      }
    }
  
   // console.log(`No open position found for symbol ${symbol} in any category`);
    return null; // No open position found
  }
// Function to end the current cycle
endCycle() {
      this.bybitApi.cancelAllOpenOrdersV5(this.ticker);
      console.log(`Ending ${this.ticker} Bot Cycle. Cancelling Any Remaining Open Orders`);
      this.positionOpened = false;
      this.ordersPlaced = false;
      clearInterval(this.noPositionTime);
      var newStartPrice = 0;

      console.log("Cycle ended, emmiting event");
      this.emit('cycleEnded', {symbol: this.ticker});
 }

restartCycle() {
  this.bybitApi.cancelAllOpenOrdersV5(this.ticker);
  console.log(`Ending ${this.ticker} Bot Cycle. Cancelling Any Remaining Open Orders`);
  this.positionOpened = false;
  this.ordersPlaced = false;
  var newStartPrice = 0;
  
   setTimeout(() => {
     this.startNewCycle();
   }, 2000);

}

 stopBot() {
  // Stop any timers or processes
  console.log("Stopping Bot here");
  clearInterval(this.monitorPositionTimer);
  clearTimeout(this.noPositionTimer);
  this.endCycle();
    // Add any additional cleanup logic as needed
}


async getCurrentPrice(){

  const fetchTickers = async () => {
    try {
   
      const data = await this.bybitApi.getTickers(this.ticker);
     
      if(this.side == "Long"){
         const price = parseFloat(data.result[0].bid_price);
         return price;
      }

      if(this.side == "Short"){
         const price = parseFloat(data.result[0].bid_price);
         return price;
      }
  
    } catch (error) {
      // Handle any errors that occur during the API call
      console.error('Error fetching tickers', error);
    }
};

const price = await fetchTickers();

return price;

}

async calculateOrders() {
      
      const fetchTickers = async () => {
                       try {
                      
                         const data = await this.bybitApi.getTickers(this.ticker);
                        
                         if(this.side == "Long"){
                            const newStartPrice = parseFloat(data.result[0].bid_price);
                            return newStartPrice;
                         }

                         if(this.side == "Short"){
                            const newStartPrice = parseFloat(data.result[0].bid_price);
                            return newStartPrice;
                         }
                     
                       } catch (error) {
                         // Handle any errors that occur during the API call
                         console.error('Error fetching tickers', error);
                       }
               };

               const Price = await fetchTickers();
            
               const category = this.checkCategory(this.ticker);
                            
               if(this.side == "Long"){
                  this.InitialEntryPrice = parseFloat(Price * (1 - this.priceOffset / 100)).toFixed(this.decimals);
               }
               
               if(this.side == "Short"){
                  this.InitialEntryPrice = parseFloat(Price * (1 + this.priceOffset / 100)).toFixed(this.decimals);
               }

               this.startPrice = this.roundPriceToTicksize(this.InitialEntryPrice);

               if(category == "linear"){
                var position_Size = this.roundQtyUpToNearest(this.initialOrderMargin / this.startPrice );
               }else{
                var position_Size = this.roundQtyUpToNearest(this.calculatePositionSizeInverse(this.initialOrderMargin, this.leverage));
                }
               
               console.log(this.ticker  + ": start Price " + this.startPrice  + " Position_Size " +  position_Size + " Ticksize " + this.tickSize + " Round_to " + this.roundTo + " Decimals " + this.decimals + " priceStepsMultiplier " + this.priceStepsMultiplier);
                                     
               // Calculate the safety order prices
               const safetyOrderPrices = [];

               // Calculate the safety order amounts
               const safetyOrderAmounts = [];

               // Add initial safety order price  
               let firstSafetyOrderPrice = 0;
               if(this.side == "Long"){
                 firstSafetyOrderPrice = parseFloat(this.startPrice * (1 - (this.priceSteps / 100)));
               }
               
               if(this.side == "Short"){
                 firstSafetyOrderPrice = parseFloat(this.startPrice * (1 + (this.priceSteps / 100)));
               }

               safetyOrderPrices.push(this.roundPriceToTicksize(firstSafetyOrderPrice));
              
               // Calculate subsequent safety order prices
               for (let i = 1; i < this.maxSafetyOrders; i++) {

                 // Get previous safety order price
                 const prevSafetyPrice = safetyOrderPrices[i-1];  

                 // Calculate exponential step  
                 let priceDiff = this.priceSteps * Math.pow(this.priceStepsMultiplier, i);

                 // Convert to percentage
                 let priceDiffPercent = priceDiff / 100;

                 // Apply percentage diff to previous price
                 let nextSafetyPrice = this.side == "Long" ? prevSafetyPrice * (1 - priceDiffPercent) : prevSafetyPrice * (1 + priceDiffPercent);

                 // Add next safety order price to array
                 safetyOrderPrices.push(this.roundPriceToTicksize(nextSafetyPrice));

               }

               // Calculate safety order amounts
               let safetyOrderAmount = this.safetyOrderMargin * this.leverage;

               for (let i = 0; i < this.maxSafetyOrders; i++) {
                 
                  if(category == "linear"){
                
                    var usdAmount = safetyOrderAmount * Math.pow(this.amountMultiplier, i);
                    const positionSize = this.roundQtyUpToNearest(usdAmount / safetyOrderPrices[i]);
                    safetyOrderAmounts.push(positionSize);


                  }else{
                    const positionSize = this.roundQtyUpToNearest(safetyOrderAmount * Math.pow(this.amountMultiplier, i));
                    safetyOrderAmounts.push(positionSize);
                  }
                    
               }

               safetyOrderPrices.unshift(this.startPrice);
               safetyOrderAmounts.unshift(position_Size);

               return [safetyOrderAmounts, safetyOrderPrices]
             
 }
 
 roundPriceToTicksize(number) {

  var roundedPrice = Math.round(number / this.tickSize ) * this.tickSize;
  roundedPrice = roundedPrice.toFixed(this.decimals);
  return roundedPrice;
}
      
  placeOrder(orderType, price, amount, takeProfitPrice, stopLossPrice) {

    //think about how to handle the fact that the api accepts string as numbers now.

    console.log(` ${this.ticker} Placing ${orderType} order: Price: ${price}, Amount: ${amount}, Take_Profit ${takeProfitPrice} , sStopLoss ${stopLossPrice}` );
    
    var data = {
      //category: "linear", add category in bybitapi.js
      side: this.side == "Long" ? 'Buy' : 'Sell',
      symbol: this.ticker,
      price: price.toString(),
      orderType: 'Limit',
      qty: amount.toString(),
      takeProfit: takeProfitPrice.toString(),
      closeOnTrigger: false,
      reduceOnly: false,
    }

    if(stopLossPrice > 0){
      data.stopLoss = stopLossPrice.toString();
    }

    this.bybitApi.placeOrderV5(data);
    this.ordersPlaced = true;                                
  }
  

    roundQtyUpToNearest(value) {

      const roundedValue = typeof this.roundTo === 'number' ? this.roundTo : parseFloat(this.roundTo);

      if (isNaN(roundedValue)) {
          console.error("Invalid value (" + value + ") of this.roundTo:", this.roundTo);
          return value;
      }

      const decimalPlaces = roundedValue % 1 === 0 ? 0 : roundedValue.toString().split('.')[1].length;
      const roundedVal = Math.ceil(value / roundedValue) * roundedValue;
      const roundedValueAsString = decimalPlaces === 0 ? roundedVal.toString() : roundedVal.toFixed(decimalPlaces);

      return parseFloat(roundedValueAsString);
    }

    checkCategory(symbol) {
      // Convert the input string to lowercase for case-insensitive matching
      const lowercaseString = symbol.toLowerCase();
      let category = "";
      if (lowercaseString.endsWith("usd")) {
        category = "inverse";
      } else if (lowercaseString.endsWith("usdt")) {
        category = "linear";
      } 

      return category;
    }

    calculatePositionSizeInverse(initialMargin, leverage) {
      // Ensure leverage is a number
      leverage = parseFloat(leverage);
    
      // Ensure initialMargin is a number
      initialMargin = parseFloat(initialMargin);
    
      if (isNaN(leverage) || isNaN(initialMargin)) {
        console.error('Invalid input for leverage or initial margin');
        return null;
      }
    
      // Calculate the position size in contracts
      const positionSize = initialMargin * leverage;
    
      return positionSize;
    }

    get rsi() {
      return this._rsi;
    }

    set rsi(value) {
      this._rsi = value;
    }


    async openWebsocket(){

    
      await this.bybitApi.getHistoricOHLC(this.bybitApi.convertToSeconds("hours", 1), this.ohlc, 1, this.ticker, "v2/public/kline/list?symbol=");


      this.ws = new ReconnectingWebSocket(`${this.wsUrl}`);

      this.ws.onopen = (e) => {
        let expires = Date.now() + 1500;

        let signature = CryptoJS.HmacSHA256('GET/realtime' + expires,
            this.bybitApi.account.apiSecret).
            toString();
 
        this.ws.send(
            JSON.stringify({
              'op': 'auth',
              'args': [this.bybitApi.account.apiKey, expires, signature],
            }));

        setTimeout(() => {
            this.ws.send( '{"op":"subscribe","args":["klineV2.1.' + this.ticker+ '"]}');
            this.ws.send(' {"op":"subscribe","args":["instrument_info.100ms.' + this.ticker + '"]}');

         }, 100);

      };

      this.ws.onmessage = (e) => {
        let data = JSON.parse(e.data);
        switch (data.topic) {
         
          case 'instrument_info.100ms.' + this.ticker + '' :
           // this.setPrice(data);
           // console.log(data);
          break;

          case 'klineV2.1.' + this.ticker + '':
               
            if(data.data[0].confirm == true){
              this.ohlc.push(data.data[0]);
              this.ohlc.shift();
         
            }else{
                  this.ohlc[this.ohlc.length-1] = data.data[0];
            }

            this.rsi = this.bybitApi.rsi(this.ohlc, 14);
            //console.log(this.rsi);

          break;


          default :
         //   console.log(data.topic);
         //   console.log(data);
          break;
        }
      };

    }
    
    

}


module.exports.MartingaleBot = MartingaleBot;

  


// const { typeOf } = require("mathjs");

// const EventEmitter = require('events');
// class MartingaleBot extends EventEmitter {

//   constructor(params, bybitApi) {
//     super(); 

//     this.params = {
//       ...params,
//       ticker: params.ticker,
//       side: params.side,
//       priceSteps: params.priceSteps,
//       tpTarget: params.tpTarget,
//       leverage: params.leverage,
//       initialOrderMargin: params.initialOrderMargin,
//       safetyOrderMargin: params.safetyOrderMargin,
//       maxSafetyOrders: params.maxSafetyOrders,
//       priceOffset: params.priceOffset,
//       priceStepsMultiplier: params.priceStepsMultiplier,
//       amountMultiplier: params.amountMultiplier,
//       investedMargin: params.investedMargin,
//       slTarget: params.slTarget,
//       decimals: params.decimals,
//       roundTo: params.roundTo,
//       initialSize: 0,
//       InitialEntryPrice: 0,
//       monitorPositionTimer: 0,
//       PositionSize: 0,
//       entryPrice: 0,
//       noPositionTimer: 0,
//       tickSize: 0,
//       movedToBreakeven: false,
//       ordersPlaced: params.ordersPlaced !== undefined ? params.ordersPlaced : false,
//       positionOpened: params.positionOpened !== undefined ? params.positionOpened : false,
//       currentCycleIndex: 0,
//       positionStatus: "",
//       startPrice: 0,
//       position: 0,
//       startTime: 0,
//     };

//     this.bybitApi = bybitApi;
//   }

//   // Function to start a new trading cycle
//   async startNewCycle() {
//     this.currentCycleIndex++;

//     var SymbolInfo = this.bybitApi.AllSymbols.get(this.params.ticker);

//     console.log(SymbolInfo);

//     this.params.tickSize = parseFloat(SymbolInfo.tickSize);
//     this.params.roundTo = parseFloat(SymbolInfo.minQty);
//     this.params.decimals = parseFloat(SymbolInfo.priceFraction);

//     var position = this.CheckOpenPosition();

//     if (position) {
//       console.log(this.params.ticker + " Bot already running, monitoring the position now... ");
//       this.params.positionOpened = true;
//       const self = this;
//       this.params.monitorPositionTimer = setInterval(() => self.MonitorPosition(), 2000);
//     } else if (this.params.ordersPlaced == true) {
//       console.log("Orders are already placed, ending cycle and starting a new cycle.");

//       this.restartCycle();
//     } else {
//       this.params.positionStatus = "Starting Cycle " + this.params.currentCycleIndex;
//       console.log(this.params.ticker + " Bot is not running, starting a new cycle!");

//       const [safetyOrderAmounts, safetyOrderPrices] = await this.calculateOrders();

//       let averageEntryPrice = safetyOrderPrices[0];
//       let totalAmount = safetyOrderAmounts[0];
//       var stopLossPrice = 0;

//       // Place the safety orders
//       var currentSafetyOrderIndex = 0;

//       for (let i = 0; i < this.params.maxSafetyOrders + 1; i++) {
//         const currentIndex = currentSafetyOrderIndex;
//         const safetyOrderPrice = safetyOrderPrices[i];
//         const safetyOrderAmount = safetyOrderAmounts[i];

//         totalAmount += safetyOrderAmount;
//         averageEntryPrice = (averageEntryPrice * (totalAmount - safetyOrderAmount) + safetyOrderPrice * safetyOrderAmount) / totalAmount;

//         averageEntryPrice = this.roundPriceToTicksize(averageEntryPrice);

//         const takeProfitPrice = this.params.side == "Long" ? averageEntryPrice * (1 + this.params.tpTarget / 100) : averageEntryPrice * (1 - this.params.tpTarget / 100);

//         this.params.positionStatus = "Placing Orders " + this.params.maxSafetyOrders;
//         if (currentSafetyOrderIndex == this.params.maxSafetyOrders) {
//           stopLossPrice = this.params.side == "Long" ? safetyOrderPrice * (1 - this.params.slTarget / 100) : safetyOrderPrice * (1 + this.params.slTarget / 100);
//         }

//         //  setTimeout(() => {
//         this.placeOrder(`Safety ${currentIndex}`, safetyOrderPrice, safetyOrderAmount, takeProfitPrice.toFixed(this.params.decimals), stopLossPrice.toFixed(this.params.decimals));
//         //   }, 750);

//         currentSafetyOrderIndex++;
//       }

//       // Orders placed, start monitoring the position
//       this.params.ordersPlaced = true;
//       const self = this;
//       this.params.monitorPositionTimer = setInterval(() => self.MonitorPosition(), 1000);
//     }
//   }

//   async calculateBreakevenPrice(moveToBreakeven) {
//     const price = await this.getCurrentPrice();

//     var takerFeeToOpenUSD = ((this.params.position.size / this.params.position.avgPrice) * 0.0006) * this.params.position.avgPrice;
//     var takerFeeToCloseUSD = ((this.params.position.size / this.params.position.takeProfit) * 0.0006) * this.params.position.takeProfit;

//     var Reward = 0;
//     var direction = this.params.position.side;
//     var breakevenPrice = parseFloat(this.params.position.avgPrice);
//     var totalTakerFee = 0;

//     do {
//       Reward = this.params.position.size * (Math.abs(this.params.position.avgPrice - breakevenPrice)) / breakevenPrice;
//       var takerFeeToCloseUSD = ((this.params.position.size / breakevenPrice) * 0.0006) * breakevenPrice;

//       totalTakerFee = (takerFeeToOpenUSD + takerFeeToCloseUSD);
//       direction == "Buy" ? breakevenPrice += 0.5 : breakevenPrice -= 0.5;
//     } while (Reward < totalTakerFee);

//     breakevenPrice = this.roundPriceToTicksize(breakevenPrice);

//     // console.log("Total Taker Fee " + parseFloat(totalTakerFee).toFixed(this.params.decimals) + " Breakeven Price " + breakevenPrice);

//     if (moveToBreakeven == true) {
//       if (this.params.position.side == "Buy" && price > breakevenPrice && this.params.movedToBreakeven == false) {
//         console.log("Moving to breakeven");
//         var tp = this.params.position.takeProfit;
//         this.bybitApi.cancelAllOpenOrdersV5(this.params.ticker);
//         this.bybitApi.setTradingStops(tp, breakevenPrice, null);
//         setTimeout(() => {
//           this.bybitApi.setTradingStops(tp, breakevenPrice, null);
//         }, 750);
//         this.params.movedToBreakeven = true;
//       }

//       if (this.params.position.side == "Sell" && price < breakevenPrice && this.params.movedToBreakeven == false) {
//         console.log("Moving to breakeven");
//         var tp = this.params.position.takeProfit;
//         this.bybitApi.cancelAllOpenOrdersV5(this.params.ticker);
//         setTimeout(() => {
//           this.bybitApi.setTradingStops(tp, breakevenPrice, null);
//         }, 750);
//         this.params.movedToBreakeven = true;
//       }
//     }

//     return breakevenPrice;
//   }

//   async MonitorPosition() {
//     var position = this.CheckOpenPosition();
//     this.params.position = position;

//     if (position) {
//       //console.log(position);
//       this.params.positionStatus = this.params.ticker + " Position Open";

//       clearTimeout(this.params.noPositionTimer);
//       this.params.noPositionTimer = null;

//       if (this.params.positionOpened == false) {
//         this.params.entryPrice = position.entry_price;
//         this.params.PositionSize = position.size;
//         this.params.positionOpened = true;
//       }

//       // Watch for changes to the entry price and or order size
//       // If the entry price has changed or the position size has changed then update the stops

//       if (parseFloat(position.entry_price) != parseFloat(this.params.entryPrice)) {
//         this.params.entryPrice = position.entry_price;
//         var slPriceSafety = position.entry_price - (0.5 / position.size);
//       }

//       // Move to breakeven if in profit
//       this.calculateBreakevenPrice(true);

//     } else {
//       // console.log("Orders placed, No open Position");
//       this.params.positionStatus = "Orders placed, No open Position";

//       // If no orders have been filled after N time period, restart the bot.
//       if (!this.params.noPositionTimer) {
//         console.log("Setting a timer, if a position isn't open when the timer expires, orders will be canceled and placed again.");
//         this.params.noPositionTimer = setTimeout(() => {
//           console.log("Timer expired, ending cycle");
//           this.params.positionStatus = this.params.ticker + " Timer expired, ending cycle";
//           this.restartCycle();
//         }, 5 * 60 * 1000); // 10 minutes
//       }
//     }

//     if (!position && this.params.positionOpened == true) {
//       clearInterval(this.params.monitorPositionTimer);
//       this.params.position = 0;
//       this.endCycle();
//     }
//   }

//   CheckOpenPosition() {
//     var symbol = this.params.ticker;

//     // Check if we already have an open position
//     //console.log(symbol + ": Checking for open position");

//     // Define the categories you want to check
//     const categoriesToCheck = ["inverse", "linear"];

//     for (const category of categoriesToCheck) {
//       if (this.bybitApi.openPositionV5[category]) {
//         const positionData = this.bybitApi.openPositionV5[category][symbol];
//         if (positionData) {
//           //console.log(`Position data for ${symbol} found in category ${category}:`);
//           return positionData;
//         }
//       }
//     }

//     // console.log(`No open position found for symbol ${symbol} in any category`);
//     return null; // No open position found
//   }

//   // Function to end the current cycle
//   endCycle() {
//     this.bybitApi.cancelAllOpenOrdersV5(this.params.ticker);
//     console.log(`Ending ${this.params.ticker} Bot Cycle. Cancelling Any Remaining Open Orders`);
//     this.params.positionOpened = false;
//     this.params.ordersPlaced = false;
//     var newStartPrice = 0;

//     console.log("Cycle ended, emitting event");

//     this.emit('cycleEnded', { symbol: this.params.ticker });
//   }

//   restartCycle() {
//     this.bybitApi.cancelAllOpenOrdersV5(this.params.ticker);
//     console.log(`Ending ${this.params.ticker} Bot Cycle. Cancelling Any Remaining Open Orders`);
//     this.params.positionOpened = false;
//     this.params.ordersPlaced = false;
//     var newStartPrice = 0;

//     setTimeout(() => {
//       this.startNewCycle();
//     }, 2000);
//   }

//   stopBot() {
//     // Stop any timers or processes
//     console.log("Stopping Bot here");
//     clearInterval(this.params.monitorPositionTimer);
//     clearTimeout(this.params.noPositionTimer);
//     this.endCycle();
//     // Add any additional cleanup logic as needed
//   }

//   async getCurrentPrice() {
//     const fetchTickers = async () => {
//       try {
//         const data = await this.bybitApi.getTickers(this.params.ticker);

//         if (this.params.side == "Long") {
//           const price = parseFloat(data.result[0].bid_price);
//           return price;
//         }

//         if (this.params.side == "Short") {
//           const price = parseFloat(data.result[0].bid_price);
//           return price;
//         }
//       } catch (error) {
//         // Handle any errors that occur during the API call
//         console.error('Error fetching tickers', error);
//       }
//     };

//     const price = await fetchTickers();

//     return price;
//   }

//   async calculateOrders() {
//     const fetchTickers = async () => {
//       try {
//         const data = await this.bybitApi.getTickers(this.params.ticker);

//         if (this.params.side == "Long") {
//           const newStartPrice = parseFloat(data.result[0].bid_price);
//           return newStartPrice;
//         }

//         if (this.params.side == "Short") {
//           const newStartPrice = parseFloat(data.result[0].bid_price);
//           return newStartPrice;
//         }
//       } catch (error) {
//         // Handle any errors that occur during the API call
//         console.error('Error fetching tickers', error);
//       }
//     };

//     const Price = await fetchTickers();

//     const category = this.checkCategory(this.params.ticker);

//     if (this.params.side == "Long") {
//       this.params.InitialEntryPrice = parseFloat(Price * (1 - this.params.priceOffset / 100)).toFixed(this.params.decimals);
//     }

//     if (this.params.side == "Short") {
//       this.params.InitialEntryPrice = parseFloat(Price * (1 + this.params.priceOffset / 100)).toFixed(this.params.decimals);
//     }

//     this.params.startPrice = this.roundPriceToTicksize(this.params.InitialEntryPrice);

//     if (category == "linear") {
//       var position_Size = this.roundQtyUpToNearest(this.params.initialOrderMargin / this.params.startPrice);
//     } else {
//       var position_Size = this.roundQtyUpToNearest(this.calculatePositionSizeInverse(this.params.initialOrderMargin, this.params.leverage));
//     }

//     console.log(this.params.ticker + ": start Price " + this.params.startPrice + " Position_Size " + position_Size + " Ticksize " + this.params.tickSize + " Round_to " + this.params.roundTo + " Decimals " + this.params.decimals + " priceStepsMultiplier " + this.params.priceStepsMultiplier);

//     // Calculate the safety order prices
//     const safetyOrderPrices = [];

//     // Calculate the safety order amounts
//     const safetyOrderAmounts = [];

//     // Add initial safety order price  
//     let firstSafetyOrderPrice = 0;
//     if (this.params.side == "Long") {
//       firstSafetyOrderPrice = parseFloat(this.params.startPrice * (1 - (this.params.priceSteps / 100)));
//     }

//     if (this.params.side == "Short") {
//       firstSafetyOrderPrice = parseFloat(this.params.startPrice * (1 + (this.params.priceSteps / 100)));
//     }

//     safetyOrderPrices.push(this.roundPriceToTicksize(firstSafetyOrderPrice));

//     // Calculate subsequent safety order prices
//     for (let i = 1; i < this.params.maxSafetyOrders; i++) {

//       // Get the previous safety order price
//       const prevSafetyPrice = safetyOrderPrices[i - 1];

//       // Calculate exponential step  
//       let priceDiff = this.params.priceSteps * Math.pow(this.params.priceStepsMultiplier, i);

//       // Convert to percentage
//       let priceDiffPercent = priceDiff / 100;

//       // Apply percentage diff to the previous price
//       let nextSafetyPrice = this.params.side == "Long" ? prevSafetyPrice * (1 - priceDiffPercent) : prevSafetyPrice * (1 + priceDiffPercent);

//       // Add the next safety order price to the array
//       safetyOrderPrices.push(this.roundPriceToTicksize(nextSafetyPrice));
//     }

//     // Calculate safety order amounts
//     let safetyOrderAmount = this.params.safetyOrderMargin * this.params.leverage;

//     for (let i = 0; i < this.params.maxSafetyOrders; i++) {

//       if (category == "linear") {

//         var usdAmount = safetyOrderAmount * Math.pow(this.params.amountMultiplier, i);
//         const positionSize = this.roundQtyUpToNearest(usdAmount / safetyOrderPrices[i]);
//         safetyOrderAmounts.push(positionSize);

//       } else {
//         const positionSize = this.roundQtyUpToNearest(safetyOrderAmount * Math.pow(this.params.amountMultiplier, i));
//         safetyOrderAmounts.push(positionSize);
//       }
//     }

//     safetyOrderPrices.unshift(this.params.startPrice);
//     safetyOrderAmounts.unshift(position_Size);

//     return [safetyOrderAmounts, safetyOrderPrices]
//   }

//   roundPriceToTicksize(number) {
//     var roundedPrice = Math.round(number / this.params.tickSize) * this.params.tickSize;
//     roundedPrice = roundedPrice.toFixed(this.params.decimals);
//     return roundedPrice;
//   }

//   placeOrder(orderType, price, amount, takeProfitPrice, stopLossPrice) {

//     // Think about how to handle the fact that the API accepts strings as numbers now.

//     console.log(` ${this.params.ticker} Placing ${orderType} order: Price: ${price}, Amount: ${amount}, Take_Profit ${takeProfitPrice} , StopLoss ${stopLossPrice}`);

//     var data = {
//       // category: "linear", add category in bybitapi.js
//       side: this.params.side == "Long" ? 'Buy' : 'Sell',
//       symbol: this.params.ticker,
//       price: price.toString(),
//       orderType: 'Limit',
//       qty: amount.toString(),
//       takeProfit: takeProfitPrice.toString(),
//       closeOnTrigger: false,
//       reduceOnly: false,
//     }

//     if (stopLossPrice > 0) {
//       data.stopLoss = stopLossPrice.toString();
//     }

//     this.bybitApi.placeOrderV5(data);
//     this.params.ordersPlaced = true;
//   }

//   roundQtyUpToNearest(value) {
//     const roundedValue = typeof this.params.roundTo === 'number' ? this.params.roundTo : parseFloat(this.params.roundTo);

//     if (isNaN(roundedValue)) {
//       console.error("Invalid value (" + value + ") of this.params.roundTo:", this.params.roundTo);
//       return value;
//     }

//     const decimalPlaces = roundedValue % 1 === 0 ? 0 : roundedValue.toString().split('.')[1].length;
//     const roundedVal = Math.ceil(value / roundedValue) * roundedValue;
//     const roundedValueAsString = decimalPlaces === 0 ? roundedVal.toString() : roundedVal.toFixed(decimalPlaces);

//     return parseFloat(roundedValueAsString);
//   }

//   checkCategory(symbol) {
//     // Convert the input string to lowercase for case-insensitive matching
//     const lowercaseString = symbol.toLowerCase();
//     let category = "";
//     if (lowercaseString.endsWith("usd")) {
//       category = "inverse";
//     } else if (lowercaseString.endsWith("usdt")) {
//       category = "linear";
//     }

//     return category;
//   }

//   calculatePositionSizeInverse(initialMargin, leverage) {
//     // Ensure leverage is a number
//     leverage = parseFloat(leverage);

//     // Ensure initialMargin is a number
//     initialMargin = parseFloat(initialMargin);

//     if (isNaN(leverage) || isNaN(initialMargin)) {
//       console.error('Invalid input for leverage or initial margin');
//       return null;
//     }

//     // Calculate the position size in contracts
//     const positionSize = initialMargin * leverage;

//     return positionSize;
//   }
// }

// module.exports.MartingaleBot = MartingaleBot;

