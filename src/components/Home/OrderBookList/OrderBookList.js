export default {
  name: 'order-book-list',
  components: {},
  props: {
  },

  data() {

    return {
      formFieldQty:1,
      highlightedPricesData: [],
      previousBidSizes: {},
      previousAskSizes: {},
      timeout:300,
      

      orderBookHeaders: [
        {text: 'Total', value: 'bid_total', sortable: false, width:'16.6%'},
        {text: 'Size', value: 'bid_size', sortable: false, width:'16.6%'},
        {text: 'Price', value: 'bid_price', sortable: false, width:'16.6%'},
        {text: 'Price', value: 'ask_price', sortable: false, width:'16.6%'},
        {text: 'Size', value: 'ask_size', sortable: false, width:'16.6%'},
        {text: 'Total', value: 'ask_total', sortable: false, width:'16.6%'},
      ],
      
      maxBidTotal: this.$bybitApi.bid_total,
      maxAskTotal: this.$bybitApi.ask_total,
      
      lastPriceIncreasing: false,
      lastPriceDecreasing: false,
      markPriceIncreasing: false,
      markPriceDecreasing: false,
      lastPriceMarkPriceDifferenceIncreasing: false,
      lastPriceMarkPriceDifferenceDecreasing: false,

      pricePrecision: 2,
      precisionOptions: [],
      minPrecision: 2,
    }
   
  },
  created() {
    for (let i = 1; i <= 10; i++) {
      this.precisionOptions.push(this.minPrecision * i);
    }
  },

  computed: {

       
    items() {
      return this.$bybitApi.OrderBookParsed.map((item, index) => ({
        item,
        id: index
      }));
    },
  },
  mounted() {

     // Wait until the this.$bybitApi.OrderBookParsed array is populated
     this.$watch(() => this.$bybitApi.OrderBookParsed, () => {
      this.previousBidSizes = this.$bybitApi.OrderBookParsed.reduce((acc, item, index) => {
        acc[index] = null;
        return acc;
      }, {});
      this.previousAskSizes = this.$bybitApi.OrderBookParsed.reduce((acc, item, index) => {
        acc[index] = null;
        return acc;
      }, {});
    });

  },
  methods: {

    fillForm(val){
       if(val == 0){
        this.formFieldQty = 1;
       }else{
         this.formFieldQty += val;
    }
    },

    cancelOrder(price) {
      // Cancel all the orders at a given price, there shouldnt be, but there could be more than one order at the same price.
     
     const orderIDs = this.highlightedPricesData
                      .filter(hp => hp.price == price)
                      .map(hp => hp.orderId);

      for (const orderID of orderIDs) {
        this.$bybitApi.cancelOrder(orderID);
      }
    },

       async placeOrder(price,side, formFieldQty){
          console.log("Placing order at " + price);
          var size = formFieldQty;
       
          const result = await this.$bybitApi.placeOrder({
              side: side,
              symbol: this.$bybitApi.currentSymbol,
              price: price,
              order_type: 'Limit',
              qty: size,
              time_in_force: 'PostOnly',
              reduce_only: false,
              close_on_trigger: false
            });
  
             if(result == "OK"){
              //order sucessfully placed  
              this.$notify({
                text: "Placed Limit " + side +" Order for" + size + " Contracts",
                type: 'success',
              });
              
        }
  
    },


     bidSize (bidSize, id){
      // Use a local variable to store the previous bid size
      let previousBidSize = this.previousBidSizes[id];
    
      // If the previous bid size is null, set it to the current bid size
      if (previousBidSize === null) {
        previousBidSize = bidSize;
      } else if (bidSize > previousBidSize) {
        // If the current bid size is greater than the previous bid size
        previousBidSize = bidSize;
        // Use getElementById instead of querySelector for better performance
        document.getElementById(`bid-size-${id}`).classList.add('green-fade');
        setTimeout(() => {
          document.getElementById(`bid-size-${id}`).classList.remove('green-fade');
        }, this.timeout);
      } else if (bidSize < previousBidSize) {
        // If the current bid size is less than the previous bid size
        previousBidSize = bidSize;
        this.flashRedBid(id);
      }
      this.previousBidSizes[id] = previousBidSize;
      return bidSize.toLocaleString('en-US');
    },

    askSize(askSize, id) {
       if (this.previousAskSizes[id] === null) {
         this.previousAskSizes[id] = askSize;
       } else if (askSize > this.previousAskSizes[id]) {
         this.previousAskSizes[id] = askSize;
         this.$el.querySelector(`#ask-size-${id}`).classList.add('green-fade');
         setTimeout(() => {
           this.$el.querySelector(`#ask-size-${id}`).classList.remove('green-fade');
         }, this.timeout);
       } else if (askSize < this.previousAskSizes[id]) {
         this.previousAskSizes[id] = askSize;
         this.flashRedAsk(id);
       }
       return askSize.toLocaleString('en-US');
     },

    flashRedAsk(id) {
      this.$el.querySelector(`#bid-size-${id}`).classList.add('red-flash');
      setTimeout(() => {
        this.$el.querySelector(`#bid-size-${id}`).classList.remove('red-flash');
      }, this.timeout);
    },

    flashRedBid(id) {
      this.$el.querySelector(`#ask-size-${id}`).classList.add('red-flash');
      setTimeout(() => {
        this.$el.querySelector(`#ask-size-${id}`).classList.remove('red-flash');
      }, this.timeout);
    },

  maxBidTotalCalc: function(item){
    return item/this.$bybitApi.bid_total * 100
  },
  maxAskTotalCalc: function(item){
    return item/this.$bybitApi.ask_total * 100
  },

  maxBidSizeCalc: function(item){
    return item/this.$bybitApi.maxBid_size*100
  },
  maxAskSizeCalc: function(item){
    return item/this.$bybitApi.maxAsk_size*100
  },

  sum : function(items, prop){
      return items.reduce( function(a, b){
        return a + b[prop];
      }, 0);
  },
  sumb : function(items) {
      return items.length;
    }
  },watch: { 

    '$bybitApi.openOrders': {
        handler(newOpenOrders) {
          this.highlightedPricesData = this.$bybitApi.openOrders.map(order => ({ price: Number(order.price), orderId: order.order_id }));
        },

      deep: true
    }

  },
 
};