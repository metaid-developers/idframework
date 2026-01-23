### id-connect-button.js
以下的修改只修改test/id-connect-button/idcomponments/id-connect-button.js
1. 参考UI图，点击id-connect-button.js下的user-info时，显示一个下拉菜单，Options选项一个是Edit Profile,一个是Log Out，点击logout的时候handleDisconnect方法，点击Edit Profile的时候参考UI图弹出一个UI图样式的弹窗，其中弹窗头像显示用户当前的userAvatarUrl，用户名userInfo.name，暂时不要个人简介这一栏
```
   <div part="user-info" class="user-info" title="Click to disconnect">
          <img part="avatar" class="avatar" src="${userAvatarUrl}" alt="User Avatar" />
          <div part="user-info-text" class="user-info-text">
            <span part="name" class="name">${displayName}</span>
            <span part="metaid" class="metaid">MetaID:${displayMetaId?.slice(0,6)}</span>
          </div>
        </div>

```

2. Edit Profile点击后出现的弹窗，用户点击头像之后给出一个上传本地图片的容器，用户选择图片后把用户选择的图片渲染到弹窗的用户头像中，用户名运行用户输入编辑

以上的修改只修改test/id-connect-button/idcomponments/id-connect-button.js
