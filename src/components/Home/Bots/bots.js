import { map } from "lodash";
import moment from 'moment';


export default {
  name: 'bots',
  components: {},
  props: ['bot'],
  data() {

    return {
      bots: [],
      
      newBot: {
                side: 'Long',
                priceSteps: 1,
                tpTarget: 0.75,
                leverage: 1,
                initialOrderMargin: 1,
                safetyOrderMargin: 1,
                maxSafetyOrders: 4,
                priceOffset: 0,
                priceStepsMultiplier: 1,
                amountMultiplier: 2,
                slTarget:1.5,
              }
   }

  },

  async mounted() {
    
    this.bots = this.$bybitApi.botManager.bots; // Populate initial bots data

     this.$watch(
      () => this.$bybitApi.botManager.bots,
      (newBots) => {
        this.bots = newBots;
      }
    );
    
  },
  computed: {

    previewedBot() {

        //Calulate the invested margin in USD
      
        var investedMargin = this.calculateInvestedMargin(this.newBot.initialOrderMargin, 
                                                          this.newBot.safetyOrderMargin,
                                                          this.newBot.maxSafetyOrders, 
                                                          this.newBot.amountMultiplier);
       // console.log('Invested Margin:', investedMargin);

        //Calculate Order Prices and Position Size for each order

           var data = {
              ticker: this.newBot.ticker,
              side: this.newBot.side,
              priceSteps: this.newBot.priceSteps,
              tpTarget: this.newBot.tpTarget,
              leverage: this.newBot.leverage,
              initialOrderMargin: this.newBot.initialOrderMargin,
              safetyOrderMargin: this.newBot.safetyOrderMargin,
              maxSafetyOrders: this.newBot.maxSafetyOrders,
              priceOffset: this.newBot.priceOffset,
              priceStepsMultiplier: this.newBot.priceStepsMultiplier,
              amountMultiplier: this.newBot.amountMultiplier,
              investedMargin: investedMargin,
              slTarget: this.newBot.slTarget
            
            };

            return data;
    }, 
   
   
  },
  methods: {

    addNewBot() {
      var investedMargin = this.calculateInvestedMargin(this.newBot.initialOrderMargin, 
                                                        this.newBot.safetyOrderMargin,
                                                        this.newBot.maxSafetyOrders, 
                                                        this.newBot.amountMultiplier);

      this.newBot.investedMargin = investedMargin;
      this.$bybitApi.botManager.createBot(this.newBot); 
           
    },
    // Other methods like startBot, stopBot, and deleteBot

    calculateInvestedMargin(initialOrderMargin, safetyOrderMargin, maxSafetyOrders, amountMultiplier) {
      
      let investedMargin = initialOrderMargin;
    
      for (let i = 0; i < maxSafetyOrders; i++) {
        investedMargin += safetyOrderMargin * Math.pow(amountMultiplier, i);
      }
    
      return investedMargin + ' USDT';
      //return investedMargin.toFixed(2) + ' USDT';
    },

    deleteBot(bot){
        console.log("Deleting Bot")
        this.stopBot(bot);
        this.$bybitApi.botManager.deleteBot(bot); 
    },

    startBot(bot){
     
       this.$bybitApi.botManager.startBot(bot.ticker); 
    },

    stopBot(bot){
      console.log("Stopping Bot")
      console.log(bot);
      let position = this.$bybitApi.botManager.CheckOpenPosition(bot.ticker);

      if(position){
        var size = bot.position.size;
        this.$bybitApi.placeOrderV5({
          side: bot.position.side === 'Buy' ? 'Sell' : 'Buy',
          symbol: bot.position.symbol,
          order_type: 'Market',
          qty: size,
          time_in_force: 'GoodTillCancel',
      });

      this.$notify({
        text: "Placing Market Close Order for " + size + " Contracts",
        type: 'success',
      });
    }

     this.$bybitApi.cancelAllOpenOrdersV5(bot.ticker);

    },

  
  },
  watch: {
    

  },
};
