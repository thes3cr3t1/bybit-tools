export default {
  name: 'support-resistance-list',
  components: {},
  props: [],
  data() {
    return {
      supportResistance: {},
      
      headers: [
        {text: 'Interval', value: 'interval'},
        {text: 'Support', value: 'support'},
        {text: '% Move', value: 'supportPercentChange'},
        {text: 'Resistance', value: 'resistance'},
        {text: '% Move', value: 'resistancePercentChange'},
      ]
    };
  },
  computed: {
    items() {
      const items = [];
      for (const interval in this.$bybitApi.supportResistance) {
        items.push({
          interval,
          support: this.$bybitApi.supportResistance[interval].support,
          resistance: this.$bybitApi.supportResistance[interval].resistance,
          supportPercentChange: this.$bybitApi.supportResistance[interval].supportPercentChange,
          resistancePercentChange: this.$bybitApi.supportResistance[interval].resistancePercentChange
        });
      }
      return items;
    }
  },
  mounted() {
  },
  methods: {
  }
};