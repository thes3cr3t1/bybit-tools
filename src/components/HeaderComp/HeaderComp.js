import { map } from "lodash";
import { VTooltip } from 'vuetify/lib';

export default {

  name: 'header-comp',
  components: {
    VTooltip
  },
  props: [],

  data() {
   
    return {

      headers: [
        { text: '', value: '' },
        { text: 'Coin', value: 'contractType' },
        { text: 'Price', value: 'last_price' },
        { text: '24H Chg', value: 'price_24h_pcnt' },
        { text: '24H Vol', value: 'volume_24h' },
      ],
      renderMenu:false,
      symbol:this.$bybitApi.currentSymbol,
      symbolMap:this.$bybitApi.symbolMap,
      coinImageMap: new map(),
      isVisible: false,
      search: "",
      items: this.$bybitApi.Tickers,
      lastPriceIncreasing: false,
      lastPriceDecreasing: false,
      markPriceIncreasing: false,
      markPriceDecreasing: false,
      lastPriceMarkPriceDifferenceIncreasing: false,
      lastPriceMarkPriceDifferenceDecreasing: false,
      countdownTimer: "",
      fundingRate: "",

    };

  },
  async mounted() {

    // Start the countdown timer
   

    // Wait for symbolMap to have data before populating coinImageMap
    while (!this.$bybitApi.fundingTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.updateCountdownTimer();

    await this.$bybitApi.getCoinIcons();
    console.log("getting coin icons");

    // Wait for symbolMap to have data before populating coinImageMap
    while (!this.$bybitApi.symbolMap) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.coinImageMap = this.$bybitApi.symbolMap;
    this.renderMenu = true;
  },
  computed: {
    filteredItems(){
      return this.$bybitApi.Tickers.filter(item => item.symbol.toLowerCase().includes(this.search.toLowerCase()))
    },

    usdBalance(){
      if (this.$bybitApi.walletBalance) {
          return parseFloat(this.$bybitApi.walletBalance * this.$bybitApi.lastPrice).toFixed(2);
      }
      
    },

  },
 methods: {

  updateCountdownTimer() {

    if (!this.$bybitApi.fundingTime) {
      console.log("Exiting funding time empty");
      return; // Exit if fundingTime is empty
    }

    const nextFundingTime = new Date(this.$bybitApi.fundingTime).getTime(); // Next funding time in milliseconds

    const now = new Date().getTime(); // Current time in milliseconds

    const timeRemaining = nextFundingTime - now; // Time remaining in milliseconds

    // Calculate hours, minutes, and seconds
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    // Format the countdown timer
    this.countdownTimer = hours.toString().padStart(2, "0") + ":" +
                          minutes.toString().padStart(2, "0") + ":" +
                          seconds.toString().padStart(2, "0");

    // Update the countdown every second
    if (timeRemaining > 0) {
      setTimeout(this.updateCountdownTimer, 1000);
    }
  },
  
  //get the symboltag varible from the bybit array, place icons for hot, trending, or new menu items.
  symbolTagImage(item, SearchTerm) {
    if (this.coinImageMap.get(item.symbol).symbolTags) {
       
      if (this.coinImageMap.get(item.symbol).symbolTags.includes(SearchTerm) && SearchTerm == "NEW") {
          return 'https://www.bybit.com/bycsi-root/assets/image/hot.svg';
        } else if (this.coinImageMap.get(item.symbol).symbolTags.includes(SearchTerm )  && SearchTerm == "Trending") {
           return 'https://www.bybit.com/bycsi-root/assets/image/hot.svg';
        } else if (this.coinImageMap.get(item.symbol).symbolTags.includes(SearchTerm)  && SearchTerm == "HOT") {
        return 'https://www.bybit.com/bycsi-root/assets/image/hot.svg';
     }
    }
    return '';
    },

  changeSymbol(newSymbol) { this.$bybitApi.changeSymbol(newSymbol); },
  
  },
  watch: { 
  
    '$bybitApi.lastPrice': function(newPrice, oldPrice) {
      if (newPrice > oldPrice) {
        this.lastPriceIncreasing = true;
        this.lastPriceDecreasing = false;
      } else {
        this.lastPriceIncreasing = false;
        this.lastPriceDecreasing = true;
      }
    },
    '$bybitApi.markPrice': function(newPrice, oldPrice) {
      if (newPrice > oldPrice) {
        this.markPriceIncreasing = true;
        this.markPriceDecreasing = false;
      } else {
        this.markPriceIncreasing = false;
        this.markPriceDecreasing = true;
      }
    },
    '$bybitApi.lastPriceMarkPriceDifference': function() {
      if (this.$bybitApi.lastPrice < this.$bybitApi.markPrice) {
        //long green
        this.lastPriceMarkPriceDifferenceIncreasing = true;
        this.lastPriceMarkPriceDifferenceDecreasing = false;
      } else {
        //short red
        this.lastPriceMarkPriceDifferenceIncreasing = false;
        this.lastPriceMarkPriceDifferenceDecreasing = true;
      }
    },
  },
};
