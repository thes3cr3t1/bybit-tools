import { map } from "lodash";

export default {
  name: 'screener',
  components: {},
  props: ['active'],
  data() {
    return {
      headers: [
        { text: '', value: '' },
        { text: 'Contract', value: 'symbol' },
        { text: 'Price', value: 'last_price' , type: 'numeric'},
        { text: 'Bias', value: 'bias' },
        { text: '24H Chg', value: 'price_24h_pcnt', type: 'numeric' },
        { text: '24H Vol', value: 'volume_24h', type: 'numeric' },
        { text: '15 Min RSI', value: 'rsiValues'},
        { text: '15 Min ATR', value: 'atrValues'},
        { text: 'Support', value: 'Support', type: 'numeric' },
        { text: '%S Move', value: 'supportPercentChange', type: 'numeric'},
        { text: 'RR', value: 'longRR', type: 'numeric'},
        { text: 'Resistance', value: 'Resistance' , type: 'numeric'},
        { text: '%R Move', value: 'resistancePercentChange' , type: 'numeric' },
        { text: 'RR', value: 'shortRR' , type: 'numeric'},  
      ],
      day: this.$bybitApi.day,
      week: '',
      month: '',
      renderMenu: false,
      symbol: this.$bybitApi.currentSymbol,
      symbolMap: this.$bybitApi.symbolMap,
      rsiValues: this.$bybitApi.rsiValues, 
      atrValues: this.$bybitApi.atrValues, 
      scannerSupportResistance: this.$bybitApi.scannerSupportResistance,
      coinImageMap: {},
      isVisible: false,
      search: "",
      items: this.$bybitApi.Tickers,
      Bias: {} 
    };
  },
  async mounted() {

    //disable below temporarily
   // await this.fetchAllData();
   // this.renderMenu = true;
   

  },
  computed: {
    
    filteredItems() {
      const searchTerms = this.search.split(',').map(term => term.trim().toLowerCase());
      if (searchTerms.length === 0) {
        return this.$bybitApi.Tickers;
      } else {
        return this.$bybitApi.Tickers.filter(item => {
          return searchTerms.some(term => item.symbol.toLowerCase().includes(term));
        });
      }
    },


    Bias() {
      const bias = {};
      for (const item of this.$bybitApi.Tickers) {
        const trendPromise = this.$bybitApi.Trend[item.symbol];

        console.log(trendPromise);
        console.log("HERE");
    
        if (trendPromise instanceof Promise) {
          // If the item's Trend is a Promise, display 'Loading...' until it's resolved.
          console.log("here 2");
          bias[item.symbol] = 'Loading...';
          // Update the Bias when the promise is resolved.
          trendPromise.then((resolvedValue) => {
            bias[item.symbol] = resolvedValue;
          });
        } else {
          console.log("here 3");
          // If it's not a Promise, directly use the value (could be a string or 'undefined').
          bias[item.symbol] = trendPromise || 'Loading...';
        }
      }
      return bias;
    },
    
    
  },
  methods: {

    updateFilteredItems() {
      // Method to update filteredItems if needed, for example, if you have additional real-time updates.
    },

    getLastItemInArray(nestedArray) {
      if (!nestedArray || nestedArray.length === 0) {
        return null; // Return a default value or handle the case when the nested array is empty
      }

      return nestedArray[nestedArray.length - 1];
    },
    

    async fetchAllData() {
      await this.$bybitApi.getCoinIcons();
      this.coinImageMap = this.$bybitApi.symbolMap;

     // await this.$bybitApi.MarketScan();

      this.rsiValues = this.$bybitApi.rsiValues;
      this.atrValues = this.$bybitApi.atrValues;

      this.Bias = this.$bybitApi.Trend;
      this.scannerSupportResistance = this.$bybitApi.scannerSupportResistance;

      console.log("Got all data");
    },


    symbolTagImage(item, searchTerm) {
      if (this.coinImageMap[item.symbol] && this.coinImageMap[item.symbol].symbolTags) {
        if (this.coinImageMap[item.symbol].symbolTags.includes(searchTerm) && searchTerm == "NEW") {
          return 'https://www.bybit.com/bycsi-root/assets/image/hot.svg';
        } else if (this.coinImageMap[item.symbol].symbolTags.includes(searchTerm) && searchTerm == "Trending") {
          return 'https://www.bybit.com/bycsi-root/assets/image/hot.svg';
        } else if (this.coinImageMap[item.symbol].symbolTags.includes(searchTerm) && searchTerm == "HOT") {
          return 'https://www.bybit.com/bycsi-root/assets/image/hot.svg';
        }
      }
      return '';
    },
    changeSymbol(newSymbol) {
      this.$bybitApi.changeSymbol(newSymbol);
    },
  },
  watch: {

   // Watch the this.$bybitApi.Trend object for changes
   '$bybitApi.Trend': {
    handler(newTrend, oldTrend) {
      // Loop through each symbol in the newTrend object
      for (const symbol in newTrend) {
     //   console.log("watcher triggered looping...")
        // Check if the newTrend has a resolved value and if it is different from the oldTrend
        if (newTrend[symbol] && newTrend[symbol] !== oldTrend[symbol]) {
          // Update the Bias property for that specific symbol
          this.Bias[symbol] = newTrend[symbol];
          console.log("resolved " + symbol + " " + newTrend[symbol]);
        }else{
     //     console.log(this.$bybitApi.Trend[symbol]);
          this.Bias[symbol] = this.$bybitApi.Trend[symbol] || 'Loading...';
        }

        
      }
    },
    deep: true,
  },
  },
};
