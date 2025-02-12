//блок основных переменных
const appver = '0.3.6'
const telegramBot = require('node-telegram-bot-api')
const { RouterOSAPI } = require('node-routeros')
const fs = require('fs')
const dns = require('dns')
const os = require('os')
const path = require('path')
const ipOrder = 'ipv4first'
dns.setDefaultResultOrder(ipOrder)
const functions = require('./functions.js')
const buttons = require('./buttons.js')
const allowedUsers = [] // белый список доступа к боту.
const hasGreeted = {}
const userSession = {}
const addressListObject = {}
const ipFotmat = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}$/

//определяем, откуда запускается бот, и выбираем нужный токен. vscode - тестовый токен. Остальное - продовый.
let telegramToken
if (process.env.VSCODE_CWD) {
  telegramToken = '' // указать токен
} else {
  telegramToken = '' // указать токен
}
const bot = new telegramBot(telegramToken, { polling: true })

//динамическое значение переменной пути лога, в зависимости от ОС
let logFilePath
if (os.platform() === 'win32') {
  logFilePath = path.join(path.dirname(process.execPath), 'log.txt')
} else {
  logFilePath = path.join(__dirname, 'log.txt')
}

// служебная информация для вывода в консоль при запуске
const startMessages = [
  `${new Date().toISOString()} - Telegram Mikrotik Control bot`,
  `${new Date().toISOString()} - App version: ${appver}`,
  `${new Date().toISOString()} - Bot started successfully`,
  `${new Date().toISOString()} - Listening for commands \n`
]
startMessages.forEach((startMsg, startIndex) => {
  setTimeout(() => {
    console.log(startMsg)
    writeLog(startMsg)
  }, 250 * startIndex)
})

// Блок запили логов в файл
const writeLog = logMessage => {
  const timestampedMessage = `${new Date().toISOString()} - ${logMessage}\n`
  if (fs.existsSync(logFilePath)) {
    fs.appendFile(logFilePath, timestampedMessage, error => {
      if (error) {
        console.error(
          `Error Writing log to existed file ${logFilePath}. \n Error: ${error}`
        )
      }
    })
  } else {
    fs.writeFile(logFilePath, timestampedMessage, error => {
      if (error) {
        console.error(`Error writing log to file ${logFilePath}`)
      } else {
        console.log(
          `${new Date().toISOString()} - Log was sucessfully written to ${logFilePath}`
        )
      }
    })
  }
}

// блок взаимодействия с ботом, когда бот начинает слушать сообщения
bot.on('message', msg => {
  const chatId = msg.chat.id
  const command = msg.text
  const userId = msg.from.id

  if (!msg.text) {
    bot.sendMessage(chatId, 'Only text messages are allowed.')
    return
  }

  // поддержание соединения
  setInterval(() => {
    bot
      .getMe()
      .then(() =>
        console.log(
          `${new Date().toISOString()} - getMe to keep connection alive.`
        )
      )
  }, 600000)

  //пишем файл, в зависимости от ОС
  // fileName = path.join(path.dirname(process.execPath), `${command.slice(1).replace(/\//g, '-')}_userId-${userId}_${new Date().toISOString().replace(/:/g, '-')}.txt`);
  let outputCommandFile
  let fileName
  if (os.platform() === 'win32') {
    fileName = `${command
      .slice(1)
      .replace(/\//g, '-')}_userId-${userId}_${new Date()
      .toISOString()
      .replace(/:/g, '-')}.txt`
    outputCommandFile = path.join(path.dirname(process.execPath), fileName)
  } else {
    fileName = `${command
      .slice(1)
      .replace(/\//g, '-')}_userId-${userId}_${new Date()
      .toISOString()
      .replace(/:/g, '-')}.txt`
    outputCommandFile = path.join(__dirname, fileName)
  }

  // сброс стэйта на запрос IP с очисткой объекта userSessions
  if (command === '/reset') {
    if (!allowedUsers.includes(userId)) {
      bot.sendMessage(chatId, `You do not have permission to access the bot`)
      return
    }
    bot.sendMessage(chatId, `Session reset by request.`)
    console.log(
      `${new Date().toISOString()} - User ${userId} restarted session by request.`
    )
    writeLog(`User ${userId} restarted session by request.`)
    delete userSession[chatId]
    delete addressListObject[chatId]
    userSession[chatId] = { state: 'enter_ip' }
    setTimeout(() => {
      bot.sendMessage(chatId, `Enter IP address:`)
    }, 1000)
    return
  }

  // Блок обработки команды /help
  if (command === '/help') {
    if (
      userSession[chatId] &&
      (userSession[chatId].state === 'enter_ip' ||
        userSession[chatId].state === 'enter_username' ||
        userSession[chatId].state === 'enter_password' ||
        userSession[chatId].state === 'ready')
    ) {
      bot.sendMessage(chatId, `This is the help section. To be written.`)
      console.log(
        `${new Date().toISOString()} - User ${userId} requested /help info.`
      )
      writeLog(`User ${userId} requested /help info.`)
      setTimeout(() => {
        switch (userSession[chatId].state) {
          case 'enter_ip':
            userSession[chatId].state = 'enter_ip'
            bot.sendMessage(chatId, 'Enter IP address:')
            break
          case 'enter_username':
            userSession[chatId].state = 'enter_username'
            bot.sendMessage(chatId, 'Enter login:')
            break
          case 'enter_password':
            userSession[chatId].state = 'enter_password'
            bot.sendMessage(chatId, 'Enter password:')
            break
          case 'ready':
            bot.sendMessage(chatId, 'Enter command. For example: /ip/dns/print')
            break
        }
      }, 1500)
      return
    }
  }
  // блок обработки команды /about
  if (command === '/about') {
    if (
      userSession[chatId] &&
      (userSession[chatId].state === 'enter_ip' ||
        userSession[chatId].state === 'enter_username' ||
        userSession[chatId].state === 'enter_password' ||
        userSession[chatId].state === 'ready')
    ) {
      bot.sendMessage(
        chatId,
        `Created by Mikhail Shakov \n\n App version: ${appver}`
      )
      console.log(
        `${new Date().toISOString()} - User ${userId} requested /about info.`
      )
      setTimeout(() => {
        switch (userSession[chatId].state) {
          case 'enter_ip':
            userSession[chatId].state = 'enter_ip'
            bot.sendMessage(chatId, 'Enter IP address:')
            break
          case 'enter_username':
            userSession[chatId].state = 'enter_username'
            bot.sendMessage(chatId, 'Enter login:')
            break
          case 'enter_password':
            userSession[chatId].state = 'enter_password'
            bot.sendMessage(chatId, 'Enter password:')
            break
          case 'ready':
            bot.sendMessage(chatId, 'Enter command. For example: /ip/dns/print')
            break
        }
      }, 1000)
      return
    }
  }
  // Блок обработки команды /log
  if (command === '/log') {
    if (
      userSession[chatId] &&
      (userSession[chatId].state === 'enter_ip' ||
        userSession[chatId].state === 'enter_username' ||
        userSession[chatId].state === 'enter_password' ||
        userSession[chatId].state === 'ready')
    ) {
      if (fs.existsSync(logFilePath) && allowedUsers.includes(userId)) {
        bot
          .sendDocument(chatId, logFilePath, {}, { contentType: 'text/plain' })
          .then(() => {
            console.log(
              `${new Date().toISOString()} - User ${userId} requested bot log file`
            )
            writeLog(`User ${userId} requested bot log file`)
          })
        bot.sendMessage(chatId, `Here you can download bot log file.`)
        setTimeout(() => {
          switch (userSession[chatId].state) {
            case 'enter_ip':
              userSession[chatId].state = 'enter_ip'
              bot.sendMessage(chatId, 'Enter IP address:')
              break
            case 'enter_username':
              userSession[chatId].state = 'enter_username'
              bot.sendMessage(chatId, 'Enter login:')
              break
            case 'enter_password':
              userSession[chatId].state = 'enter_password'
              bot.sendMessage(chatId, 'Enter password:')
              break
            case 'ready':
              bot.sendMessage(chatId, 'Enter command:')
              break
          }
        }, 1500)
        return
      } else {
        bot.sendMessage(chatId, `You are now allowed to request log.`)
        console.log(
          `${new Date().toISOString()} - User ${userId} denied to download log.`
        )
      }
    }
  }

  /*
// блок обработки команды /reboot
let rebootCommand = false;

if (command === '/reboot') {
    rebootCommand = true
    if (userSession[chatId] && userSession[chatId].state === 'ready') {
        const connection = new RouterOSAPI({
            host: userSession[chatId].ip,
            user: userSession[chatId].username,
            password: userSession[chatId].password,
        });
        connection.connect()
           
        .then(() => {
            console.log('Connected to the router');
            writeLog(`User ${userId} connected to the router`);
            return connection.write('/system/reboot')
        })
        .then(() => {
            console.log(`${new Date().toISOString()} - User ${userId} initiated reboot of device ${userSession[chatId].ip}`)
            writeLog(`User ${userId} initiated reboot of device ${userSession[chatId].ip}`)
            bot.sendMessage(chatId, `Rebooting ${userSession[chatId].ip} ...`);
        })        
        .then(() => {
            // Используем Promise для задержки
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 12000); // Задержка 10 секунд
            });
        })
        .then(() => {
            rebootCommand = false;
            delete userSession[chatId];
            userSession[chatId] = { state: 'enter_ip' };
        })
        .finally(() => {
            connection.close().then(() => {
                console.log('Connection closed');
            });
        });
    }
}
*/

  // Блок обработки команды /addresslist_add
  if (command === '/addresslist_add') {
    if (userSession[chatId] && userSession[chatId].state === 'ready') {
      if (userSession[chatId].ip === '10.0.0.1') {
        setTimeout(() => {
          bot.sendMessage(chatId, `Enter IP or domain to add to Address List:`)
        }, 1000)
        bot.sendMessage(
          chatId,
          `*Available Address Lists for ${userSession[chatId].ip}:* \n\n - WG\\_FREE\\_VPN \n - to\\_ISP \n - to\\_10.0.0.12 \n - to\\_VDS\\_Turkey \n - external\\_allowed \n - local\\_exclusion`,
          { parse_mode: 'Markdown' }
        )
        userSession[chatId].state = 'enter_addresslist_ip'
      } else if (
        userSession[chatId].ip === '172.18.6.1' ||
        userSession[chatId].ip === '10.0.6.100'
      ) {
        setTimeout(() => {
          bot.sendMessage(chatId, `Enter IP or domain to add to Address List:`)
        }, 1000)
        bot.sendMessage(
          chatId,
          `*Available Address Lists on ${userSession[chatId].ip}:* \n - ISP \n - to\\_HOMENET \n - to\\_vless`,
          { parse_mode: 'Markdown' }
        )
        userSession[chatId].state = 'enter_addresslist_ip'
      } else {
        setTimeout(() => {
          bot.sendMessage(chatId, `Enter IP or domain to add to Address List:`)
        }, 1000)
        bot.sendMessage(
          chatId,
          `Available Address Lists on ${userSession[chatId].ip} are not defined here. Please check available address lists via terminal or GUI.`
        )
        userSession[chatId].state = 'enter_addresslist_ip'
      }
    }
  } else if (
    userSession[chatId] &&
    userSession[chatId].state === 'enter_addresslist_ip'
  ) {
    addressListObject.addressList_ip = command
    userSession[chatId].state = 'enter_addresslist_name'
    bot.sendMessage(chatId, `Enter address list to add to:`)
  } else if (
    userSession[chatId] &&
    userSession[chatId].state === 'enter_addresslist_name'
  ) {
    addressListObject.addressList_name = command
    userSession[chatId].state = 'enter_addresslist_timeout'
    bot.sendMessage(chatId, `Enter timeout value:`)
  } else if (
    userSession[chatId] &&
    userSession[chatId].state === 'enter_addresslist_timeout'
  ) {
    addressListObject.addressList_timeout = command
    userSession[chatId].state = 'enter_addresslist_comment'
    bot.sendMessage(chatId, `Enter comment:`)
  } else if (
    userSession[chatId] &&
    userSession[chatId].state === 'enter_addresslist_comment'
  ) {
    addressListObject.addressList_comment = command
    bot.sendMessage(
      chatId,
      `Accepted. Now adding the IP to the address list...`
    )
    userSession[chatId].state = 'enter_addresslist_processing'

    const connection = new RouterOSAPI({
      host: userSession[chatId].ip,
      user: userSession[chatId].username,
      password: userSession[chatId].password
    })

    connection
      .connect()
      .then(() => {
        console.log('Connected to the router')
        writeLog(`User ${userId} connected to the router`)
        return connection.write('/ip/firewall/address-list/add', [
          `=list=${addressListObject.addressList_name}`,
          `=address=${addressListObject.addressList_ip}`,
          `=timeout=${addressListObject.addressList_timeout}`,
          `=comment=${addressListObject.addressList_comment}`
        ])
      })
      .then(response => {
        console.log(
          `${new Date().toISOString()} - Value ${
            addressListObject.addressList_ip
          } added to address-list ${addressListObject.addressList_name} for ${
            addressListObject.addressList_timeout
          }:`,
          response
        )
        writeLog(
          `Value ${addressListObject.addressList_ip} added to address-list ${addressListObject.addressList_name} for ${addressListObject.addressList_timeout}:`,
          response
        )
        bot.sendMessage(
          chatId,
          `Value *${addressListObject.addressList_ip}* added to address-list *${addressListObject.addressList_name}* for *${addressListObject.addressList_timeout}*`,
          { parse_mode: 'Markdown' }
        )
        return connection.close()
      })
      .then(() => {
        console.log('Connection closed')
        bot.sendMessage(chatId, `Enter new command.`)
        userSession[chatId].state = 'ready'
      })
      .catch(error => {
        console.error('Error:', error)
        bot.sendMessage(chatId, `Error: \n ${error.message}`)
        delete addressListObject[chatId]
        userSession[chatId].state = 'ready'

        setTimeout(() => {
          bot.sendMessage(chatId, `Enter command:`)
        }, 1000)
      })
      .finally(() => {
        // Проверка и закрытие соединения, если оно открыто
        if (connection) {
          connection
            .close()
            .then(() => console.log('Connection closed'))
            .catch(closeError =>
              console.error('Error closing connection:', closeError)
            )
        }
      })
  }

  // проверка на доступ по userId (задается выше в масиве)
  if (!allowedUsers.includes(userId)) {
    bot.sendMessage(chatId, 'You do not have permission to access the bot.')
    console.log(
      `${new Date().toISOString()} - WARNING! Unauthorized user ${userId} tried to access the bot`
    )
    writeLog(`WARNING! Unauthorized user ${userId} tried to access the bot`)
    return
  }
  if (!hasGreeted[userId]) {
    bot.sendMessage(chatId, 'Welcome! This is test Mikrotik Control bot.')
    console.log(
      `${new Date().toISOString()} - User ${userId} has accessed the bot`
    )
    writeLog(`User ${userId} has accessed the bot`)
    hasGreeted[userId] = true
  }
  // блок авторизации на роутере
  if (!userSession[chatId]) {
    setTimeout(() => {
      bot.sendMessage(chatId, ` Enter IP address:`)
    }, 1000)
    userSession[chatId] = { state: 'enter_ip' }
  } else if (userSession[chatId].state === 'enter_ip') {
    userSession[chatId].ip = command
    if (!ipFotmat.test(userSession[chatId].ip)) {
      console.log(
        `${new Date().toISOString()} - User ${userId} entered invalid IP address: ${
          userSession[chatId].ip
        }`
      )
      writeLog(
        `User ${userId} entered invalid IP address: ${userSession[chatId].ip}`
      )
      bot.sendMessage(
        chatId,
        'Invalid IP address format. Check IP format and enter again. \n \n Valid format: 192.168.0.1'
      )
      setTimeout(() => {
        bot.sendMessage(chatId, ` Enter IP address:`)
      }, 750)
      return userSession[chatId].state === 'enter_ip'
    }
    if (userSession[chatId].ip) userSession[chatId].state = 'enter_username'
    bot.sendMessage(chatId, 'Enter Login:')
  } else if (userSession[chatId].state === 'enter_username') {
    userSession[chatId].username = command
    userSession[chatId].state = 'enter_password'
    bot.sendMessage(chatId, 'Enter Password:')
  } else if (userSession[chatId].state === 'enter_password') {
    userSession[chatId].password = command
    userSession[chatId].state = 'ready' // Устанавливаем состояние как "готово"
    bot.sendMessage(
      chatId,
      `Credentials accepted. Connecting... \n\n Meanwhile enter your command. Example: /ip/dns/print \n\n After sending the command, please wait for 10 seconds for the response`
    )

    // очистка userSession, AddressList, hasGreeted по таймауту
    if (!userSession[chatId].timeoutId) {
      setTimeout(() => {
        delete userSession[chatId]
        delete addressListObject[chatId]
        delete hasGreeted[userId]
        delete userSession[chatId].timeoutId
      }, 7200000)
    }
  } else if (userSession[chatId].state === 'ready') {
    if (command === '/start') {
      bot.sendMessage(chatId, 'Временная заглушка для открытия меню в будущем')
    }
    if (command === '/system/reboot') {
      const connection = new RouterOSAPI({
        host: userSession[chatId].ip,
        user: userSession[chatId].username,
        password: userSession[chatId].password
      })
      connection
        .connect()
        .then(() => {
          console.log(
            `${new Date().toISOString()} - Successfully connected to ${
              userSession[chatId].ip
            }`
          )
          console.log(
            `${new Date().toISOString()} - User ${userId} sent command ${command}`
          )
          writeLog(`Successfully connected to ${userSession[chatId].ip}`)
          writeLog(`User ${userId} sent command ${command}`)
          writeLog(
            `User ${userId} initiated reboot of device ${userSession[chatId].ip}`
          )
          setTimeout(() => {
            bot.sendMessage(
              chatId,
              `Device ${userSession[chatId].ip} reboot in progress... \n\n Operation might take up to 2 minutes.`
            )
          }, 500)
          return connection.write(command)
        })
        .then(() => {
          return connection.close()
        })
        .then(() => {
          delete userSession[chatId]
          userSession[chatId] = { state: 'enter_ip' }
          setTimeout(() => {
            bot.sendMessage(chatId, `Enter new IP address:`)
          }, 1500)
        })
    } else {
      const connection = new RouterOSAPI({
        host: userSession[chatId].ip,
        user: userSession[chatId].username,
        password: userSession[chatId].password
      })
      //блок подключения по данным авторизации и обработка входящих сообщений
      connection
        .connect()
        .then(() => {
          console.log(
            `${new Date().toISOString()} - Successfully connected to ${
              userSession[chatId].ip
            }`
          )
          console.log(
            `${new Date().toISOString()} - User ${userId} sent command ${command}`
          )
          writeLog(`Successfully connected to ${userSession[chatId].ip}`)
          writeLog(`User ${userId} sent command ${command}`)
          return connection.write(command)
        })
        .then(data => {
          if (Array.isArray(data)) {
            // преобразуем и деструктуризируем JSON-массив в более читаемый вид
            // Преобразуем и форматируем JSON-массив для более читаемого вывода
            let jsonFormattedData = ''
            data.forEach((item, index) => {
              // item - каждый объект в массиве, index - его порядковый номер
              jsonFormattedData += `Object ${index + 1}:\n\n` // добавляем заголовок объекта с его номером (index + 1)
              Object.entries(item).forEach(([key, value]) => {
                // обходим каждую пару ключ-значение в объекте
                jsonFormattedData += `${key}: ${value}\n` // добавляем строку с ключом и значением в jsonFormattedData
              })
            })
            // Записываем данные в файл один раз
            fs.writeFile(
              outputCommandFile,
              jsonFormattedData,
              'utf8',
              error => {
                if (error) {
                  console.error(
                    `Error writing output data to file ${outputCommandFile}`
                  )
                  writeLog(
                    `Error writing output data to file ${outputCommandFile}`
                  )
                } else {
                  console.log(
                    `${new Date().toISOString()} - Data was successfully written to ${outputCommandFile}`
                  )
                  writeLog(
                    `Data was successfully written to ${outputCommandFile}`
                  )

                  // Отправляем файл после успешной записи
                  bot
                    .sendDocument(
                      chatId,
                      outputCommandFile,
                      {},
                      { contentType: 'text/plain' }
                    )
                    .then(() => {
                      bot.sendMessage(
                        chatId,
                        `Here you can download the result of your command.`
                      )
                      console.log(
                        `${new Date().toISOString()} - File ${outputCommandFile} was successfully sent to ${userId}`
                      )
                      writeLog(
                        `File ${outputCommandFile} was successfully sent to ${userId}`
                      )
                    })
                    .catch(error => {
                      console.error(`Error sending document: ${error.message}`)
                      writeLog(`Error sending document: ${error.message}`)
                      bot.sendMessage(
                        chatId,
                        'An error occurred while sending the document.'
                      )
                    })
                }
              }
            )
          } else {
            const jsonFormattedData = JSON.stringify(data, null, 2)
            bot.sendMessage(chatId, `Raw Data:\n${jsonFormattedData}`)
          }
          return connection.close()
        })
        .then(() => {
          console.log('Connection closed')
          writeLog(`${userId}, connection closed.`)
        })
        .then(() => {
          fs.unlink(outputCommandFile, error => {
            if (error) {
              console.error(`Error deleting file ${outputCommandFile}:`, error)
              writeLog(`Error deleting file ${outputCommandFile}`)
            } else {
              console.log(
                `${new Date().toISOString()} - File ${outputCommandFile} was successfully deleted after sending.`
              )
              writeLog(
                `File ${outputCommandFile} was successfully deleted after sending.`
              )
            }
          })
        })

        //блок обработки ошибок
        .catch(err => {
          console.error(err)
          writeLog(err)
          if (
            err &&
            err.message &&
            err.message.includes('no such command') &&
            userSession[chatId].state !== 'enter_addresslist_ip' &&
            userSession[chatId].state !== 'enter_addresslist_name' &&
            userSession[chatId].state !== 'enter_addresslist_timeout' &&
            userSession[chatId].state !== 'enter_addresslist_comment' &&
            userSession[chatId].state !== 'enter_addresslist_processing'
          ) {
            bot.sendMessage(
              chatId,
              `Error!\n\n Command "${command}" is not recognized, check your syntax.\n\n Command example: /ip/dns/print`
            )
          } else if (
            err.message.includes('Username or password is invalid') ||
            err.message.includes('radius timeout')
          ) {
            console.log(
              `${new Date().toISOString()} - User ${userId} has failed to authorize at ${
                userSession[chatId].ip
              }`
            )
            writeLog(
              `Warning! ${userId} has failed to authorize at ${userSession[chatId].ip}`
            )
            bot.sendMessage(
              chatId,
              `Error!\n\n Wrong username-password combination to ${userSession[chatId].ip}. Check your credentials and try again.`
            )
            delete userSession[chatId]
            userSession[chatId] = { state: 'enter_ip' }
            setTimeout(() => {
              bot.sendMessage(chatId, `Enter IP address:`)
            }, 1000)
          } else if (
            err.message.includes('RosException') ||
            err.hasOwnProperty('errno')
          ) {
            console.log(
              `${new Date().toISOString()} - User ${userId} experienced a timeout while connecting to IP ${
                userSession[chatId].ip
              }`
            )
            writeLog(
              `User ${userId} experienced a timeout while connecting to IP ${userSession[chatId].ip}`
            )
            bot.sendMessage(
              chatId,
              `Timeout connecting to router. Check IP address and router availability. ${err.message}`
            )
            userSession[chatId] = { state: 'enter_ip' }
            setTimeout(() => {
              bot.sendMessage(chatId, `Enter IP address:`)
            }, 1500)
          } else if (
            err.message.includes('getaddrinfo EAI_AGAIN api.telegram.org')
          ) {
            console.log(
              `${new Date().toISOString()} - Connection lost to api.telegram.org`
            )
            writeLog(`Connection lost to api.telegram.org`)
          }
          connection
            .close()
            .then(() => {
              console.log('Connection closed on error')
              writeLog(`${userId}. Connection closed on error`)
            })
            .catch(closeError => {
              console.error(`Failed to close connection: ${closeError.message}`)
              writeLog(`Failed to close connection: ${closeError.message}`)
            })
        })
    }
  }
})

/* TODO
// блок кнопок
if (command === '/buttons') {
    if (!userSession[chatId]) {
        bot.sendMessage(chatId, 'You need to authorize first.');
        return;
    }
    if (userSession[chatId].state !== 'ready') {
        bot.sendMessage(chatId, 'You need to complete authorization first.');
        console.log(`${new Date().toISOString()} - User ${userId} tried to access buttons without completing authorization.`);

        setTimeout(() => {
            switch (userSession[chatId].state) {
                case 'enter_ip':
                    bot.sendMessage(chatId, 'Enter IP address:');
                    break;
                case 'enter_username':
                    bot.sendMessage(chatId, 'Enter login:');
                    break;
                case 'enter_password':
                    bot.sendMessage(chatId, 'Enter password:');
                    break;
            }
        }, 1000);
        return;
    }

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Первая кнопка', callback_data: 'first_button' },
                    { text: 'Вторая кнопка', callback_data: 'second_button' }
                ]
            ]
        }
    };
    bot.sendMessage(chatId, 'Нажмите одну из кнопок:', options);
}

// Обработчик для нажатий на кнопки
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    if (userSession[chatId] && userSession[chatId].state === 'ready') {
        if (callbackQuery.data === 'first_button') {
            bot.sendMessage(chatId, 'Вы нажали первую кнопку');
        } else if (callbackQuery.data === 'second_button') {
            bot.sendMessage(chatId, 'Вы нажали вторую кнопку');
        }
    } else {
        bot.sendMessage(chatId, 'You need to complete authorization or finish entering credentials to use buttons.');
    }
});


*/
