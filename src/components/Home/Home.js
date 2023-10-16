import LadderOrdersForm from './LadderOrdersForm';
import LimitOrderForm from './LimitOrderForm';
import ScalpForm from './ScalpForm';
import MarketOrderForm from './MarketOrderForm';
import OpenOrdersList from './OpenOrdersList';
import SupportResistanceList from './SupportResistanceList';
import OrderBookList from './OrderBookList';
import LadderHistoryList from './LadderHistoryList';
import OpenPosition from './OpenPosition';
import RiskManagementPane from './RiskManagementPane';
import Screener from './Screener';
import Calcs from './Calcs';
import Bots from './Bots';


export default {
  name: 'home',
  components: {
    LadderOrdersForm,
    LimitOrderForm,
    ScalpForm,
    Screener,
    Calcs,
    Bots,
    MarketOrderForm,
    OpenOrdersList,
    OrderBookList,
    LadderHistoryList,
    OpenPosition,
    RiskManagementPane,
    SupportResistanceList
  },
  props: [],
  data() {
    return {
      orderTypeId: 0,
      expandTv: false,
      order: {}
    };
  },
  computed: {
    tvStyleSmall: function() {
      return {
        'max-height': 'calc(100vh - 64px - 48px' +
            (this.$ui.showOpenPosition && this.$bybitApi.openPosition ? ' - 61px)' : ')'),
      };
    },
    tvStyleBig: function() {
      return {
        'height': 'calc(100vh - 64px - 48px' +
            (this.$ui.showOpenPosition && this.$bybitApi.openPosition ? ' - 61px)' : ')'),
      };
    },
  },
  mounted() {
  
  },
  methods:{

            domReadyHandler() {
                      
                      //   console.log("handler called");

                      //   this.$refs.webview.executeJavaScript(`
                      //   // Select the desired element and remove the rest

                      //   const desiredSection = document.querySelector('.by-card.chart');
                      //   if (!desiredSection) return;
                      
                      //   // Keep all CSS files
                      //   const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
                      //   cssLinks.forEach(link => {
                      //     link.parentNode.removeChild(link);
                      //     document.head.appendChild(link);
                      //   });
                      
                      //   // Remove everything else
                      //   Array.from(document.body.children).forEach(el => {
                      //     if (el !== desiredSection) {
                      //       el.remove();
                      //     }
                      //   });
                      // `)
            },
  
},

  
  watch: {
    orderTypeId: function() {
      this.order = {} ;
    }
  }
};
