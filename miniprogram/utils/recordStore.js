const KEY_ANSWER_MAP = "quiz_answer_map"
const KEY_WRONG_MAP = "quiz_wrong_map"
const KEY_FAVORITE_MAP = "quiz_favorite_map"
const KEY_NOTE_MAP = "quiz_note_map"
const KEY_DELETED_MAP = "quiz_deleted_question_map"
const KEY_STATS = "quiz_study_stats"

const KEY_SEQUENCE_PROGRESS_MAP = "quiz_sequence_progress_map"
const KEY_WRONG_PROGRESS_MAP = "quiz_wrong_practice_progress_map"
const KEY_FAVORITE_PROGRESS_MAP = "quiz_favorite_practice_progress_map"

function getTodayString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getMap(key) {
  return wx.getStorageSync(key) || {}
}

function saveMap(key, value) {
  wx.setStorageSync(key, value)
}

function getAnswerMap() {
  return getMap(KEY_ANSWER_MAP)
}

function getWrongMap() {
  return getMap(KEY_WRONG_MAP)
}

function getFavoriteMap() {
  return getMap(KEY_FAVORITE_MAP)
}

function getNoteMap() {
  return getMap(KEY_NOTE_MAP)
}

function getDeletedMap() {
  return getMap(KEY_DELETED_MAP)
}

function getSequenceProgressMap() {
  return getMap(KEY_SEQUENCE_PROGRESS_MAP)
}

function getWrongProgressMap() {
  return getMap(KEY_WRONG_PROGRESS_MAP)
}

function getFavoriteProgressMap() {
  return getMap(KEY_FAVORITE_PROGRESS_MAP)
}

function getProgressKeyByMode(mode) {
  if (mode === "wrong") {
    return KEY_WRONG_PROGRESS_MAP
  }

  if (mode === "favorite") {
    return KEY_FAVORITE_PROGRESS_MAP
  }

  return KEY_SEQUENCE_PROGRESS_MAP
}

function getModeProgressMap(mode) {
  return getMap(getProgressKeyByMode(mode))
}

function saveModeProgressMap(mode, value) {
  saveMap(getProgressKeyByMode(mode), value)
}

function isHardDeleted(questionId) {
  const deletedMap = getDeletedMap()
  return deletedMap[questionId] && deletedMap[questionId].deleteStatus === "hard_deleted"
}

function isInRecycleBin(questionId) {
  const deletedMap = getDeletedMap()
  return deletedMap[questionId] && deletedMap[questionId].deleteStatus === "recycle"
}

function moveQuestionToRecycle(question) {
  const deletedMap = getDeletedMap()

  deletedMap[question.id] = {
    questionId: question.id,
    subjectId: question.subjectId,
    chapterId: question.chapterId,
    deleteStatus: "recycle",
    deletedAt: new Date().toISOString()
  }

  saveMap(KEY_DELETED_MAP, deletedMap)
}

function restoreQuestion(questionId) {
  const deletedMap = getDeletedMap()

  if (deletedMap[questionId]) {
    delete deletedMap[questionId]
  }

  saveMap(KEY_DELETED_MAP, deletedMap)
}

function normalizeAnswer(answer) {
  if (!Array.isArray(answer)) return []
  return answer.map(item => String(item)).sort()
}

function isSameAnswer(userAnswer, correctAnswer) {
  const u = normalizeAnswer(userAnswer).join("|")
  const c = normalizeAnswer(correctAnswer).join("|")
  return u === c
}

function formatAnswer(answer) {
  const list = normalizeAnswer(answer)

  if (list.length === 0) {
    return "未选择"
  }

  return list.join("、")
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

function saveStats(stats) {
  wx.setStorageSync(KEY_STATS, stats)
}

function addAnswerStat(isCorrect) {
  const today = getTodayString()
  const stats = getStats()

  stats.totalAnswered += 1

  if (isCorrect) {
    stats.totalCorrect += 1
  }

  if (!stats.dailyStats[today]) {
    stats.dailyStats[today] = {
      date: today,
      answered: 0,
      correct: 0
    }
  }

  stats.dailyStats[today].answered += 1

  if (isCorrect) {
    stats.dailyStats[today].correct += 1
  }

  saveStats(stats)
}

function isFavorite(questionId) {
  const favoriteMap = getFavoriteMap()
  return !!favoriteMap[questionId]
}

function isWrong(questionId) {
  const wrongMap = getWrongMap()
  return !!wrongMap[questionId]
}

function toggleFavorite(question) {
  const favoriteMap = getFavoriteMap()

  if (favoriteMap[question.id]) {
    delete favoriteMap[question.id]
  } else {
    favoriteMap[question.id] = {
      questionId: question.id,
      subjectId: question.subjectId,
      chapterId: question.chapterId,
      favoriteTime: new Date().toISOString(),
      source: "manual"
    }
  }

  saveMap(KEY_FAVORITE_MAP, favoriteMap)

  return !!favoriteMap[question.id]
}

function submitAnswer(question, userAnswer, mode) {
  const answerMap = getAnswerMap()
  const wrongMap = getWrongMap()
  const progressMap = getModeProgressMap(mode)

  const oldAnswerRecord = answerMap[question.id]
  const oldWrongRecord = wrongMap[question.id]

  const previousUserAnswer = oldAnswerRecord
    ? oldAnswerRecord.lastAnswer
    : oldWrongRecord
      ? oldWrongRecord.lastUserAnswer
      : []

  const isCorrect = isSameAnswer(userAnswer, question.answer)

  const baseRecord = {
    questionId: question.id,
    subjectId: question.subjectId,
    chapterId: question.chapterId,
    lastAnswer: userAnswer,
    correctAnswer: question.answer,
    lastIsCorrect: isCorrect,
    done: true,
    submitTime: new Date().toISOString()
  }

  answerMap[question.id] = baseRecord

  progressMap[question.id] = {
    ...baseRecord,
    mode: mode || "sequence"
  }

  if (!isCorrect) {
    wrongMap[question.id] = {
      questionId: question.id,
      subjectId: question.subjectId,
      chapterId: question.chapterId,
      lastUserAnswer: userAnswer,
      correctAnswer: question.answer,
      wrongCount: oldWrongRecord ? oldWrongRecord.wrongCount + 1 : 1,
      lastWrongTime: new Date().toISOString()
    }
  }

  saveMap(KEY_ANSWER_MAP, answerMap)
  saveMap(KEY_WRONG_MAP, wrongMap)
  saveModeProgressMap(mode, progressMap)

  addAnswerStat(isCorrect)

  return {
    isCorrect,
    previousUserAnswer
  }
}

function removeWrong(questionId) {
  const wrongMap = getWrongMap()
  const wrongProgressMap = getWrongProgressMap()

  if (wrongMap[questionId]) {
    delete wrongMap[questionId]
  }

  if (wrongProgressMap[questionId]) {
    delete wrongProgressMap[questionId]
  }

  saveMap(KEY_WRONG_MAP, wrongMap)
  saveMap(KEY_WRONG_PROGRESS_MAP, wrongProgressMap)
}

function getNote(questionId) {
  const noteMap = getNoteMap()
  return noteMap[questionId] || ""
}

function saveNote(questionId, note) {
  const noteMap = getNoteMap()
  noteMap[questionId] = note
  saveMap(KEY_NOTE_MAP, noteMap)
}

function shouldClearRecord(record, scope) {
  if (!record) return false

  if (!scope || scope.type === "all") {
    return true
  }

  if (scope.type === "subject") {
    return String(record.subjectId) === String(scope.subjectId)
  }

  if (scope.type === "chapter") {
    return String(record.subjectId) === String(scope.subjectId) &&
      String(record.chapterId) === String(scope.chapterId)
  }

  return false
}

function clearMapByScope(key, scope) {
  const targetMap = getMap(key)
  const newMap = {}

  Object.keys(targetMap).forEach(questionId => {
    const record = targetMap[questionId]

    if (!shouldClearRecord(record, scope)) {
      newMap[questionId] = record
    }
  })

  saveMap(key, newMap)
}

function clearSequenceProgress(scope) {
  clearMapByScope(KEY_SEQUENCE_PROGRESS_MAP, scope)
}

function clearWrongPracticeProgress(scope) {
  clearMapByScope(KEY_WRONG_PROGRESS_MAP, scope)
}

function clearFavoritePracticeProgress(scope) {
  clearMapByScope(KEY_FAVORITE_PROGRESS_MAP, scope)
}

function clearWrongRecords(scope) {
  clearMapByScope(KEY_WRONG_MAP, scope)
  clearMapByScope(KEY_WRONG_PROGRESS_MAP, scope)
}

function clearFavoriteRecords(scope) {
  clearMapByScope(KEY_FAVORITE_MAP, scope)
  clearMapByScope(KEY_FAVORITE_PROGRESS_MAP, scope)
}

function buildQuestionIdSet(questionIds) {
  const idSet = {}

  if (!Array.isArray(questionIds)) {
    return idSet
  }

  questionIds.forEach(id => {
    if (id !== undefined && id !== null && id !== "") {
      idSet[String(id)] = true
    }
  })

  return idSet
}

function pickMapByQuestionIds(map, questionIds) {
  const idSet = buildQuestionIdSet(questionIds)
  const result = {}

  Object.keys(map || {}).forEach(questionId => {
    if (idSet[questionId]) {
      result[questionId] = map[questionId]
    }
  })

  return result
}

function removeMapByQuestionIds(map, questionIds) {
  const idSet = buildQuestionIdSet(questionIds)
  const result = {}

  Object.keys(map || {}).forEach(questionId => {
    if (!idSet[questionId]) {
      result[questionId] = map[questionId]
    }
  })

  return result
}

function countMapByQuestionIds(map, questionIds) {
  const picked = pickMapByQuestionIds(map, questionIds)
  return Object.keys(picked).length
}

function getRecordImpactByQuestionIds(questionIds) {
  return {
    answerCount: countMapByQuestionIds(getAnswerMap(), questionIds),
    wrongCount: countMapByQuestionIds(getWrongMap(), questionIds),
    favoriteCount: countMapByQuestionIds(getFavoriteMap(), questionIds),
    noteCount: countMapByQuestionIds(getNoteMap(), questionIds),
    sequenceProgressCount: countMapByQuestionIds(getSequenceProgressMap(), questionIds),
    wrongProgressCount: countMapByQuestionIds(getWrongProgressMap(), questionIds),
    favoriteProgressCount: countMapByQuestionIds(getFavoriteProgressMap(), questionIds),
    deletedCount: countMapByQuestionIds(getDeletedMap(), questionIds)
  }
}

function getDateFromRecord(record) {
  const timeText = record && record.submitTime
    ? record.submitTime
    : ""

  if (!timeText) {
    return getTodayString()
  }

  const date = new Date(timeText)

  if (Number.isNaN(date.getTime())) {
    return getTodayString()
  }

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")

  return `${y}-${m}-${d}`
}

function buildStatsFromAnswerMap(answerMap) {
  const stats = {
    totalAnswered: 0,
    totalCorrect: 0,
    dailyStats: {}
  }

  Object.keys(answerMap || {}).forEach(questionId => {
    const record = answerMap[questionId]
    const dateText = getDateFromRecord(record)

    stats.totalAnswered += 1

    if (record && record.lastIsCorrect) {
      stats.totalCorrect += 1
    }

    if (!stats.dailyStats[dateText]) {
      stats.dailyStats[dateText] = {
        date: dateText,
        answered: 0,
        correct: 0
      }
    }

    stats.dailyStats[dateText].answered += 1

    if (record && record.lastIsCorrect) {
      stats.dailyStats[dateText].correct += 1
    }
  })

  return stats
}

function rebuildStatsFromAnswers() {
  const answerMap = getAnswerMap()
  const stats = buildStatsFromAnswerMap(answerMap)

  saveStats(stats)

  return stats
}

function clearRecordsByQuestionIds(questionIds) {
  saveMap(KEY_ANSWER_MAP, removeMapByQuestionIds(getAnswerMap(), questionIds))
  saveMap(KEY_WRONG_MAP, removeMapByQuestionIds(getWrongMap(), questionIds))
  saveMap(KEY_FAVORITE_MAP, removeMapByQuestionIds(getFavoriteMap(), questionIds))
  saveMap(KEY_NOTE_MAP, removeMapByQuestionIds(getNoteMap(), questionIds))
  saveMap(KEY_SEQUENCE_PROGRESS_MAP, removeMapByQuestionIds(getSequenceProgressMap(), questionIds))
  saveMap(KEY_WRONG_PROGRESS_MAP, removeMapByQuestionIds(getWrongProgressMap(), questionIds))
  saveMap(KEY_FAVORITE_PROGRESS_MAP, removeMapByQuestionIds(getFavoriteProgressMap(), questionIds))
  saveMap(KEY_DELETED_MAP, removeMapByQuestionIds(getDeletedMap(), questionIds))

  rebuildStatsFromAnswers()

  return {
    ok: true
  }
}

function hardDeleteQuestionsAndRecords(questionIds) {
  const idSet = buildQuestionIdSet(questionIds)
  const ids = Object.keys(idSet)

  if (ids.length === 0) {
    return {
      ok: true
    }
  }

  const oldDeletedMap = getDeletedMap()

  saveMap(KEY_ANSWER_MAP, removeMapByQuestionIds(getAnswerMap(), ids))
  saveMap(KEY_WRONG_MAP, removeMapByQuestionIds(getWrongMap(), ids))
  saveMap(KEY_FAVORITE_MAP, removeMapByQuestionIds(getFavoriteMap(), ids))
  saveMap(KEY_NOTE_MAP, removeMapByQuestionIds(getNoteMap(), ids))
  saveMap(KEY_SEQUENCE_PROGRESS_MAP, removeMapByQuestionIds(getSequenceProgressMap(), ids))
  saveMap(KEY_WRONG_PROGRESS_MAP, removeMapByQuestionIds(getWrongProgressMap(), ids))
  saveMap(KEY_FAVORITE_PROGRESS_MAP, removeMapByQuestionIds(getFavoriteProgressMap(), ids))

  const newDeletedMap = removeMapByQuestionIds(oldDeletedMap, ids)
  const now = new Date().toISOString()

  ids.forEach(questionId => {
    newDeletedMap[questionId] = {
      ...(oldDeletedMap[questionId] || {}),
      questionId,
      deleteStatus: "hard_deleted",
      hardDeletedAt: now
    }
  })

  saveMap(KEY_DELETED_MAP, newDeletedMap)

  rebuildStatsFromAnswers()

  return {
    ok: true
  }
}

function hardDeleteQuestionAndRecords(questionId) {
  return hardDeleteQuestionsAndRecords([questionId])
}

function hardDeleteQuestion(questionId) {
  return hardDeleteQuestionAndRecords(questionId)
}

function getPackageRecordsByQuestionIds(questionIds) {
  const answers = pickMapByQuestionIds(getAnswerMap(), questionIds)

  return {
    answers,
    wrong: pickMapByQuestionIds(getWrongMap(), questionIds),
    favorites: pickMapByQuestionIds(getFavoriteMap(), questionIds),
    notes: pickMapByQuestionIds(getNoteMap(), questionIds),
    sequenceProgress: pickMapByQuestionIds(getSequenceProgressMap(), questionIds),
    wrongProgress: pickMapByQuestionIds(getWrongProgressMap(), questionIds),
    favoriteProgress: pickMapByQuestionIds(getFavoriteProgressMap(), questionIds),
    deleted: pickMapByQuestionIds(getDeletedMap(), questionIds),
    stats: buildStatsFromAnswerMap(answers)
  }
}

function getPackageRecords() {
  return {
    answers: getAnswerMap(),
    wrong: getWrongMap(),
    favorites: getFavoriteMap(),
    notes: getNoteMap(),
    sequenceProgress: getSequenceProgressMap(),
    wrongProgress: getWrongProgressMap(),
    favoriteProgress: getFavoriteProgressMap(),
    deleted: getDeletedMap(),
    stats: getStats()
  }
}

function normalizeImportRecords(records) {
  const safeRecords = records || {}

  return {
    answers: safeRecords.answers || {},
    wrong: safeRecords.wrong || {},
    favorites: safeRecords.favorites || {},
    notes: safeRecords.notes || {},
    sequenceProgress: safeRecords.sequenceProgress || {},
    wrongProgress: safeRecords.wrongProgress || {},
    favoriteProgress: safeRecords.favoriteProgress || {},
    deleted: safeRecords.deleted || {},
    stats: safeRecords.stats || {
      totalAnswered: 0,
      totalCorrect: 0,
      dailyStats: {}
    }
  }
}

function mergeObjectMap(oldMap, newMap) {
  return {
    ...(oldMap || {}),
    ...(newMap || {})
  }
}

function importPackageRecords(records, mode) {
  const normalized = normalizeImportRecords(records)
  const importMode = mode || "merge"

  if (importMode === "overwrite") {
    saveMap(KEY_ANSWER_MAP, normalized.answers)
    saveMap(KEY_WRONG_MAP, normalized.wrong)
    saveMap(KEY_FAVORITE_MAP, normalized.favorites)
    saveMap(KEY_NOTE_MAP, normalized.notes)
    saveMap(KEY_SEQUENCE_PROGRESS_MAP, normalized.sequenceProgress)
    saveMap(KEY_WRONG_PROGRESS_MAP, normalized.wrongProgress)
    saveMap(KEY_FAVORITE_PROGRESS_MAP, normalized.favoriteProgress)
    saveMap(KEY_DELETED_MAP, normalized.deleted)
    saveStats(normalized.stats)

    return {
      ok: true
    }
  }

  saveMap(KEY_ANSWER_MAP, mergeObjectMap(getAnswerMap(), normalized.answers))
  saveMap(KEY_WRONG_MAP, mergeObjectMap(getWrongMap(), normalized.wrong))
  saveMap(KEY_FAVORITE_MAP, mergeObjectMap(getFavoriteMap(), normalized.favorites))
  saveMap(KEY_NOTE_MAP, mergeObjectMap(getNoteMap(), normalized.notes))
  saveMap(KEY_SEQUENCE_PROGRESS_MAP, mergeObjectMap(getSequenceProgressMap(), normalized.sequenceProgress))
  saveMap(KEY_WRONG_PROGRESS_MAP, mergeObjectMap(getWrongProgressMap(), normalized.wrongProgress))
  saveMap(KEY_FAVORITE_PROGRESS_MAP, mergeObjectMap(getFavoriteProgressMap(), normalized.favoriteProgress))
  saveMap(KEY_DELETED_MAP, mergeObjectMap(getDeletedMap(), normalized.deleted))

  return {
    ok: true
  }
}

module.exports = {
  clearRecordsByQuestionIds,
  getPackageRecordsByQuestionIds,
  getPackageRecords,
  importPackageRecords,

  getAnswerMap,
  getWrongMap,
  getFavoriteMap,
  getNoteMap,
  getDeletedMap,
  getSequenceProgressMap,
  getWrongProgressMap,
  getFavoriteProgressMap,
  getModeProgressMap,
  saveModeProgressMap,

  isHardDeleted,
  isInRecycleBin,
  moveQuestionToRecycle,
  restoreQuestion,
  hardDeleteQuestion,
  hardDeleteQuestionAndRecords,
  hardDeleteQuestionsAndRecords,
  getRecordImpactByQuestionIds,

  isFavorite,
  isWrong,
  toggleFavorite,
  submitAnswer,
  removeWrong,
  getNote,
  saveNote,
  formatAnswer,
  isSameAnswer,

  clearSequenceProgress,
  clearWrongPracticeProgress,
  clearFavoritePracticeProgress,
  clearWrongRecords,
  clearFavoriteRecords,

  saveMap
}