// @ts-nocheck
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: magic;
// <reference path="../index.d.ts" />

const LOGS=false
const DEBUG=false

let fm = FileManager.iCloud()
const logPath = getLogPath()

if (!LOGS && fm.fileExists(logPath)) {
  fm.remove(logPath)
}

const storageDir = fm.documentsDirectory()
const configPath = fm.joinPath(storageDir, fm.fileName("prayers_config.json", true))
// log(`Config: ${configPath}`)
const dataPath = fm.joinPath(storageDir, fm.fileName("prayers_data.json", true))
// log(`Data: ${dataPath}`)

const prayer_names_regular = {
  0: {
    long: "Fajr",
    short: "Fajr",
  },
  1: {
    long: "Sunrise",
    short: "Sun",
  },
  2: {
    long: "Zohr",
    short: "Zohr",
  },
  3: {
    long: "Asr",
    short: "Asr",
  },
  4: {
    long: "Maghrib",
    short: "Mgrb",
  },
  5: {
    long: "Isha",
    short: "Isha",
  },
}

const prayer_names_ramadan = {
  0: {
    long: "Suhoor",
    short: "Suhr",
  },
  1: {
    long: "Sunrise",
    short: "Sun",
  },
  2: {
    long: "Zohr",
    short: "Zohr",
  },
  3: {
    long: "Asr",
    short: "Asr",
  },
  4: {
    long: "Iftar",
    short: "Iftr",
  },
  5: {
    long: "Isha",
    short: "Isha",
  },
}

var latiniseList = {
  "Ć":"C",
  "Č":"C",
  "ǲ":"D",
  "ǅ":"D",
  "Đ":"D",
  "Ǳ":"DZ",
  "Ǆ":"DZ",
  "Š":"S",
  "Ṧ":"S",
  "Ž":"Z",
  "ć":"c",
  "č":"c",
  "đ":"d",
  "ǳ":"dz",
  "ǆ":"dz",
  "š":"s"
}

let searchText = ""
let cityIndex
let cityList = []

let bg_color = Color.dynamic(new Color("#FFFFFF"), new Color("#1F2227"))
let fg_primary = Color.dynamic(new Color("#4A4A4A"), new Color("#FFFFFF"))
let fg_active = new Color("#9C9D35")
let fg_inactive = Color.dynamic(new Color("#CACACA"), new Color("#6F6F6F"))
let fg_sunrise = new Color("#EDB550")
let fg_secondary = Color.dynamic(new Color("#333333"), new Color("#CACACA"))
// let fg_ramadan = new Color("#A39577")
let fg_ramadan = new Color("#4679B2")

let isDark = Device.isUsingDarkAppearance()
let icon_name =
  (isDark && fm.fileName("icon-light.png", true)) ||
  fm.fileName("icon-dark.png", true)
let icon_path = fm.joinPath(fm.documentsDirectory(), icon_name)

const prayers_data = await fetchData()
const prayer_id = prayers_data ? getUpcomingPrayer(prayers_data.vakat) : -1
const ramadan = prayers_data && prayers_data.datum[0].split(" ")[1] == "ramazan" ? true : false
const prayer_names = ramadan ? prayer_names_ramadan : prayer_names_regular

if (config.runsInApp) {
  log("Runs in App..")
  const data = await getData()
  log(JSON.stringify(data))
  let choice
  let initAlert = new Alert()
  initAlert.message = `Vaktija.ba - ${data.lokacija}`
  initAlert.addAction("Web View")
  initAlert.addAction("Switch City")
  initAlert.addCancelAction("Refresh Widgets")
  if (Device.isPhone()) {
    await initAlert.presentSheet()
      .then(id => {
        choice = id
      })
  } else {
    await initAlert.presentAlert()
      .then(id => {
        choice = id
      })
  }
  switch (choice) {
    case 0:
      let webW = new WebView()
      const city = latinise(data.lokacija.toLowerCase().replace(/ /g, "-"))
      const url = `https://vaktija.ba/${city}`
      webW.loadURL(url)
      webW.present(Device.isPhone() ? false : true)
      Script.complete()
      break
    case 1:
      cityList = await fetchLocations()
      let table = new UITable()
      table.showSeparators = true
      tableView(table)
      await QuickLook.present(table)
      if (cityIndex != undefined) {
        await updateConfig(cityIndex)
        let finalAlert = new Alert()
        finalAlert.message = `Active city: ${cityList[cityIndex]}`
        finalAlert.addAction("Done")
        finalAlert.presentAlert()
        Script.complete()
      } else {
        Script.complete()
        return
      }
  }
} else if (config.runsWithSiri) {
  if (args.shortcutParameter) {
    log("Updating city from shortcuts..")
    let inputs = args.shortcutParameter
    city = inputs.city
    await updateConfig(cityList.indexOf(city))
    Script.setShortcutOutput(`Active city: ${city}`)
    Script.complete()
    return
  }
}

let nextRefresh = Date.now() + 1000 * 60
if (config.runsInAccessoryWidget) {
  log("Accesssory widget..")
  let accesssoryCircleWidget = await createListWidget()

  accesssoryCircleWidget.refreshAfterDate = new Date(nextRefresh)

  accesssoryCircleWidget.addAccessoryWidgetBackground = true

  if (prayer_id != -1) {
    accesssoryCircleWidget
      .addText(
        `${prayer_names[prayer_id].short} ${formatPrayerTime(
          prayers_data.vakat[prayer_id]
        )}`
      )
      .centerAlignText()
  } else {
    accesssoryCircleWidget
      .addText(
        `${prayer_names[5].short} ${formatPrayerTime(prayers_data.vakat[5])}`
      )
      .centerAlignText()
  }

  accesssoryCircleWidget.presentAccessoryCircular()
  Script.setWidget(accesssoryCircleWidget)
} else if (config.runsInWidget) {
  log("Regular widget..")
  // create and configure ListWidget (widget)
  let widget = await createListWidget()

  widget.refreshAfterDate = new Date(nextRefresh)

  widget.backgroundColor = bg_color
  widget.setPadding(15, 15, 15, 15)

  // add and configure header
  let header = widget.addStack()
  // header.size = new Size(310, 50) // 290, 40
  header.setPadding(0, -5, 0, 2)
  header.centerAlignContent()

  // debug
  if (DEBUG) {
    header.borderWidth = Number(1)
    header.borderColor = Color.red()
  }

  widget.addSpacer() // space between "header" and "mainStack"

  // add and configure mainStack
  let mainStack = widget.addStack()
  // mainStack.size = new Size(310, 65)
  mainStack.centerAlignContent()
  // mainStack.setPadding(0, 5, 0, 5)
  // mainStack.addSpacer()

  // debug
  if (DEBUG) {
    mainStack.borderWidth = Number(1)
    mainStack.borderColor = Color.red()
  }

  // if (prayer_id != -1) widget.addSpacer() // space between "mainStack" and "footer"
  widget.addSpacer() // space between "mainStack" and "footer"

  // add and configure footer
  let footer = widget.addStack()

  // debug
  if (DEBUG) {
    footer.borderWidth = Number(1)
    footer.borderColor = Color.red()
  }

  // add icon to header
  // let headerIcon = header.addStack()
  // headerIcon.size = new Size(40, 40)

  // debug
  // headerIcon.borderWidth = Number(1)
  // headerIcon.borderColor = Color.yellow()

  if (await checkIfFileAvailable(icon_path)) {
    header.addSpacer(5)
    header.addImage(Image.fromFile(icon_path)).imageSize = new Size(40, 40)
    header.addSpacer(5)
  }

  // add and configure header components
  let leftHeader = header.addStack()
  // leftHeader.size = new Size(130, 45)
  leftHeader.centerAlignContent()

  // debug
  if (DEBUG) {
    leftHeader.borderWidth = Number(1)
    leftHeader.borderColor = Color.yellow()
  }

  header.addSpacer()

  let rightHeader = header.addStack()
  // rightHeader.size = new Size(90, 45)
  rightHeader.centerAlignContent()
  rightHeader.setPadding(7, 0, 0, 0)

  // debug
  if (DEBUG) {
    rightHeader.borderWidth = Number(1)
    rightHeader.borderColor = Color.cyan()
  }

  // add icon to header
  icon_path = fm.joinPath(
    fm.documentsDirectory(),
    fm.fileName("sunrise.png", true)
  )
  if (await checkIfFileAvailable(icon_path)) {
    rightHeader.addImage(Image.fromFile(icon_path)).imageSize = new Size(30, 30)
    rightHeader.addSpacer(10)
  }

  // left header components
  let headerDateStack = leftHeader.addStack()
  headerDateStack.layoutVertically()
  headerDateStack.setPadding(0, 2, 0, 2)
  leftHeader.addSpacer()
  // headerDateStack.size = new Size(100, 40)

  let headerDateTop = headerDateStack.addText(
    prayers_data.lokacija
  )
  headerDateTop.font = Font.boldSystemFont(17)
  headerDateTop.textColor = fg_primary

  let strippedDate = prayers_data.datum[0]
  let headerDateBottom = headerDateStack.addText(
    `${strippedDate.charAt(0).toUpperCase()}${strippedDate.slice(1)}.`
  )
  headerDateBottom.font = Font.regularSystemFont(13)
  headerDateBottom.textColor = fg_secondary

  prayers_data.vakat.forEach((prayer, id) => {
    let prayerBox

    if (id == 1) {
      prayerBox = rightHeader.addStack()
      // prayerBox.size = new Size(55, 40)
    } else {
      prayerBox = mainStack.addStack()
      // prayerBox.size = new Size(55, 60)
      if (id < 5) {
        mainStack.addSpacer()
      }
    }

    // debug
    if (DEBUG) {
      prayerBox.borderWidth = Number(1)
      prayerBox.borderColor = Color.yellow()
    }

    prayerBox.centerAlignContent()
    prayerBox.layoutVertically()

    let prayerNameBox = prayerBox.addStack()
    // prayerNameBox.size = new Size(55, 15)
    prayerNameBox.centerAlignContent()

    // debug
    if (DEBUG) {
      prayerNameBox.borderWidth = Number(1)
      prayerNameBox.borderColor = Color.green()
    }

    // let prayerNameBoxVLine = prayerBox.addStack()
    // prayerNameBoxVLine.borderWidth = Number(1)
    // prayerNameBoxVLine.borderColor = new Color("#6F6F6F")
    // prayerNameBoxVLine.size = new Size(50,1)

    let prayerName = prayerNameBox.addText(prayer_names[id].long)
    prayerName.font = Font.regularSystemFont(12)

    let prayerTimeBox = prayerBox.addStack()
    // prayerTimeBox.size = new Size(55, 30)
    prayerTimeBox.centerAlignContent()

    // debug
    if (DEBUG) {
      prayerTimeBox.borderWidth = Number(1)
      prayerTimeBox.borderColor = Color.green()
    }

    let prayerTime = prayerTimeBox.addText(formatPrayerTime(prayer))
    prayerTime.font = Font.boldSystemFont(20)
    prayerTime.textColor = ramadan && (id == 4 || id == 0) ? fg_ramadan : fg_primary

    // log(`ID: ${id}, PrayerID: ${prayer_id}`)
    if ((id == prayer_id - 1 && id != 1) || (prayer_id == -1 && id == 5)) {
      prayerTime.textColor = fg_active
      prayerName.textColor = fg_primary
    } else if (id == 1 && prayer_id == 1) {
      prayerTime.textColor = fg_sunrise
      // prayerName.textColor = fg_sunrise
    } else if (
      (id == 0 && id < prayer_id && ramadan) ||
      id < prayer_id - 1 ||
      (id < prayer_id && id == 1) ||
      (prayer_id == -1 && id != 5)
    ) {
      prayerTime.textColor = fg_inactive
      prayerName.textColor = fg_inactive
    }

    if (id != 1) {
      let prayerInBox = prayerBox.addStack()
      // prayerInBox.size = new Size(55, 10)
      prayerInBox.centerAlignContent()

      let prayerIn = prayerInBox.addText(prayerRelativeTime(prayer))
      prayerIn.font = Font.italicSystemFont(8)

      if ((id >= prayer_id && prayer_id != -1) || (id == 5 && prayer_id == -1)) {
        prayerIn.textColor = fg_secondary
      } else {
        prayerIn.textColor = fg_inactive
      }

      // debug
      if (DEBUG) {
        prayerInBox.borderWidth = Number(1)
        prayerInBox.borderColor = Color.green()
      }

    }
  })

  // if (Device.isPhone()) {
  //   mainStack.spacing = Number(3)
  // }
  // mainStack.addSpacer()

  footer.layoutHorizontally()
  footer.centerAlignContent()
  footer.addSpacer()
  // footer.size = new Size(310, 15)

  if (prayer_id != -1) {
    let footerPrayer = footer.addText(`${prayer_names[prayer_id].long}`)
    footer.addSpacer(3)
    let footerTime = footer.addText(
      `${prayerRelativeTime(prayers_data.vakat[prayer_id])}`
    )

    // footerPrayer.textColor = new Color("#CACACA")
    footerPrayer.textColor = fg_primary
    footerPrayer.font = Font.heavySystemFont(12)
    footerPrayer.centerAlignText()

    footerTime.textColor = fg_secondary
    footerTime.font = Font.regularSystemFont(12)
    footerTime.centerAlignText()
  } else {
    let footerTextTop = footer.addText("بارك الله فيك")
    footerTextTop.font = Font.regularSystemFont(15)
    footerTextTop.textColor = fg_primary
    footerTextTop.centerAlignText()
  }
  footer.addSpacer()

  // let headerPrayer = footer.addText(prayer_names[prayer_id].long)
  // headerPrayer.font = Font.boldSystemFont(20)
  // headerPrayer.textColor = new Color("#6F6F6F")

  // let headerTime = footer.addText(prayerRelativeTime(prayers_data.vakat[prayer_id]))
  // headerTime.font = Font.boldSystemFont(20)
  // headerTime.textColor = new Color("#6F6F6F")

  widget.presentMedium()
  Script.setWidget(widget)
}
// } else {
//   log("Running from shortcut..")
//   prayer_id != -1 ? Script.setShortcutOutput(
//     `Next prayer ${prayerRelativeTime(prayers_data.vakat[prayer_id])}`
//   ) : Script.setShortcutOutput(
//     `No more prayers today!`
//   )
// }

async function fetchLocations() {
  log("Fetching locations..")
  const url = "https://api.vaktija.ba/vaktija/v1/lokacije"
  const request = new Request(url)
  const response = await request.loadJSON()
  return response
}

async function getConfig() {
  log("Getting config..")
  if (await checkIfFileAvailable(configPath)) {
    return JSON.parse(fm.readString(configPath))
  }
  return {}
}

async function getData() {
  log("Getting data..")
  if (await checkIfFileAvailable(dataPath)) {
    return JSON.parse(fm.readString(dataPath))
  }
  return {}
}

async function updateConfig(cityIndex) {
  let config = await getConfig()
  // let config = {}
  // if (await checkIfFileAvailable(configPath)) {
  //   config = JSON.parse(fm.readString(configPath))
  //   config.city = json_input.city
  //   config.region = json_input.region
  //   config.slug = json_input.slug
  //   fm.writeString(configPath, JSON.stringify(config) )
  // }
  if (cityIndex != -1) {
    config.city = cityIndex
    fm.writeString(configPath, JSON.stringify(config))
    await fetchData(true)
  }
}


async function fetchData(force = false) {
  log("Fetching data..")
  const currentDate = new Date()
  if (await checkIfFileAvailable(dataPath)) {
    let data = await getData()
    if (data.dan == currentDate.getDate() && !force) {
      log("Using cached data.")
      return data
    }
  }

  if (checkIfFileAvailable(configPath)) {
    const config = await getConfig()
    const url = `https://api.vaktija.ba/vaktija/v1/${
      config.city
    }/${currentDate.getFullYear()}/${
      currentDate.getMonth() + 1
    }/${currentDate.getDate()}`
    const request = new Request(url)
    // log(`Request: ${JSON.stringify(request)}`)
    const response = await request.loadJSON()
    log(`Response: ${JSON.stringify(response)}`)
    fm.writeString(dataPath, JSON.stringify(response))
    return response
  }
  return false
}

function formatPrayer(prayer_time) {
  let formatedPrayer = new Date()
  formatedPrayer.setHours(prayer_time.split(":")[0])
  formatedPrayer.setMinutes(prayer_time.split(":")[1])
  formatedPrayer.setSeconds(0)
  return formatedPrayer
}

function prayerRelativeTime(prayer_time) {
  const prayer = formatPrayer(prayer_time)
  const currentDate = new Date()
  let relativeFormatter = new RelativeDateTimeFormatter()
  relativeFormatter.locale = "eng"
  relativeFormatter.useNamedDateTimeStyle()
  return relativeFormatter.string(prayer, currentDate)
}

function upcomingPrayer(prayer_time) {
  const prayer = formatPrayer(prayer_time)
  const currentDate = new Date()
  return prayer.getTime() - currentDate.getTime() > 0
}

function getUpcomingPrayer(prayer_times) {
  return prayer_times.indexOf(
    prayer_times.find((prayer_time) => upcomingPrayer(prayer_time))
  )
}

function formatPrayerTime(prayer_time) {
  let dateFormatter = new DateFormatter()
  dateFormatter.dateFormat = "h:mm"
  return dateFormatter.string(formatPrayer(prayer_time))
}

async function createListWidget() {
  let listwidget = new ListWidget()
  return listwidget
}

async function checkIfFileAvailable(file_path) {
  if (fm.fileExists(file_path)) {
    if (!fm.isFileDownloaded(file_path))
      log(`Downloading file ${file_path} from iCloud..`)
      await fm.downloadFileFromiCloud(file_path)
  } else {
    return false
  }
  return true
}

function getLogPath() {
  let logFile
  if (Device.isPhone()) {
    logFile = "iphone.log"
  } else {
    logFile = "mac.log"
  }
  const logPath = fm.joinPath(
    fm.documentsDirectory(),
    logFile
  )
  return logPath
}

function log(msg) {
  if (!LOGS) return
  console.log(msg)
  let oldData = ""
  if (fm.fileExists(logPath))
    oldData = fm.readString(logPath) + "\n"
  let logDate = new Date()
  oldData +=
    `${logDate.getFullYear()}-${logDate.getMonth()}-${logDate.getDate()}` +
    " " +
    `${logDate.getHours()}:${logDate.getMinutes()}:${logDate.getSeconds()}.${logDate.getMilliseconds()}` +
    " [INFO] " +
    msg
  fm.writeString(logPath, oldData)
}

function tableView(table) {
  table.removeAllRows()
  tableHeader(table)
  tableList(table)
  table.reload()
}

function tableHeader(table) {
  let header = new UITableRow()
  header.isHeader = true
  header.height = 70

  let imageCell = UITableCell.image(Image.fromFile(icon_path))
  imageCell.leftAligned()
  header.addCell(imageCell)

  let titleCell = UITableCell.text("Vaktija.ba")
  titleCell.centerAligned()
  titleCell.titleFont = Font.boldRoundedSystemFont(20)
  header.addCell(titleCell)

  // let searchCell = UITableCell.image(SFSymbol.named("magnifyingglass").image)
  let searchCell = UITableCell.button("Search")
  searchCell.rightAligned()
  searchCell.onTap = () => {
    let searchAlert = new Alert()
    searchText = searchAlert.addTextField("Search city..", searchText)
    searchAlert.addAction("Search")
    searchAlert.addCancelAction("Back")
    searchAlert.title = "Search"
    searchAlert.presentAlert()
      .then((id) => {
        switch (id) {
          case 0:
            searchText = searchAlert.textFieldValue(0)
            tableView(table)
            break
        }
      })
  }

  header.addCell(searchCell)

  table.addRow(header)
}

function tableList(table) {
  let row = new UITableRow()
  let cell = UITableCell.text("Select city:")
  cell.centerAligned()
  cell.titleFont = Font.subheadline()
  row.addCell(cell)
  table.addRow(row)
  cityList.forEach((city, id) => {
    let row = new UITableRow()
    const cityText = formatSearchText(city)
    const matchText = formatSearchText(searchText)
    if (cityText.includes(matchText)) {
      row.addText(city)
      row.onSelect = () => {
        cityIndex = id
      }
      table.addRow(row)
    }
  })
}

function formatSearchText(string) {
  return latinise(string.toLowerCase().replace(/ /g, ""))
}

function latinise(string) {
  return string.replace(/[^A-Za-z0-9\[\] ]/g, (a) => {
    return latiniseList[a]||a
  })
}
