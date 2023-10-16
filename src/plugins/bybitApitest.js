import { mdiCommentSearchOutline, mdiConsoleNetworkOutline } from '@mdi/js';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { slice } from 'lodash';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { ORDER_DISTRIBUTIONS } from '../../src/components/Home/LadderOrdersForm/constants';
import { generateOrders, generateOrdersByPricePoints } from '../../src/components/Home/LadderOrdersForm/scaledOrderGenerator';
import { floor, abs, max, round, min, typeOf} from 'mathjs'
import { closePosition } from '../../src/components/Home/ScalpForm';
import { Console } from 'console';

const MarketMakerBot = require('./MarketMakerBot');

var http = require('http');

export default {
  install(Vue, defaultOptions = {}) {
    Vue.prototype.$bybitApi = new Vue({
      data: {
        account: {
          apiKey: '',
          apiSecret: '',
          label: '',
          isTestnet: false,
        },
        accounts: [],
        autoconnect: true,

        url: 'https://api.bybit.com/',
        wsUrl: 'wss://stream.bybit.com/realtime',
        wsUrlPrivate:'',
        ws: null,
        lastPrice: 0,
        markPrice: 0,
        funding: 0,
        fundingTime :0,
        walletBalance: 0,
        openOrders: [],
        openPosition: null,
        availableSymbols: ['BTCUSD', 'ETHUSD'],
        currentSymbol: 'BTCUSD',
        quoteCurrency:"USD",
        baseCurrency:"BTC",
        contractType:"InversePerpetual",
        startingBalance:0,
        targetPercentage:0,
        currentTickSize: 0.5,
        currentQtyStep: 1,
        lastPriceMarkPriceDifference: 0,
        OrderBookParsed:[],
        OrderBookTemp:[],
        chaseOrderID: null,
        bids:[],
        SellSideOrderBook:[],
        bid_total:0,
        ask_total:0,
        maxBid_size:0,
        maxAsk_size:0,
        trackOrderID:null,
        stopLoss:0,
        generatedLadder:null,
        orders: [],
        ATR: [],
        KlineData1:[],
        KlineData5:[],
        KlineData15:[],
        KlineData30:[],
        KlineData60:[],
        KlineData240:[],
        KlineData720:[],
        KlineDataD:[],
        KlineDataW:[],
        KlineDataM:[],
        breakevenPrice:0,
        average_entry:0,
        movedtoBreakeven:false,
        LadderInterval:0,
        symbolInfo:[],
        orderBook: new Map(),
        sortedOrderBook:[],
        Tickers:[],
        symbolMap: new Map(),
        balances:[],
        supportResistance:[],
        LinearPerpetualSymbols:[],
        InversePerpetualSymbols:[],
        InverseFuturesSymbols:[],
        MarketScanner:[],
        BBwidth:[],
        scannerSupportResistance:[],
        Trend:[],
        Liquidations:[],
        openInterest:[],
        day: "",
        newOrders:[],
        removedOrders:[],
        updatedOrders:[],
        momentum:{},
        sentiment:0,
        imbalance:0,
        momentumData:[],
        trades:[],
        ema21:[],
        ema65:[],
        ema100:[],
        closePrices:[],
        marketMakerRunning:false,
        orderPlaced:false,
      
       
        urls: {
          mainnetUSDTPerp: {
          url: 'https://api.bybit.com/',
          wsUrlPublic: 'wss://stream.bybit.com/realtime_public',
          wsUrlPrivate: 'wss://stream.bybit.com/realtime_private',
          },
          mainnetInversePerp: {
            url: 'https://api.bybit.com/',
            wsUrl: 'wss://stream.bybit.com/realtime',
          },
          mainnet: {
            url: 'https://api.bybit.com/',
            wsUrl: 'wss://stream.bybit.com/realtime',
          },
          testnet: {
            url: 'https://api-testnet.bybit.com/',
            wsUrl: 'wss://stream-testnet.bybit.com/realtime',
          },
         },
        klineEndpoint: 'v2/public/kline/list?symbol=',
        QueryActiveOrderEndpoint: 'v2/private/order',
        PlaceOrderEndpoint: 'v2/private/order/create',
        cancelOrderEndpoint: 'v2/private/order/cancel',
        replaceOrderEndpoint: 'v2/private/order/replace',
        cancelAllOrdersEndpoint: 'v2/private/order/cancelAll',
        setTradingStopEndpoint: 'v2/private/position/trading-stop',
        positionUrl: '/v2/private/position/list',
        positionInterval: undefined,

      },
      methods: {
        async init() {
          
          await this.getUndocumentedApi();

          //look to replace this call with the data gained from this.getUndocumentedApi
          // await this.updateInstrumentDetails();
         if (this.account.apiKey && this.account.apiSecret &&
              this.autoconnect) {
            if (this.account.isTestnet) {
              this.url = this.urls.testnet.url;
              this.wsUrl = this.urls.testnet.wsUrl;
            } else {
             
             if(this.contractType == "LinearPerpetual"){
                this.url = this.urls.mainnetUSDTPerp.url;
                this.wsUrl = this.urls.mainnetUSDTPerp.wsUrlPublic;
                this.wsUrlPrivate = this.urls.mainnetUSDTPerp.wsUrlPrivate;
                }else if(this.contractType == "InversePerpetual"){
                  this.url = this.urls.mainnet.url;
                  this.wsUrl = this.urls.mainnet.wsUrl;
                  
                }

                this.balances = await this.getBalance("BTC");
                this.walletBalance = parseFloat(this.balances["BTC"].wallet_balance).toFixed(this.symbolInfo.walletBalanceFraction);
                console.log("Symbol " + this.currentSymbol + " base_currency " + this.baseCurrency + " quote_currency " + this.quoteCurrency + " Contract " + this.contractType + " Base currency wallet balance " + this.walletBalance);

            }
          
            
            setTimeout(() => {

              this.getHistoricOHLC(this.convertToSeconds("minutes", 55 ), this.KlineData1, 1);
              this.getHistoricOHLC(this.convertToSeconds("hours", 10), this.KlineData5, 5);              
              this.getHistoricOHLC(this.convertToSeconds("weeks", 3 ), this.KlineData30, 30);
            //  this.getHistoricOHLC(this.convertToSeconds("weeks", 4), this.KlineData240, 240);
            //  this.getHistoricOHLC(this.convertToSeconds("months", 7), this.KlineData720, 720);

              
              this.getOpenInterest();

            //  console.log(this.KlineData5);
              this.initPositionInterval();
              this.getOrders();


            }, 1000);
            
    

            setTimeout(() => {

              this.initWs();
              this.getTickers();

            //  console.log(this.KlineData5);
              let supportResistance15 = [];
              let supportResistance30 = [];
              let supportResistance240 = [];
              let supportResistance720 = [];

              supportResistance15 = this.getSupportAndResistance(this.KlineData5);
              supportResistance30 = this.getSupportAndResistance(this.KlineData30);
           //   supportResistance240 = this.getSupportAndResistance(this.KlineData240);
           //   supportResistance720 = this.getSupportAndResistance(this.KlineData720);

              this.$set(this.supportResistance, '15 Min', supportResistance15);
              this.$set(this.supportResistance, '30 Min', supportResistance30);
           //   this.$set(this.supportResistance, '4 Hour', supportResistance240);
          //    this.$set(this.supportResistance, '12 Hour', supportResistance720);
              
             // console.log(this.supportResistance);

              //this.MarketScan();

            }, 3000);

            setTimeout(() => {

             this.runMarketMaker();

           },7000);

            // var http = require('http');                            // Import Node.js core module

            // var server = http.createServer(async (req, res) => {
            //   const buffers = [];

            //   for await (const chunk of req) {
            //     buffers.push(chunk);
            //   }

            //   const data = Buffer.concat(buffers).toString();
            //   this.httpHandler(data);
            //   res.end();
            // })

            // server.listen(80); //6 - listen for any incoming requests

            // console.log('Node.js web server at port 80 is running..');

          }
        },
        changeSymbol(symbol) {
          this.disablePositionInterval();
          console.log("Changing Symbol To " + symbol);
          if (this.ws) {
            this.ws.close();
          }
          if (this.wsPrivate) {
            this.wsPrivate.close();
          }
          this.lastPrice = 0;
          this.markPrice = 0;
          this.walletBalance = 0;
          this.openOrders = [];
          this.openPosition = null;
          this.currentSymbol = symbol;
          this.init();
        },
        changeAccount() {
          this.disablePositionInterval();
          if (this.ws) {
            this.ws.close();
          }
          if (this.wsPrivate) {
            this.wsPrivate.close();
          }
          this.lastPrice = 0;
          this.markPrice = 0;
          this.walletBalance = 0;
          this.openOrders = [];
          this.openPosition = null;
          this.movedtoBreakeven = false;
          this.init();
        }, 
        async getTickers() {
          //this is used by headers to populate the menu, think it can be removed or replace though
          let res = await axios.get(this.url + '/v2/public/tickers');
          if (res.data.ret_msg === 'OK') {
            this.Tickers = res.data.result;
           // console.log(this.Tickers);
         }
        },
        initWs() {

          if(this.contractType == "LinearPerpetual"){
            this.ws = new ReconnectingWebSocket(`${this.wsUrl}`);
            this.wsPrivate = new ReconnectingWebSocket(`${this.wsUrlPrivate}`);

            this.ws.onopen = (e) => {
               this.ws.send('{"op":"subscribe","args":["candle.5.' + this.currentSymbol + '"]}');
               this.ws.send('{"op":"subscribe","args":["candle.D.' + this.currentSymbol + '"]}');
               this.ws.send('{"op":"subscribe","args":["candle.W.' + this.currentSymbol + '"]}');
               this.ws.send('{"op":"subscribe","args":["candle.M.' + this.currentSymbol + '"]}');
               this.ws.send('{"op":"subscribe","args":["orderBookL2_25.' + this.currentSymbol + '"]}');
               this.ws.send('{"op":"subscribe","args":["instrument_info.100ms.' + this.currentSymbol + '"]}');
              
              // this.ws.send('{"op":"subscribe","args":["liquidation.' + this.currentSymbol + '"]}');
            };

            this.wsPrivate.onopen = (e) => {
              let expires = Date.now() + 1500;

              let signature = CryptoJS.HmacSHA256('GET/realtime' + expires,
                  this.account.apiSecret).
                  toString();

              this.wsPrivate.send(
                  JSON.stringify({
                    'op': 'auth',
                    'args': [this.account.apiKey, expires, signature],
                  }));

                  this.wsPrivate.send('{"op": "subscribe", "args": ["wallet"]}');
                  this.wsPrivate.send('{"op":"subscribe","args":["order"]}');
            };

          }else if(this.contractType == "InversePerpetual"){
            this.ws = new ReconnectingWebSocket(`${this.wsUrl}`);

            this.ws.onopen = (e) => {
              let expires = Date.now() + 1500;

              let signature = CryptoJS.HmacSHA256('GET/realtime' + expires,
                  this.account.apiSecret).
                  toString();
       
              this.ws.send(
                  JSON.stringify({
                    'op': 'auth',
                    'args': [this.account.apiKey, expires, signature],
                  }));

              setTimeout(() => {
                  this.ws.send('{"op":"subscribe","args":["order"]}');
                  this.ws.send( '{"op":"subscribe","args":["klineV2.1.' + this.currentSymbol + '"]}');
                  this.ws.send( '{"op":"subscribe","args":["klineV2.5.' + this.currentSymbol + '"]}');
                  this.ws.send( '{"op":"subscribe","args":["klineV2.15.' + this.currentSymbol + '"]}');
                  this.ws.send( '{"op":"subscribe","args":["klineV2.30.' + this.currentSymbol + '"]}');
                  this.ws.send( '{"op":"subscribe","args":["klineV2.60.' + this.currentSymbol + '"]}');
               //   this.ws.send( '{"op":"subscribe","args":["klineV2.W.' + this.currentSymbol + '"]}');
               //   this.ws.send( '{"op":"subscribe","args":["klineV2.M.' + this.currentSymbol + '"]}');
                  this.ws.send( '{"op":"subscribe","args":["wallet"]}');
                  //this.ws.send( '{"op":"subscribe","args":["orderBook_200.100ms.' + this.currentSymbol + '"]}');
                  this.ws.send( '{"op":"subscribe","args":["orderBookL2_25.' + this.currentSymbol + '"]}');
                  this.ws.send(' {"op":"subscribe","args":["instrument_info.100ms.' + this.currentSymbol + '"]}');
                  this.ws.send( '{"op":"subscribe","args":["liquidation.' + this.currentSymbol + '"]}');
               //  this.ws.send( '{"op":"subscribe","args":["trade.' + this.currentSymbol + '"]}');

               }, 100);

            };
                   
          }

          if(this.contractType == "LinearPerpetual"){
          this.wsPrivate.onmessage = (e) => {
            let data = JSON.parse(e.data);
            switch (data.topic) {
              case 'wallet' :
                console.log(data.data);
                console.log("Balance Changed " + data.data[0].wallet_balance);
               // this.walletBalance = data.data[0].wallet_balance;
                this.walletBalance = parseFloat(data.data[0].wallet_balance).toFixed(this.symbolInfo.walletBalanceFraction);

              break;

              case 'order' :
                console.log(data.data);

                for (let i = 0; i < data.data.length; i++) {
                  if (data.data[i].symbol === this.currentSymbol) {
                    if (data.data[i].order_status === 'Cancelled'
                        || data.data[i].order_status === 'Rejected'
                        || data.data[i].order_status === 'Filled') {
                      this.removeOrder(data.data[i]);
                    }
                    if (data.data[i].order_status === 'New'
                        || data.data[i].order_status === 'PartiallyFilled') {
                      this.addOrder(data.data[i]);
                    }
                  }
                }

              break;

              default :
                // console.log(data.topic);
                // console.log(data);
              break;
            }
          };
        }

          this.ws.onmessage = (e) => {
            let data = JSON.parse(e.data);

           // console.log(data);
            switch (data.topic) {
              case 'wallet' :
                //console.log("Balance Changed " + data.data[0].wallet_balance);
               // console.log(data.data);
                this.walletBalance = parseFloat(data.data[0].wallet_balance).toFixed(this.symbolInfo.walletBalanceFraction);

              break;
              case 'instrument_info.100ms.' + this.currentSymbol + '' :
                this.setPrice(data);
               // console.log(data);
                break;
              case 'order' :

                for (let i = 0; i < data.data.length; i++) {
                  if (data.data[i].symbol === this.currentSymbol) {
                    if (data.data[i].order_status === 'Cancelled'
                        || data.data[i].order_status === 'Rejected'
                        || data.data[i].order_status === 'Filled') {
                      this.removeOrder(data.data[i]);
                    }
                    if (data.data[i].order_status === 'New'
                        || data.data[i].order_status === 'PartiallyFilled') {
                          this.addOrder(data.data[i]);
                    }
                  }
                }
              break;     

                case 'orderBook_25.100ms.' + this.currentSymbol + '':
                case 'orderBookL2_25.' + this.currentSymbol + '':
                case 'orderBook_200.100ms.' + this.currentSymbol + '':

                                
                  if (data.type === 'snapshot') {

                      let result = [];
                      if(this.contractType == "LinearPerpetual"){
                        data.data = data.data.order_book;
                      }

                    // Clear the existing order book
                    this.orderBook.clear();
                    // Iterate over the snapshot data and add it to the order book

                    for (let i = 0; i < data.data.length; i++) {
                        this.orderBook.set(data.data[i].id, data.data[i]);
                    }
                   
                }
             if (data.type === 'delta') {

             // console.log(data);
             
                    // Iterate over the deleted entries and remove them from the order book
                    for (let i = 0; i < data.data.delete.length; i++) {
                      const deletedOrder = data.data.delete[i];
                      this.orderBook.delete(deletedOrder.id);
                      this.removedOrders.push(deletedOrder.id);
                    }

                    // Iterate over the updated entries and update them in the order book
                    for (let i = 0; i < data.data.update.length; i++) {
                      const updatedEntry = data.data.update[i];
                      const existingEntry = this.orderBook.get(updatedEntry.id);
                      existingEntry.price = updatedEntry.price;
                      existingEntry.side = updatedEntry.side;
                      existingEntry.size = updatedEntry.size;
                      this.updatedOrders.push(updatedEntry.id);
                    }

                    // Iterate over the inserted entries and add them to the order book
                    for (let i = 0; i < data.data.insert.length; i++) {
                      const insertedOrder = data.data.insert[i];
                      this.orderBook.set(insertedOrder.id, insertedOrder);
                      this.newOrders.push(insertedOrder);
                     
                    }
                
                    // Sort the order book by price
                    this.sortedOrderBook = [...this.orderBook.values()].sort((a, b) => a.price - b.price);
                    
                }
                
           this.OrderBook = this.sortedOrderBook;

          // this.bids = this.OrderBook.slice(100,200).reverse();
          // this.asks = this.OrderBook.slice(200,300);   

           this.bids = this.OrderBook.slice(0,25).reverse();
           this.asks = this.OrderBook.slice(25,50);   
           
      
          // Perform order flow analysis
        //  const orderFlowAnalysis = this.performOrderFlowAnalysis(this.OrderBook, this.bids, this.asks);

          // Inferred sentiment and future price movements
         // const sentimentAndPredictions = this.inferSentiment(orderFlowAnalysis);

          // Access the analyzed data or predictions as needed
          //this.imbalance = Math.abs(orderFlowAnalysis.imbalancePercentage);
         // this.sentiment = sentimentAndPredictions.sentiment;
            
        //  console.log(this.sentiment + " " + this.imbalance); // Output: The normalized imbalance percentage
         // this.momentumData = this.calculateMomentum(this.OrderBook);


         


           // Perform decision-making based on momentum
          if (this.momentumData.momentum === 'Bullish') {
            // Take bullish action or make bullish decisions
         //   console.log("Bullish Momentum: Net Buying Pressure " +  this.momentumData.netBuyingPressurePercentage + "%");
          } else if (this.momentumData.momentum === 'Bearish') {
            // Take bearish action or make bearish decisions
          //   console.log("Bearish Momentum - Net selling Pressure: Net selling Pressure " +  this.momentumData.netSellingPressurePercentage + "%");
          } 

           this.bestBid = this.bids[0].price;
           this.bestAsk = this.asks[0].price;

         //  const result = this.detectManipulation(this.bids[0], this.asks[0]);

       //    console.log(result);

           let cumulativeBid = 0;
           let cumulativeAsk = 0;

           this.bid_total = 0;
           this.ask_total = 0;

           this.maxBid_size = 0;
           this.maxAsk_size = 0;
           const OrderBookArray = [];

           for(var x=0; x < this.bids.length; x++){

              cumulativeBid += this.bids[x].size;
              cumulativeAsk += this.asks[x].size;

              this.maxBid_size = (this.bids[x].size > this.maxBid_size ? this.bids[x].size : this.maxBid_size);
              this.maxAsk_size = (this.asks[x].size > this.maxAsk_size ? this.asks[x].size : this.maxAsk_size);

              OrderBookArray.push({bid_total:  cumulativeBid,
                                   bid_size:   this.bids[x].size,
                                   bid_price:  this.bids[x].price,
                                   ask_price:  this.asks[x].price,
                                   ask_size:   this.asks[x].size,
                                   ask_total:  cumulativeAsk,
                                 });
           }
              this.bid_total = cumulativeBid;
              this.ask_total = cumulativeAsk;
              this.OrderBookParsed = OrderBookArray;

             break;
                
                case 'liquidation.' + this.currentSymbol + '':
               //   console.log(data);
                  console.log(data.data);
                  this.Liquidations.push(data.data);
                break;

                case 'klineV2.1.' + this.currentSymbol + '':
               
                  if(data.data[0].confirm == true){
                    this.KlineData1.push(data.data[0]);
                    this.KlineData1.shift();

                  }else{
                        this.KlineData1[this.KlineData1.length-1] = data.data[0];
                  }

            //      this.watchPriceRetracement(this.KlineData1[this.KlineData1.length-1] = data.data[0], this.lastPrice, "1 min candle ");

                break;

                case 'klineV2.15.' + this.currentSymbol + '':
               
                  if(data.data[0].confirm == true){
                    this.KlineData15.push(data.data[0]);
                    this.KlineData15.shift();

                  }else{
                        this.KlineData15[this.KlineData15.length-1] = data.data[0];
                  }

                //  this.watchPriceRetracement(this.KlineData15[this.KlineData15.length-1] = data.data[0], this.lastPrice, "15 min candle ");

                break;

                case 'klineV2.60.' + this.currentSymbol + '':
               
                  if(data.data[0].confirm == true){
                    this.KlineData60.push(data.data[0]);
                    this.KlineData60.shift();

                  }else{
                        this.KlineData60[this.KlineData60.length-1] = data.data[0];
                  }

                //  this.watchPriceRetracement(this.KlineData60[this.KlineData60.length-1] = data.data[0], this.lastPrice, "60 min candle ");

                break;


                case 'klineV2.30.' + this.currentSymbol + '':
               
                  if(data.data[0].confirm == true){
                    this.KlineData30.push(data.data[0]);
                    this.KlineData30.shift();

                  }else{
                        this.KlineData30[this.KlineData30.length-1] = data.data[0];
                  }

              //    this.watchPriceRetracement(this.KlineData30[this.KlineData30.length-1] = data.data[0], this.lastPrice, "30 min candle ");

                break;


                case 'klineV2.5.' + this.currentSymbol + '':
               
                  if(data.data[0].confirm == true){
                    this.KlineData5.push(data.data[0]);
                    this.KlineData5.shift();
                  }else{
                         this.KlineData5[this.KlineData5.length-1] = data.data[0];
                       }

               
                       this.ema21 = this.calculateEMA(21, this.KlineData5);
             
                       this.ema65 = this.calculateEMA(65, this.KlineData5);
                    
                       this.ema100 = this.calculateEMA(100, this.KlineData5);

                      // console.log(this.ema21);

                       //console.log('%c' + this.ema21[this.ema21.length - 1].ema, 'color: #1efb27');
                      // console.log('%c' + this.ema65[this.ema65.length - 1].ema, 'color: #f70202');
                      // console.log('%c' + this.ema100[this.ema100.length - 1].ema, 'color: #3c11f7');

                    //   this.watchPriceRetracement(this.KlineData5[this.KlineData5.length-1] = data.data[0], this.lastPrice, "5 min candle ");

                       

                break;

              case 'candle.5.' + this.currentSymbol + '':
                  if(data.data[0].confirm == true){
                    this.KlineData5.push(data.data[0]);
                    this.KlineData5.shift();

                  }else{
                        this.KlineData5[this.KlineData5.length-1] = data.data[0];
                 
                  }

           
                break;

                case 'klineV2.D.' + this.currentSymbol + '':
                  case 'candle.D.' + this.currentSymbol + '':
                      if(data.data[0].confirm == true){
                        this.KlineDataD.push(data.data[0]);
                        this.KlineDataD.shift();
    
                      }else{
                            this.KlineDataD[this.KlineDataD.length-1] = data.data[0];
                      }

                      if(this.KlineDataD[this.KlineDataD.length-1].close > this.KlineDataD[this.KlineDataD.length-1].open){

                        this.day = "green";

                      } else if(this.KlineDataD[this.KlineDataD.length-1].close < this.KlineDataD[this.KlineDataD.length-1].open){

                        this.day = "red";

                      } 
                    break;

                    case 'klineV2.W.' + this.currentSymbol + '':
                      case 'candle.W.' + this.currentSymbol + '':
                          if(data.data[0].confirm == true){
                            this.KlineDataW.push(data.data[0]);
                            this.KlineDataW.shift();
        
                          }else{
                                this.KlineDataW[this.KlineDataW.length-1] = data.data[0];
                          }
                        break;

                        case 'klineV2.M.' + this.currentSymbol + '':
                          case 'candle.M.' + this.currentSymbol + '':
                              if(data.data[0].confirm == true){
                                this.KlineDataM.push(data.data[0]);
                                this.KlineDataM.shift();
            
                              }else{
                                    this.KlineDataM[this.KlineDataM.length-1] = data.data[0];
                              }
                            break;


                       
                         case 'trade.' + this.currentSymbol + '':
                          /*
                              const MAX_TRADES = 30;
                           
                              
                              this.trades.push({ ...data.data[0], order_type: this.determineOrderType(data.data[0], parseFloat(this.bestBid), parseFloat(this.bestAsk)) });
                              //console.log(this.trades);
                            
                              if (this.trades.length > MAX_TRADES) {
                                this.trades.shift();
                              }
                            
                              this.analyzeTrades(this.trades, this.bestBid, this.bestAsk);

                              */
                          break;
                            
              default :
                //console.log(data.topic);
               // console.log(data);
              break;
            }
          };
      },

      ////////////////////
      runMarketMaker() {

        var usdBalance = (parseFloat(this.walletBalance) * parseFloat(this.lastPrice));

        if(usdBalance <= 14){
          console.log("Exiting");
          return 
        }
       

          if(this.marketMakerRunning == false){
            const marketMaker = new MarketMakerBot('BTC/USD', 25, 1, 5, 2, this.walletBalance, this);


            if(this.openPosition == null && this.orderPlaced == false){
            
                  var prices = marketMaker.updateMarketPrices(this.lastPrice);
                  //calulate the position size required to hit a specified target profit if both orders are filled 
                  usdBalance = (parseFloat(this.walletBalance) * parseFloat(this.lastPrice));
                  var contracts = Math.floor(marketMaker.calculatePositionSize(prices[0], (prices[0] + 30), 0.10));
                  var leverage  = marketMaker.calculateLeverageRequired(usdBalance, contracts);

                  console.log(this.openPosition);
                    if(marketMaker.orderFilled == false && this.openPosition == null){

                    console.log("pos size " + contracts + " " + prices[0] + " " + (prices[0] + 30)  + " required leverage " + leverage);


                      marketMaker.placeOrder('Buy', prices[0], contracts, "Buy_" + this.makeid(5));
                      marketMaker.placeOrder('Sell', prices[1], contracts, "Sell_" + this.makeid(5));
                      this.orderPlaced = true;
                    }else{
                      marketMaker.monitorPosition();
                    }


            this.marketMakerRunning = true;
          }
        }

      },
     
            
      // Call the function to run the market maker

      
      ///////////////////
      watchPriceRetracement(candle, currentPrice, period) {
      
        const open = candle.open;
        const high = candle.high;
        const low = candle.low;
        const close = candle.close;
      
        // Check if price moved away from the candle's open
        const priceMovedUp = close > open;
        const priceMovedDown = close < open;
      
        if (priceMovedUp) {
          // Watch for retracement if price moved up
          if (low < open && currentPrice > open) {
         //   console.log(period + " Price formed a low and retraced back above the candle's open (bullish)");
            // Trigger your alert or desired action here
          }
        } else if (priceMovedDown) {
          // Watch for retracement if price moved down
          if (high > open && currentPrice < open) {
       //     console.log(period + " Price formed a high and retraced back below the candle's open (bearish)");
            // Trigger your alert or desired action here
          }
        }
      }
      ,
  
       detectManipulation(bestBid,bestAsk) {
        // Get the best bid and ask prices

      
        // Calculate the bid-ask spread
        const spread = bestAsk.price - bestBid.price;
       
      
        // Check if there is a significant size difference between the best bid and ask
        const bidAskSizeRatio = parseFloat(bestBid.size) / parseFloat(bestAsk.size);
        const sizeThreshold = 25; // Set a threshold for size difference

        if (bidAskSizeRatio > sizeThreshold) {
          // The bid size is significantly larger than the ask size, indicating potential manipulation to block price decrease
          return 'Artificially blocked from going down';
        } else if (bidAskSizeRatio < 1 / sizeThreshold) {
          // The ask size is significantly larger than the bid size, indicating potential manipulation to block price increase
          return 'Artificially blocked from going up';
        }
      
        // Check if the bid-ask spread is abnormally narrow
        const spreadThreshold = 0.02; // Set a threshold for spread
      
        if (spread < spreadThreshold) {
          // The spread is narrower than the threshold, indicating potential manipulation to prevent price movement
          return 'Artificially blocked from price movement';
        }
      
        // No signs of manipulation detected
        return 'No manipulation detected';
      },

      determineOrderType(trade, bestBid, bestAsk) {
        const price = trade.price;
       // console.log(price + " " + typeOf(price ))
       // console.log(bestBid + " " + typeOf(bestBid ))
      
        if (trade.side === 'Buy') {
          return (price === bestAsk) ? 'Market' : 'Limit';
        } else if (trade.side === 'Sell') {
          return (price === bestBid) ? 'Market' : 'Limit';
        }
      
        return 'Unknown';
      },
      analyzeTrades(trades, bestBid, bestAsk) {
        let marketBuyCount = 0;
        let marketSellCount = 0;
        let limitBuyCount = 0;
        let limitSellCount = 0;
      
        trades.forEach((trade) => {
          const orderType = trade.order_type;
          const side = trade.side;
      
          if (orderType === 'Market') {
            if (side === 'Buy') {
              marketBuyCount++;
            } else if (side === 'Sell') {
              marketSellCount++;
            }
          } else if (orderType === 'Limit') {
            if (side === 'Buy') {
              limitBuyCount++;
            } else if (side === 'Sell') {
              limitSellCount++;
            }
          }
        });
      
        const totalTrades = trades.length;
        const marketBuyPercentage = (marketBuyCount / totalTrades) * 100;
        const marketSellPercentage = (marketSellCount / totalTrades) * 100;
        const limitBuyPercentage = (limitBuyCount / totalTrades) * 100;
        const limitSellPercentage = (limitSellCount / totalTrades) * 100;
      
       // console.log(`Market Buy Percentage: ${marketBuyPercentage.toFixed(2)}%`);
       // console.log(`Market Sell Percentage: ${marketSellPercentage.toFixed(2)}%`);
       // console.log(`Limit Buy Percentage: ${limitBuyPercentage.toFixed(2)}%`);
       // console.log(`Limit Sell Percentage: ${limitSellPercentage.toFixed(2)}%`);
      
        let previousMarketBuyPercentage = 0;
        let previousMarketSellPercentage = 0;
        let previousLimitBuyPercentage = 0;
        let previousLimitSellPercentage = 0;

        // Decision making based on market order percentages
        if (
        marketBuyPercentage > previousMarketBuyPercentage &&
        marketBuyPercentage > marketSellPercentage &&
        marketBuyPercentage > limitSellPercentage &&
        marketBuyPercentage > limitBuyPercentage
        ) {
        console.log(`Traders are heavily using market orders to buy. Consider going long : ${marketBuyPercentage.toFixed(2)}%`);
        } else if (
        marketSellPercentage > previousMarketSellPercentage &&
        marketSellPercentage > marketBuyPercentage &&
        marketSellPercentage > limitBuyPercentage &&
        marketSellPercentage > limitSellPercentage
        ) {
        console.log(`Traders are heavily using market orders to sell. Consider going short : ${marketSellPercentage.toFixed(2)}%`);
        } else if (
        limitBuyPercentage > previousLimitBuyPercentage &&
        limitBuyPercentage > marketBuyPercentage &&
        limitBuyPercentage > marketSellPercentage &&
        limitBuyPercentage > limitSellPercentage
        ) {
        console.log(`Traders are using more limit orders to buy. Consider going long. : ${limitBuyPercentage.toFixed(2)}%`);
        } else if (
        limitSellPercentage > previousLimitSellPercentage &&
        limitSellPercentage > marketBuyPercentage &&
        limitSellPercentage > marketSellPercentage &&
        limitSellPercentage > limitBuyPercentage
        ) {
        console.log(`Traders are using more limit orders to sell. Consider going short. : ${limitSellPercentage.toFixed(2)}%`);
        }

        // Update previous values
        previousMarketBuyPercentage = marketBuyPercentage;
        previousMarketSellPercentage = marketSellPercentage;
        previousLimitBuyPercentage = limitBuyPercentage;
        previousLimitSellPercentage = limitSellPercentage;

            // Decision making based on trade frequency and size
          const buyTradeFrequency = marketBuyCount + limitBuyCount;
          const sellTradeFrequency = marketSellCount + limitSellCount;
          const totalBuySize = trades
            .filter((trade) => trade.side === 'Buy')
            .reduce((total, trade) => total + trade.size, 0);
          const totalSellSize = trades
            .filter((trade) => trade.side === 'Sell')
            .reduce((total, trade) => total + trade.size, 0);

          // console.log(`Buy Trade Frequency: ${buyTradeFrequency}`);
          // console.log(`Sell Trade Frequency: ${sellTradeFrequency}`);
          // console.log(`Total Buy Size: ${totalBuySize}`);
          // console.log(`Total Sell Size: ${totalSellSize}`);

         // if (buyTradeFrequency > sellTradeFrequency && totalBuySize > totalSellSize) {
          if (totalBuySize > totalSellSize) {
         //   console.log(`Buy trades (${totalBuySize}) are more frequent (${buyTradeFrequency}) than sell trades (${sellTradeFrequency}) and have a larger total size than sell trades (${totalSellSize}). Consider going long.`);
          //} else if (sellTradeFrequency > buyTradeFrequency && totalSellSize > totalBuySize) {
          } else if ( totalSellSize > totalBuySize) {
          //  console.log(`Sell trades (${totalSellSize}) are more frequent (${sellTradeFrequency}) than buy trades (${buyTradeFrequency}) and have a larger total size than buy trades (${totalBuySize}). Consider going short.`);
          } else {
          //  console.log("Market sentiment is balanced.");
          }
      },

    calculateMomentum(orderBookData) {
        let buyingPressure = 0;
        let sellingPressure = 0;
      
        for (let i = 0; i < orderBookData.length; i++) {
          const order = orderBookData[i];
      
          // Calculate momentum based on the last N orders
          const timeInterval = 25; // Number of previous orders to consider
          const startIndex = Math.max(0, i - timeInterval);
          const endIndex = i;
      
          for (let j = startIndex; j <= endIndex; j++) {
            const previousOrder = orderBookData[j];
            if (previousOrder.side.toLowerCase() === 'buy') {
              buyingPressure += previousOrder.size;
            } else if (previousOrder.side.toLowerCase() === 'sell') {
              sellingPressure += previousOrder.size;
            }
          }
        }
      
        const netBuyingPressure = buyingPressure - sellingPressure;
        const netSellingPressure = buyingPressure - sellingPressure;

        const totalPressure = buyingPressure + sellingPressure;
      
        // Determine the momentum direction
        let momentum = '';
        if (netBuyingPressure > 0) {
          momentum = 'Bullish';
        } else if (netBuyingPressure < 0) {
          momentum = 'Bearish';
        } else {
          momentum = 'Neutral';
        }
      
        const netBuyingPressurePercentage = ((netBuyingPressure / totalPressure) * 100).toFixed(2);
        const netSellingPressurePercentage = ((netSellingPressure / totalPressure) * 100).toFixed(2);
      
        return {
          buyingPressure,
          sellingPressure,
          netBuyingPressure,
          netSellingPressure,
          netBuyingPressurePercentage,
          netSellingPressurePercentage,
          momentum
        };
      },
      performOrderFlowAnalysis(orderBook, bids, asks) {
        // Calculate the cumulative bid and ask sizes
        let cumulativeBid = 0;
        let cumulativeAsk = 0;
      
        for (let i = 0; i < bids.length; i++) {
          cumulativeBid += bids[i].size;
          cumulativeAsk += asks[i].size;
        }
      
        // Calculate the imbalance
        const imbalance = cumulativeBid - cumulativeAsk;
      
        // Normalize the imbalance to a percentage
        const bidTotal = cumulativeBid;
        const askTotal = cumulativeAsk;
        const imbalancePercentage = this.normalizeImbalance(imbalance, bidTotal, askTotal);
      
        // Perform any other analysis or predictions here
      
        // Return the analysis result
        return {
          imbalance,
          imbalancePercentage,
          // Add other analysis results here
        };
      },
      
      // Function to normalize imbalance to a percentage
      normalizeImbalance(imbalance, bidTotal, askTotal) {
        const total = bidTotal + askTotal;
        const imbalancePercentage = (imbalance / total) * 100;
        return imbalancePercentage.toFixed(2); // Round to 2 decimal places
      },
      // Function for inferring sentiment and predicting future price movements
      inferSentiment(orderFlowAnalysis) {
        // Use the analyzed order flow data to infer sentiment
        // and potential future price movements
        // Perform any necessary calculations or inference logic

        // Example: Infer sentiment based on bid-ask imbalances
        let sentiment = '';
        if (orderFlowAnalysis.imbalance > 0) {
          sentiment = 'Bullish'; // More buying pressure
        } else if (orderFlowAnalysis.imbalance < 0) {
          sentiment = 'Bearish'; // More selling pressure
        } else {
          sentiment = 'Neutral'; // Balanced bid-ask quantities
        }

        // Return the inferred sentiment or any other predictions
        return {
          sentiment,
          // Add other predictions or insights here
        };
      },

      async getUndocumentedApi() {

        //response contains symbok info and contract tyoe an also image urls for icons amongst other data.
        const url2 = 'https://api2.bybit.com/v3/private/instrument/dynamic-symbol';
    
        try {
             const res = await axios.get(url2);

            if (res.data.ret_msg === 'OK') {
             
              this.LinearPerpetualSymbols = res.data.result.LinearPerpetual;
              this.InversePerpetualSymbols = res.data.result.InversePerpetual;
              this.InverseFuturesSymbols = res.data.result.InverseFutures;

              // console.log(LinearPerpetual);
              // console.log(InversePerpetual);
              // console.log(InverseFutures);

              let availableSymbols = new Map();

              for (let key of ['InverseFutures', 'InversePerpetual', 'LinearPerpetual']) {
                for (let symbol of res.data.result[key]) {
                  availableSymbols.set(symbol.symbolName, symbol);
                }
              }
    
               this.symbolInfo = availableSymbols.get(this.currentSymbol);
               console.log(this.symbolInfo);

    
               var testTickSize =  Number(parseFloat(this.symbolInfo.tickSize).toFixed(this.symbolInfo.tickSizeFraction));
               //console.log(testTickSize + " " + typeOf(testTickSize ));
        this.klineEndpoint
              // this.currentTickSize = parseFloat(this.symbolInfo.tickSize);
               //console.log(this.currentTickSize  + " " + typeOf(this.currentTickSize ));
               this.currentTickSize = testTickSize;

               this.currentQtyStep = parseFloat(this.symbolInfo.minQty);
               this.contractType = this.symbolInfo.contractType;

               this.baseCurrency  = this.symbolInfo.baseCurrency;
               this.quoteCurrency = this.symbolInfo.quoteCurrency;
               //console.log(this.contractType);

               if(this.contractType == "InversePerpetual"){
                    this.klineEndpoint = 'v2/public/kline/list?symbol=';
                    this.QueryActiveOrderEndpoint = 'v2/private/order';
                    this.PlaceOrderEndpoint = 'v2/private/order/create';
                    this.cancelOrderEndpoint = 'v2/private/order/cancel';
                    this.replaceOrderEndpoint = 'v2/private/order/replace';
                    this.cancelAllOrdersEndpoint ='v2/private/order/cancelAll';
                    this.setTradingStopEndpoint = 'v2/private/position/trading-stop';
                    this.positionUrl = 'v2/private/position/list';
                    console.log("Running Inverse Perpetual")

               }else if(this.contractType == "LinearPerpetual"){
                console.log("Running Linear Perpetual")
                        this.klineEndpoint = 'public/linear/kline/?symbol=';
                        this.QueryActiveOrderEndpoint ='private/linear/order/search';
                        this.PlaceOrderEndpoint = 'private/linear/order/create';
                        this.cancelOrderEndpoint = 'private/linear/order/cancel';
                        this.replaceOrderEndpoint = 'private/linear/order/replace';
                        this.cancelAllOrdersEndpoint = 'private/linear/order/cancel-all'; 
                        this.setTradingStopEndpoint = 'private/linear/position/trading-stop';
                        this.positionUrl = 'private/linear/position/list';
               }
            }

             } catch (error) {
  
                      console.log("Error retrieving data from Bybit url2");
                      console.log(error);
                      }
            },

    async getCoinIcons() {
      const url1 = 'https://api2.bybit.com/spot/s_api/basic/quote_tokens';
      const url2 = 'https://api2.bybit.com/v3/private/instrument/dynamic-symbol';
      var response1 = '';
      var response2 = '';
  
      this.symbolMap = new Map();

      try {
          const response2 = await axios.get(url2);
          Object.entries(response2.data.result).forEach(([property, data]) => {
              if (property === 'InverseFutures' || property === 'InversePerpetual' || property === 'LinearPerpetual') {
                    data.forEach(quoteTokenSymbols =>{
                       if (!this.symbolMap.has(quoteTokenSymbols.symbolName)) {
                            this.symbolMap.set(quoteTokenSymbols.symbolName, {
                          iconUrl: quoteTokenSymbols.lightIcon,
                          contractType: quoteTokenSymbols.contractType,
                          symbolTags: quoteTokenSymbols.symbolTags
                      });
                        }
                    });
                    }
                });


               /// console.log(this.symbolMap);
               console.log("get coins call finished");
               console.log(this.symbolMap);

           } catch (error) {

                    console.log("Error retrieving icons from Bybit url2");
                    console.log(error);
                    }
          },


        setPrice(data) {
         // console.log(data);

          if (data.type === 'snapshot') {
            this.lastPrice = parseFloat(data.data.last_price).toFixed(this.symbolInfo.priceFraction);
            this.markPrice = parseFloat(data.data.mark_price).toFixed(this.symbolInfo.priceFraction);
            this.funding = ((data.data.funding_rate_e6 / 1e6) * 100).toFixed(4);
            this.fundingTime = data.data.next_funding_time;
        
          }
          if (data.type === 'delta') {
           
            if (data.data.update[0].last_price) {
              this.lastPrice =  parseFloat(data.data.update[0].last_price).toFixed(this.symbolInfo.priceFraction);
            }
            if (data.data.update[0].mark_price) {
              this.markPrice =  parseFloat(data.data.update[0].mark_price).toFixed(this.symbolInfo.priceFraction);
            }
            if (data.data.update[0].funding_rate_e6) {
              this.funding = ((data.data.funding_rate_e6 / 1e6) * 100).toFixed(4);
            }
            if (data.data.update[0].next_funding_time) {
              this.fundingTime = data.data.update[0].next_funding_time
            }

          }

        this.PriceDifference();

        },PriceDifference(){

          let difference;
          if (this.lastPrice > this.markPrice) {
            difference = Number(this.lastPrice - this.markPrice).toFixed(this.symbolInfo.priceFraction);
          } else {
            difference = Number(this.markPrice - this.lastPrice).toFixed(this.symbolInfo.priceFraction);
          }
          this.lastPriceMarkPriceDifference = difference;

        },

        async getOpenInterest() {
          let data = {
            'symbol': this.currentSymbol,
            'period': "5min"
          };

          let options = {
            params: this.signData(data),
          };

          let res = await axios.get(this.url + '/v2/public/open-interest', options);
          if (res.data.ret_msg === 'OK') {
            this.openInterest = res.data.result;
            //console.log(this.openInterest);
         }
        },

        async getOrders() {
          try {
            let data = {
              'symbol': this.currentSymbol
            };
            let options = {
              params: this.signData(data),
            };
            let res = await axios.get(this.url + this.QueryActiveOrderEndpoint,
                options);

            if (res.data.ret_msg === 'ok' || res.data.ret_msg === 'OK') {
                this.openOrders = res.data.result;

            } else {
              console.log("Error here symbol " + this.currentSymbol);
              console.log(res.data);
              this.$notify({
                text: res.data.ret_msg,
                type: 'error',
              });
            }
          } catch (e) {
            console.error(e);
          }
        },
        initPositionInterval() {
          if (this.positionInterval) {
              //this.movedtoBreakeven = false;
              this.disablePositionInterval();
          }


          this.positionInterval = setInterval(this.getPosition, 1250);

        },
        disablePositionInterval() {
          clearInterval(this.positionInterval);
          this.breakevenPrice = 0;
          this.stopLoss = 0;
          this.takeProfit = 0;
          this.movedtoBreakeven = false;

        },openPositionDirection(){
          if(this.openPosition != null){
            if(this.openPosition.side == "Sell"){
              return "Sell";
            }else if(this.openPosition.side == "Buy"){
              return "Buy";
            }
          }else{
                return false;
          }

        },
       
        calculateEMA(period, kline) {
          const closePrices = kline.map(data => data.close);
          const emas = [];
          
          const alpha = 2 / (period + 1);
          let ema = closePrices[0];
          
          emas.push({ close: closePrices[0], ema: ema });
          
          for (let i = 1; i < closePrices.length; i++) {
            ema = alpha * closePrices[i] + (1 - alpha) * ema;
            emas.push({ close: closePrices[i], ema: parseFloat(ema.toFixed(1)) });
          }
          
          return emas;
        },

      

        calculateBreakevenPrice(moveTobreakeven){

          if(this.openPosition != null){

            var takerFeeToOpenUSD = ((this.openPosition.size/this.openPosition.entry_price) * 0.0006) * this.openPosition.entry_price;
            var takerFeeToCloseUSD = ((this.openPosition.size/this.openPosition.take_profit) * 0.0006) * this.openPosition.take_profit;

            var Reward = 0;
            var direction = this.openPositionDirection();
            var breakevenPrice = this.openPosition.entry_price;
            var totalTakerFee = 0;

              do{
                  Reward = this.openPosition.size * (Math.abs(this.openPosition.entry_price - breakevenPrice)) / breakevenPrice;
                  var takerFeeToCloseUSD = ((this.openPosition.size/breakevenPrice) * 0.0006) * breakevenPrice;

                  totalTakerFee = (takerFeeToOpenUSD + takerFeeToCloseUSD);
                  direction == "Buy" ? breakevenPrice += 0.5 : breakevenPrice -= 0.5;
              }while(Reward < totalTakerFee)

            console.log("Total Taker Fee " + parseFloat(totalTakerFee).toFixed(1) + " Breakeven Price " + breakevenPrice);

            if(moveTobreakeven == true){
              console.log("Moving to breakeven");
               this.setTradingStops(null, parseFloat(breakevenPrice).toFixed(1), null);
            }

            this.breakevenPrice = breakevenPrice;
            //emit breakeven price to the openPosition component

            return breakevenPrice;
          }

         },

        async getPosition() {
        
          try {

            let data = {
              //'symbol': this.currentSymbol
            };

          //  let data = {};
            let options = {
              params: this.signData(data),
            };
            var url = this.positionUrl;
      
            let res = await axios.get(this.url + url,
                options);
            if (res.data.ret_msg == 'ok' || res.data.ret_msg == 'OK') {

       
              const symbolToFind = this.currentSymbol;
              const index = res.data.result.findIndex(item => item.data.symbol === symbolToFind);


                 if (res.data.result[index].data.size > 0){

                   
                      this.openPosition = res.data.result[index].data;
                        
                      this.openPosition.realised_pnl = parseFloat(this.openPosition.realised_pnl);
                      this.walletBalance = parseFloat(this.openPosition.wallet_balance).toFixed(this.symbolInfo.walletBalanceFraction);
                      //this.walletBalance = parseFloat(parseFloat(this.openPosition.unrealised_pnl) + parseFloat(this.openPosition.wallet_balance)).toFixed(this.symbolInfo.walletBalanceFraction);
            
                     
                  }else{
                    this.openPosition = null;
                  }
 

                  
            } else {
              console.error(res);
              this.$notify({
                text: res.data.ret_msg +
                    ((res.data.ret_code === 10002) ? '<br> server_time : ' +
                        res.data.time_now + '<br> request_time : ' +
                        data.timestamp : ''),
                type: 'error',
              });
            }
          } catch (e) {
            console.error(e);
          }

        },
        async getBalance(currency) {
        //Shared endpoint
          try {
                     let data = {
                        'symbol': currency
                      };

                      let options = {
                        params: this.signData(data),
                      };
                      let res = await axios.get(this.url + '/v2/private/wallet/balance',
                          options);
                      if (res.data.ret_msg == 'ok' || res.data.ret_msg == 'OK') {
                          
                          return res.data.result;
                      } else {
                        console.error(res);
                        this.$notify({
                          text: res.data.ret_msg +
                              ((res.data.ret_code === 10002) ? '<br> server_time : ' +
                                  res.data.time_now + '<br> request_time : ' +
                                  data.timestamp : ''),
                          type: 'error',
                        });
                      }
                    } catch (e) {
                      console.error(e);
                    }

           

                  },

        makeid(length) {
          //Make an unique order ID
          var result           = '';
          var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          var charactersLength = characters.length;
          for ( var i = 0; i < length; i++ ) {
             result += characters.charAt(Math.floor(Math.random() * charactersLength));
          }
          return result;
        },
        marketClosePosition(size) {
          this.placeOrder({
            side: this.openPosition.side === 'Buy' ? 'Sell' : 'Buy',
            symbol: this.currentSymbol,
            order_type: 'Market',
            qty: size,
            time_in_force: 'GoodTillCancel',
          });

          this.$notify({
            text: "Placing Market Close Order for " + size + " Contracts",
            type: 'success',
          });

        },
        limitClosePosition(size, order_link_id) {

          this.placeOrder({
            side: this.openPosition.side === 'Buy' ? 'Sell' : 'Buy',
            symbol: this.currentSymbol,
            price: this.openPosition.side === 'Buy' ? this.bestAsk: this.bestBid,
            order_type: 'Limit',
            qty: size,
            order_link_id: order_link_id,
            time_in_force: 'PostOnly',
            close_on_trigger	: true
          });

          this.$notify({
            text: "Placing Limit Close Order for " + size + " Contracts",
            type: 'success',
          });

        }, async setTradingStops(takeProfit, stopLoss, trailingStop) {    

          let data = {
            symbol: this.currentSymbol
          };

          //confirm 1 direction mode as opposed to hedge mode
          if (this.contractType == "LinearPerpetual") {
            data.position_idx = 0;
          }

          if(takeProfit > 0){
            data.take_profit = takeProfit;
          }
          if(stopLoss > 0){
            data.stop_loss = stopLoss;
          }
          if(trailingStop > 0){
            data.trailing_stop = trailingStop;
          }

          try {
            let res = await axios.post(
                this.url + this.setTradingStopEndpoint,
                this.signData(data));
                

            if (res.data.ret_msg === 'ok') {
              console.log(res.data.ret_msg)
              this.$notify({
                text: 'Trading stops changed',
                type: 'success',
              });
            } else {
             
              this.$notify({
                text: res.data.ret_msg,
                type: 'error',
              });
            }

          } catch (e) {
            console.log("ERROR");
            console.error(e);
            this.$notify({
              text: e,
              type: 'error',
            });
          }
        },
        async placeOrder(data) {

          console.log(data);
        
          //confirm 1 direction mode as opposed to hedge mode
          if (this.contractType == "LinearPerpetual") {
             data.position_idx = 0;
          }
          try {
            let res = await axios.post(this.url + this.PlaceOrderEndpoint,
                this.signData(data));
            if (res.data.ret_msg === 'OK') {
              this.$notify({
                text: 'Order placed',
                type: 'success',
              });

              return res;
            } else {
              console.log(res);

              this.$notify({
   
                text: res.data.ret_msg,
                type: 'error',
              });

              console.log(res.data.ret_msg);
            }

          } catch (e) {
            console.error(e);
            this.$notify({
              text: e,
              type: 'error',
            });
          }

        },
        async cancelOrder(id) {
          try {
            let data = {
              order_id: id,
              symbol: this.currentSymbol,
            };

            let res = await axios.post(this.url + this.cancelOrderEndpoint,
                this.signData(data));
            if (res.data.ret_msg === 'OK') {
              this.$notify({
                text: 'Order cancelled',
                type: 'success',
              });
            } else {
              this.$notify({
                text: res.data.ret_msg,
                type: 'error',
              });
            }
          } catch (e) {
            console.error(e);
          }
        },
        async cancelAllOpenOrders() {
          try {
            let data = {
              symbol: this.currentSymbol,
            };

            let res = await axios.post(this.url + this.cancelAllOrdersEndpoint,
                this.signData(data));
            if (res.data.ret_msg === 'OK') {
              this.$notify({
                text: 'Orders cancelled',
                type: 'success',
              });
            } else {
              this.$notify({
                text: res.data.ret_msg,
                type: 'error',
              });
            }
          } catch (e) {
            console.error(e);
          }
        },async replaceActiveOrder(id, p_r_qty, p_r_price) {
          try {
            let data = {
              symbol: this.currentSymbol,
              order_link_id: id
            };

            if (p_r_qty) {
              data.p_r_qty = p_r_qty;
            }
            if (p_r_price) {
              data.p_r_price = p_r_price;
            }

            let res = await axios.post(this.url + this.replaceOrderEndpoint,
                this.signData(data));
            if (res.data.ret_msg === 'OK') {

              //modify the order in the openOrders array here TODO
             // console.log(res);
             // console.log(res.data);
              console.log("Limit Order Replaced");
              this.$notify({
                text: 'Order Replaced ',
                type: 'success',
              });

              return res.data.ret_msg;

            } else {
              if(res.data.ret_msg != "order not modified"){
                this.$notify({
                  text: res.data.ret_msg,
                  type: 'error',
                });
            }

              this.limitTPorderId = 0;

            }
          } catch (e) {
            console.log("error here " + e);
            console.error(e);
          }
        },
        async cancelAllBuyOpenOrders() {
          for (let i = 0; i < this.openOrders.length; i++) {
            if (this.openOrders[i].side === 'Buy') {
              this.cancelOrder(this.openOrders[i].order_id);
            }
          }
        },
        async cancelAllSellOpenOrders() {
          for (let i = 0; i < this.openOrders.length; i++) {
            if (this.openOrders[i].side === 'Sell') {
              this.cancelOrder(this.openOrders[i].order_id);
            }
          }
        },
        

        addOrder(order) {
          order.updated_at = order.timestamp;
          const index = this.openOrders.findIndex(o => o.order_id === order.order_id);
          if (index !== -1) {
             // this.openOrders[index] = order;
              this.$set(this.openOrders, index, order);
             // console.log(this.openOrders);
          } else {
              this.openOrders.push(order);
          }
      },
      removeOrder(order) {
          const index = this.openOrders.findIndex(o => o.order_id === order.order_id);
          if (index !== -1) {
              this.openOrders.splice(index, 1);
          }
          if (order.order_link_id === this.chaseOrderID){
              this.chaseOrderID = null;
              this.$notify({
                  text: "Chaser order for " + order.qty + " contracts has been filled. Shutting down chaser",
                  type: 'success',
              });
            
          }
      },
        httpHandler(data){
          this.direction = "";
          console.log(data);
          //var command = JSON.parse(data).text;
          // var high    = JSON.parse(data).high;
          // var low     = JSON.parse(data).low;
          // var price   = JSON.parse(data).price;

          // function CheckPosition(self){
              if(this.openPosition != null){
                  console.log("Position already open");

              }
                      this.cancelAllOpenOrders();

                      switch (data) {

                        case 'Long':

                        console.log("entering long");
                        clearInterval(this.LadderInterval);
                        this.cancelAllBuyOpenOrders();
                        this.enterPosition("Long");
                        var self = this;
                        this.LadderInterval = setInterval(function () {
                          self.cancelAllBuyOpenOrders();
                          self.enterPosition("Long");

                      }, 150000);

                        // this.LadderInterval = setInterval( this.enterPosition("Long"), 10000);
                        break;
                        case 'Short':
                          var self = this;
                          console.log("entering short");
                          clearInterval(this.LadderInterval);
                          this.cancelAllSellOpenOrders();
                          // this.LadderInterval = setInterval( this.enterPosition("Short"), 10000);
                          this.enterPosition("Short");
                          this.LadderInterval = setInterval(function () {
                            self.cancelAllSellOpenOrders();
                            self.enterPosition("Short");

                        }, 60000);
                        break;

                        default:
                          console.log(JSON.parse(data));
                          console.log(`Sorry, I did not recognise the command:  ${command}.`);


                   }
          // }



         },average: function(side) {
          let totalAll = 0;
          var totalQty = 0;
          for (let i = 0; i < this.generatedLadder.length; i++) {
            totalAll += this.generatedLadder[i].amount * this.generatedLadder[i].price;
            totalQty += this.generatedLadder[i].amount;
          }

          if(this.openPosition != null){
            totalAll += this.openPosition.size * this.openPosition.entry_price;
            totalQty += this.openPosition.size;
          }
          return (totalAll / totalQty);
        },
        calculateRisk(amount,side){

          this.average_entry = this.average(side);
          var riskUSD = amount*(Math.abs(this.average_entry-this.stopLoss))/this.average_entry;
          var riskPercent = riskUSD/(this.walletBalance * this.lastPrice) * 100;
          // console.log("Average Entry " + this.average_entry);
          return riskPercent;
        }, generateOrders(data) {
          return generateOrders(data);
        },
         enterPosition(side){

            function getPricesFromOrderBook(array, amount, minPrice, maxPrice) {
              var return_array = [];
              array.sort((a,b) => b.size - a.size);
              const new_array = array.slice(0, amount);

              for(const item of new_array) {
                if (item.price >= minPrice && item.price <= maxPrice) {
                  return_array.push(item.price);
               }
             }
              return return_array;
           }

          var amount = 10;
          var risk = 1;
          var data  = {}
          var Ladder = 0;
          var orders = 0;
          var atr = Number(this.ATRCalculation(10,this.KlineData5));
          var lastPrice = Number(this.lastPrice);

             var bid_prices = 0;
             var ask_prices = 0;

          if(side == "Long"){
            if (this.openPosition != null){
              if(this.openPosition.stop_loss <= 0 || this.openPosition.side == "Sell" ){
                 this.stopLoss = lastPrice - (atr*5);
              }else{
                 this.stopLoss = this.openPosition.stop_loss;
              }
            }else{
              this.stopLoss = lastPrice -  (atr*5);
            }

            bid_prices = getPricesFromOrderBook(this.bids, 15, lastPrice - (atr*3), lastPrice);
          }else if(side == "Short"){

            if (this.openPosition != null){
              if(this.openPosition.stop_loss <= 0 || this.openPosition.side == "Buy" ){
                this.stopLoss = lastPrice + (atr*5);
              }else{
                this.stopLoss = this.openPosition.stop_loss;
              }
            }else{
              this.stopLoss = lastPrice +  (atr*5);
            }

            ask_prices = getPricesFromOrderBook(this.asks, 15, lastPrice, lastPrice + (atr*3));
          }


          console.log("Stop loss " + this.stopLoss + " take profit " + this.takeProfit);
          do{
            this.generatedLadder = generateOrdersByPricePoints(amount, side == "Long" ? bid_prices : ask_prices , "Increasing", 30, this.currentTickSize);
            var RiskPercent = this.calculateRisk(amount, side);
            amount += 2;
            this.generatedLadder.amount = amount;
           }while(RiskPercent < risk);

           this.generatedLadder = generateOrdersByPricePoints(amount, side == "Long" ? bid_prices : ask_prices , "Increasing", 30, this.currentTickSize);

           side == "Long" ? this.calculateOrders('Buy', this.generatedLadder, false) : this.calculateOrders('Sell', this.generatedLadder,  false);

         },calculateOrders(side, orders, reduce, link_id) {

          this.orders = [];
          if (side === 'Buy') {

            console.log(orders);
            for (let i = orders.length - 1; i >= 0; i--) {
              let order = {
                side: side,
                symbol: this.currentSymbol,
                order_type: 'Limit',
                qty: orders[i].amount,
                price: orders[i].price,
                time_in_force: "PostOnly",
                reduce_only: reduce,
              };
              if (this.takeProfit && i === orders - 1) {
                 order.take_profit = this.takeProfit;
              }
              if (this.stopLoss && i == orders.length - 1) {
                order.stop_loss = Number(this.stopLoss);
              }
              if (link_id > 0) {
                  order.order_link_id = i + "_" + link_id + "_" + this.makeid(5);
              }

              this.orders.push(order);
            }
          } else {
             for (let i = 0; i < orders.length; i++) {
              let order = {
                side: side,
                symbol: this.currentSymbol,
                order_type: 'Limit',
                qty: orders[i].amount,
                price: orders[i].price,
                time_in_force: "PostOnly",
                reduce_only: reduce,
              };

              if (this.takeProfit && i == 0) {
                 order.take_profit = this.takeProfit;
              }

              if (i == 0) {
                order.stop_loss = this.stopLoss;
              }

              if (link_id > 0) {
                order.order_link_id = i + "_" + link_id + "_" + this.makeid(5);
             }

              //console.log(order);
              this.orders.push(order);
            }
            console.log(this.orders);``
          }

          console.log("Placing Orders");
          this.placeOrders();
        },placeOrders() {
          for (let i = 0; i < this.orders.length; i++) {
            this.placeOrder(this.orders[i]);
          }
        },ATRCalculation(period,klinetimeframe){

          var high = 0;
          var low = 0;
          var yesterdaysClose = 0;
          var trueRange = [];

         // for (let i = klinetimeframe.length-period; i < klinetimeframe.length; i++) {
       for (let i = 1; i < klinetimeframe.length; i++) {
            high = klinetimeframe[i].high;
            low  = klinetimeframe[i].low;
            yesterdaysClose = klinetimeframe[i-1].close;

            trueRange.push(Math.max(
              high - low,
              high - yesterdaysClose,
              yesterdaysClose - low
             ));

                if(trueRange.length > period){
                    var sum = 0;
                    if(this.ATR.length <= 0){
                            for(var x = 0; x < trueRange.length; x++){
                              sum += trueRange[x];
                             }
                             this.ATR.push(sum/period);

                    }else{
                            //Current this.ATR = [(Prior this.ATR x 13) + Current TR] / 14
                            var atrcalc  = ((this.ATR[this.ATR.length-1] * (period-1)) + trueRange[trueRange.length-1]) / period;
                            this.ATR.push(atrcalc);

                          }
                  }
         }

          var currentatr = parseFloat(parseFloat(this.ATR[this.ATR.length-1]).toFixed(1));
          return currentatr;

        },async getHistoricOHLC(SecondsLookback, DataArray, Interval, symbol, endpoint) {
        
          let coin = symbol !== undefined ? symbol : this.currentSymbol;

          var TimeStamp = floor(Date.now() / 1000)
              TimeStamp =  TimeStamp - SecondsLookback;
          try {
            let data = {};
            var res = 0
            if(endpoint !== undefined){
                 res = await axios.get(this.url + endpoint + coin + '&interval='+ Interval +'&from=' + TimeStamp);
            }else{
                 res = await axios.get(this.url + this.klineEndpoint + coin + '&interval='+ Interval +'&from=' + TimeStamp);
            }

            //console.log(res);
          if (res.data.ret_msg == "OK") {
               for (let i = 0; i < res.data.result.length; i++) {
                res.data.result[i].close  = parseFloat(res.data.result[i].close);
                res.data.result[i].open   = parseFloat(res.data.result[i].open);
                res.data.result[i].high   = parseFloat(res.data.result[i].high);
                res.data.result[i].low    = parseFloat(res.data.result[i].low);
                res.data.result[i].volume = parseFloat(res.data.result[i].volume);
                DataArray.unshift(res.data.result[i]);
                }
               // console.log("Got historic data for " + Interval + " interval");
                  
            } else {
              console.log('error');
              console.error(res);
              this.$notify({
                text: res.data.ret_msg +
                    ((res.data.ret_code === 10002) ? '<br> server_time : ' +
                        res.data.time_now + '<br> request_time : ' +
                        data.timestamp : ''),
                type: 'error',
              });
            }
          } catch (e) {
            console.error(e);
          }
        },

        bollingerBandWidth(dataArray, length, multiplier) {
          const closePrices = dataArray.map(data => data.close);
          const basis = closePrices.slice(-length).reduce((sum, x) => sum + x, 0) / length;
          const deviation = multiplier * Math.sqrt(
            closePrices.slice(-length).reduce((sum, x) => sum + (x - basis) ** 2, 0) / length
          );
          const upperBand = basis + deviation;
          const lowerBand = basis - deviation;
          return parseFloat((upperBand - lowerBand) / basis).toFixed(4);
        },
      
        
       async MarketScan(){

        var endpoint = "";
        const symbolArrays = [this.InversePerpetualSymbols, this.InverseFuturesSymbols, this.LinearPerpetualSymbols];
     
        for (const symbolArray of symbolArrays) {
           
          for (let x = 0; x < symbolArray.length; x++) {
              if (symbolArray === this.InversePerpetualSymbols) {
                endpoint = "v2/public/kline/list?symbol=";
              } else if (symbolArray === this.InverseFuturesSymbols) {
                endpoint = "v2/public/kline/list?symbol=";
              } else if (symbolArray === this.LinearPerpetualSymbols) {
                endpoint = "public/linear/kline/?symbol=";
              }
              
              this.MarketScanner = [];
               
              await this.getHistoricOHLC(this.convertToSeconds("hours", 36), this.MarketScanner, 15, symbolArray[x].symbolName, endpoint);
              let bbwp = this.bollingerBandWidth(this.MarketScanner, 120, 2);
              this.BBwidth[symbolArray[x].symbolName] = bbwp;

              this.MarketScanner = [];
              await this.getHistoricOHLC(this.convertToSeconds("days", 100), this.MarketScanner, "D", symbolArray[x].symbolName, endpoint);
              this.scannerSupportResistance[symbolArray[x].symbolName] = this.getSupportAndResistance(this.MarketScanner);

              this.MarketScanner = [];
              await this.getHistoricOHLC(this.convertToSeconds("hours", 3 ), this.MarketScanner, "60", symbolArray[x].symbolName, endpoint);
              this.Trend[symbolArray[x].symbolName] = this.getTrend(this.MarketScanner);
              
             // console.log("Got data for " + symbolArray[x].symbolName );
            }
          
        }

       console.log("market scan call finished");
       console.log(this.Trend);
       console.log(this.BBwidth);
       console.log(this.scannerSupportResistance);
       },
      getSupportAndResistance(data) {
        let supportPrices = [];
        let resistancePrices = [];
      
        function searchArray(arr, symbol) {
          let lastPrice;
          arr.forEach((obj) => {
            if (obj.symbol === symbol) {
              lastPrice = obj.last_price;
            }
          });
          return lastPrice;
        }
      
       // console.log(data);
      //  console.log("Symbol = " + data[0].symbol);
        let currentPrice = searchArray(this.Tickers, data[0].symbol);
      
        data.reverse();
      
        for (let i = 1; i < data.length; i++) {
          let prev = data[i - 1];
          let current = data[i];
      
          if (current.low <= prev.low && current.low < currentPrice) {
            supportPrices.push(current.low);
          }
          if (current.high >= prev.high && current.high > currentPrice) {
            resistancePrices.push(current.high);
          }
        }
      
        let closestSupport = Number.MAX_VALUE;
        let closestResistance = Number.MIN_VALUE;
      
        for (let support of supportPrices) {
          if (Math.abs(support - currentPrice) < Math.abs(closestSupport - currentPrice)) {
            closestSupport = support;
          }
        }
      
        for (let resistance of resistancePrices) {
          if (Math.abs(resistance - currentPrice) < Math.abs(closestResistance - currentPrice)) {
            closestResistance = resistance;
          }
        }
      
        let supportPercentChange = closestSupport !== Number.MAX_VALUE ? parseFloat(((currentPrice - closestSupport) / currentPrice * 100).toFixed(2)) : null;
        let resistancePercentChange = closestResistance !== Number.MIN_VALUE ? parseFloat(((closestResistance - currentPrice) / currentPrice * 100).toFixed(2)) : null;
      
        // calculate the risk to reward ratio for a long position
        let longRR = closestSupport !== Number.MAX_VALUE && closestResistance !== Number.MIN_VALUE
          ? parseFloat(((closestResistance - currentPrice) / (currentPrice - closestSupport)).toFixed(2))
          : null;
      
        // calculate the risk to reward ratio for a short position
        let shortRR = closestSupport !== Number.MAX_VALUE && closestResistance !== Number.MIN_VALUE
          ? parseFloat(((currentPrice - closestSupport) / (closestResistance - currentPrice)).toFixed(2))
          : null;
      
        return {
          support: closestSupport !== Number.MAX_VALUE ? parseFloat(closestSupport) : null,
          supportPercentChange: parseFloat(supportPercentChange) ,
          resistance: closestResistance !== Number.MIN_VALUE ? parseFloat(closestResistance) : null,
          resistancePercentChange: parseFloat(resistancePercentChange) ,
          longRR: longRR,
          shortRR: shortRR,
        };
      },

      
     getTrend(candlesticks) {
        if (candlesticks.length < 3) {
          return false;
        }
      
        let isBullishBreakout = false;
        let isBearishBreakout = false;
        let isSwingLow = false;
        let isSwingHigh = false;
      
        const lastCandle = candlesticks[candlesticks.length - 1];
        const middleCandle = candlesticks[candlesticks.length - 2];
        const firstCandle = candlesticks[candlesticks.length - 3];
      
        const middleLow = Math.min(firstCandle.low, middleCandle.low, lastCandle.low);
        const middleHigh = Math.max(firstCandle.high, middleCandle.high, lastCandle.high);


        if (lastCandle.close > lastCandle.open && lastCandle.close <= middleCandle.high && lastCandle.high <= middleCandle.high &&  lastCandle.close > (middleCandle.high + middleCandle.low) / 2) {
          isBullishBreakout = true;
        }
        if (lastCandle.close < lastCandle.open && lastCandle.close >= middleCandle.low  && lastCandle.low >= middleCandle.low && lastCandle.close < (middleCandle.high + middleCandle.low) / 2) {
          isBearishBreakout = true;
        }
        if (middleCandle.high > firstCandle.high && middleCandle.high > lastCandle.high) {
          isSwingHigh = true;
        }
        if (middleCandle.low < firstCandle.low && middleCandle.low < lastCandle.low) {
          isSwingLow = true;
        }
      
        if (isBullishBreakout && isSwingLow) {
          return 'Bullish Breakout';
        }
        if (isBearishBreakout && isSwingHigh) {
          return 'Bearish Breakout';
        }

        return false;
      }
      
      ,
         convertToSeconds(timeUnit, amount) {
          switch (timeUnit) {
            case "minutes":
              return amount * 60;
            case "hours":
              return amount * 60 * 60;
            case "days":
              return amount * 60 * 60 * 24;
            case "weeks":
              return amount * 60 * 60 * 24 * 7
            case "months":
              return amount * 60 * 60 * 24 * 30;
            default:
              return null;
          }
        },ladderOut() {

          var atr = parseFloat(this.ATRCalculation(10,this.KlineData5));

          if(this.openPosition.side == "Buy"){
            let data = {
              amount: this.openPosition.size,
              orderCount: 20,
              priceLower: parseFloat(this.lastPrice) + Number(Math.abs((atr*3))),
              distribution:this.openPositionDirection() == "Sell" ? ORDER_DISTRIBUTIONS.DECREASING.label : ORDER_DISTRIBUTIONS.INCREASING.label,
              tickSize: this.currentTickSize,
              coefficient: parseInt(30),
              }

              data.priceUpper = Number(data.priceLower) + Number(Math.abs((atr*3))),

              console.log("upper Price " + data.priceUpper + " Lower Price " + data.priceLower);
              this.generatedLadder = this.generateOrders(data);
              //console.log(this.generatedLadder);
              this.calculateOrders('Sell', this.generatedLadder, true);

          }else if(this.openPosition.side == "Sell"){
            console.log("lastPrice " + this.lastPrice)
            var upperPrice = parseFloat(this.lastPrice) - Number(Math.abs(atr*3));
            console.log("upperPrice " + upperPrice)

            let data = {
              amount: this.openPosition.size,
              orderCount: 20,
              priceUpper: upperPrice,
              distribution:this.openPositionDirection() == "Sell" ? ORDER_DISTRIBUTIONS.DECREASING.label : ORDER_DISTRIBUTIONS.INCREASING.label,
              tickSize: this.currentTickSize,
              coefficient: parseInt(30),
              }

              data.priceLower = Number(data.priceUpper) - Number(Math.abs((atr*3))),

              console.log("upper Price " + data.priceUpper + " Lower Price " + data.priceLower);
              this.generatedLadder = this.generateOrders(data);
              console.log(this.generatedLadder);
              this.calculateOrders('Buy', this.generatedLadder, true);
          }

          console.log("Placing Orders");
          this.placeOrders();

      },
        signData(data) {
          data.api_key = this.account.apiKey;
          data.timestamp = Date.now() - 2000;
          data.recv_window = 25000;
          let dataString = this.objToString(this.sortObject(data));
          data.sign = CryptoJS.HmacSHA256(dataString, this.account.apiSecret).
              toString();
          return this.sortObject(data);
        },
        sortObject(o) {
          let sorted = {},
              key,
              a = [];
          for (key in o) {
            if (o.hasOwnProperty(key)) {
              a.push(key);
            }
          }
          a.sort();
          for (key = 0; key < a.length; key++) {
            sorted[a[key]] = o[a[key]];
          }
          return sorted;
        },
        objToString(data) {
          return Object.keys(data).map(function(k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
          }).join('&');
        },
        getDataFromLocalStorage() {
          if (localStorage.accounts !== undefined) {
            this.accounts = JSON.parse(localStorage.accounts);
          }
          if (localStorage.account) {
            this.account = JSON.parse(localStorage.account);
          }
          if (localStorage.currentSymbol) {
            this.currentSymbol = localStorage.currentSymbol;
          }
          if (localStorage.autoconnect !== undefined) {
            this.autoconnect = localStorage.autoconnect === 'true';
          }
          if (localStorage.startingBalance !== undefined) {
            this.startingBalance = localStorage.startingBalance;
          }
          if (localStorage.targetPercentage !== undefined) {
            this.targetPercentage = localStorage.targetPercentage;
          }
        },
      },
      created() {
        this.getDataFromLocalStorage();
        this.init();
      },
      watch: {
        autoconnect(autoconnect) {
          localStorage.autoconnect = autoconnect;
        },
        startingBalance(startingBalance) {
          localStorage.startingBalance = startingBalance;
        },
        targetPercentage(targetPercentage) {
          localStorage.targetPercentage = targetPercentage;
        },

        apiKey(apiKey) {
          this.account.apiKey = apiKey.trim();
          localStorage.apiKey = apiKey.trim();
        },
        apiSecret(apiSecret) {
          this.apiSecret = apiSecret.trim();
          localStorage.apiSecret = apiSecret.trim();
        },
        currentSymbol(currentSymbol) {
          localStorage.currentSymbol = currentSymbol;
        },
        account: {
          deep: true,
          handler(account) {
            account.apiSecret = account.apiSecret.trim();
            account.label = account.label.trim();
            account.apiKey = account.apiKey.trim();
            localStorage.account = JSON.stringify(account);
          },
        },
        accounts: {
          deep: true,
          handler(accounts) {
            localStorage.accounts = JSON.stringify(accounts);
          },
        },
      },
    });
  },
};