以下的修改只修改test/id-connect-button/idframework.js

1. 对test/id-connect-button/idframework.js增加一个createPin方法，该方法具体逻辑如下

```
  async createPin({ payload, stores }) {
     try{
      // 1. Construct PIN transaction
      // 2. Sign with Metalet
      // 3. Broadcast to blockchain
      
      const {operation, body, path, contentType  } = payload;

      if (!body) {
        throw new Error('PIN body is required');
      }

      if (!stores.wallet.isConnected) {
        throw new Error('Wallet must be connected to create PIN');
      }

      const parmas={
        chain:'mvc',
        feeRate:1,
        dataList:[
           {
            metaidData: {
              operation: operation,
              path: path,
              body: body,
              contentType:contentType,
            }
          }
      ]
      }
      
      
      const createPinRes = await window.metaidwallet.createPin(parmas);;
      return createPinRes
     }catch(e){
        throw new Error(e)
     }
    },

```