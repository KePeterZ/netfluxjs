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
        }
      }
    }
    // Don't forget to make title modifications here
    url = "http://www.omdbapi.com/?t=mytitle&apikey=b5305899".replace("mytitle", title.replace(/[^a-zA-Z ]/g, "").replace(/ /g, "+"))
    open("db.json", "a", {[title]: "workingonit"})
    request.get(url, (error, response, body) => {
      /* console.log(":"+title )*/
      try {
        res = JSON.parse(body)
      } catch(error) {
        console.error(error)
        open("db.json", "a", {[title]: {"Response": "True", "Runtime": "45 min"}})
      }
      /* console.log(body) */
      /* console.log("yes") */
      open("db.json", "a", {[title]: res})
      resolve()
    })

  }).catch(error => {
    resolve()
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
    return Number(dict["Runtime"].split(" ")[0])
  }
}

function getGenres(dict) {
  if (dict["Genre"]) {
    return dict["Genre"].split(", ")
  } else {
    return []
  }
}

async function generateNetfluxDict(path) {
  fullDict = {
    "counts": {},
    "dates": [],
    "rawLengths": {},
    "genres": {},
    "averages": {},
    "minutes": {}
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
      fullDict["dates"][date]["episodes"].push(justTitle)
    } else {
      fullDict["dates"][date] = {"episodes": [justTitle]}
    }
  })
  // Wait for every download
  console.log("eddig1")
  titles = keys(fullDict["counts"]).map(item => getMovieData(item))
  const bar = await Promise.all(titles)
  console.log("eddig2")
  // Fill rawLengths
  rawTitles = keys(fullDict["counts"])
  dbJson = open("db.json", "json")
  rawTitles.map(function (stuff, index) {
    /* console.log(":"+stuff) */
    fullDict["rawLengths"][stuff] = getRuntime(dbJson[stuff]) 
  })
  console.log(fullDict)
  // Add viewTime to dates
  keys(fullDict["dates"]).forEach(function (date, index) {
    fullDict["dates"][date]["episodes"].forEach(function (ep, index) {
      if (fullDict["dates"][date]["watctime"]) {
        fullDict["dates"][date]["watctime"] += fullDict["rawLengths"][ep]
      } else {
        fullDict["dates"][date]["watctime"] = fullDict["rawLengths"][ep]
      }
    })
  })
  // Add Most watched genres
  rawTitles.forEach(function (item, index) {
    currentGenres = getGenres(dbJson[item])
    currentGenres.forEach(function (genre) {
      if (fullDict["genres"][genre]) {
        fullDict["genres"][genre] += fullDict["counts"][item]
      } else {
        fullDict["genres"][genre] = fullDict["counts"][item]
      }
    })
  })
  // Create averages for data
  byMonth = {}
  keys(fullDict["dates"]).forEach(function (item, index) {
    date = item.split("/")
    month = date[0]+"/"+date[2]
    if (byMonth[month]) {
      byMonth[month]["full"] += fullDict["dates"][item]["watchtime"]
      byMonth[month]["days"] += 1
    } else {
      byMonth[month]= {"full": fullDict["dates"][item]["watchtime"], "days": 1}
    }
    fullDict["averages"]["byMonth"] = byMonth

  })
  // Calculate minutes watched for every show
  rawTitles.forEach(function (title, index) {
    fullDict["minutes"][title] = Math.floor(fullDict["counts"][title]*fullDict["rawLengths"][title]/60*10)/10
  })
  return Promise.resolve(fullDict)
}

generateNetfluxDict("peti.csv").then(function (result) {
  console.log(result)
})

// last 2 months, by days
// last 6 months, by weeks
// last 2 years, by months

// Genres, by episodes