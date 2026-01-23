### . /test/id-connect-button/id-connect-button.html修改如下：
1. 如下代码逻辑是我从其他项目中复制过来的，主要功能是实现idframework应用集成到app时的登录状态处理
```
const MAX_RETRY_TIME = 10000 // 最大等待时间（毫秒）
const RETRY_INTERVAL = 100  // 重试间隔（毫秒）
     const isAndroid = !!(UA && UA.indexOf('android') > 0)
     const isIOS = !!(UA && /iphone|ipad|ipod|ios/.test(UA))
    checkWebViewBridge(): boolean {
      if (isIOS || isAndroid) {
        if (window?.navigator) {
          const userAgent = window?.navigator?.userAgent || ''
          if (userAgent == 'IDChat-iOS' || userAgent == 'IDChat-Android') {
            this.isWebView = true
            console.log('当前环境是app webview')
            return true
          } else {
            return false //false
          }
        } else {
          return false
        }
      } else {
        return false
      }
    },

    onMounted(async () => {
          const checkMetalet =  () => {
    checkWebViewBridge()
    if (window.metaidwallet) {
      
      try {
          
           ;(window.metaidwallet as any)?.on('accountsChanged',metaletAccountsChangedHandler)
          ;(window.metaidwallet as any)?.on('LoginSuccess',appLoginSuccessHandler)
           ;(window.metaidwallet as any)?.on('onAccountSwitch',appAccountSwitchHandler)
  ;(window.metaidwallet as any)?.on('Logout',appLogoutHandler)

      } catch (err) {
        
        console.error('Failed to setup Metalet listeners:', err)
      }
    } else if (retryCount * RETRY_INTERVAL < MAX_RETRY_TIME) {
      
      retryCount++
      timeoutId = setTimeout(checkMetalet, RETRY_INTERVAL)
    } else {
      
      console.warn('Metalet wallet not detected after timeout')
    }
  }
    })




   async checkBtcAddressSameAsMvc() {
      const connectionStore = useConnectionStore()
      const userStore = useUserStore()
      const mvcAddress = await connectionStore.adapter.getMvcAddress() //userStore.last.address
      const btcAddress = await connectionStore.adapter.getBtcAddress()
      if (mvcAddress && btcAddress && mvcAddress !== btcAddress) {
        throw new Error(`${i18n.global.t('btcSameAsMvcError')}`)
      }
    },


  if(window.metaidwallet && connectionStore.last.status == 'connected'){
      rootStore.checkBtcAddressSameAsMvc().then().catch((err)=>{

            ElMessage.warning({
              message:i18n.t('btcSameAsMvcError'),
              type: 'warning',
              })
              setTimeout(() => {
                 connectionStore.disconnect(router)
              }, 3000);

        })



  }


  onBeforeUnmount(async () => {
  // remove event listener
  try {
    ;(window.metaidwallet as any)?.removeListener(
      'accountsChanged',
      metaletAccountsChangedHandler,
    )
   

    ;(window.metaidwallet as any)?.removeListener('LoginSuccess',appLoginSuccessHandler)
    ;(window.metaidwallet as any)?.removeListener('Logout',appLogoutHandler)
     ;(window.metaidwallet as any)?.removeListener(
      'onRefresh',
      appRreshHandler
    )
    ;(window.metaidwallet as any)?.removeListener(
    'onAccountSwitch',
    appAccountSwitchHandler

    )
   

    clearInterval(accountInterval.value)
  } catch (error) {
    console.error('Error removing event listeners:', error)
  }
})


const metaletAccountsChangedHandler = () => {
  try {
    if (useConnectionStore().last.wallet !== 'metalet') return
    if(rootStore.isWebView) return
    // sync here to prevent chronological error
    //connectionStore.sync()

    connectionStore.disconnect(router)

    ElMessage.warning({
      message: i18n.t('account.change'),
      type: 'warning',
      onClose: () => {
        completeReload()
      },
    })



  } catch (error) {
    console.error('Error in metaletAccountsChangedHandler:', error)
  }
}

const appLoginSuccessHandler= async (data: any) => {
      // ElMessage.success('调用LoginSuccess')
          try {
            //  if(userStore.isAuthorized && rootStore.isWebView && data !== userStore.last.address){
            //       connectionStore.disconnect(router)
            //   simpleTalkStore.$patch({isInitialized:false})
            //   await connectMetalet()

            //   if (!userStore.last.chatpubkey) {
            //     const ecdhRes = await GetUserEcdhPubkeyForPrivateChat(userStore.last.metaid)
            //     if (ecdhRes?.chatPublicKey) {
            //       userStore.updateUserInfo({
            //         chatpubkey: ecdhRes?.chatPublicKey
            //       })
            //     }
            //   }
  
            // setTimeout(() => {
            //    return window.location.reload()
            // }, 1000);
            // }


            if (!userStore.isAuthorized) {

                 
              await connectMetalet()
              //  ElMessage.success('调用LoginSuccess成功')
              if (!userStore.last.chatpubkey) {
                const ecdhRes = await GetUserEcdhPubkeyForPrivateChat(userStore.last.metaid)
                if (ecdhRes?.chatPublicKey) {
                  userStore.updateUserInfo({
                    chatpubkey: ecdhRes?.chatPublicKey
                  })
                  rootStore.updateShowCreatePubkey(false)
                }else{
                  rootStore.updateShowCreatePubkey(true)
                }
              }
              // setTimeout(() => {
              //   window.location.reload()
              // }, 5000);

            }
             
          } catch (error) {
            ElMessage.error(error as any)
            console.error('Error in LoginSuccess handler:', error)
          }
        }

        const appAccountSwitchHandler= async(data:any)=>{
            //ElMessage.success('调用onAccountSwitch')
          try {
            if(rootStore.isWebView){
              
              await connectionStore.disconnect(router)
              simpleTalkStore.$patch({isInitialized:false})
              await connectMetalet()
               //ElMessage.success('调用onAccountSwitch成功')
              if (!userStore.last.chatpubkey) {
                const ecdhRes = await GetUserEcdhPubkeyForPrivateChat(userStore.last.metaid)
                if (ecdhRes?.chatPublicKey) {
                  userStore.updateUserInfo({
                    chatpubkey: ecdhRes?.chatPublicKey
                  })
                  rootStore.updateShowCreatePubkey(false)
                }else{
                  rootStore.updateShowCreatePubkey(true)
                }
              }
  
            // setTimeout(() => {
            //     window.location.reload()
            // }, 5000);
            
          }
          } catch (error) {
            throw new Error(error)
          }
         }

         const appLogoutHandler= async (data: any) => {
try {
  console.log("退出登录成功", data)
  if (userStore.isAuthorized) {
    await connectionStore.disconnect(router)
    closeConnectionModal()
  }
} catch (error) {
  console.error('Error in Logout handler:', error)
}
}

```

