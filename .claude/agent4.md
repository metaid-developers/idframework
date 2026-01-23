### id-connect-button.js
以下的修改只修改test/id-connect-button/idcomponments/id-connect-button.js

我从其他项目中提取了一个编辑和设置用户信息的功能，详细的代码如下

save方法
```









const hasChanges = computed(() => {
  return (
    imageUrl.value ||
    username.value !== (userInfo?.name || '')
  )
})




export const createOrUpdateUserInfo = async ({
  userData,
  oldUserData,
  options,
}: {
  userData: {
    name: string
    avatar?:{
      base64:string
      fileType:string
    }
    chatpubkey?: string
  }
  oldUserData: {
    nameId: string
    avatarId?: string
    chatpubkey?: string
  }
  options: { feeRate?: number; network?: BtcNetwork; assistDomain?: string }
}): Promise<{
  [key: string]: { txid: string | undefined } | undefined
}> => {
  const metaDatas: MetaidData[] = []
  const utxoStore = useUtxosStore()
  if (userData.name) {
    metaDatas.push({
      metaidData:{
      operation: oldUserData.nameId ? 'modify' : 'create',
      body: userData.name,
      path: oldUserData.nameId ? `@${oldUserData.nameId}` : '/info/name',
      encoding: 'utf-8',
      contentType: 'text/plain',
      }
   
    })
  }

  if (userData.avatar.base64) {

    metaDatas.push({
      metaidData:{
      operation: oldUserData.avatarId ? 'modify' : 'create',
      body: userData.avatar.base64,
      path: oldUserData.avatarId ? `@${oldUserData.avatarId}` : '/info/avatar',
      encoding: 'base64',
      contentType: serData.avatar.fileType,
      
      }

    })
  }


  if (userData.chatpubkey) {
    if (!oldUserData.chatpubkey) {
    metaDatas.push({
      metaidData:{
        operation: 'create',
        body: userData.chatpubkey,
        path: `/info/chatpubkey`,
        encoding: 'utf-8',
        contentType: 'text/plain',
       
      }


       
      })
    }
  }
  if (metaDatas.length === 0) {
    throw new Error('No user data provided to create user info')
  }
  let _transactions: Transaction[] = []
  let _txids: string[] = []

  if (options.assistDomain && !oldUserData.nameId) {
    let utxo: {
      txid: string
      outIndex: number
      value: number
      address: string
    }
    for (let i = 0; i < metaDatas.length; i++) {
      const metaData = metaDatas[i]
      const _options: any = {
        network: options?.network ?? 'testnet',
        signMessage: 'create User Info',
        serialAction: 'finish',
        assistDomain: options.assistDomain as string,
      }
      if (utxo) {
        _options.utxo = utxo
      }
      const { txid, utxo: _utxo } = await createPinWithAsset(metaData, _options)
      utxo = _utxo
      utxoStore.insert(utxo, utxo.address)

      if (txid) {
        _txids.push(txid)
      }
    }
  } else {
    for (let i = 0; i < metaDatas.length; i++) {
      const metaData = metaDatas[i]
      const { transactions, txid, txids } = await createPin(metaData, {
        network: options?.network ?? 'testnet',
        signMessage: 'create User Info',
        serialAction: i === metaDatas.length - 1 ? 'finish' : 'combo',
        transactions: [..._transactions],
        feeRate: options?.feeRate,
      })
      _transactions = transactions as Transaction[]
      if (txids) {
        _txids = txids
      }
    }
  }
  const ret: { [key: string]: { txid: string | undefined } | undefined } = {
    nameRes: undefined,
    avatarRes: undefined,
    chatpubkeyRes: undefined,
  }
  type ResKey = 'nameRes' | 'avatarRes'  | 'chatpubkeyRes'
  const userInfos: {
    key: string
    resKey: ResKey
  }[] = [
    {
      key: 'name',
      resKey: 'nameRes',
    },
   
    {
      key: 'avatar',
      resKey: 'avatarRes',
    },
   
    {
      key: 'chatpubkey',
      resKey: 'chatpubkeyRes',
    },
  ]
  for (let i = 0; i < userInfos.length; i++) {
    const { key, resKey } = userInfos[i]
    if (userData[key as keyof typeof userData]) {
      const txid = _txids.shift()
      ret[resKey as ResKey] = {
        txid,
      }
    }
  }

  return ret
}


const save = async () => {
  if (!hasChanges.value || loading.value) {
    ElMessage.info('No changes to save.')
    return
  }

  loading.value = true
  try {
    const values: any = {}
    if (imgRaw.value) {
      const [image] = await image2Attach(([imgRaw.value] as unknown) as FileList)
      values.avatar = Buffer.from(image.data, 'hex').toString('base64')
    }
    if (username.value !== userInfo?.name) {
      values.name = username.value
    }
   
    if(!userInfo?.chatpubkey){
      
      const ecdh=await getEcdhPublickey()
      if(ecdh){
         values.chatpubkey=ecdh?.ecdhPubKey
       
      }
      
    }
    
    await createOrUpdateUserInfo({
      userData: values,
      oldUserData: {
        nameId: userInfo?.nameId || '',
        avatarId:userInfo?.avatarId || '',
        chatpubkey:userInfo?.chatpubkey || ''
      },
      options: {
        feeRate: 1,
        network: 'mainnet',
        assistDomain: 'https://www.metaso.network/assist-open-api',
      },
    })
    if (!userInfo.name) {
      const publicKey = await window.metaidwallet.btc.getPublicKey()
      const signature: any = await window.metaidwallet.btc.signMessage('metaso.network')
      await getMVCRewards(
        {
          address: userInfo!.address,
          gasChain: 'mvc',
        },
        {
          'X-Public-Key': publicKey,
          'X-Signature': signature,
        }
      )
    }
    /**
    
    await userStore.setUserInfo(userInfo!.address) 这个方法应因本项目更新userInfo的方式进行设置操作，外部项目逻辑过于复杂不方便引入此处进行参考，核心逻辑是进入这个方法之后先去const res=await window.IDFramework.dispatch('fetchUser').catch(err => {
              console.warn(`Failed to fetch user info for ${metaid}:`, err);
            });
            通过res获取到res.name，如果name为空，则代表这是一个新用户，如果是新用户的话则需要在提供一个设置新用户页面的弹框，UI参考id-connect-button/idcomponments/id-connect-button.js下的modal-content即可，而后点击save按钮执行当前生成的save方法即可
    
     */
    await userStore.setUserInfo(userInfo!.address) 
    
    ElMessage.success('Profile updated successfully!')
    emit('update:modelValue', false)
    
  } catch (error) {
    console.error('Failed to save profile changes:', error)
    ElMessage.error('Failed to save profile changes.')
  } finally {
    loading.value = false
  }
}

```