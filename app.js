var express = require('express')
var app = express()
var request = require('request')
var cheerio = require('cheerio')
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()
var PORT = process.env.PORT || 3000
app.use(express.static('page'))
app.use(jsonParser)

app.post('/getTimeline', (req, res) => {
  console.log(req.body)
  var account = req.body.account.map(item => {
    return getUid(item)
  })
  var targetId = ''
  var start = req.body.start
  var end = req.body.end
  getUid(req.body.searchAccount)
    .then(searchId => {
      targetId = searchId
      console.log(targetId)
      return Promise.all(account)
    })
    .then(allAccount => {
      // console.log(allAccount)
      var offset = new Date(end).toISOString()
      var getAllTimeline = allAccount.map(item => {
        return getTimeline(item, offset, req.body.start)
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
      var hasTargetRespones = response.filter(item => {
        return item.users.hasOwnProperty(targetId)
      })
      var targetRespones = []
      // 過濾出只有目標帳號的回應
      hasTargetRespones.forEach(item => {
        var responsesObj = {
          url: item.url,
          responses: []
        }
        item.responses.forEach(response => {
          if (response.user_id == targetId && Date.parse(response.posted) > start && Date.parse(response.posted) < end) {
            responsesObj.responses.push(response.content)
          }
        })
        if (responsesObj.responses.length) {
          targetRespones.push(responsesObj)
        }
      })
      // console.log(targetRespones)
      res.json(targetRespones)
    })
    .catch(error => {
      console.log(error)
    })
})

app.listen(PORT, function() {
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
        if (error || $('title').text() == 'User Not Found! - Plurk' || $('title').text() == 'Your life, on the line - Plurk' || $('title').text() == 'Not Found - Plurk') {
          return resolve(0)
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

function getTimeline(user_id, offset, start) {
  return new Promise((resolve, reject) => {
    request(
      {
        url: 'https://www.plurk.com/TimeLine/getPlurks',
        method: 'POST',
        formData: { offset: offset, only_user: 1, user_id: user_id }
      },
      function(error, response, body) {
        var plurksData = JSON.parse(body)
        if (error || plurksData.error === 'NoReadPermissionError') {
          return resolve({ plurks: [] })
        }
        // 用來繼續發出 request 的 function，遞迴至取得的舊文章的發文日比起使日早或是沒有舊文章
        function getMore(newOffset) {
          request(
            {
              url: 'https://www.plurk.com/TimeLine/getPlurks',
              method: 'POST',
              formData: { offset: newOffset, only_user: 1, user_id }
            },
            function(error, response, body) {
              var morePlurksData = JSON.parse(body)
              if (morePlurksData.plurks.length === 0) {
                return resolve(plurksData)
              }
              plurksData.plurks = [...plurksData.plurks, ...morePlurksData.plurks]
              if (Date.parse(morePlurksData.plurks[morePlurksData.plurks.length - 1].posted) > start) {
                return getMore(new Date(morePlurksData.plurks[morePlurksData.plurks.length - 1].posted).toISOString())
              } else {
                return resolve(plurksData)
              }
            }
          )
        }
        // 如果最後一則文章的發文時間的時間比起始日晚，則繼續發出 request
        if (plurksData.plurks.length > 0 && Date.parse(plurksData.plurks[plurksData.plurks.length - 1].posted) > start) {
          return getMore(new Date(plurksData.plurks[plurksData.plurks.length - 1].posted).toISOString())
        } else {
          resolve(plurksData)
        }
      }
    )
  })
}

function getResponse(postId) {
  return new Promise((resolve, reject) => {
    request(
      {
        url: 'https://www.plurk.com/Responses/get',
        method: 'POST',
        formData: { from_response_id: 0, plurk_id: postId }
      },
      function(error, response, body) {
        if (error || !body) {
          return reject('發生錯誤')
        }
        response = JSON.parse(body)
        response.url = `https://www.plurk.com/p/${postId.toString(36)}`
        resolve(response)
      }
    )
  })
}
