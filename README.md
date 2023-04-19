# node-telegram-bot-wrapper
[![](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2Fmzzsfy%2Fnode-telegram-bot-wrapper&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false)](https://github.com/mzzsfy)

对[node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)进行简单封装,更简单易用,如果你不是需要一个非常轻量的服务更建议使用他人封装的完整框架,如:[telegraf](https://github.com/telegraf/telegraf),

### 使用方法

```javascript
require("./node-telegram-bot-wrapper")
const TelegramBot = require("node-telegram-bot-api")
```
或

```javascript
const TelegramBot = require("./node-telegram-bot-wrapper")
```

> 项目过于简单,未上传仓库,基于node-telegram-bot-api@0.58.0适配

可参考 https://github.com/mzzsfy/tgbot-randomWord

### 改造方法

#### onText

```javascript
function onText(patten, callback){}
```

原来的patten只支持正则,修改为支持3种模式

1. 与原版api相同的正则

1. 字符串,将自动转换为正则  

    对于此模式有特殊优化

    - 会在前面添加^标记,也就是默认全匹配,如果需要模糊匹配,请使用正则
    - 当字符串中有?占位符时,表示?部分需要匹配一个字符
    - 当字符串中有??时,表示可能需要匹配一个字符,这个占位符有或没有都能成功匹配

    > 如果字符串中有多个?或??时,不一定能符合预期,更建议使用正则

1. 数组,将原始遍历并调用onText

>如果不是数组或正则,将会强制转换为字符串

在onText上增加了一些便捷方法,使用方式与onText相同  

- `onPrivate`
- `onGroup`
- `onChannel`

#### sendWithButton

发送一条带内联butten的消息

```js
function sendWithButton(chatId, text, buttons = [[]], config = {
    callback: (data, funcs) => {},//点击回调,可重复触发
    timeout: 60 * 1000,
    timeoutCallback: () => {},
    complete: () => {}//finally回调
  })
```

其中funcs定义为

```js
{
    pause: function(pause = true),//暂停监听这个butten的回调,pause=false为恢复
    resetTimeout: function(newTimeout),//重置超时时间,newTimeout不填写为重置为原始超时时长
    cancel: function()//取消监听并清理按钮
}
```

提供了方便的butten构造方法`TelegramBot.button(title, callback, data)`,callback与data为可选,如果没有data则会随机生成一个data值,如果需要多次交互,建议自定义data并不要使用callback

```js
bot.sendWithButton(xxx,xxx,[[bot.butten(1,()=>console.log("点击了1")),bot.butten(2),bot.butten(3)],[bot.butten(11)]],{
callback:(m,fnucs)=>{console.log("点击了"+m.data);fnucs.cancel()}
})
```

>buttens为标准tg 的内联butten写法,在其中额外添加了callback属性
>buttens编辑后不再保证填写在butten中的回调被正确触发

### registerChatListener

注册一个chat监听器,当exclusive为true时,其他组件都不再响应

```js
function registerChatListener(chatId, callback = message => {}, config = {
   uid: 0,//设置后额外判断用户id
   exclusive: true,//是否排他
   timeout: 60 * 1000,
   timeoutCallback: () => {},
   complete: () => {},//finally回调
 })

let {
   exclusive,//是否排他,exclusive(true)时执行到这个callback就拒绝执行其他Listerner
   pause,//暂停当前这个监听器
   resetTimeout,//重置超时
   cancel//取消这个监听器
}=registerChatListener(...xxx)
```

### 便捷属性

1. 给标准message增加了一些便捷属性  

    - `message.cid` => message.chat.id  
    - `message.mid` => message.message_id  
    - `message.uid` => message.from.id  
    - `message.rcid` => message.reply_to_message.chat.id  
    - `message.rmid` => message.reply_to_message.message_id  
    - `message.ruid` => message.reply_to_message.from.id  
    - `message.send(text,option)` 在该消息聊天中发送一条消息  
    - `message.reply(text,option)` 回复该消息  
    - `message.edit(text,option)` 编辑该消息  
    - `message.forward(chatId,reply,option)` 转发该消息,reply为true则转发该消息回复的消息  
    - `message.delete(option)` 删除该消息  

1. TelegramBot启动后会获取自己的信息并保存

    ```js
    const bot=TelegramBot(...arg)
    
    //使用
    console.log("bot信息",bot.me)
    console.log("bot的id与username",bot.id,bot.username)
    ```

### 不一致表现

1. 将在群中`/命令@bot`中`@bot`部分删除,方便匹配表达式的编写

1. onText和衍生函数中,修改callback定义  
原:`function callback(message,正则匹配结果)`  
改为: `function callback(message,匹配的第一个结果,获取第n个匹配值的函数,正则匹配结果)`
