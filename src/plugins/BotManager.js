import Vue from 'vue'; // Make sure you have imported Vue
import { SymbolInfo } from './bybitApi.js';
// import MartingaleBot from './MartingaleBot.js';
import { MartingaleBot } from './MartingaleBot.js';


export default class BotManager {
      
  constructor(SymbolInfo, bybitApi) {
       
      this.SymbolInfo = SymbolInfo;
      this.bybitApi = bybitApi;
      this.bots = {}; 
      this.listnerTimeout = 0;
    }


    createBot(params) {
      //Create a new bot
     console.log("creating new bot");
     const newBotInstance = new MartingaleBot(params, this.bybitApi);
     this.bots = { ...this.bots, [params.ticker]: newBotInstance };

     const bot = this.bots[params.ticker];
     this.setEventListner(bot);

     //save the bot to local storage
     this.saveToLocalStorage(params); // Save the updated bot data

    }
  
    startBots() {
      Object.values(this.bots).forEach(bot => {
        bot.startNewCycle(); 
      })
    }

    async loadFromLocalStorage() {
      // Get the saved bots
      const savedBots = JSON.parse(localStorage.getItem('savedBots')) || {};
    
      // Iterate through them
      for (const ticker in savedBots) {
        if (savedBots.hasOwnProperty(ticker)) {
          let botParams = savedBots[ticker];
    
          // Check the status of the loaded bot, i.e., open position, active orders
          const symbolToFind = botParams.ticker;
         // console.log(symbolToFind);
    
          // Wait for the checkBotStatus function to complete and update botParams
          botParams = await this.checkBotStatus(botParams);
          
          //re-create the bot
          //this.createBot(botParams);

          const savedBot = new MartingaleBot(botParams, this.bybitApi);
          this.bots = { ...this.bots, [botParams.ticker]: savedBot };

          
          const bot = this.bots[botParams.ticker];
          this.setEventListner(bot);

          this.bots[botParams.ticker].startNewCycle();
        }
      }
    }
    
    async checkBotStatus(botParams) {
      const symbolToFind = botParams.ticker;
      //console.log(symbolToFind);
    
      try {
        const openOrders = await this.bybitApi.getOrdersV5(symbolToFind);
        const position = this.CheckOpenPosition(symbolToFind);
    
        if (position) {
          console.log(botParams.ticker + ": position Open");
          botParams.positionOpened = true;
        }
    
     //   console.log(openOrders);
    
        if (openOrders.length > 0) {
          console.log(botParams.ticker + ": Got Open Orders");
          botParams.ordersPlaced = true;
        } else {
          console.log("No open Orders");
        }
    
        return botParams;

      } catch (error) {
        console.error("Error checking bot status:", error);
        return botParams; // Return botParams even on error
      }
    }

    saveToLocalStorage(newBotInstance) {
      const botData = JSON.parse(localStorage.getItem('savedBots')) || {};
      botData[newBotInstance.ticker] = newBotInstance;
      localStorage.setItem('savedBots', JSON.stringify(botData));
      
    }
    monitorBots() {
      // Restart bots when cycles end
    } 
  
    scanMarkets() {
      // Scan for new opportunities
    }
  
    createNewBots() {
      // Create bots based on scan
    }
    startBot(ticker){
      console.log( this.bots[ticker]);
      this.bots[ticker].startNewCycle();

    }
    

    deleteBot(bot){
      console.log("deleting bot " + bot.ticker);
      clearInterval(this.listnerTimeout);
    
      this.bots[bot.ticker].stopBot();
      Vue.delete(this.bots, bot.ticker);
    
      // Load the bot data from local storage
      const botData = JSON.parse(localStorage.getItem('savedBots')) || {};

      // Check if the bot exists in local storage
      if (botData.hasOwnProperty(bot.ticker)) {
        // Delete the bot from local storage
        delete botData[bot.ticker];

        // Save the updated bot data back to local storage
        localStorage.setItem('savedBots', JSON.stringify(botData));
      }


    }

    setEventListner(bot){

      bot.on('cycleEnded', (data) => {
        // handle event
        console.log("Cycle ended event receieved ");
        console.log(data);
        

        //Check RSI
        this.listnerTimeout = setInterval(() => {
         var rsi = bot.rsi[bot.rsi.length-1];
         console.log(rsi);
          if(rsi < 25 && this.bots[bot.ticker].side == "Long"){
            console.log("starting bot " + data.symbol);
            clearInterval(this.listnerTimeout);
            this.startBot(data.symbol);

          }else if(rsi > 70 && this.bots[bot.ticker].side == "Short"){
            console.log("starting bot " + data.symbol);
            clearInterval(this.listnerTimeout);
            this.startBot(data.symbol);

          }else{
            console.log("Waiting " + rsi);
   
          }

       }, 2500);

        
      
      });
     


    }
    

    CheckOpenPosition(symbol) {
      // Check if we already have an open position
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
    

    

    run() {
      this.loadFromLocalStorage();
      this.startBots();
     
      /*
      while (true) {
        this.monitorBots();
        this.scanMarkets();
        this.createNewBots();
      //  await sleep(60000); // Wait a minute
      }*/
    }
  
  }
  
  // Usage:
  console.log("Ok HEre");


  


/////////////////////


// const reScanMarkets = async () => {
//   try {
//     console.log("Re-Scanning available markets in order to obtain latest indicator values.")
//     const data = await this.bybitApi.MarketScan();
//     console.log(data);
//     return data;

//   } catch (error) {
//     // Handle any errors that occur during the API call
//     console.error('Error scanning markets', error);
//   }
// };


// const executeAfterFetch = async () => {
// try {

// const rsiValues = await reScanMarkets();   
// this.bybitApi.rsiValue = rsiValues;

//  // Step 1: Create a new array with price_24h_pcnt and symbol
// const tickersWithPcnt = this.bybitApi.Tickers.map(ticker => ({
//   price_24h_pcnt: ticker.price_24h_pcnt,
//   symbol: ticker.symbol
// }));

// // Step 2: Sort the array in descending order based on price_24h_pcnt
// tickersWithPcnt.sort((a, b) => b.price_24h_pcnt - a.price_24h_pcnt);

// // Step 3: Extract the top 20 items
// const top20Tickers = tickersWithPcnt.slice(0, 20);

// // Step 4: Create a new array with only symbols from top20Tickers
// const symbolsOnly = top20Tickers.map(ticker => ticker.symbol);

// // console.log(symbolsOnly);

// // Step 5: Filter the symbolsOnly array to get the top 10 symbols with the highest volume_24h values
// const top10Symbols = symbolsOnly
//   .map(symbol => ({
//     symbol: symbol,
//     price_24h_pcnt: tickersWithPcnt.find(ticker => ticker.symbol === symbol).price_24h_pcnt
//   }))
//   .sort((a, b) => b.price_24h_pcnt - a.price_24h_pcnt)
//   .slice(0, 10)
//   .map(item => item.symbol);

// // Step 6: Filter the top10Symbols array to get the symbols with the highest volume_24h values
// const top10SymbolsWithVolume = top10Symbols
//   .map(symbol => ({
//     symbol: symbol,
//     volume_24h: this.bybitApi.Tickers.find(ticker => ticker.symbol === symbol).volume_24h
//   }))
//   .sort((a, b) => b.volume_24h - a.volume_24h);

// // Step 8: Sort the top10SymbolsWithVolume array based on RSI values
// const sortedTop10Symbols = top10SymbolsWithVolume.sort((a, b) => {
//   const rsiA = this.bybitApi.rsiValues[a.symbol][this.bybitApi.rsiValues[a.symbol].length - 1];
//   const rsiB = this.bybitApi.rsiValues[b.symbol][this.bybitApi.rsiValues[b.symbol].length - 1];
//   return rsiA - rsiB;
// });

// // Now sortedTop10Symbols contains the top 10 symbols with the highest price_24h_pcnt values,
// // highest volume_24h values, ordered by the lowest RSI value at the beginning and the highest RSI value at the end
// console.log(sortedTop10Symbols);

// // Find a ticker that ends with "usdt"
// for (const symbolInfo of sortedTop10Symbols) {
//   if (symbolInfo.symbol.toLowerCase().endsWith('usdt')) {
//     this.ticker = symbolInfo.symbol;
//     break;
//   }
// }

// console.log('Selected ticker:', this.ticker);

// var position = this.CheckOpenPosition();

// if (position) {
//     console.log("Bot already running, monitoring the position now... ");
//     this.positionStatus = "Bot already running, monitoring the position now... ";
//     this.positionOpened = true;
//     const self = this;
//     this.monitorPositionTimer = setInterval(() => self.MonitorPosition(), 2000);
// }else{ 

//       this.calculateOrders();

  /*

        const newStartPrice = await fetchTickers();
        var ATR = parseFloat(this.bybitApi.atrValues[this.ticker]);
        this.priceStepsMultiplier = ATR;
        this.tpTarget = ATR * 6;
        this.slTarget = ATR * 10;

      */