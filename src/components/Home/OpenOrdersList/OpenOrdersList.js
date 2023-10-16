import { mdiConsoleNetwork } from "@mdi/js";

export default {
  name: 'open-orders-list',
  components: {},
  props: [],
  data() {
    return {
      headers: [
        { text: 'Side', value: 'side', width: '5%' },
        { text: 'Qty', value: 'qty', width: '10%' },
        { text: 'Price', value: 'price', width: '10%' },
        { text: 'Type', value: 'order_type', width: '5%' },
        { text: 'Updated At', value: 'updated_at', width: '20%' },
        { text: 'P&L', value: 'PL', width: '20%' },
        { text: 'Total P&L', value: 'totalPL', width: '20%' },
        { text: 'Cancel', value: 'cancel', width: '30%' },
      ],
    };
  },
 computed: {
  
    sortedOpenOrders: function () {
      
      if (!this.$bybitApi.openOrders || this.$bybitApi.openOrders.length === 0 || !this.$bybitApi.openPosition) {
        return [];
      }
      

        const lastPrice = this.$bybitApi.lastPrice;
        var buyOrders = this.$bybitApi.openOrders.filter(order => order.side === 'Buy').sort((a, b) => b.price - a.price); // Sort buy orders by price in descending order
        var sellOrders = this.$bybitApi.openOrders.filter(order => order.side === 'Sell').sort((a, b) => b.price - a.price); // Sort sell orders by price in descending order
          
        var  pl = parseFloat(((1 / this.$bybitApi.openPosition.entry_price) - (1 / this.$bybitApi.lastPrice)) * this.$bybitApi.openPosition.size * lastPrice).toFixed(2);
      //  console.log(pl);

       
        let totalPL = 0;
        const sortedOrders = [];

        for (let i = sellOrders.length - 1; i >= 0; i--) {
          const order = sellOrders[i];
          const PL =
            this.$bybitApi.openPosition.side === 'Sell' && order.side === 'Buy' && order.price < this.$bybitApi.openPosition.entry_price
              ? (order.qty * Math.abs(this.$bybitApi.openPosition.entry_price - order.price)) / order.price
              : this.$bybitApi.openPosition.side === 'Buy' && order.side === 'Sell' && order.price > this.$bybitApi.openPosition.entry_price
              ? (order.qty * Math.abs(this.$bybitApi.openPosition.entry_price - order.price)) / order.price
              : 0;
          totalPL += PL;

          sortedOrders.unshift({ ...order, PL, totalPL: totalPL });
        }

        let insertIndex = 0;

        for (const order of buyOrders) {
          var PL =
            this.$bybitApi.openPosition.side === 'Buy' && order.side === 'Sell' && order.price > this.$bybitApi.openPosition.entry_price
              ? (order.qty * Math.abs(this.$bybitApi.openPosition.entry_price - order.price)) / order.price
              : this.$bybitApi.openPosition.side === 'Sell' && order.side === 'Buy' && order.price < this.$bybitApi.openPosition.entry_price 
              ? (order.qty * Math.abs(this.$bybitApi.openPosition.entry_price - order.price)) / order.price
              : 0;
           
              totalPL += PL;

              if( this.$bybitApi.openPosition.side === 'Sell' && order.side === 'Buy' && order.price < this.$bybitApi.openPosition.take_profit){
                totalPL = 0;
              //  PL = 0;
               }

              sortedOrders.push( { ...order, PL, totalPL: totalPL });
        }

        //console.log(sortedOrders);

        const entryPriceOrder = {
          side:  this.$bybitApi.openPosition.side,
          qty: this.$bybitApi.openPosition.size,
          price: parseFloat(this.$bybitApi.openPosition.entry_price).toFixed(2),
          order_type: 'Entry',
          PL: parseFloat(this.$bybitApi.openPosition.unrealised_pnl * lastPrice).toFixed(2),
          updated_at: this.$bybitApi.openPosition.updated_at,
          totalPL: parseFloat(this.$bybitApi.openPosition.unrealised_pnl * lastPrice).toFixed(2),
        };

        // Find the index of the next highest price and the next lowest price
        let nextHighestIndex = sortedOrders.findIndex(order => order.price > entryPriceOrder.price);
        let nextLowestIndex = sortedOrders.findIndex(order => order.price < entryPriceOrder.price);

        if (nextHighestIndex === -1 && nextLowestIndex === -1) {
          // If there are no buy or sell orders in sortedOrders, push the entryPriceOrder
          sortedOrders.push(entryPriceOrder);
        } else if (nextHighestIndex === -1) {
          // If there are only sell orders in sortedOrders, insert the entryPriceOrder at the beginning
          sortedOrders.splice(0, 0, entryPriceOrder);
        } else if (nextLowestIndex === -1) {
          // If there are only buy orders in sortedOrders, insert the entryPriceOrder at the end
          sortedOrders.push(entryPriceOrder);
        } else {
          // If there are both buy and sell orders in sortedOrders, insert the entryPriceOrder between the next highest and next lowest prices
          const insertIndex = nextHighestIndex > nextLowestIndex ? nextHighestIndex : nextLowestIndex;
          sortedOrders.splice(insertIndex, 0, entryPriceOrder);
        }



      ///the entry price should be inserted between the next highest price and the next lowest price here.
      //if there are only buy orders in the sortedOrders array then the entry price will be at a higher price than any of the buy orders
      ///if there are only sell orders in the sortedOrders array then the entry price will be at a lower price than any of the sell orders.

      //modify the code to add the entryPriceOrder to the sortedOrders in the correct position here:

        var  PositivePL = parseFloat(((1 / this.$bybitApi.openPosition.entry_price) - (1 / this.$bybitApi.lastPrice)) * this.$bybitApi.openPosition.size * lastPrice).toFixed(2);

        const entryPricePL = (() => {
          if (this.$bybitApi.openPosition.side === 'Sell') {
            if (lastPrice < this.$bybitApi.openPosition.entry_price) {
              return PositivePL
            } else {
              return PositivePL
            }
          } else if (this.$bybitApi.openPosition.side === 'Buy') {
            if (lastPrice > this.$bybitApi.openPosition.entry_price) {
              return PositivePL
           } else {
              return PositivePL
            }
          }
          return 0;
        })();


        const entryPricePLString = entryPricePL;
        entryPriceOrder.PL = parseFloat(entryPricePLString);
        entryPriceOrder.totalPL = parseFloat(entryPricePLString);

          // Check if take profit order is set
          if (this.$bybitApi.openPosition.take_profit != null) {
           
            let takeProfitQty = this.$bybitApi.openPosition.size; // Initial quantity for take profit order
  
            // Subtract the quantity of sell orders that are less than the take profit price

            if(this.$bybitApi.openPosition.side == "Buy"){
              for (const order of sortedOrders) {
                if (order.price < this.$bybitApi.openPosition.take_profit && order.side === 'Sell') {
                  takeProfitQty -= order.qty;
                  order.order_type = 'Reduce';
                } else if (order.price < this.$bybitApi.openPosition.entry_price && this.$bybitApi.openPosition.side == 'Buy' && order.order_type != "Entry") {
                  order.order_type = 'Limit';
                } else if (order.price > this.$bybitApi.openPosition.take_profit && order.order_type != "Entry") {
                  order.PL = 0;
                  order.totalPL = 0;
                }
              }
          }else if(this.$bybitApi.openPosition.side == "Sell"){
            for (const order of sortedOrders) {
              if (order.price > this.$bybitApi.openPosition.take_profit && order.side === 'Buy') {
                takeProfitQty -= order.qty;
                order.order_type = 'Reduce';
              } else if (order.price < this.$bybitApi.openPosition.entry_price && this.$bybitApi.openPosition.side == 'Buy' && order.order_type != "Entry") {
                order.order_type = 'Limit';
              } else if (order.price > this.$bybitApi.openPosition.take_profit && order.order_type != "Entry") {
                order.PL = 0;
                order.totalPL = 0;
              }
            }
          }

         
  
            const takeProfitPL =
              this.$bybitApi.openPosition.side === 'Sell' && this.$bybitApi.openPosition.take_profit < lastPrice
                ? (takeProfitQty * Math.abs(this.$bybitApi.openPosition.entry_price - this.$bybitApi.openPosition.take_profit)) /
                  this.$bybitApi.openPosition.take_profit
                : this.$bybitApi.openPosition.side === 'Buy' && this.$bybitApi.openPosition.take_profit > lastPrice
                ? (takeProfitQty * Math.abs(this.$bybitApi.openPosition.entry_price - this.$bybitApi.openPosition.take_profit)) / 
                  this.$bybitApi.openPosition.take_profit
                : 0;

               // console.log(takeProfitPL);
               // console.log(sortedOrders);
  
            const takeProfitOrder = {
              side: this.$bybitApi.openPosition.side == "Sell" ? "Buy" : "Sell",
              qty: takeProfitQty,
              price: this.$bybitApi.openPosition.take_profit,
              order_type: 'Take Profit',
              PL: takeProfitPL,
              updated_at: this.$bybitApi.openPosition.updated_at,
              //: takeProfitPL + sortedOrders[sortedOrders.length - 1].totalPL,
              // totalPL: this.$bybitApi.openPosition.side == "Sell" ? takeProfitPL + sortedOrders[sortedOrders.length - 1].totalPL : takeProfitPL + sortedOrders[1].totalPL,
              totalPL : takeProfitPL
            };


  
            // Find the correct position to insert the take profit order based on price
            insertIndex = sortedOrders.findIndex((order) => order.price < this.$bybitApi.openPosition.take_profit);
            if (insertIndex === -1) {
              insertIndex = sortedOrders.length;
            }
  
            sortedOrders.splice(insertIndex, 0, takeProfitOrder);
          }

        // Check if stop loss order is set
        if (this.$bybitApi.openPosition.stop_loss != null) {
          let stopLossQty = this.$bybitApi.openPosition.size; // Initial quantity for stop loss order


          const stopLossPL =
            this.$bybitApi.openPosition.side === 'Sell' && this.$bybitApi.openPosition.stop_loss > lastPrice
              ? (stopLossQty * Math.abs(this.$bybitApi.openPosition.entry_price - this.$bybitApi.openPosition.stop_loss)) /
                this.$bybitApi.openPosition.stop_loss
              : this.$bybitApi.openPosition.side === 'Buy' && this.$bybitApi.openPosition.stop_loss < lastPrice
              ? (stopLossQty * Math.abs(this.$bybitApi.openPosition.entry_price - this.$bybitApi.openPosition.stop_loss)) /
                this.$bybitApi.openPosition.stop_loss
              : 0;

          const stopLossOrder = {
            side: 'Sell',
            qty: stopLossQty,
            price: this.$bybitApi.openPosition.stop_loss,
            order_type: 'Stop Loss',
            PL: parseFloat(stopLossPL.toFixed(2)),
            updated_at: this.$bybitApi.openPosition.updated_at,
            totalPL: parseFloat(stopLossPL.toFixed(2)),
          };

          // Find the correct position to insert the stop loss order based on price
          insertIndex = sortedOrders.findIndex(order => order.price < this.$bybitApi.openPosition.stop_loss);
          if (insertIndex === -1) {
            insertIndex = sortedOrders.length;
          }

          sortedOrders.splice(insertIndex, 0, stopLossOrder);
        }

     
        return sortedOrders;
      
    },

    
  },
  mounted() {},
  methods: {
    
    sum: function (items, prop) {
      return items.reduce(function (a, b) {
        return a + b[prop];
      }, 0);
    },
    sumb: function (items) {
      return items.length;
    },
  },
  filters: {
    formatDate: function (value) {
      // Custom date formatting logic here
      const date = new Date(value);
      const options = {
        hour: '2-digit',
        minute: '2-digit',
      };
      return date.toLocaleString('en-US', options);
    },
  },
};
