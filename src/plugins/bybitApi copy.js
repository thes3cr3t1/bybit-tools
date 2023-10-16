import {ORDER_DISTRIBUTIONS} from '../../Home/LadderOrdersForm/constants';
import {generateOrders} from '../../Home/LadderOrdersForm/scaledOrderGenerator';
import PreviewOrders from '../PreviewOrders';
import hotkeys from 'hotkeys-js';
import { mdiCellphoneLock, mdiConsoleNetwork } from '@mdi/js';
import {Decimal} from 'decimal.js';
import { typeOf } from 'mathjs';
import { endsWith } from 'lodash';

export default {
  name: 'scalp-form',
  components: {PreviewOrders},
  props: ['active'],
  data: () => ({
    valid: true,
    takeProfit:0,
    stopLoss:0,
    side:0,
    direction:0,
    amount:0,    
    TrackSizeSwitchStatus:false,
    orders: [],
    generatedLadder:[],
    highPrice:0,
    lowPrice:0,
    breakevenPrice:0,
    ladderInForm:true,
    qty:0,
    lastPrice: 0,
    entryPrice:0,
    toggleAutobreakeven: false,
    toggleMaintainRisk: false,
    toggleMaintainProfit: false,
    toggleActivateBot:false,
   
    chaserTimer: undefined,
    trackTimer: null,
    form: {
      price: '',
      orderType:'Limit',
      takeProfit: '',
      stopLoss: '',
      StopLossUSD: '0',
      contractsIn: 0,
      contractsOut: 0,
      rangeIn: 10,
      rangeOut: 10,
      priceOffsetIn:1,
      priceOffsetOut:2,
      orderCountIn:10,
      orderCountOut:10,
      riskPercent:0.25,
      stopLoss:0,
      chaseInQty:0,
      LadderOutFormFocused:0,
      replaceOrderResult:0,
      trigger:0,
      maintainRisk:0,
      maintainProfit:0,

      scale: ORDER_DISTRIBUTIONS.INCREASING.label,
      scaleItems: [
        ORDER_DISTRIBUTIONS.FLAT.label,
        ORDER_DISTRIBUTIONS.INCREASING.label,
        ORDER_DISTRIBUTIONS.DECREASING.label,
      ],
      
      CloseAmountItems: [
        {
          value: 'Full',
          text: 'Full',
        },
        { 
          value: '1/3',
          text: 'Third',
        },
        {
          value: '1/2',
          text: 'Half',
        },
        {
          value: '1/4',
          text: 'Quater',
        },
      ],
      CloseAmount: '1/4'
    },
    preview: [],
    liveOrders: [],
  }),
  computed: {

    TrackSize: {
      get: function(){},
      set: function() {
        if(this.openPositionDirection() != false && this.TrackSizeSwitchStatus == true){
         // console.log("Tracking Price");
          this.qty = this.$bybitApi.openPosition.size;
        }
      }
    },
    positionSize: function() {
      if(this.openPositionDirection() != false && this.TrackSizeSwitchStatus == true){
      return this.$bybitApi.openPosition.size;
      }
    },
     isDisabled: function(){
      return this.$bybitApi.breakevenBtnDisabled;
    },isDisabledB: function(){
      return this.$bybitApi.ButtonDisabled; 	
    },
    formValidation: function() {
      return {
       TakeProfitUSD: [
          v => !v || v && !isNaN(v) || 'Take Profit must be an number',
          v => !v || v && (Number(v + 'e4') %
              Number(this.$bybitApi.currentTickSize + 'e4') === 0) ||
              'Take Profit must be a multiple of ' +
              this.$bybitApi.currentTickSize,
        ],
        StopLossUSD: [
          v => !v || v && !isNaN(v) || 'Take Profit must be an number',
          v => !v || v && (Number(v + 'e4') %
              Number(this.$bybitApi.currentTickSize + 'e4') === 0) ||
              'Take Profit must be a multiple of ' +
              this.$bybitApi.currentTickSize,
        ],
        takeProfitRules: [
          v => !v || v && !isNaN(v) || 'Take Profit must be an number',
          v => !v || v && (Number(v + 'e4') %
              Number(this.$bybitApi.currentTickSize + 'e4') === 0) ||
              'Take Profit must be a multiple of ' +
              this.$bybitApi.currentTickSize,
        ],
        stopLossRules: [
          v => !v || v && !isNaN(v) || 'Stop Loss must be an number',
          v => !v || v && (Number(v + 'e4') %
              Number(this.$bybitApi.currentTickSize + 'e4') === 0) ||
              'Stop Loss must be a multiple of ' +
              this.$bybitApi.currentTickSize,
        ]
       
      };
    },
    tpProfit: function() {
      if (this.form.price && this.form.takeProfit && this.form.contracts) {
        let profit = Math.abs(
            (1 / this.form.price) - (1 / parseFloat(this.form.takeProfit))) *
            this.form.contracts;
        return profit.toFixed(4) + ' ≈ ' +
            (profit * this.$bybitApi.lastPrice).toFixed(2) + 'USD';
      }
    },
    slLoss: function() {
      if (this.form.price && this.form.stopLoss && this.form.contracts) {
        let loss = Math.abs(
            (1 / this.form.price) - (1 / parseFloat(this.form.stopLoss))) *
            this.form.contracts +
            (((this.form.contracts * 0.075) / 100) / this.form.stopLoss);
        return loss.toFixed(4) + ' ≈ ' +
            (loss * this.$bybitApi.lastPrice).toFixed(2) +
            'USD (including fees)';
      }
    },
  },
  mounted() {
    this.ChaseOrderChecker();
    var self = this;

    hotkeys('ctrl+alt+a,ctrl+alt+b,ctrl+alt+c,ctrl+alt+d,ctrl+alt+e,ctrl+alt+f,ctrl+alt+g,ctrl+alt+h,ctrl+alt+i,ctrl+alt+j,ctrl+alt+k,ctrl+alt+l,ctrl+alt+m,ctrl+alt+n,ctrl+alt+o',self, function (event, handler){

      switch (handler.key) {
        //Top row of custom keyboard
        case 'ctrl+alt+a':
          self.ladderIn();
          break;
          case 'ctrl+alt+b': 
          self.calculateBreakevenPrice(true);
          break;
          case 'ctrl+alt+c':
          self.closePosition(self.form.CloseAmount, 'Chase')
          break;
          case 'ctrl+alt+d': 
          self.closePosition(self.form.CloseAmount, 'Market')
          break;
          case 'ctrl+alt+e':
          self.closePosition(self.form.CloseAmount, 'Limit')
          break;
         //Middle row of custom keyboard
         case 'ctrl+alt+f':
          self.ladderOut();
          break;
          case 'ctrl+alt+g':
          self.$bybitApi.cancelAllBuyOpenOrders();
          break;
          case 'ctrl+alt+h':
          self.$bybitApi.cancelAllSellOpenOrders();
          break;
          case 'ctrl+alt+i':
          self.$bybitApi.cancelAllOpenOrders();
          break;
          case 'ctrl+alt+j':
          self.$bybitApi.cancelAllBuyOpenOrders()
          break;
        default: console.log(event);
      }
    });

  },
  methods: {

    async GoLong(){

      var diff = Math.abs(this.$bybitApi.lastPrice - this.$bybitApi.KlineData1[this.$bybitApi.KlineData1.length-2].low);

      var tp = parseFloat(this.$bybitApi.lastPrice + (diff*4)).toFixed(1);

      var order = {
        side: 'Buy',
        symbol: this.$bybitApi.currentSymbol,
        price: this.$bybitApi.lastPrice,
        order_type: 'Market',
        qty: 3,
        time_in_force: "GoodTillCancel",
        take_profit: tp,
        stop_loss: this.$bybitApi.KlineData1[this.$bybitApi.KlineData1.length-2].low,
      }

      console.log(order);

      const result = await this.$bybitApi.placeOrder(order);

      console.log(result);

    },

   async GoShort(){

    var diff = Math.abs(this.$bybitApi.lastPrice - this.$bybitApi.KlineData1[this.$bybitApi.KlineData1.length-2].high);

    var tp = parseFloat(this.$bybitApi.lastPrice - (diff*4)).toFixed(1);

    var order = {
      side: 'Sell',
      symbol: this.$bybitApi.currentSymbol,
      price: this.$bybitApi.lastPrice,
      order_type: 'Market',
      qty: 3
      ,
      time_in_force: "GoodTillCancel",
      take_profit: tp,
      stop_loss: this.$bybitApi.KlineData1[this.$bybitApi.KlineData1.length-2].high,
    }

    console.log(order);

    const result = await this.$bybitApi.placeOrder(order);

    console.log(result);

    },

   calculateEMAsAndExecuteStrategy() {
      const klineData = this.$bybitApi.KlineData1;
      const closePrices = klineData.map(data => data.close);
    
      function calculateEMA(period) {
        const k = 2 / (period + 1);
        let ema = closePrices[0];
    
        for (let i = 1; i < closePrices.length; i++) {
          ema = (closePrices[i] * k) + (ema * (1 - k));
        }
    
        return parseFloat(ema).toFixed(1);
      }

   
    
      const fastEMA = parseFloat(calculateEMA(7));
      const mediumEMA = parseFloat(calculateEMA(21));
      const slowEMA = parseFloat(calculateEMA(50));
   
      var lastPrice = parseFloat(this.$bybitApi.lastPrice);

      const isBullishEngulfing = lastPrice > secondToLastCandle.high && lastPrice > secondToLastCandle.open &&
      secondToLastCandle.open > secondToLastCandle.close;
      const isBearishEngulfing = lastPrice < secondToLastCandle.low && lastPrice < secondToLastCandle.open &&
      secondToLastCandle.open < secondToLastCandle.close;
      


      var high = parseFloat(this.$bybitApi.KlineData1[this.$bybitApi.KlineData1.length-2].high);
      var low  = parseFloat(this.$bybitApi.KlineData1[this.$bybitApi.KlineData1.length-2].low);
    
      if (this.toggleActivateBot && this.$bybitApi.openPosition == null) {

        console.log("second to last candles low " + this.$bybitApi.KlineData1[this.$bybitApi.KlineData1.length-2].low);
    
        if (lastPrice > slowEMA && fastEMA > mediumEMA) {
      
          if(lastPrice >= high){
             console.log("GO Long");
             this.GoLong();
            }
        }else
  
        // Bot running position open
        if (lastPrice < slowEMA && fastEMA < mediumEMA) {
       
          if(lastPrice <= low){
             console.log("GO Short");
             this.GoShort();
          }
        }
      }
    },

  
    callFunction() {
      console.log('Last price is greater than breakeven price');
    },
    
    openPositionDirection(){
      if(this.$bybitApi.openPosition != null){ 
        if(this.$bybitApi.openPosition.side == "Sell"){
          return "Sell";
        }else if(this.$bybitApi.openPosition.side == "Buy"){
          return "Buy";
        }
      }else{
            return false;
      }

    },
    qtyClicked() {
     //check if we should be tracking the positions quantitiy if so set it.
     if(this.TrackSizeSwitchStatus == true){
         this.TrackSize = this.TrackSizeSwitchStatus;
      }
    },

    TrackLiveQtySetter: function(d){
    //  console.log("Track size - TOGGLED");
      this.TrackSize = this.TrackSizeSwitchStatus;
    },

    Identify: function(e){
      this.LadderOutFormFocused = (e == "ladderOutForm" ? true : false);
    },

    closePosition(amount,type){
      var size = 0;
      switch (amount){
        case "Full":
          size = this.$bybitApi.openPosition.size;
        break;
        case "1/2":
          size = Math.floor(this.$bybitApi.openPosition.size/2);
        break;
        case "1/3":
          size = Math.floor(this.$bybitApi.openPosition.size/3);
        break;
          case "1/4":
          size = Math.floor(this.$bybitApi.openPosition.size/4);
        break;
      }
      type == "Limit" ?  this.$bybitApi.limitClosePosition(size,this.$bybitApi.makeid(8)) : type == "Chase" ? this.limitCloseChase(size,"Chase_" + this.$bybitApi.makeid(8)) : this.$bybitApi.marketClosePosition(size)
     
    },roundHalf(num) {
      return (Math.round(parseInt(num)*2)/2);
    
    },moveStops(stop){ 
      console.log("Moving stop to " + stop);
      this.$bybitApi.setTradingStops(null, parseFloat(stop).toFixed(1), null);
      
    },
    calculateTakeProfitPrice(positionSize, entryPrice, dollarProfit, isLong) {
          const takeProfitPrice = parseFloat(entryPrice + (dollarProfit / (Math.abs(positionSize) / entryPrice))).toFixed(0);

        return takeProfitPrice;
    },
  
    calculateStopLossPrice(dollarRiskAmount) {

      var positionSize = parseFloat(this.$bybitApi.openPosition.size);
      var entryPrice   = parseFloat(this.$bybitApi.openPosition.entry_price);
    
      let low = entryPrice - 15000; // Initialize the lower bound
      let high = entryPrice + 15000; // Initialize the upper bound
    
      const maxIterations = 1000;
      const precision = 0.01; // Define the desired precision
    
      let iteration = 0;
    
      while (iteration < maxIterations) {
        var mid = (low + high) / 2; // Calculate the mid-point
    
        var calculatedDollarRiskAmount = positionSize * Math.abs(entryPrice - mid) / mid;

        if(this.$bybitApi.openPosition.side == "Sell"){
            if (Math.abs(calculatedDollarRiskAmount - dollarRiskAmount) < precision) {
              // Stop iterating if the desired precision is achieved
              return mid;
            } else if (calculatedDollarRiskAmount > dollarRiskAmount) {
              high = mid; // Adjust the upper bound
            } else {
              low = mid; // Adjust the lower bound
            }
        }else if(this.$bybitApi.openPosition.side == "Buy") {

            if (Math.abs(calculatedDollarRiskAmount - dollarRiskAmount) < precision) {
              // Stop iterating if the desired precision is achieved
              return mid;
            } else if (calculatedDollarRiskAmount > dollarRiskAmount) {
              low = mid; // Adjust the upper bound
            } else {
              high = mid; // Adjust the lower bound
            }
        }
    
        iteration++;
      }
    
      return null; // Return null if the desired stop loss price cannot be found within the specified iterations

     },
    
  calculateBreakevenPrice(moveTobreakeven){ 

  
      //console.log("Calculating breakeven price");
       
      if(this.$bybitApi.openPosition != null){
        
        var takerFeeToOpenUSD = ((this.$bybitApi.openPosition.size/this.$bybitApi.openPosition.entry_price) * 0.0006) * this.$bybitApi.openPosition.entry_price;
        var takerFeeToCloseUSD = ((this.$bybitApi.openPosition.size/this.$bybitApi.openPosition.take_profit) * 0.0006) * this.$bybitApi.openPosition.take_profit;

        var Reward = 0;
        var direction = this.openPositionDirection();
        var breakevenPrice = parseFloat(this.$bybitApi.openPosition.entry_price);
        var totalTakerFee = 0;
        
          do{
              Reward = this.$bybitApi.openPosition.size * (Math.abs(this.$bybitApi.openPosition.entry_price - breakevenPrice)) / breakevenPrice;
              var takerFeeToCloseUSD = ((this.$bybitApi.openPosition.size/breakevenPrice) * 0.0006) * breakevenPrice;

              direction == "Buy" ? breakevenPrice += 0.5 : breakevenPrice -= 0.5;

              totalTakerFee = (takerFeeToOpenUSD + takerFeeToCloseUSD);
          }while(Reward < totalTakerFee)

        console.log("Total Taker Fee " + parseFloat(totalTakerFee).toFixed(2) + " Breakeven Price " + breakevenPrice);
        
        if(moveTobreakeven == true){
           this.$bybitApi.setTradingStops(null, parseFloat(breakevenPrice).toFixed(1), null);
        }

        this.breakevenPrice = breakevenPrice;
        //emit breakeven price to the openPosition component

        return breakevenPrice;
      }
  
     },risk_percent(){

      if(this.$bybitApi.openPosition.stop_loss <= 0){
        return "100"
      }else{
            var riskUSD = parseFloat(this.$bybitApi.openPosition.size*(Math.abs(this.$bybitApi.openPosition.entry_price-parseFloat(this.$bybitApi.openPosition.stop_loss).toFixed(this.$bybitApi.symbolInfo.priceScale)))/this.$bybitApi.openPosition.entry_price).toFixed(2);
            var usdBalance = this.$bybitApi.walletBalance * this.$bybitApi.lastPrice;
            var riskPercent = parseFloat(riskUSD/(usdBalance) * 100).toFixed(2);
            return riskPercent;
      }

    },
      ladderOut() { 
        var contracts = this.qty;
        console.log("Laddering out - contracts: "+ this.qty);
        var data = {};
        
        if(this.$bybitApi.openPosition.side == "Buy"){
             data = {
                    amount: Number(contracts),
                    orderCount: this.form.orderCountOut,
                    priceLower: parseFloat(this.$bybitApi.lastPrice) +  Number(Math.abs(this.form.priceOffsetOut)),
                    // distribution:this.openPositionDirection() == "Sell" ? ORDER_DISTRIBUTIONS.INCREASING.label : ORDER_DISTRIBUTIONS.INCREASING.label,
                    distribution: this.openPositionDirection() == "Sell" ? this.form.scale : (this.form.scale ===
                      ORDER_DISTRIBUTIONS.FLAT.label ? ORDER_DISTRIBUTIONS.FLAT.label :
                          (this.form.scale === ORDER_DISTRIBUTIONS.INCREASING.label
                              ? ORDER_DISTRIBUTIONS.INCREASING.label
                              : ORDER_DISTRIBUTIONS.DECREASING.label)),
                    tickSize: this.$bybitApi.currentTickSize,
                    coefficient: parseInt(40),
                    close_on_trigger:true,
            }

            data.priceUpper = Number(data.priceLower) + Number(this.form.rangeOut);
            data.minTolerance = this.$bybitApi.symbolInfo.minQty; 

            this.generatedLadder = this.generateOrders(data);
            console.log(this.generatedLadder);
            this.calculateOrders('Sell', true , true );
            
        }else if(this.$bybitApi.openPosition.side == "Sell"){
             data = {
                      amount: Number(contracts),
                      orderCount: this.form.orderCountOut,
                      priceUpper: parseFloat(this.$bybitApi.lastPrice) - Number(Math.abs(this.form.priceOffsetOut)),
                     // distribution:this.openPositionDirection() == "Sell" ? ORDER_DISTRIBUTIONS.DECREASING.label : ORDER_DISTRIBUTIONS.INCREASING.label,  
                     distribution: this.openPositionDirection() == "Sell" ? this.form.scale : (this.form.scale ===
                      ORDER_DISTRIBUTIONS.FLAT.label ? ORDER_DISTRIBUTIONS.FLAT.label :
                          (this.form.scale === ORDER_DISTRIBUTIONS.INCREASING.label
                              ? ORDER_DISTRIBUTIONS.DECREASING.label
                              : ORDER_DISTRIBUTIONS.INCREASING.label)),
                      tickSize: this.$bybitApi.currentTickSize,
                      coefficient:  parseInt(40),
                      close_on_trigger:true,

                    }

            data.priceLower = Number(data.priceUpper) - Number(this.form.rangeOut);
        
            data.minTolerance = this.$bybitApi.symbolInfo.minQty; 
            this.generatedLadder = this.generateOrders(data);
            //console.log(this.generatedLadder);
            this.calculateOrders('Buy', true, true);
        }

  
        this.placeOrders();
       
    }, ladderIn() {
          this.form.priceOffsetIn < 0 ?  this.calculateOrders('Buy', false, false) : this.calculateOrders('Sell', false, false);
          this.placeOrders();
          this.orders = [];
    },
    ChaseLadderIn(atr,qty){
      //Chade ladder in to an existing position at X ATR below the price


    },
    async chaseIn(size,side){
         var price = 0;

          if(side == "Buy"){
              price = this.$bybitApi.bestBid; //ATR//ORDERBOOK
          }else if(side == "Sell"){
              price = this.$bybitApi.bestAsk;
          }

          //console.log("Price " + price);
          //Place a limit open order in orderbook
          //figure out direction, for now hardcode it 

          var orderId = "TrackIn_" +this.$bybitApi.makeid(8);
          const result = await this.$bybitApi.placeOrder({
              side: side,
              symbol: this.$bybitApi.currentSymbol,
              price: price,
              order_type: 'Limit',
              qty: size,
              order_link_id: orderId,
              time_in_force: 'PostOnly',
              reduce_only: false,
              close_on_trigger: false
            });

           // console.log(result);
             if(result.data.ret_msg == "OK" || result.data.ret_msg == "ok"){
              //order sucessfully placed
              this.$bybitApi.trackOrderID = orderId;
  
              this.$notify({
                text: "Placed Limit Buy Order for" + size + " Contracts",
                type: 'success',
              });
              
              //call the function 1 second after the chase order was placed to give the order time to get in the openOrders array
             
              setTimeout(() => {this.trackOrderChecker(size, side);}, 1000);
              
        }
  
    },async trackOrderChecker(size, side){ 
            //Check the open orders for the existing chaseOrder ID if it does not exist then it has been filled

           /// console.log("trackOrderChecker running TimerID = " + this.trackTimer);

            var trackOrderFound = false;
            var size = size;
          
            // console.log("trackOrderChecker " + side);
            
            for(let x= 0; x < this.$bybitApi.openOrders.length; x++){
              if(this.$bybitApi.openOrders[x].order_link_id.search("TrackIn_") != -1){
                this.$bybitApi.trackOrderID = this.$bybitApi.openOrders[x].order_link_id;
                side = this.$bybitApi.openOrders[x].side;
                trackOrderFound = true;
              }
            }

            //if the chaser order has been found then we need to make sure that the timer is running. The timer wont be running if the program has been restarted durign a chase.
            if(trackOrderFound == true && this.trackTimer == undefined){
             // console.log("Starting Timer " + typeof(this.trackTimer));
              var self = this;
              this.trackTimer = setInterval(() => {this.trackOrderChecker(size, side);}, 225);
             }
            
            if(trackOrderFound == false){
              //Chaser has been filled shut down the timer
              if (this.trackTimer) {
              
                clearInterval(this.trackTimer);
                this.trackTimer = null;
                
                this.$notify({
                  text: "Track order succesfuly filled, placing opposing exit order",
                  type: 'success',
                });


              }

      
            } 
        for(let x= 0; x < this.$bybitApi.openOrders.length; x++){
        //  if(this.replaceOrderResult != 0){

                var price = parseFloat(this.$bybitApi.openOrders[x].price).toFixed(2);
                if(side === 'Buy'){
                   
                  if(this.$bybitApi.openOrders[x].order_link_id == this.$bybitApi.trackOrderID && price != this.$bybitApi.bestBid){
                   // console.log("Order Price " + price + " Best Ask " + this.$bybitApi.bestAsk + " Best Bid " + this.$bybitApi.bestBid);
                    clearInterval(this.trackTimer);
                   // console.log("Stopping timer");
                    this.trackTimer = null;
                    this.replaceOrderResult = await this.$bybitApi.replaceActiveOrder(this.$bybitApi.trackOrderID,size,this.$bybitApi.bestBid);
                  
                  }
                }
                else
                if(side === 'Sell'){
                 
                    if(this.$bybitApi.openOrders[x].order_link_id == this.$bybitApi.trackOrderID && price != this.$bybitApi.bestAsk){
                    //  console.log("Order Price " + price + " Best Ask " + this.$bybitApi.bestAsk + " Best Bid " + this.$bybitApi.bestBid);
                      clearInterval(this.trackTimer);
                   //   console.log("Stopping timer");
                      this.trackTimer = null;
                      this.replaceOrderResult = await this.$bybitApi.replaceActiveOrder(this.$bybitApi.trackOrderID,size,this.$bybitApi.bestAsk);
                   //   console.log("Returned");
                    }
                }
     
         }
     
       if(this.replaceOrderResult == "OK"){
        //order sucessfully placed
        this.replaceOrderResult = 0;
        this.trackTimer = setInterval(() => {this.trackOrderChecker(size, side);}, 225);

        this.$notify({
          text: "Placed Limit Close Order for" + size + " Contracts",
          type: 'success',
        });
      }


    },
    
    testFunc(){
      this.calculateBreakevenPrice(false);
    },
    generateOrders(data) {
      console.log(data);
      return generateOrders(data);
    },
    calculateOrders(side, reduce, closeOnTrigger) {
      //ensure that stop loss is placed for the first limit order pf the ladder that is hit, not the last.
      if (side === 'Buy') {
        for (let i = this.generatedLadder.length - 1; i >= 0; i--) {
          let order = {
            side: side,
            symbol: this.$bybitApi.currentSymbol,
            order_type: 'Limit',
            qty: this.generatedLadder[i].amount,
            price: this.generatedLadder[i].price,
            time_in_force: "PostOnly",
            reduce_only: reduce,
            close_on_trigger : closeOnTrigger
          };
          if (this.form.takeProfit && i === this.generatedLadder.length - 1) {
            order.take_profit = this.form.takeProfit;
          }
          if (this.form.stopLoss && i === this.generatedLadder.length - 1) {
            order.stop_loss = Number(this.form.stopLoss);
          }
          this.orders.push(order);
        }
      } else {
        //console.log(this.generatedLadder);
         for (let i = 0; i < this.generatedLadder.length; i++) {
          let order = {
            side: side,
            symbol: this.$bybitApi.currentSymbol,
            order_type: 'Limit',
            qty: this.generatedLadder[i].amount,
            price: this.generatedLadder[i].price,
            time_in_force: "PostOnly",
            reduce_only: reduce,
            close_on_trigger : closeOnTrigger
          };
         
          if (this.form.takeProfit && i == 0) {
            order.take_profit = this.form.takeProfit;
          }
          if (this.form.stopLoss && i == 0) {
            order.stop_loss = Number(this.form.stopLoss);
          }
         
          this.orders.push(order);
        }
        //console.log(this.orders);
      }
    },placeOrders() {
      for (let i = 0; i < this.orders.length; i++) {
        this.$bybitApi.placeOrder(this.orders[i]);
      }
    },
    getOrder(side,orderType) {
      let order = {
        side: side,
        symbol: this.$bybitApi.currentSymbol,
        order_type: orderType,
        qty: this.form.contracts,
        price: this.form.price,
        time_in_force: this.form.time_in_force,
        reduce_only: this.form.reduceOnly,
      };
      if(this.$bybitApi.openPosition == null){
        order.take_profit = this.$bybitApi.takeProfit;
        order.stop_loss = this.$bybitApi.stopLoss;
      }
      //console.log(order);
      return order;
    },
    reset() {
      this.$refs.form.reset();
    },

    roundToTickSize(tickSize, price) {

      console.log(tickSize);

      var tp = new Decimal(tickSize);
      var p = price;
      var t = tickSize;
      var rounded = p - (p % t) + (p % t < t / 2 ? 0 : t);
      var roundedDecimal = new Decimal(rounded);
      return roundedDecimal.toDecimalPlaces(tp.dp()).toNumber();
      },
      average() {
        let totalAll = 0;
        let totalQty = 0;
        for (let i = 0; i < this.generatedLadder.length; i++) {
          totalAll += this.generatedLadder[i].amount * this.generatedLadder[i].price;
          totalQty += this.generatedLadder[i].amount;
        }
  
        console.log(totalAll  + " " + totalQty);
        return (totalAll / totalQty);
      },
    calculateRisk(amount){
      
      var average_entry = parseFloat(this.average()).toFixed(2);
      var riskUSD = parseFloat(amount*(Math.abs(average_entry-parseFloat(this.form.stopLoss).toFixed(this.$bybitApi.symbolInfo.priceScale)))/average_entry).toFixed(2);
  
      var usdBalance = this.$bybitApi.walletBalance * this.$bybitApi.lastPrice;
      var riskPercent =  parseFloat(riskUSD/(usdBalance ) * 100).toFixed(2) //100 = balance
      
      console.log("Actual Average Entry " + average_entry + " risk percent " +  riskPercent  + " RiskUSD " +  riskUSD);
      return riskPercent;
    },
    async limitCloseChase(size, order_link_id) {

      //TODO only chase in profit
      //set threshold of price change for when to stop chasing

      //Check the open orders for the existing chaseOrder ID if it does not exist then a new order will be placed
      var chaseOrderFound = false;
      for(let x= 0; x < this.$bybitApi.openOrders.length; x++){
        if(this.$bybitApi.openOrders[x].order_link_id.search("Chase_") != -1){
           chaseOrderFound = true;
           size = this.$bybitApi.openOrders[x].size;
           console.log("Existing chase order found " + this.$bybitApi.openOrders[x].order_link_id + " Size " + size);
           
        }
      }
      
      //Place a limit close chaser order if we dont already have one running.
      if(chaseOrderFound == false){

        const result = await this.$bybitApi.placeOrder({
            side: this.$bybitApi.openPosition.side === 'Buy' ? 'Sell' : 'Buy',
            symbol: this.$bybitApi.currentSymbol,
            price: this.$bybitApi.openPosition.side === 'Buy' ?  this.$bybitApi.bestAsk: this.$bybitApi.bestBid,
            order_type: 'Limit',
            qty: size,
            order_link_id: order_link_id,
            time_in_force: 'PostOnly',
            close_on_trigger: true,
            reduce_only: true
          });

           if(result.data.ret_msg == "OK"){
            //order sucessfully placed
            //console.log(result.data);
            this.$bybitApi.chaseOrderID = order_link_id;
            console.log("Chase order placed: ID " + order_link_id + " Price " + result.data.result.price);
            this.chaserTimer = setInterval(this.ChaseOrderChecker, 500);

            this.$notify({
              text: "Placed Limit Close Order for " + size + " Contracts",
              type: 'success',
            });
          
            }
      }

    },ChaseOrderChecker(){ 
      //Check the chase order has not been filled already
      if( this.$bybitApi.chaseOrderID == null){
        //Chaser has been filled or cancelled or order dosent exist shut down the timer
        if (this.chaserTimer) {
          clearInterval(this.chaserTimer);
          this.$notify({
            text: "Chase order succesfuly finished",
            type: 'success',
          });
        }
        return 0;
      }else{  //chase order is still active, lets check if price has moved away from our order and update accordingly
        const matchingOrder = this.$bybitApi.openOrders.find(order => order.order_link_id === this.$bybitApi.chaseOrderID);
              if(matchingOrder){

                if(this.$bybitApi.openPosition.side === 'Buy'){
                   if(Number(matchingOrder.price).toFixed(this.$bybitApi.symbolInfo.priceScale) != Number(this.$bybitApi.bestAsk).toFixed(this.$bybitApi.symbolInfo.priceScale)){
                    console.log("replacing chaser order " + matchingOrder.qty + " before price " + Number(matchingOrder.price).toFixed(this.$bybitApi.symbolInfo.priceScale) + " after price " + this.$bybitApi.bestAsk );
                    this.$bybitApi.replaceActiveOrder(matchingOrder.order_link_id, null, this.$bybitApi.bestAsk);
                  }
                }
                else
                if(this.$bybitApi.openPosition.side === 'Sell'){
                   if(Number(matchingOrder.price).toFixed(this.$bybitApi.symbolInfo.priceScale) != Number(this.$bybitApi.bestBid).toFixed(this.$bybitApi.symbolInfo.priceScale)){
                    console.log("replacing chaser order  " + matchingOrder.qty + "before price " + Number(matchingOrder.price).toFixed(this.$bybitApi.symbolInfo.priceScale) + " after price " + this.$bybitApi.bestBid );
                      this.$bybitApi.replaceActiveOrder(matchingOrder.order_link_id,null,this.$bybitApi.bestBid);
                    }
                }
              }
           }
    },
  },

  watch: {

     
    '$bybitApi.openPosition.entry_price': {
      handler: function (entryPrice) {
      
        if (this.toggleMaintainRisk && this.$bybitApi.openPosition != null && this.form.maintainRisk >= 0) {
          if( (this.openPosition.side == "Buy" && this.lastPrice < this.openPosition.entry_price) || (this.openPosition.side == "Sell" && this.lastPrice > this.openPosition.entry_price) ){
            console.log("expect errot here appendignvalut to strin " + this.openPosition.entry_price)
            //Will maintain the risk in dollars if the position is under water/negative P&L
         
                var dollarRiskAmount = this.form.maintainRisk; // Desired dollar risk amount in dollars (e.g., 20 cents)
                var stopLossPrice = this.calculateStopLossPrice(dollarRiskAmount);
                
                if (stopLossPrice !== null) {
                } else {
                  console.log('Unable to find the desired stop loss price within the specified iterations.');
                }

                this.moveStops(parseFloat(stopLossPrice));
          }
        }
      },
    },
  
       
    '$bybitApi.openPosition.size': {
      handler: function (size) {

        if (this.$bybitApi.openPosition.side == "Buy" && this.lastPrice > this.$bybitApi.openPosition.entry_price) {

        }else if (this.$bybitApi.openPosition.side == "Sell" && this.lastPrice < this.$bybitApi.openPosition.entry_price) {
        
        }else
      
        if (this.toggleMaintainRisk && this.$bybitApi.openPosition != null && this.form.maintainRisk >= 0) {
    
         
            var dollarRiskAmount = this.form.maintainRisk; // Desired dollar risk amount in dollars (e.g., 20 cents)
            var stopLossPrice = this.calculateStopLossPrice(dollarRiskAmount);
            
            if (stopLossPrice !== null) {
            } else {
              console.log('Unable to find the desired stop loss price within the specified iterations.');
            }
            
            this.moveStops(parseFloat(stopLossPrice));
          
        }
      },
    },
  


    
    '$bybitApi.lastPrice': {
    handler: function (lastPrice) {

      //activate bot code
      this.calculateEMAsAndExecuteStrategy();


      //breakeven code
      if (this.toggleAutobreakeven && this.$bybitApi.openPosition != null && this.form.trigger >= 0) {
    
        this.breakeven = this.calculateBreakevenPrice(false); // calculate the breakeven price
  
        if (this.$bybitApi.openPosition.side == "Buy" && parseFloat(this.$bybitApi.openPosition.stop_loss).toFixed(1) < parseFloat(this.breakeven).toFixed(1) && lastPrice > this.breakeven && lastPrice >= this.form.trigger) {
          this.calculateBreakevenPrice(true);
        }else if (this.$bybitApi.openPosition.side == "Sell" && parseFloat(this.$bybitApi.openPosition.stop_loss).toFixed(1) > parseFloat(this.breakeven).toFixed(1) && lastPrice < this.breakeven && lastPrice <= this.form.trigger) {
                  this.calculateBreakevenPrice(true);
       }
      }

      //maintain profit lock code

      if (this.toggleMaintainProfit && this.$bybitApi.openPosition != null && this.form.maintainProfit >= 0) {
     
        if((this.$bybitApi.openPosition.unrealised_pnl*lastPrice) > this.form.maintainProfit){

            const positionSize = parseFloat(this.$bybitApi.openPosition.size); // Number of contracts
            const entryPrice = parseFloat(this.$bybitApi.openPosition.entry_price); // Entry price in USD
            const dollarProfit = parseFloat(this.form.maintainProfit); // Desired profit in USD
            const isLong = this.$bybitApi.openPosition.side == "Buy" ? true : false; // Short position
            const takeProfitPrice = parseFloat(entryPrice + (dollarProfit / (Math.abs(positionSize) / entryPrice))).toFixed(0);

            if(this.$bybitApi.openPosition.stop_loss != takeProfitPrice ){
            this.moveStops(takeProfitPrice);      
            }
        }
      
      }


    },
    deep: true
    },

    positionSize(size) {
      //watch the OPEN position size for changes and if we are tracking price update the qty form field to reflect the change
      console.log("Position size Changed");
      if(this.openPositionDirection() != false && this.TrackSizeSwitchStatus == true){
         this.qty = size;
      }     
     },

     form: {
      deep: true,
      handler: async function() {

        console.log("handler caalled")

        if (this.active
            && this.form.orderCountIn
            && this.form.priceOffsetIn
            && this.form.rangeIn
            && this.form.stopLoss
            ) {
          //await this.$nextTick();
           
            let Ladder = [];
            var buySell = "";
            var data = 0;
            var loopCount = 0;
            console.clear();
            var amount = this.$bybitApi.symbolInfo.minQty;
                
               if (this.form.priceOffsetIn < 0) {  
         
                      data = {
                              amount: amount,
                              orderCount: this.form.orderCountIn,
                              priceUpper: Number(parseFloat(this.$bybitApi.lastPrice - Math.abs(this.form.priceOffsetIn)).toFixed(this.$bybitApi.symbolInfo.priceScale))
                             }

                        data.priceLower = Number(parseFloat(data.priceUpper - this.form.rangeIn).toFixed(this.$bybitApi.symbolInfo.priceScale));
                        buySell = "Buy";
                       
                }else if (this.form.priceOffsetIn > 0) { 
              
                      data = {
                              amount: amount,
                              orderCount: this.form.orderCountIn,
                              priceLower: Number(parseFloat(this.$bybitApi.lastPrice)) + Math.abs(this.form.priceOffsetIn),
                             }
                        data.priceUpper = Number(data.priceLower) + Number(this.form.rangeIn);
                        
                        buySell = "Sell";
                  }    

              data.distribution = buySell == "Buy" ? ORDER_DISTRIBUTIONS.DECREASING.label : ORDER_DISTRIBUTIONS.INCREASING.label  
              data.tickSize = this.$bybitApi.currentTickSize;
              data.coefficient=parseInt(30);
              data.minTolerance = this.$bybitApi.symbolInfo.minQty;              

              //Do some estimations to reduce the amount of goalseeking required
              var average_entry = (Number(data.priceLower) + Number(data.priceUpper)) / 2;
              var positionSize = Math.round((this.$bybitApi.walletBalance * this.$bybitApi.lastPrice) * (this.form.riskPercent/100) / (Math.abs(average_entry-this.form.stopLoss)/average_entry));

              data.amount = positionSize;
             
              this.generatedLadder = this.generateOrders(data);
              var RiskPercent = this.calculateRisk(positionSize);

              while(RiskPercent <= this.form.riskPercent){
                //keep generating the ladder over and over increasing the total contracts for the ladder untill it reaches the desired risk percent is achieved.
          
                data.amount += parseFloat(this.$bybitApi.symbolInfo.minQty);
                this.generatedLadder = this.generateOrders(data);
                var RiskPercent = this.calculateRisk(data.amount);

              //  console.log(loopCount  + ") RiskPercent " + RiskPercent + " form.riskPercent " + this.form.riskPercent);
                
                 if(loopCount >= 200){
                 //  console.log("exiting loop itteration " + loopCount);
                   break;
                 }
                 loopCount++;
                 
               }
               
               //console.log("exited loop after iterations -  " + loopCount);
               console.log(this.generatedLadder);
               
               this.highPrice = parseFloat(data.priceUpper).toFixed(this.$bybitApi.symbolInfo.priceFraction);
               this.lowPrice  = parseFloat(data.priceLower).toFixed(this.$bybitApi.symbolInfo.priceFraction);
              // console.log("Contracts to trade = " + data.amount);
          
               this.preview = [];
               buySell = "Buy" ? this.calculateOrders('Buy', false, false) : this.calculateOrders('Sell', false, false);
         
               this.preview = this.orders;
               this.orders = [];
               
         this.$emit('order', {
         
              price: this.average(),
              stopLoss: this.form.stopLoss,
              takeProfit: this.form.takeProfit,
              orderType: 'limit',
            });
            
        }
      },
    },
  },
  
};

