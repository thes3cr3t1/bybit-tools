

export default {
  data() {
    return {
      wins: 0,
      losses: 0,
      startingBalance: this.$bybitApi.startingBalance != 0 ? this.$bybitApi.startingBalance : parseFloat(this.$bybitApi.walletBalance).toFixed(0),
      targetPercentage: this.$bybitApi.targetPercentage != 0 ? this.$bybitApi.targetPercentage : 10,
      riskPercentage: this.$bybitApi.riskPercentage != 0 ? this.$bybitApi.riskPercentage : 10,
      headers: [
        { text: 'Wins', value: 'wins' },
        { text: 'Losses', value: 'losses' },
        { text: 'Win Rate', value: 'winRatePercentage', format: val => `${val.toFixed(2)}%` },
        { text: 'Minimum Risk:Reward Ratio', value: 'minRiskRewardRatioFormatted' }
      ],
      
      projectionHeaders: [
        { text: 'Trade no', value: 'tradeNo' },
        { text: 'Starting $', value: 'startingBalance' },
        { text: 'Target %', value: 'targetPercentage' },
        { text: 'Risk Amount', value: 'riskAmount' },
        { text: 'Profit Required', value: 'profitRequired' },
        { text: 'Balance Increase', value: 'balanceIncrease' },
        { text: 'Exceeded', value: 'exceeded', align: 'center' }
      ],
      projectionData: [],
      valid: false
    };
  },
  computed: {
    tableData() {
      const winRatePercentage = this.calculateWinRatePercentage();
      const minRiskRewardRatio = this.calculateMinRiskRewardRatio(winRatePercentage);
      const minRiskRewardRatioFormatted = this.formatRiskRewardRatio(minRiskRewardRatio);
      return {
        winRatePercentage,
        wins: this.wins,
        losses: this.losses,
        minRiskRewardRatioFormatted
      };
    },
  },
  mounted() {
    this.updateProjections();
  },
  watch: {
    startingBalance(newStartingBalance, oldStartingBalance) {
      if (newStartingBalance !== oldStartingBalance) {
        this.$bybitApi.startingBalance = newStartingBalance;
        this.updateProjections();
      }
    },
    targetPercentage(newTargetPercentage, oldTargetPercentage) {
      if (newTargetPercentage !== oldTargetPercentage) {
        this.$bybitApi.targetPercentage = newTargetPercentage;
        this.updateProjections();
      }
    },

    riskPercentage(newRiskPercentage, oldRiskPercentage) {
      if (newRiskPercentage !== oldRiskPercentage) {
        this.$bybitApi.riskPercentage = newRiskPercentage;
        this.updateProjections();
      }
    }
  },
  methods: {
    calculateExceeded(projection) {
           const exceeded = parseFloat(this.$bybitApi.walletBalance).toFixed(2) >= (parseFloat(projection.startingBalance) + parseFloat(projection.profitRequired));
           return exceeded ? true : false;
     },
    calculateWinRatePercentage() {
      const totalTrades = this.wins + this.losses;
      if (totalTrades === 0) {
        return 0;
      }
      return (this.wins / totalTrades) * 100;
    },
    calculateMinRiskRewardRatio(winRatePercentage) {
      const winRateDecimal = winRatePercentage / 100;
      const riskRewardRatio = (1 - winRateDecimal) / winRateDecimal;
      return riskRewardRatio.toFixed(2);
    },
    formatRiskRewardRatio(riskRewardRatio) {
      return `1:${riskRewardRatio}`;
    },
    updateProjections() {
      this.projectionData = [];
      let startingBalance = parseFloat(this.startingBalance);
      const targetPercentage = parseFloat(this.targetPercentage);
      let tradeNo = 1;
      let profitRequired = startingBalance * (targetPercentage / 100);
      let balanceIncrease = profitRequired;
      let exceeded = balanceIncrease >= startingBalance;
      const riskPercentage = this.riskPercentage; // 1% risk 
      var riskAmount = startingBalance * (riskPercentage / 100)
    
      this.projectionData.push({
        tradeNo,
        startingBalance: startingBalance.toFixed(2),
        targetPercentage: targetPercentage.toFixed(2) + '%',
        balanceIncrease: balanceIncrease.toFixed(2),
        profitRequired: profitRequired.toFixed(2),
        riskAmount: riskAmount.toFixed(2),
        exceeded: exceeded ? 'Yes' : 'No'
      });
    
      while (!exceeded && tradeNo < 50 && startingBalance < 250000) {
        startingBalance += balanceIncrease;
        tradeNo++;
        profitRequired = startingBalance * (targetPercentage / 100);
        balanceIncrease += profitRequired;
        exceeded = balanceIncrease >= startingBalance;
        riskAmount = startingBalance * (riskPercentage / 100)
    
        this.projectionData.push({
          tradeNo,
          startingBalance: startingBalance.toFixed(2),
          targetPercentage: targetPercentage.toFixed(2) + '%',
          balanceIncrease: balanceIncrease.toFixed(2),
          profitRequired: profitRequired.toFixed(2),
          riskAmount: riskAmount.toFixed(2),
          exceeded: exceeded ? 'Yes' : 'No'
        });
      }
    }
    
  }
};

