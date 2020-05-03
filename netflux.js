const fs = require('fs')
const request = require('request')

function open(filename, format, data='') { // opne file at path, either read in as string, json, or write new data to it.
  if (format == "json") {
    f = fs.readFileSync(filename, encoding="utf-8")
    return JSON.parse(f)
  } else if (format == "r") {
    f = fs.readFileSync(filename, encoding="utf-8")
    return f
  } else if (format == "w") {
    fs.writeFileSync(filename, data)
    return data
  } else if (format == "a") {
    f = fs.readFileSync(filename, encoding="utf-8")+''
    newKey = Object.keys(data)[0]
    newValue = data[newKey]
    oldJSON = JSON.parse(f)
    oldJSON[newKey] = newValue
    newJSON = JSON.stringify(oldJSON, "", 4)
    fs.writeFileSync(filename, newJSON)
    return newJSON
  }
}

/* console.log(open("hey.json", "json")) */

function wait(ms) {
  var start = Date.now(),
      now = start;
  while (now - start < ms) {
    now = Date.now();
  }
}

async function getMovieData(title) {
  // First, check if it's already in DB
  return new Promise(function (resolve, reject) {
    db = open('db.json', "json")
    if (title in db) {
      if (db[title]["Response"] == "False") {
  
      } else {
        if (db[title] != "workingonit") {
          return true
        }
      }
    }
    // Don't forget to make title modifications here
    url = "http://www.omdbapi.com/?t=mytitle&apikey=b5305899".replace("mytitle", title.replace(/[^a-zA-Z ]/g, "").replace(/ /g, "+"))
    open("db.json", "a", {[title]: "workingonit"})
    request.get(url, (error, response, body) => {
/*       console.log(":"+title)
 */      try {
        res = JSON.parse(body)
      } catch(error) {
        console.error(error)
        getMovieData(title)
      }
      /* console.log(body) */
      open("db.json", "a", {[title]: res})
      resolve()
    })

  })

}


function keys(dict) { // return keys from dict, but without the "object.xx" part
  return Object.keys(dict)
}

function getRuntime(dict) {
  if (dict["Response"] == "False") {
    return 45
  } else if (dict["Runtime"] == "N/A") {
    return 45
  } else {
    return Number(dict["Runtime"].split("")[0])
  }
}

async function generateNetfluxDict(path) {
  fullDict = {
    "counts": {},
    "dates": [],
    "rawLengths": []
  }
  rawFile = open(path, "r")
  rawLines = rawFile.split("\n").slice(1, -1) // Split at newlines
/*   console.log(rawLines)
 */  netfluxDict = {}
  rawLines.forEach( function (item, index) {
    currentArray = item.replace('","', "SEPARATOR").replace(/"/g, "").split("SEPARATOR") // replace the separator, which is "title","date", so "," with SEP, then replace single "s with nothing, then split array.
    title = currentArray[0]
    date = currentArray[1]
    justTitle = title.split(":")[0]
    // Fill counts subdict
    if (justTitle in fullDict["counts"]) {
      fullDict["counts"][justTitle] += 1
    } else {
      fullDict["counts"][justTitle] = 1
    }
    // Fill dates subdicts
    if (date in fullDict["dates"]) {
      fullDict["dates"][date].push(justTitle)
    } else {
      fullDict["dates"][date] = [justTitle]
    }
  })
  // Wait for every download
  titles = []
  keys(fullDict["counts"]).forEach(function (item, index) {
    titles.push(getMovieData(item))
  })
  console.log("eddig1")
  const bar = await Promise.all(titles)
  console.log("eddig2")
  // Fill rawLengths
  dbJson = open("db.json", "json")
  keys(fullDict["counts"]).forEach(function (item, index) {
    fullDict["rawLength"][item] = getRuntime(dbJson[item])
  })
  console.log(fullDict)
  return Promise.resolve(fullDict)
}

generateNetfluxDict("peti.csv").then(function (result) {
  console.log(result)
})