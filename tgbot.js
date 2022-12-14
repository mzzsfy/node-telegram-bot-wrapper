const TelegramBot = require("node-telegram-bot-api");
module.exports=TelegramBot

{
  class forObj {
    some(f) {
      for (let e in this) {
        if (f(this[e])) {
          return true
        }
      }
      return false
    }

    forEach(f) {
      for (let e in this) {
        f(this[e])
      }
    }
  }

  TelegramBot.prototype.init = function () {
    this.chatCallbackListener = this.chatCallbackListener || new forObj()
    this.callbackQueryListener = this.callbackQueryListener || new forObj()

    //启动内100ms内不能监听消息,否则可能导致注册到一半时就开始处理程序
    this.startStep0 = true
    setTimeout(() => {
      delete this.startStep0
    }, 100)
    //启动时丢弃太久以前的历史消息
    this.startStep1 = true
    setTimeout(() => {
      delete this.startStep1
    }, 10 * 1000)

    //当前bot信息
    this.getMe().then(data => {
      this.me = data
      this.id = data.id
      this.username = data.username
    })
  }

  const startPolling = TelegramBot.prototype.startPolling

  TelegramBot.prototype.startPolling = function () {
    this.init()
    return startPolling.apply(this, arguments)
  }

  const openWebHook = TelegramBot.prototype.openWebHook

  TelegramBot.prototype.openWebHook = function () {
    this.init()
    return openWebHook.apply(this, arguments)
  }

  const processUpdate = TelegramBot.prototype.processUpdate

  TelegramBot.prototype.processUpdate = function () {
    let message = arguments[0].message
    if (this.startStep1) {
      while (this.startStep0) {
        util.sleepSync(5)
      }
      if (message && message.date < (new Date().getTime() / 1000 - 60)) {
        console.log("启动初期丢弃太旧的历史消息", JSON.stringify(message))
        return
      }
    }

    //callBack
    if (!(message && message.chat && this.chatCallbackListener.some(o => o.chatId === message.chat.id && !(o.uid ? o.uid !== message.from.id : false) && (o.callback(message), o.exclusive)))) {
      processUpdate.apply(this, arguments)
    }
    if (arguments[0].callback_query) {
      const c = arguments[0].callback_query
      const cid = c.message.chat.id;
      const mid = c.message.message_id;
      this.callbackQueryListener.forEach(o => o.chatId === cid && o.mid === mid && o.callback(c))
    }
    if (message && (!message.__handled)) {
      bot.emit('notHandle', message)
    }
  }
  let id = 0
  TelegramBot.prototype.registerChatListener = function (chatId, callback = data => {
  }, config = {
    uid: 0,
    exclusive: true,
    timeout: 60 * 1000,
    timeoutCallback: () => {
    },
    complete: () => {
    },
  }) {
    let timeoutCallback = config.timeoutCallback
    let complete = config.complete
    let timeout = config.timeout || 60 * 1000
    let enable = true
    let exclusive = config.exclusive != false
    const oid = id++
    const obj = {
      uid: config.uid,
      callback: message => enable && callback(message),
      exclusive,
      chatId,
    };
    this.chatCallbackListener[oid] = obj
    const timeoutFn = () => {
      try {
        timeoutCallback && timeoutCallback()
      } catch {
      }
      cancel()
    }
    let timeoutId = setTimeout(timeoutFn, timeout)
    let resetTimeout = (newTimeout) => {
      newTimeout = newTimeout || timeout
      clearTimeout(timeoutId)
      timeoutId = setTimeout(timeoutFn, newTimeout)
    }
    let cancel = () => {
      delete this.chatCallbackListener[oid]
      clearTimeout(timeoutId)
      complete && complete()
    }
    return {
      exclusive: (exclusive = true) => obj.exclusive = exclusive,
      pause: (pause = true) => (enable = !pause, obj.exclusive = enable && exclusive),
      resetTimeout,
      cancel,
    }
  }

  TelegramBot.prototype.button = function (title, option = {
    callback: () => {
    },
    data: "",
  }) {
    option.callback_data = String(option.data || ("$btn_" + id++))
    const r = Object.assign({text: title}, option);
    delete r.data
    let callback = option.callback
    callback && (r.callback = (m, c) => m.data === option.callback_data && callback(m, c))
    return r
  }
  TelegramBot.prototype.sendWithButton = function (chatId, text, buttons = [[]], config = {
    callback: (data, funcs) => {
    },
    timeout: 60 * 1000,
    timeoutCallback: () => {
    },
    complete: () => {
    },
    option: {},
  }) {
    const callback = config.callback
    let buttonCallback = []
    buttons.forEach(bs => bs.forEach(b => b.callback && buttonCallback.push(b.callback)))
    return this.sendMessage(chatId, text, Object.assign({}, config.option, {
      reply_markup: {
        inline_keyboard: buttons
      }
    })).then(m => {
      const oid = id++
      let enable = true
      const timeoutCallback = config.timeoutCallback
      const complete = config.complete
      if (typeof config.timeout !== "undefined" && config.timeout <= 0) {
        return m
      }
      const timeout = config.timeout || 60 * 1000
      const obj = {
        mid: m.message_id,
        callback: (m) => {
          if (!enable) {
            return
          }
          buttonCallback.forEach(c => c(m, funcs))
          callback(m, funcs)
        },
        chatId,
      }
      const timeoutFn = () => {
        try {
          timeoutCallback && timeoutCallback()
        } finally {
          cancel()
        }
      }
      let timeoutId = setTimeout(timeoutFn, timeout)
      let resetTimeout = (newTimeout) => {
        newTimeout = newTimeout || timeout
        clearTimeout(timeoutId)
        timeoutId = setTimeout(timeoutFn, newTimeout)
      }
      let cancel = () => {
        delete this.callbackQueryListener[oid]
        clearTimeout(timeoutId)
        bot.editMessageReplyMarkup({}, {chat_id: chatId, message_id: obj.mid}).catch()
        complete && complete()
      }
      const funcs = {
        pause: (pause = true) => enable = !pause,
        resetTimeout,
        cancel,
      }
      this.callbackQueryListener[oid] = obj
      return m
    })
  }

  const _request = TelegramBot.prototype._request
  TelegramBot.prototype._request = function () {
    return _request.apply(this, arguments).then(obj => {
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          obj[i].message && applyMessage(this, obj[i].message)
        }
      } else {
        obj.chat && applyMessage(this, obj)
      }
      return obj
    }, err => {
      console.log("请求错误", err.message)
      throw err
    })
  }

  function applyMessage(_this, message) {
    // 去除 /命令@namebot中 @namebot 部分
    if (message.text && message.chat.type !== "private" && message.text.startsWith("/")) {
      const ati = message.text.indexOf("@");
      if (ati > -1) {
        if (_this.username) {
          message.text = message.text.replace('@' + _this.username, "")
        } else {
          message.text = message.text.replace(/@\w+bot/, "")
        }
      }
    }
    if (message.__addFn) {
      return
    }
    message.__addFn = () => {
    }
    if (!message.chat) {
      return
    }
    message.cid = message.chat.id
    message.mid = message.message_id
    message.uid = message.from?.id
    if (message.reply_to_message) {
      message.rcid = message.reply_to_message.chat.id
      message.rmid = message.reply_to_message.message_id
      message.ruid = message.reply_to_message.from?.id
    }
    //@formatter:off
    message.send = (text, option) => _this.sendMessage(message.cid, text, option)
    message.reply = (text, option) => _this.sendMessage(message.cid, text, Object.assign({}, option, {reply_to_message_id: message.message_id,allow_sending_without_reply:true}))
    message.edit = (text, option) => _this.editMessageText(text, Object.assign({}, option, {chat_id: message.cid, reply_to_message_id: message.message_id}))
    message.forward = (chatId, reply, option) => _this.forwardMessage(chatId, message.cid, reply ? (message.rmid || (function (){throw "请回复一条消息"}())) : message.message_id, option);
    message.delete = (option) => _this.deleteMessage(message.cid, message.message_id, option).catch(()=>false)
    //@formatter:on
  }

  const onText = TelegramBot.prototype.onText

  const _onText = function (r, c) {
    if (!(r instanceof RegExp)) {
      r = String(r)
      if (!r.startsWith('^')) {
        r = '^' + r
      }
      if (r.endsWith('$')) {
        r = r.substring(0, r.length - 2)
      }
      if (r.includes('?')) {
        r = r.replace(/\s*\?\??/g, (m, i, s) => {
          if (m.includes("??")) {
            if (i > 0) {
              if (/\s/.test(s[i])) {
                return '(?:\\s+(\\S[\\s\\S]*?))?'
              }
            }
            return '(\\S[\\s\\S]*?)?'
          } else {
            if (i > 0) {
              if (/\s/.test(s[i])) {
                return '\\s+([\\s\\S]+?)'
              }
            }
            return '([\\s\\S]+?)'
          }
        })
      }
      r = r + "$"
      r = new RegExp(r)
    }
    let _this = this;
    onText.call(_this, r, async (m, d) => {
        m.__handled || (m.__handled = () => {
        })
        try {
          await c.call(this, m, d[1], index => d[index], d)
        } catch (e) {
          if (e?.message?.includes("429 Too Many Requests")) {
            console.error("发送频率过高,已忽略该错误")
            return
          }
          try {
            await m.reply(String(e) || "未知错误")
          } catch (e1) {
            console.error("未知错误", String(e), String(e1))
          }
        }
      }
    )
  }
  TelegramBot.prototype.onText = function (r) {
    if (Array.isArray(r)) {
      for (const e of r) {
        arguments[0] = e
        _onText.apply(this, arguments)
      }
    } else {
      _onText.apply(this, arguments)
    }
  }
  TelegramBot.prototype.onPrivate = function (r, c) {
    let _this = this
    this.onText(r, function () {
      if (arguments[0].chat.type === "private") {
        return c.apply(_this, arguments)
      }
    })
  }
  TelegramBot.prototype.onGroup = function (r, c) {
    let _this = this
    this.onText(r, function () {
      if (arguments[0].chat.type === "supergroup" || arguments[0].chat.type === "group") {
        return c.apply(_this, arguments)
      }
    })
  }
  TelegramBot.prototype.onChannel = function (r, c) {
    let _this = this
    this.onText(r, function () {
      if (arguments[0].chat.type === "supergroup" || arguments[0].chat.type === "group") {
        return c.apply(_this, arguments)
      }
    })
  }
}
