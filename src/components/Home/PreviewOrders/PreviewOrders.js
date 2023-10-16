export default {
  name: 'preview-orders',
  components: {},
  props: ['orders'],
  data() {
    return {
      headers: [
        {text: 'Side', value: 'side'},
        {text: 'Symbol', value: 'symbol'},
        {text: 'Qty', value: 'qty'},
        {text: 'Price', value: 'price'},
        {text: 'Take Profit', value: 'take_profit'},
        {text: 'Stop Loss', value: 'stop_loss'},
        {text: 'Reduce Only', value: 'reduce_only'},
      ],
      totalAll: 0,
      totalQty: 0,

      
    };
  },
  mounted() {
    this.calculateTotals();
  },
  watch: {
    orders: function(newOrders, oldOrders) {
      if (newOrders !== oldOrders) {
        this.calculateTotals();
      }
    },
  },
  methods: {
    calculateTotals() {
      this.totalAll = 0;
      this.totalQty = 0;
      for (let i = 0; i < this.orders.length; i++) {
        this.totalAll += this.orders[i].qty * this.orders[i].price;
        this.totalQty += this.orders[i].qty;
      }
    },
  },
  computed: {

   
    
    leverage: function() {
      
      //var leverage = this.totalQty / ((this.totalAll / this.totalQty) - this.orders[0].stop_loss)  / 1;
      var usdBalance = this.$bybitApi.walletBalance * this.$bybitApi.lastPrice;
      var leverage = Math.max((this.totalQty / usdBalance), 1).toFixed(2);


      return parseFloat(leverage).toFixed(1);
      
    },

   contracts: function() {

       return this.totalQty;
    },
    percentIncrease: function() {

   
      let profit = Math.abs(
        (1 / this.average) - (1 / parseFloat(this.orders[0].take_profit))) *
        this.totalQty;

        var usdBalance = this.$bybitApi.walletBalance * this.$bybitApi.lastPrice;
        var usdProfit = profit * this.$bybitApi.lastPrice;
      
        return ((usdProfit/usdBalance)*100).toFixed(2) + '%';
      
    
   },  

   average: function() {
    return parseFloat(this.totalAll / this.totalQty).toFixed(2);
    
  },
  
    tpProfit: function() {

      if (this.average && this.orders[0].take_profit && this.totalQty) {
    
        const potentialProfit = (this.orders[0].take_profit - this.average) * this.totalQty;
        return   (potentialProfit).toFixed(2) + ' USD';

      }
    },
    slLoss: function() {

      if (this.average && this.orders[0].stop_loss && this.totalQty) {

          const potentialLoss = (this.average - this.orders[0].stop_loss) * this.totalQty ;
          return (potentialLoss).toFixed(2) + ' USD (including fees)'; //usd only
    

      }
    },
  }
};
