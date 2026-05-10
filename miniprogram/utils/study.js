const KEY_SETTINGS = "quiz_user_settings"
const KEY_CHECKIN = "quiz_checkin_records"
const KEY_STATS = "quiz_study_stats"

function getTodayString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getSettings() {
  const settings = wx.getStorageSync(KEY_SETTINGS)

  if (settings) {
    return settings
  }

  const defaultSettings = {
    examDate: "2026-12-01",
    createTime: new Date().toISOString()
  }

  wx.setStorageSync(KEY_SETTINGS, defaultSettings)
  return defaultSettings
}

function saveSettings(settings) {
  wx.setStorageSync(KEY_SETTINGS, settings)
}

function getCountdownDays() {
  const settings = getSettings()
  const examDate = new Date(`${settings.examDate}T00:00:00`)
  const today = new Date(`${getTodayString()}T00:00:00`)

  const diff = examDate.getTime() - today.getTime()
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))

  return days > 0 ? days : 0
}

function getCheckinRecords() {
  return wx.getStorageSync(KEY_CHECKIN) || {}
}

function isTodayChecked() {
  const records = getCheckinRecords()
  const today = getTodayString()
  return !!records[today]
}

function checkinToday() {
  const records = getCheckinRecords()
  const today = getTodayString()

  records[today] = {
    date: today,
    checked: true,
    checkinTime: new Date().toISOString()
  }

  wx.setStorageSync(KEY_CHECKIN, records)
}

function getLearningDays() {
  const records = getCheckinRecords()
  return Object.keys(records).length
}

function getDefaultStats() {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    dailyStats: {}
  }
}

function getStats() {
  const stats = wx.getStorageSync(KEY_STATS) || getDefaultStats()

  if (!stats.dailyStats) {
    stats.dailyStats = {}
  }

  if (typeof stats.totalAnswered !== "number") {
    stats.totalAnswered = 0
  }

  if (typeof stats.totalCorrect !== "number") {
    stats.totalCorrect = 0
  }

  return stats
}

function getTodayStats() {
  const stats = getStats()
  const today = getTodayString()

  return stats.dailyStats[today] || {
    date: today,
    answered: 0,
    correct: 0
  }
}

function getAccuracyRate() {
  const stats = getStats()

  if (!stats.totalAnswered) {
    return 0
  }

  return Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
}

function getTodayAccuracyRate() {
  const todayStats = getTodayStats()

  if (!todayStats.answered) {
    return 0
  }

  return Math.round((todayStats.correct / todayStats.answered) * 100)
}

function getHomeSummary() {
  const stats = getStats()
  const todayStats = getTodayStats()

  return {
    countdownDays: getCountdownDays(),
    learningDays: getLearningDays(),
    todayChecked: isTodayChecked(),

    todayAnswered: todayStats.answered,
    todayCorrect: todayStats.correct,
    todayAccuracyRate: getTodayAccuracyRate(),

    totalAnswered: stats.totalAnswered,
    totalCorrect: stats.totalCorrect,
    accuracyRate: getAccuracyRate()
  }
}

module.exports = {
  getTodayString,
  getSettings,
  saveSettings,
  getCountdownDays,
  isTodayChecked,
  checkinToday,
  getLearningDays,
  getStats,
  getTodayStats,
  getAccuracyRate,
  getTodayAccuracyRate,
  getHomeSummary
}