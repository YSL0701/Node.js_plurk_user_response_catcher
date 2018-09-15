var express = require('express')
var app = express()
var request = require('request')
var cheerio = require('cheerio')
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()

app.use(express.static('page'))
app.use(jsonParser)

app.post('/getTimeline', (req, res) => {
  // console.log(req.body)
  var account = req.body.account.map(item => {
    return getUid(item)
  })
  var targetId = ''
  getUid(req.body.searchAccount)
    .then(searchId => {
      targetId = searchId
      console.log(targetId)
      return Promise.all(account)
    })
    .then(allAccount => {
      // console.log(allAccount)
      var getAllTimeline = allAccount.map(item => {
        return getTimeline(item)
      })
      return Promise.all(getAllTimeline)
    })
    .then(allTimeline => {
      // console.log(allTimeline)
      var allpostId = []
      allTimeline.forEach(item => {
        item.plurks.forEach(plurk => {
          allpostId.push(plurk.plurk_id)
        })
      })
      // console.log(allpostId)
      // console.log(getAllpostId)
      return Promise.all(allpostId.map(postId => getResponse(postId)))
    })
    .then(response => {
      console.log(
        response
          .filter(item => {
            return item.friends.hasOwnProperty(targetId)
          })
          .map(item => {
            return item.responses
          })
      )
      var hasTargetRespones = response.filter(item => {
        return item.friends.hasOwnProperty(targetId)
      })
      res.json(hasTargetRespones)
    })
    .catch(error => {
      console.log(error)
    })
})

app.listen(3000, function() {
  console.log('sever啟動')
})

function getUid(account) {
  return new Promise((resolve, reject) => {
    request(
      {
        url: `https://www.plurk.com/${account}`,
        method: 'GET'
      },
      function(error, response, body) {
        var $ = cheerio.load(body)
        if (error || $('title').text() == 'User Not Found! - Plurk' || $('title').text() == 'Your life, on the line - Plurk') {
          return reject('帳號不存在!')
        }
        var user_id = $('.show_all_friends > a')
          .attr('href')
          .split('=')[1]
          .split('&')[0]
        resolve(user_id)
      }
    )
  })
}

function getTimeline(user_id) {
  return new Promise((resolve, reject) => {
    request(
      {
        url: 'https://www.plurk.com/TimeLine/getPlurks',
        method: 'POST',
        formData: { only_user: 1, user_id: user_id }
      },
      function(error, response, body) {
        if (error || !body) {
          return reject('發生錯誤')
        }
        response = JSON.parse(body)
        resolve(response)
      }
    )
  })
}

function getResponse(postId) {
  return new Promise((resolve, reject) => {
    request(
      {
        url: 'https://www.plurk.com/Responses/get2',
        method: 'POST',
        formData: { from_response: 0, plurk_id: postId }
      },
      function(error, response, body) {
        if (error || !body) {
          return reject('發生錯誤')
        }
        response = JSON.parse(body)
        resolve(response)
      }
    )
  })
}
