const KEY_WEBDAV_CONFIG = "quiz_webdav_config"
const DEFAULT_BACKUP_DIR = "/quiz-bank-backup/"

function getDefaultConfig() {
  return {
    enabled: false,
    autoBackupEnabled: false,
    serverUrl: "",
    username: "",
    password: "",
    backupDir: DEFAULT_BACKUP_DIR,

    updateTime: "",

    lastBackupTime: "",
    lastBackupFileName: "",

    lastAutoBackupTime: "",
    lastAutoBackupFileName: ""
  }
}

function normalizeBackupDir() {
  return DEFAULT_BACKUP_DIR
}

function normalizeBackupFileName(fileName) {
  const raw = String(fileName || "").trim()

  if (!raw) {
    return ""
  }

  const cleanName = raw
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")

  if (!cleanName) {
    return ""
  }

  if (cleanName.toLowerCase().endsWith(".json")) {
    return cleanName
  }

  return `${cleanName}.json`
}

function normalizeConfig(config) {
  const safeConfig = config || {}

  return {
    enabled: !!safeConfig.enabled,
    autoBackupEnabled: !!safeConfig.autoBackupEnabled,

    serverUrl: String(safeConfig.serverUrl || "").trim(),
    username: String(safeConfig.username || "").trim(),
    password: String(safeConfig.password || ""),
    backupDir: normalizeBackupDir(),

    updateTime: safeConfig.updateTime || "",

    lastBackupTime: safeConfig.lastBackupTime || "",
    lastBackupFileName: safeConfig.lastBackupFileName || "",

    lastAutoBackupTime: safeConfig.lastAutoBackupTime || "",
    lastAutoBackupFileName: safeConfig.lastAutoBackupFileName || ""
  }
}

function getConfig() {
  const config = wx.getStorageSync(KEY_WEBDAV_CONFIG)

  if (!config) {
    return getDefaultConfig()
  }

  return normalizeConfig(config)
}

function saveConfig(config) {
  const oldConfig = getConfig()

  const normalized = normalizeConfig({
    ...oldConfig,
    ...config,
    backupDir: DEFAULT_BACKUP_DIR,
    updateTime: new Date().toISOString()
  })

  wx.setStorageSync(KEY_WEBDAV_CONFIG, normalized)

  return normalized
}

function clearConfig() {
  wx.removeStorageSync(KEY_WEBDAV_CONFIG)
}

function hasConfig() {
  const config = getConfig()

  return !!(
    config.serverUrl &&
    config.username &&
    config.password &&
    config.backupDir
  )
}

function maskPassword(password) {
  if (!password) return ""

  if (password.length <= 4) {
    return "****"
  }

  return `${password.slice(0, 2)}****${password.slice(-2)}`
}

function getDateText(timeText) {
  if (!timeText) return ""

  const date = new Date(timeText)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")

  return `${y}-${m}-${d}`
}

function isAutoBackupDue(config) {
  const safeConfig = normalizeConfig(config)

  if (!safeConfig.enabled) return false
  if (!safeConfig.autoBackupEnabled) return false
  if (!hasConfig()) return false

  const today = getDateText(new Date().toISOString())
  const lastAutoDay = getDateText(safeConfig.lastAutoBackupTime)

  return today !== lastAutoDay
}

function markBackupSuccess(fileName, isAuto) {
  const config = getConfig()
  const now = new Date().toISOString()

  const newConfig = {
    ...config,
    lastBackupTime: now,
    lastBackupFileName: fileName
  }

  if (isAuto) {
    newConfig.lastAutoBackupTime = now
    newConfig.lastAutoBackupFileName = fileName
  }

  wx.setStorageSync(KEY_WEBDAV_CONFIG, normalizeConfig(newConfig))

  return getConfig()
}

module.exports = {
  DEFAULT_BACKUP_DIR,
  getDefaultConfig,
  getConfig,
  saveConfig,
  clearConfig,
  hasConfig,
  maskPassword,
  normalizeBackupFileName,
  normalizeBackupDir,
  isAutoBackupDue,
  markBackupSuccess
}