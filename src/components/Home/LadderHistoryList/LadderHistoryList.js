export default {
  name: 'ladder-history-list',
  components: {},
  props: [],
  data() {
    return {
      headers: [
        {text: 'Side', value: 'side'},
        {text: 'Qty', value: 'amount'},
        {text: 'High Price', value: 'priceUpper'},
        {text: 'Low Price', value: 'priceLower'},
        {text: 'tickSize', value: 'tickSize'},
        {text: 'coefficient', value: 'coefficient'},
        {text: 'Cancel', value: 'cancel'},
      ]
    };
  },
  computed: {},
  mounted() {
  
  },
  methods: {
    sum : function(items, prop){
      return items.reduce( function(a, b){
        return a + b[prop];
      }, 0);
    }
  },
};