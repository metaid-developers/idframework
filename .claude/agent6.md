1. 参考commands/PostBuzzCommand.js的PostBuzzCommand类，帮我在GameScoresCommand.js中编写一个GameScoresCommand类，实现/protocols/gamescorerecording的上链，以下是GameScoreRecording协议body信息
```
{
 /** This field represents the PinId of the specified MetaApp game application to be recorded. */
 "metaAppPinId": "",
 /** This field represents the basic information of the record creator's MetaID. */
 "recordCreator": "{\"metaid\":\"\",address:\"'}",
 /** Record Creation Timestamp */
 "createTime": "",
 /** Record Final Game Score */
 "score": 100,
 /** Game Name */
 "gameName": "2048"
}
```
其中recordCreator的metaid:stores.user.metaid,address:stores.user.address,createTime为Date.now(),其他参数通过payload传入，外部实际调用时实际调用IDFramework.BuiltInCommands.createPin({
    payload:{
        operation:'create', 
        body:{
         metaAppPinId:'',
         recordCreator:'',
         createTime:Date.now(),
         score:0,
         gameName:'2048'
        }, 
        path:'/protocols/gamescorerecording', 
        contentType:'application/json'
    },
    stores:{
        wallet: Alpine.store('wallet'),
        app: Alpine.store('app'),
        user:Alpine.store('user')
    }


})

