// Inspired by bitfinex. please don't sue me

// Thanks to https://github.com/nice-table for the algo :)

import _ from 'lodash';
import {ORDER_DISTRIBUTIONS} from './constants';
import {Decimal} from 'decimal.js';

// Get distribution weights
const getAmountDistribution = (distribution, orderCount, coefficient) => {
  if (
      distribution === ORDER_DISTRIBUTIONS.DECREASING.label ||
      distribution === ORDER_DISTRIBUTIONS.INCREASING.label
  ) {
    const pricePointPercentages = [];
    
    // Min and max percentage of the amount allocated per price point
    const minPercentage = 1;
    const maxPercentage = coefficient;
    
    for (let i = 0; i < orderCount; i += 1) {
      pricePointPercentages[i] =
          minPercentage +
          (i * (maxPercentage - minPercentage)) / (orderCount + 1);
    }
    
    if (distribution === ORDER_DISTRIBUTIONS.DECREASING.label) {
      return pricePointPercentages.reverse();
    }
    
    return pricePointPercentages;
  }
  
  if (distribution === ORDER_DISTRIBUTIONS.FLAT.label) {
    return _.range(orderCount).map(x => 100 / orderCount);
  }
  
  return new Error(`Unknown distribution type '${distribution}' was passed`);
};

// Distribute an amount based on weighting

// const distributeAmount = (total, weights) => {
//   let leftover = 0;
//   const distributedTotal = [];
//   const distributionSum = _.sum(weights);
  
//   weights.forEach(weight => {
//     const val = (weight * total) / distributionSum + leftover;
    
//     const weightedValue = Math.trunc(val);
//     leftover = val % 1;
    
//     distributedTotal.push(weightedValue);
//   });
  
//   // Add any leftover to the largest weight
//   if (_.isNumber(leftover)) {
//     const indexOfLargestWeight = _.indexOf(
//         distributedTotal,
//         _.max(distributedTotal),
//     );
    
//     distributedTotal[indexOfLargestWeight] = _.round(
//         distributedTotal[indexOfLargestWeight] + leftover,
//         0,
//     );
//   }
  
//   return distributedTotal;
// };

const distributeAmount = (total, weights, minTolerance) => {
  let leftover = 0;
  const distributedTotal = [];
  const distributionSum = _.sum(weights);
  
  weights.forEach(weight => {
    const val = (weight * total) / distributionSum + leftover;
    let weightedValue = Math.trunc(val);
    leftover = val % 1;
    
    // check if the value is less than the minimum tolerance
    if (weightedValue < minTolerance) {
      // set the value to the minimum tolerance
      weightedValue = minTolerance;
    } 
    //rounding the value to nearest multiple of 100
    distributedTotal.push(Math.round(weightedValue/minTolerance)*minTolerance);
  });
  
  // Add any leftover to the largest weight
  if (_.isNumber(leftover)) {
    const indexOfLargestWeight = _.indexOf(
        distributedTotal,
        _.max(distributedTotal),
    );
    
    distributedTotal[indexOfLargestWeight] = _.round(
        distributedTotal[indexOfLargestWeight] + leftover,
        0,
    );
  }
  
  return distributedTotal;
};


const generateOrdersByPricePoints = (amount, prices, distribution, coefficient, tickSize) => {

  prices.sort();
  const orderCount = prices.length;
  const weights = getAmountDistribution(distribution, orderCount, coefficient);
  const orderSizes = distributeAmount(amount, weights);

  
  const orderPrices = prices.map(price => roundToTickSize(tickSize, price));

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  
  const orders = orderPrices.reduce((acc, price, index) => {
    if (price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;
    
    return acc.concat([
      {
        price,
        amount: orderSizes[index],
      },
    ]);
  }, []);
  
  return orders
  
};


const generateOrders = ({
                          amount,
                          orderCount,
                          priceLower,
                          priceUpper,
                          distribution,
                          tickSize,
                          coefficient,
                          minTolerance
                        }) => {

  var data = { 
    amount,
    orderCount,
    priceLower,
    priceUpper,
    distribution,
    tickSize,
    coefficient,
    minTolerance
  };

  if (amount < 2) {
    return new Error('Amount must be greater than or equal to 2');
  }
  
  if (orderCount < 2 || orderCount > 200) {
    return new Error('Number of orders must be between 2 and 200');
  }
  
  const weights = getAmountDistribution(distribution, orderCount, coefficient);
  // console.log(amount);
  // console.log(weights);
  // console.log(minTolerance);
  const orderSizes = distributeAmount(amount, weights, minTolerance);

  //console.log(orderSizes);
  
  const priceDiff = priceUpper - priceLower;
  const stepsPerPricePoint = priceDiff / (orderCount - 1);

  //
  //console.log("priceDiff " + priceDiff + " stepsPerPricePoint " + stepsPerPricePoint);
  
  // Generate the prices we're placing orders at
  const orderPrices = _.range(orderCount).map(i => {
    // Lower price
    if (i === 0) {
      return priceLower;
    }
    
    // Upper price
    if (i === orderCount - 1) {
      return priceUpper;
    }
    
    return priceLower + stepsPerPricePoint * i;
  }).map(price => roundToTickSize(tickSize, price));
  
  
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  
  const orders = orderPrices.reduce((acc, curr, index) => {
    minPrice = Math.min(minPrice, curr);
    maxPrice = Math.max(maxPrice, curr);
    
    return acc.concat({
      price: curr,
      amount: _.floor(orderSizes[index], 0),
    });
  }, []);
  
  // Verify that the generated orders match the specification so that we don't end up poor
  
  if (Math.abs(_.sumBy(orders, order => order.amount)) > Math.abs(amount)) {
    let size = Math.abs(_.sumBy(orders, order => order.amount));
    console.log(`The orders total up to an amount larger than ${amount} the amount was ${size} `);
  //  return new Error(`The orders total up to an amount larger than ${amount}` + " the amount was " + Math.abs(_.sumBy(orders, order => order.amount)));
  }
  
  if (minPrice < priceLower) {
    return new Error('Order is lower than the specified lower price ' + minPrice + " " + priceLower);
  }

  if (maxPrice > priceUpper) {
    return new Error('Order is higher than the specified upper price ' + maxPrice + " " + priceUpper);
  }
  
  return orders;
};


const roundToTickSize = (tickSize, price) => {
  const tp = new Decimal(tickSize);
  
  const p = price;
  const t = tickSize;
  
  const rounded = p - (p % t) + (p % t < t / 2 ? 0 : t);
  const roundedDecimal = new Decimal(rounded);
  
  return roundedDecimal.toDecimalPlaces(tp.dp()).toNumber();
};

export {generateOrders, generateOrdersByPricePoints};