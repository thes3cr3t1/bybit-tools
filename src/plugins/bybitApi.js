import { mdiBriefcaseClock, mdiCommentSearchOutline, mdiConsoleNetworkOutline, mdiContentSaveEditOutline } from '@mdi/js';
import axios from 'axios'; 
import CryptoJS from 'crypto-js';
import { slice } from 'lodash';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { ORDER_DISTRIBUTIONS } from '../../src/components/Home/LadderOrdersForm/constants';
import { generateOrders, generateOrdersByPricePoints } from '../../src/components/Home/LadderOrdersForm/scaledOrderGenerator';
import { floor, abs, max, round, min, typeOf} from 'mathjs'
import { closePosition } from '../../src/components/Home/ScalpForm';
import { Console } from 'console';
import { RSI, ATR } from 'technicalindicators'
import BotManager from './BotManager.js';

var http = require('http');
var crypto = require('crypto');

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
        openOrdersV5:[],
        openPosition: null,
        openPositionLinear: [],
        openPositionV5: {
          inverse: {},
          linear: {},
      },
        availableSymbols: ['BTCUSD', 'ETHUSD'],
        AllSymbols:[],
        currentSymbol: 'BTCUSD',
        quoteCurrency:"USD",
        baseCurrency:"BTC",
        contractType:"InversePerpetual",
        startingBalance:0,
        targetPercentage:0,
        riskPercentage: 0,
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
        rsiValues:[],
        atrValues:[],
        scannerSupportResistance:[],
        Trend:[],
        Liquidations:[],
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
        currentCandle:[],
        botManager:[],
        tradingBots:[],
      
       
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
         if (this.account.apiKey && this.account.apiSecret && this.autoconnect) {
        
               this.balances = await this.getBalance(this.baseCurrency);  
               console.log(this.balances);


                if(this.contractType == "LinearPerpetual"){
                    this.url = this.urls.mainnetUSDTPerp.url;
                    this.wsUrl = this.urls.mainnetUSDTPerp.wsUrlPublic;
                    this.wsUrlPrivate = this.urls.mainnetUSDTPerp.wsUrlPrivate;
                    this.walletBalance = parseFloat(this.balances["USDT"].wallet_balance).toFixed(this.symbolInfo.walletBalanceFraction);


                }else if(this.contractType == "InversePerpetual"){
                      this.url = this.urls.mainnet.url;
                      this.wsUrl = this.urls.mainnet.wsUrl;
                      this.walletBalance = parseFloat(this.balances["BTC"].wallet_balance).toFixed(this.symbolInfo.walletBalanceFraction);
                      
                }

               
                console.log("Symbol " + this.currentSymbol + " base_currency " + this.baseCurrency + " quote_currency " + this.quoteCurrency + " Contract " + this.contractType + " Base currency wallet balance " + this.walletBalance)
            
            setTimeout(() => {
              // this.getHistoricOHLC(this.convertToSeconds("minutes", 55 ), this.KlineData1, 1);
              // this.getHistoricOHLC(this.convertToSeconds("hours", 10), this.KlineData5, 5);              
              // this.getHistoricOHLC(this.convertToSeconds("weeks", 3 ), this.KlineData30, 30);
              this.initPositionInterval();
              this.getOrdersV5(this.currentSymbol);
            }, 1000);
            
    

            // setTimeout(() => {

               this.initWs();
               this.getTickers();
            //   let supportResistance15 = [];
            //   let supportResistance30 = [];

            //   supportResistance15 = this.getSupportAndResistance(this.KlineData5);
            //   supportResistance30 = this.getSupportAndResistance(this.KlineData30);

            //   this.$set(this.supportResistance, '15 Min', supportResistance15);
            //   this.$set(this.supportResistance, '30 Min', supportResistance30);

            // }, 3000);

             setTimeout(() => {
                 this.runMarketMaker();
             },7000);

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
          this.openOrdersV5 = [];
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
          this.openOrdersV5 = [];
          this.openPosition = null;
          this.movedtoBreakeven = false;
          this.init();
        }, 
        async getTickers(symbol) {
          //this is used by headers to populate the menu, think it can be removed or replaced though
          let data = {
            'symbol': symbol,
          };

          let options = {
            params: this.signData(data),
          };

          let res = await axios.get(this.url + '/v2/public/tickers', options);
          if (res.data.ret_msg === 'OK') {
           // console.log(res);

            if(!symbol){
             this.Tickers = res.data.result;
            }

            return res.data;
         }else{
          console.log(res);
         }
        },
        async initWs() {
          //initialize websocket

          console.log("connecting websocket " + this.currentSymbol + " URL " + this.wsUrl);

            //await this.getHistoricOHLC(this.convertToSeconds("hours", 1), this.ohlc, 1, this.ticker, "v2/public/kline/list?symbol=");
           // var wsUrl = 'wss://stream.bybit.com/realtime';
            var wsUrl = this.wsUrl;
            var wsUrlPrivate = "wss://stream.bybit.com/v5/private";
            this.ws = new ReconnectingWebSocket(`${wsUrl}`);
            this.wsPrivate = new ReconnectingWebSocket(`${wsUrlPrivate}`);
      
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
                  //this.ws.send( '{"op":"subscribe","args":["klineV2.1.' + this.currentSymbol+ '"]}');
                  this.ws.send(' {"op":"subscribe","args":["instrument_info.100ms.' + this.currentSymbol + '"]}');
                    
               }, 100);

               console.log("connecting websocket " + this.currentSymbol + " URL " + this.wsUrlPrivate);

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
              };
      
              this.wsPrivate.onmessage = (e) => {
                let data = JSON.parse(e.data);
                switch (data.topic) {
                  case 'wallet' :
                        // Iterate coins array
                        for(let i = 0; i < data.data[0].coin.length; i++) {

                          // Get current coin
                          const coin = data.data[0].coin[i]

                          // Check if match
                          if(coin.coin === this.quoteCurrency) {

                            // Extract wallet balance
                            this.walletBalance = coin.walletBalance
                            this.balances['USDT'].wallet_balance = coin.walletBalance;
                            console.log("Balance Changed " + coin.walletBalance);

                            // Break loop once found
                            break; 
                          }

                        }

    
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
                    console.log(data);
                  break;
                }
              };
            
      
            this.ws.onmessage = (e) => {
              let data = JSON.parse(e.data);
              switch (data.topic) {
               
                case 'instrument_info.100ms.' + this.currentSymbol + '' :
                  this.setPrice(data);
                  //console.log(data);
                break;
              
      
                // case 'klineV2.1.' + this.ticker + '':
                     
                //   if(data.data[0].confirm == true){
                //     this.ohlc.push(data.data[0]);
                //     this.ohlc.shift();
               
                //   }else{
                //         this.ohlc[this.ohlc.length-1] = data.data[0];
                //   }
      
                //   this.rsi = this.bybitApi.rsi(this.ohlc, 14);
                //   //console.log(this.rsi);
      
                // break;
      
      
                default :
                 // console.log(data.topic);
                  //console.log(data);
                break;
              }
            };
      
          }
          
        },

      ////////////////////
      runMarketMaker() {
                          
             var Ticker = "1000PEPEUSDT";
             var SymbolInfo = this.AllSymbols.get(Ticker);
             const manager = new BotManager(SymbolInfo, this);  
            // export const manager = new BotManager(SymbolInfo, this);  
             manager.run();

           // console.log(manager);

           //  console.log(manager.bots);

             this.botManager = manager;


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
               this.AllSymbols = availableSymbols;
               console.log(availableSymbols);
               console.log(this.symbolInfo);

    
               var testTickSize =  Number(parseFloat(this.symbolInfo.tickSize).toFixed(this.symbolInfo.tickSizeFraction));
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
      console.log("getting coin icons function called");
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
              // console.log(this.symbolMap);

           } catch (error) {

                    console.log("Error retrieving icons from Bybit url2");
                    console.log(error);
                    }
          },


        setPrice(data) {

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

        initPositionInterval() {
          if (this.positionInterval) {
              this.disablePositionInterval();
          }


          //this.positionInterval = setInterval(this.getPosition, 2000);
          //setInterval(this.getPositionLinear, 1000);
          setInterval(this.getPositionV5, 1500);

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

      

        calculateBreakevenPrice(moveToBreakEven){ 

          var avgPrice =  parseFloat(this.openPosition.avgPrice);
           
          if(this.openPosition != null){
            
            var takerFeeToOpenUSD = ((this.openPosition.size/avgPrice ) * 0.0006) * avgPrice;
            var takerFeeToCloseUSD = ((this.openPosition.size/this.openPosition.takeProfit) * 0.0006) * this.openPosition.takeProfit;
    
            var Reward = 0;
      
            var breakevenPrice = avgPrice;
            var totalTakerFee = 0;
            
              do{
                  Reward = this.openPosition.size * (Math.abs(avgPrice - breakevenPrice)) / breakevenPrice;
                  var takerFeeToCloseUSD = ((this.openPosition.size/breakevenPrice) * 0.0006) * breakevenPrice;
    
                  totalTakerFee = (takerFeeToOpenUSD + takerFeeToCloseUSD);
                  this.openPosition.side == "Buy" ? breakevenPrice += parseFloat(this.symbolInfo.tickSize) : breakevenPrice -= parseFloat(this.symbolInfo.tickSize);
              }while(Reward < totalTakerFee)
              breakevenPrice = parseFloat(breakevenPrice).toFixed(this.symbolInfo.tickSizeFraction);
              
          this.breakEven = breakevenPrice;
          }
          
          console.log("Total Taker Fee " + parseFloat(totalTakerFee).toFixed(2) + " Breakeven Price " + this.breakEven);

          if(moveToBreakEven == true){
            this.setTradingStops(null,parseFloat(this.breakEven).toFixed(this.symbolInfo.tickSizeFraction), null, null,null);
          }
          return this.breakEven;
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
                      
                      let res = await axios.get(this.url + 'v2/private/wallet/balance',
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
        marketClosePosition(size, contract) {
          this.placeOrder({
            side: this.openPosition.side === 'Buy' ? 'Sell' : 'Buy',
            symbol: this.currentSymbol,
            order_type: 'Market',
            qty: size,
            time_in_force: 'GoodTillCancel',
          }, contract);

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

        }, async setTradingStops(takeProfit, stopLoss, trailingStop, contract, symbol) {    
     
          let useSymbol = this.currentSymbol;
          let useContract = this.contractType;

          if (symbol) {
            useSymbol = symbol;
          }
          if (contract) {
            useContract = contract;
          }

          let data = {
            symbol: useSymbol,
            contract: useContract 
          };

          //confirm 1 direction mode as opposed to hedge mode
          if (useContract == "LinearPerpetual") {
            data.position_idx = 0;
            this.setTradingStopEndpoint = 'private/linear/position/trading-stop';
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
         // console.log(this.setTradingStopEndpoint + " " + data.symbol);
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

        checkCategory(symbol) {
          // Convert the input string to lowercase for case-insensitive matching
         // console.log(symbol);
          const lowercaseString = symbol.toLowerCase();
          let category = "";
          if (lowercaseString.endsWith("usd")) {
            //console.log("String ends with 'usd'");
            category = "inverse";
          } else if (lowercaseString.endsWith("usdt")) {
           // console.log("String ends with 'usdt'");
            category = "linear";
          } 

          return category;
        },

        async getOrdersV5(symbol) {
          
          var data = {
                      settleCoin:'BTC'
                     };

          data.category = this.checkCategory(symbol);

          let dataString = this.objToString(this.sortObject(data));
          try {           
                var response = await this.http_requestV5('/v5/order/realtime', "GET", dataString, "Get Orders");

                if (response.data.retMsg === 'OK') {
                  //console.log("Response OK");
                  //console.log(response.data.result.list);
                  return  response.data.result.list;

                } else {
                  console.log("Error here symbol " + symbol);
                  console.log(response.data);
                  this.$notify({
                    text:  response.data.retMsg,
                    type: 'error',
                  });
               }
        } catch (e) {
          console.error(e);
        }
      },
        async getPositionV5() {
            //Get Open Position List
            var endpoint="/v5/position/list"
                        
            var dataInverse = {category: 'inverse',
                               settleCoin:'BTC'
                              };

            let inversedataString = this.objToString(this.sortObject(dataInverse));

            var dataLinear = {category: 'linear',
                              settleCoin:'USDT'
                             };

            let lineardataString = this.objToString(this.sortObject(dataLinear));
                
            try {
                  var inverseResponse = await this.http_requestV5(endpoint, "GET", inversedataString, "Get Position Info");
                  var linearResponse  = await this.http_requestV5(endpoint, "GET", lineardataString, "Get Position Info");

                  const mergedResponse = {
                    inverse: inverseResponse.data.result.list,
                    linear: linearResponse.data.result.list
                  };

                  // Iterate through the mergedResponse
                      const symbolsInThisIteration = {};

                      for (const category in mergedResponse) {

                          if(Array.isArray(mergedResponse[category])) {

                              for (const position of mergedResponse[category]) {
                                // Use the symbol as the key to organize the data within the respective category
                                if (!this.openPositionV5[category][position.symbol]) {
                                  this.openPositionV5[category][position.symbol] = [];
                                }
                                this.openPositionV5[category][position.symbol] = position;

                                //if the open position is equal to the current active symbol then use that as the wallet balance
                                if(position.symbol == this.currentSymbol){
                                    this.openPosition = position;
                                   // console.log("Here2222");
                                 //console.log(this.openPosition);
                                    //this.openPosition.realised_pnl = parseFloat(this.openPosition.realised_pnl);
                                   // this.walletBalance = parseFloat(position.positionBalance).toFixed(this.symbolInfo.walletBalanceFraction);
                                   //this.walletBalance = parseFloat(position.positionBalance);
                                }

                                // Add the symbol to the tracking object
                                symbolsInThisIteration[position.symbol] = true;
                              }
                          }
                      }

                      // Remove symbols from openPositionV5 that are not in this iteration
                      for (const category in this.openPositionV5) {
                        if(Array.isArray(mergedResponse[category])) {
                              for (const symbol in this.openPositionV5[category]) {
                                if (!symbolsInThisIteration[symbol]) {
                                  delete this.openPositionV5[category][symbol];
                                }
                              }
                        }
                    }
          // console.log(this.openPositionV5);

            }catch (error) {
                  console.log(this.openPositionV5);
                  console.error(error);
            }
        },
        
        async placeOrderV5(data) {
          
          //determine if the category is inverse or linear
          data.category = this.checkCategory(data.symbol);

         // console.log(data);

          try {
            let res = await axios.post(this.url + '/v5/order/create',
                this.signData(data));
            if (res.data.retMsg === 'OK') {
              this.$notify({
                text: 'Order placed',
                type: 'success',
              });

              return res;
            } else {
              console.log(res);

              this.$notify({
   
                text: res.data.retMsg,
                type: 'error',
              });

              console.log(res.data.retMsg);
            }

          } catch (e) {
            console.error(e);
            this.$notify({
              text: e,
              type: 'error',
            });
          }

        },

        async cancelAllOpenOrdersV5(symbol) {
          try {
            let data = {
              symbol: symbol,
            };

            data.category = this.checkCategory(data.symbol);

            let res = await axios.post(this.url + '/v5/order/cancel-all',
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
        },


        async placeOrder(data, contract) {

          console.log(data);
          var endpoint = 0;
        
          //confirm 1 direction mode as opposed to hedge mode
        if (this.contractType == "LinearPerpetual" || contract == "LinearPerpetual") {
             data.position_idx = 0;
             endpoint = "private/linear/order/create";
          }else{
              endpoint = this.PlaceOrderEndpoint;
          }
          try {
            let res = await axios.post(this.url + endpoint,
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
        async cancelAllOpenOrders(symbol) {
          try {

            let data = {
              symbol: symbol > 0 ? symbol : this.currentSymbol,
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
        },  async cancelAllOpenOrdersLinear(symbol) {
          try {
            let data = {
              symbol: symbol,
            };

            let res = await axios.post(this.url + 'private/linear/order/cancel-all',
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
      average: function(side) {
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
        calculateOrders(side, orders, reduce, link_id) {

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

        rsi(dataArray, length) {


          const closePrices = dataArray.map(data => data.close);

          const reversedPrices = closePrices.reverse();
        
          // Construct RSI instance using new
          const rsi = new RSI({values: reversedPrices, 
            period: length}); 
          
          const rsiArray = rsi.getResult();
          
          const currentRsi = rsiArray.slice(-1)[0];

          //console.log(currentRsi);
        
          return rsiArray;
        
        },

        
          atr(dataArray, period) {

            const highPrices = dataArray.map(data => data.high);
            const lowPrices = dataArray.map(data => data.low);
            const closePrices = dataArray.map(data => data.close);

            const reversedData = {
              high: highPrices.reverse(),
              low: lowPrices.reverse(),
              close: closePrices.reverse()
            };

            const atr = new ATR({
              high: reversedData.high, 
              low: reversedData.low,
              close: reversedData.close,
              period: period
            });

            const atrArray = atr.getResult();

            const currentAtr = atrArray.slice(-1)[0];

            return currentAtr;

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

              console.log("Getting data for  " + symbolArray[x].symbolName );
              
              this.MarketScanner = [];
               
              await this.getHistoricOHLC(this.convertToSeconds("hours", 38), this.MarketScanner, 15, symbolArray[x].symbolName, endpoint);

              let Rsi = this.rsi(this.MarketScanner, 14);
              this.rsiValues[symbolArray[x].symbolName] = Rsi;
              var candleData = this.MarketScanner.reverse().slice(14);

              //latest data at the end of the array

              let ATR = this.atr(this.MarketScanner, 14);
              let CurCandleRange = Math.abs(candleData[candleData.length - 1].high - candleData[candleData.length - 1].low);
              let PercentageRange = (CurCandleRange / ATR) * 100;
              const atrPercentage = (ATR / candleData[candleData.length - 1].close) * 100;
              
              //this.atrValues[symbolArray[x].symbolName] = PercentageRange.toFixed(2) + "%";
              
              this.atrValues[symbolArray[x].symbolName] = atrPercentage.toFixed(2);

              this.scannerSupportResistance[symbolArray[x].symbolName] = this.getSupportAndResistance(this.MarketScanner);

              this.MarketScanner = [];
              //await this.getHistoricOHLC(this.convertToSeconds("hours", 2 ), this.MarketScanner, 3, symbolArray[x].symbolName, endpoint);    
              this.Trend[symbolArray[x].symbolName] = this.getTrend(candleData, this.rsiValues[symbolArray[x].symbolName], this.atrValues[symbolArray[x].symbolName], this.scannerSupportResistance[symbolArray[x].symbolName].support, this.scannerSupportResistance[symbolArray[x].symbolName].resistance , symbolArray[x].symbolName, endpoint);          
              //console.log(this.Trend);
            }
        }

       console.log("market scan call finished");
       console.log(this.Trend);
       console.log(this.rsiValues);
       console.log(this.atrValues);
       console.log(this.scannerSupportResistance);
       console.log(this.Tickers);

       return this.rsiValues;
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
      
        let currentPrice = searchArray(this.Tickers, data[0].symbol);
      
        data.reverse();
      
        for (let i = 1; i < data.length; i++) {
            let prev = data[i - 1];
            let current = data[i];
      
            if (current.low <= prev.low && current.low < currentPrice && Math.abs(current.low - currentPrice) / currentPrice > 0.01) {
                supportPrices.push(current.low);
            }
            if (current.high >= prev.high && current.high > currentPrice && Math.abs(current.high - currentPrice) / currentPrice > 0.01) {
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
      
        let longRR = closestSupport !== Number.MAX_VALUE && closestResistance !== Number.MIN_VALUE
            ? parseFloat(((closestResistance - currentPrice) / (currentPrice - closestSupport)).toFixed(2))
            : null;
      
        let shortRR = closestSupport !== Number.MAX_VALUE && closestResistance !== Number.MIN_VALUE
            ? parseFloat(((currentPrice - closestSupport) / (closestResistance - currentPrice)).toFixed(2))
            : null;
      
        return {
            support: closestSupport !== Number.MAX_VALUE ? parseFloat(closestSupport) : null,
            supportPercentChange: parseFloat(supportPercentChange),
            resistance: closestResistance !== Number.MIN_VALUE ? parseFloat(closestResistance) : null,
            resistancePercentChange: parseFloat(resistancePercentChange),
            longRR: longRR,
            shortRR: shortRR,
        };
    },

      async getTrend(candles, rsi, atr, support, resistance, symbol, endpoint) {
        if (!Array.isArray(candles)) {
            throw new Error('Candles must be an array');
        }
    
        if (candles.length < 20) {
            //throw new Error('Requires at least 20 candles got ' + candles.length + ' for ' + symbol);
            console.log('ERROR: Requires at least 20 candles got ' + candles.length + ' for ' + symbol);
        }
    
        var trend = '';
        var position = '';
    
        const currentCandle = candles[candles.length - 1];
        const previousCandle = candles[candles.length - 2];
    
        const currentRsi = rsi[rsi.length - 1];
        const previousRsi = rsi[rsi.length - 2];
    
        const swingHigh = previousCandle.high + atr;
        const swingLow = previousCandle.low - atr;
    
        const isSwingLow = currentCandle.close < swingLow;
        const isSwingHigh = currentCandle.close > swingHigh;
    
        const peakRsi = Math.max(...rsi);
        const troughRsi = Math.min(...rsi);
    
        // Get indexes for peak/trough RSI
        const peakIndex = rsi.lastIndexOf(peakRsi);
        const troughIndex = rsi.lastIndexOf(troughRsi);
    
        // Get peak/trough candles
        const peakCandle = candles[peakIndex];
        const troughCandle = candles[troughIndex];
    
        // Check for breakout of resistance and re-test of resistance bullish (resistance turns support)
        if (currentCandle.close > resistance && previousCandle.close <= resistance && currentCandle.close > previousCandle.high) {
            console.log('Breakout of resistance detected! ' + resistance);
            trend = "Breakout of resistance detected!";
            position = "Long";
    
            // Monitor the price for a retest
            while (true) {
              
              //two things can happen here, either price breaks through the resistance , at which point that resistance becomes support. Or price rejects the break and the resistance holds 

              console.log("Checking for retest of resistance to confirm it as new support for symbol " + symbol);
              this.currentCandle = []

                await this.getHistoricOHLC(this.convertToSeconds("minutes", 30 ), this.currentCandle, 15, symbol, endpoint);
            
                const latestCandle = this.currentCandle[0];
               // console.log(latestCandle.close);
               // console.log(currentCandle.close );

                if(latestCandle.close != currentCandle.close ){

                    if (latestCandle.low <= resistance && latestCandle.close > resistance && latestCandle.close > this.currentCandle[1].high) {
                      
                        const bias = 'Retest of resistance successful!, confirmed as new support LONG for ' + symbol;
                        this.$set(this.Trend, symbol, bias);
                        console.log(bias);

                        break;
                    }else if (latestCandle.high >= resistance && latestCandle.close < resistance && latestCandle.close < this.currentCandle[1].low) {
                      const bias = 'Retest of resistance failed!, resistance held, price rejected the initial break SHORT for ' + symbol;
                      this.$set(this.Trend, symbol, bias);
                      console.log(bias);
                      break;
                  }

                  }
                await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // Wait for 5 minutes before checking again
            }
        }
    
        // Check for breakdown of support and retest of support bearish (support turns resistance)
        if (currentCandle.close < support && previousCandle.close >= support && currentCandle.close < previousCandle.low) {
            console.log('Breakdown of support detected! ' + support);
            trend = "Breakdown of support detected!";
            position = "Short";
    
            // Monitor the price for a retest
            while (true) {

            //two things can happen here, either price breaks through the support , at which point that support becomes resistance. Or price rejects the break and the support holds 
              
              console.log("Checking for retest of support to confirm it as new resistance for symbol " + symbol);
              this.currentCandle = [];
              await this.getHistoricOHLC(this.convertToSeconds("minutes", 30 ), this.currentCandle, 15, symbol, endpoint);
          
              const latestCandle = this.currentCandle[0];
              //console.log(latestCandle.close);
             // console.log(currentCandle.close );
              if(latestCandle.close != currentCandle.close ){
                if (latestCandle.high >= support && latestCandle.close < support && latestCandle.close < this.currentCandle[1].low) {
                  const bias = 'Retest of support successful!, confirmed as new resistance SHORT for ' + symbol;
                  this.$set(this.Trend, symbol, bias);
                  console.log(bias);
                    break;
                  }else if (latestCandle.low >= support && latestCandle.close > support && latestCandle.close > this.currentCandle[1].high) {
                    const bias = 'Retest of support failed!, support held, price rejected the initial break LONG for ' + symbol;
                    this.$set(this.Trend, symbol, bias);
                    console.log(bias);
                    break;
                }
              }
                await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // Wait for 5 minutes before checking again
            }
        }
    
              if (currentRsi < troughRsi && currentCandle.close > troughCandle.close) {
                  trend = 'Bullish Hidden Divergence Long';
                  this.$set(this.Trend, symbol, trend);
                  position = 'Long';
              }
              // Check for bearish hidden divergence
              if (currentRsi > peakRsi && currentCandle.close < peakCandle.close) {
                  trend = 'Bearish Hidden Divergence';
                  this.$set(this.Trend, symbol, trend);
                  position = 'Short';
              } 

              // Check for regular bullish divergence
              if (currentRsi < peakRsi && currentCandle.close > peakCandle.close) {
                  trend = 'Bullish Regular Divergence';
                  this.$set(this.Trend, symbol, trend);
                  position = 'Long';
              }
              // Check for regular bearish  divergence
              if (currentRsi > troughRsi && currentCandle.close < troughCandle.close) {
                  trend = 'Bearish Regular Divergence';
                  this.$set(this.Trend, symbol, trend);
                  position = 'Short';
              } 
        
            return trend + ' ' + position;
    },

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
          data.recv_window = 30000;
          let dataString = this.objToString(this.sortObject(data));
          data.sign = CryptoJS.HmacSHA256(dataString, this.account.apiSecret).
              toString();
          return this.sortObject(data);
        },

      getSignatureV5(parameters, secret, recvWindow, timestamp ) {
          return crypto.createHmac('sha256', secret).update(timestamp + this.account.apiKey + recvWindow + parameters).digest('hex');
      },

      async http_requestV5(endpoint,method,data,Info) {

            var fullendpoint = "";
            var url = 'https://api.bybit.com';
            var recvWindow = 8000;
            var timestamp = Date.now().toString();

            var sign = this.getSignatureV5(data, this.account.apiSecret, recvWindow, timestamp);

            //console.log(sign);

            if(method=="POST")
            {
                fullendpoint=url+endpoint;
            }
            else{
                fullendpoint=url+endpoint+"?"+data;
                data="";
            }
      
            var config = {
              method: method,
              url: fullendpoint,
              headers: { 
                'X-BAPI-SIGN-TYPE': '2', 
                'X-BAPI-SIGN': sign, 
                'X-BAPI-API-KEY': this.account.apiKey, 
                'X-BAPI-TIMESTAMP': timestamp, 
                'X-BAPI-RECV-WINDOW': recvWindow, 
                'Content-Type': 'application/json; charset=utf-8'
              },
              data : data
            };

            //console.log(Info + " Calling....");

            return axios(config);
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
            //this.currentSymbol = localStorage.currentSymbol;
            this.currentSymbol = "BTCUSD";
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
          if (localStorage.riskPercentage !== undefined) {
            this.riskPercentage = localStorage.riskPercentage;
          }

          // if (localStorage.tradingBots !== undefined) {
         
          //  console.log(localStorage.tradingBots);
          //  this.tradingBots = localStorage.tradingBots;
          // }
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
        riskPercentage(riskPercentage) {
          localStorage.riskPercentage = riskPercentage;
        },
        // tradingBots(tradingBots){
        //   console.log(tradingBots);
        //   localStorage.tradingBots = tradingBots;
        // },

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