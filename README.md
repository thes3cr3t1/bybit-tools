# bybit-tools

# bybit-tools

Edited version of By bit Tools, was a work in progress until By bit cancelled UK users. Might port to another exchange. Leaving this here should anyone find it useful. There is lots of added functionality that isn't immediately noticeable without inspecting the code. was in the process of updating to By bit V5 API when the project became untenable due to by bit closing the door to UK users.

Features:

Bot Manager class to manage multiple Martingale Bot instances across different coin pairings. Bots Automatically restart based on market conditions such as RSI.

Bot Manager class can easily be updated to handle different types of bots such as DCA and other strategies.

Open Position Monitor with dynamic risk reward parameters, loss if stopped, gain if TP hits, liquidation price alert if stop loss is not set or is set beyond the liquidation price.

Open Orders monitor with gains loss if orders are filled, auto updates as orders are filled.

Calculations page for setting targets and visualization,

Market Screener,

Hot Keys and button layouts based on external keyboard for quick interaction with the exchange. Cancel orders, place order excreta,

OrderBook,

Scale In with risk managment calulations based on acct balance,

Scale Out

Chase In,

Chase Out (reduce position),


![Screenshot 2023-10-16 210057](https://github.com/thes3cr3t1/bybit-tools/assets/49348412/0506e76a-cc80-4fc7-82d4-b60436651024)
![Screenshot 2023-10-16 205343](https://github.com/thes3cr3t1/bybit-tools/assets/49348412/6086daa0-0020-4b6c-b519-47219772d161)
![Screenshot 2023-10-16 205304](https://github.com/thes3cr3t1/bybit-tools/assets/49348412/da6e12f6-8b52-4216-a7a0-7a6a22ae71ae)
![Screenshot 2023-10-16 205211](https://github.com/thes3cr3t1/bybit-tools/assets/49348412/1a94ecf4-a979-4fa2-a1bf-08a467bb9522)
![Screenshot 2023-10-16 210410](https://github.com/thes3cr3t1/bybit-tools/assets/49348412/0cf79f59-4ef4-4488-9105-e0b2a069f87e)
![Screenshot 2023-10-16 211630](https://github.com/thes3cr3t1/bybit-tools/assets/49348412/d5a69def-6dc8-412f-b0ba-8c3bfa358ab2)



##### Build instructions :
```
npm install
npm run electron:build
```

