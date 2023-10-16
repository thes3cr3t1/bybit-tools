import { mdiConsoleNetworkOutline } from '@mdi/js';
import TradingStops from './TradingStops';

export default {
  name: 'open-position',
  components: {TradingStops},
  props: [],
  data() {
    return {
      dialog: false,
      breakEven:'0',
      headers: [
        {text: 'Market', value: 'symbol'},
        {text: 'Qty', value: 'size'},
        {text: 'Break Even', value: 'breakEven'},
        {text: 'Entry', value: 'avgPrice'},
        {text: 'Liq. Price', value: 'liqPrice'},
        {text: 'Leverage', value: 'leverage'}, 
        {text: 'Static Risk Reward', value: 'static_risk_reward', default: '0'},
        {text: 'Dynamic Risk Reward', value: 'risk_reward', default: '0'},
        {text: 'Dollar Risk', value: 'dollar_risk', default: '0'},
        {text: 'Risk Percent', value: 'risk_percent', default: '0'},
        {text: 'Dollar Gain', value: 'dollar_gain', default: '0'},
        {text: 'Perecnt Gain', value: 'gain_percent', default: '0'},
        {text: 'Unrealised P&L', value: 'unrealisedPnl'},
        // {text: 'Daily Realized P&L', value: 'realised_pnl'},
        // {text: 'Daily Total (% of Account)', value: 'daily_total'},
        {text: 'SL', value: 'stopLoss'},
        {text: 'TP', value: 'takeProfit'},
        // {text: 'TS', value: 'trailing_stop'},
        {text: 'Stops', value: 'trading_stops'},
        {text: 'Market close', value: 'market_close'},
      ],
    };
  },
  computed: {

    positionSize: function() {
       return this.$bybitApi.openPosition.size;
   }

  },
  mounted() {
    this.calculateBreakevenPrice();
  },
   watch: {
           
    positionSize(size) {
      //watch the OPEN position size for changes and if we are tracking price update the qty form field to reflect the change
      this.breakEven = this.calculateBreakevenPrice();
         
     }
    },
  methods: {

   
      shouldFlashLiqPrice(item) {
        const stopLoss = parseFloat(item.stopLoss);
        const liquidationPrice = parseFloat(item.liqPrice);
        const isLong = item.side === 'Buy';
        const stopLossLessThanLiqPrice = stopLoss < liquidationPrice;
        const stopLossGreaterThanLiqPrice = stopLoss > liquidationPrice;
    
        if (item.stopLoss <= 0) {
          // Flash if stop loss is not set
          return true;
        } else if (isLong && stopLossLessThanLiqPrice) {
          // Flash if long position and stop loss is less than liquidation price
          return true;
        } else if (!isLong && stopLossGreaterThanLiqPrice) {
          // Flash if short position and stop loss is greater than liquidation price
          return true;
        }
    
        return false;
      },
    
    

    
    calculateBreakevenPrice(){ 

       this.breakEven = this.$bybitApi.calculateBreakevenPrice();

      return this.breakEven;
     },

    risk_reward(){
        var size = Number(this.$bybitApi.openPosition.size);
        var stop = parseFloat(this.$bybitApi.openPosition.stopLoss);
        var tp = parseFloat(this.$bybitApi.openPosition.takeProfit);
        var entry = parseFloat(this.$bybitApi.lastPrice);
        
        var potentialLoss = size * (Math.abs(entry-stop) / stop);
        var potentialGain = size * (Math.abs(entry-tp) / tp);

        if(stop <= 0 || tp <= 0){
          return 0;
        }

        return parseFloat(potentialLoss > potentialGain ? potentialLoss/potentialGain : potentialGain / potentialLoss).toFixed(2);
    },

    calculateFees(size, price) {
      const feeRate = 0.0006; // Fee rate for Bybit exchange
      const leverage = this.$bybitApi.openPosition.leverage;
      const orderValue = size / price; // Value of the order in BTC/USD

      // Calculate the fees for opening and closing the position
      const openFee = orderValue * feeRate;
      const closeFee = (orderValue / leverage) * feeRate;

      return openFee + closeFee;
    },
    

    static_risk_reward(){

      var size = Number(this.$bybitApi.openPosition.size);
      var stop = parseFloat(this.$bybitApi.openPosition.stopLoss);
      var tp = parseFloat(this.$bybitApi.openPosition.takeProfit);
      var entry = parseFloat(this.$bybitApi.openPosition.avgPrice);
      
      var potentialLoss = size * (Math.abs(entry-stop) / stop);
      var potentialGain = size * (Math.abs(entry-tp) / tp);

      if(stop <= 0 || tp <= 0){
        return 0;
      }

      return parseFloat(potentialLoss > potentialGain ? potentialLoss/potentialGain : potentialGain / potentialLoss).toFixed(2);
  },

  calculatePotentialProfit(entryPrice, positionSize, takeProfitPrice) {
    // Calculate potential profit
    const potentialProfit = (takeProfitPrice - entryPrice) * positionSize;
    return potentialProfit;
  },
  
  calculatePotentialLoss(entryPrice, positionSize, stopLossPrice) {
    // Calculate potential loss
    const potentialLoss = (entryPrice - stopLossPrice) * positionSize;
    return potentialLoss;
  },  
   dollar_risk(){

  //   if(this.$bybitApi.openPosition.stopLoss <= 0){
  //     return parseFloat(this.$bybitApi.walletBalance * this.$bybitApi.lastPrice).toFixed(2);
  //   }else{
  //     var riskUSD = parseFloat(this.$bybitApi.openPosition.size*(Math.abs(this.$bybitApi.openPosition.avgPrice-parseFloat(this.$bybitApi.openPosition.stopLoss).toFixed(this.$bybitApi.symbolInfo.priceScale)))/this.$bybitApi.openPosition.avgPrice ).toFixed(2);
  //     return riskUSD;
  //  }

  return parseFloat(this.calculatePotentialLoss(this.$bybitApi.openPosition.avgPrice, this.$bybitApi.openPosition.size, this.$bybitApi.openPosition.stopLoss)).toFixed(2);
  
   },
   
   dollar_gain(){

    // var dollar_gain = parseFloat(this.$bybitApi.openPosition.size *  Math.abs(this.$bybitApi.openPosition.avgPrice - this.$bybitApi.openPosition.takeProfit) / this.$bybitApi.openPosition.takeProfit).toFixed(2);
    // return dollar_gain;
    return parseFloat(this.calculatePotentialProfit(this.$bybitApi.openPosition.avgPrice, this.$bybitApi.openPosition.size, this.$bybitApi.openPosition.takeProfit)).toFixed(2);
   },
   calculateRiskPercent() {
    var riskUSD = this.dollar_risk();
    var riskPercent = parseFloat(riskUSD / this.$bybitApi.walletBalance  * 100).toFixed(2);
    return riskPercent;
  },

  gain_percent() {
    var dollarGain =  this.dollar_gain();
  
    var gainPercent = parseFloat(dollarGain / this.$bybitApi.walletBalance * 100).toFixed(2);
  
    return gainPercent;
  },
    risk_percent(){

    //   if(this.$bybitApi.openPosition.stopLoss <= 0){
      
    //     return "100"
    //   }else{
    //  var riskUSD = parseFloat(this.$bybitApi.openPosition.size*(Math.abs(this.$bybitApi.openPosition.avgPrice-parseFloat(this.$bybitApi.openPosition.stopLoss).toFixed(this.$bybitApi.symbolInfo.priceScale)))/this.$bybitApi.openPosition.avgPrice).toFixed(2);
    //  var usdBalance = this.$bybitApi.walletBalance * this.$bybitApi.lastPrice;
    //  var riskPercent = parseFloat(riskUSD/(usdBalance) * 100).toFixed(2);
    //  return riskPercent;
    //   }

    return this.calculateRiskPercent();

    },
    dailyTotal(item) {
      return this.unrealised_pnl_last(item.avgPrice, item.size, item.side) + item.realised_pnl;
    },

    realisedPnl(){

      
      const realisedPnL = (exitPrice - entryPrice) * positionSize;

      return realisedPnL;
    },
    unrealised_pnl_last(price, qty, side) {

      // console.log(this.$bybitApi.contractType);

      // console.log(price + " " + qty + " " + side);

      // if (side === 'Buy' && this.$bybitApi.contractType == "LinearPerpetual") {
         
      //       return qty * (parseFloat(this.$bybitApi.lastPrice) - price);
     
      //     }else if (side === 'Sell' && this.$bybitApi.contractType == "LinearPerpetual") {
         
      //       return qty * (price - this.$bybitApi.lastPrice);
     
      //     }else if (side === 'Buy' && this.$bybitApi.contractType == "InversePerpetual") {
          
      //       return ((1 / price) - (1 / parseFloat(this.$bybitApi.lastPrice))) * qty;
       
      //     }else if (side === 'Sell' && this.$bybitApi.contractType == "InversePerpetual") {
         
      //       return ((1 / parseFloat(this.$bybitApi.lastPrice) - (1 / price))) * qty;
     
      // }
      return parseFloat(this.$bybitApi.openPosition.unrealisedPnl);
    },
  },
};
