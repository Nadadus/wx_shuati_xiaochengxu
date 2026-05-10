const builtInQuestions = require("../data/questions")
const { importedQuestions } = require("../data/importedQuestions")
const subjectStore = require("./subjectStore")
const localBankStore = require("./localBankStore")
const appConfig = require("../config/appConfig")
const { chapters: defaultChapters } = require("../data/chapters")
const { questionBanks } = require("../data/questionBanks")

const DEFAULT_BANK_ID = "local_communication_exam"

function toStringValue(value) {
  if (value === undefined || value === null) {
    return ""
  }

  return String(value)
}

function padChapterId(chapterId) {
  return toStringValue(chapterId).padStart(2, "0")
}

function padQuestionNo(questionNo) {
  return toStringValue(questionNo).padStart(3, "0")
}

function normalizeAnswer(answer) {
  if (Array.isArray(answer)) {
    return answer.map(item => toStringValue(item))
  }

  if (answer === undefined || answer === null || answer === "") {
    return []
  }

  return [toStringValue(answer)]
}

function buildQuestionId(question) {
  if (question.id) {
    return question.id
  }

  const subjectId = toStringValue(question.subjectId)
  const chapterId = padChapterId(question.chapterId)
  const questionNo = padQuestionNo(question.questionNo)

  return `${subjectId}_${chapterId}_${questionNo}`
}

function getLocalBankPackages() {
  return localBankStore.getAllLocalBankPackages()
}

function getLocalQuestions() {
  const packages = getLocalBankPackages()
  const list = []

  packages.forEach(bankPackage => {
    const bankId = bankPackage.bankInfo && bankPackage.bankInfo.bankId
      ? bankPackage.bankInfo.bankId
      : DEFAULT_BANK_ID

    const questions = Array.isArray(bankPackage.questions)
      ? bankPackage.questions
      : []

    questions.forEach(question => {
      list.push({
        ...question,
        bankId: question.bankId || bankId
      })
    })
  })

  return list
}

function getRawQuestions() {
  const localQuestions = getLocalQuestions()

  if (localQuestions.length > 0) {
    return localQuestions
  }

  if (appConfig.useDemoBankWhenEmpty) {
    return [
      ...builtInQuestions,
      ...importedQuestions
    ]
  }

  return []
}

function getLocalChapters() {
  const packages = getLocalBankPackages()
  const chapterMap = {}

  packages.forEach(bankPackage => {
    const chapters = Array.isArray(bankPackage.chapters)
      ? bankPackage.chapters
      : []

    chapters.forEach(chapter => {
      const key = `${chapter.subjectId}_${padChapterId(chapter.chapterId)}`

      chapterMap[key] = {
        ...chapter,
        subjectId: Number(chapter.subjectId),
        chapterId: padChapterId(chapter.chapterId),
        sortOrder: Number(chapter.sortOrder || 9999),
        enabled: chapter.enabled !== false
      }
    })
  })

  return Object.values(chapterMap)
}

function getBaseChapters() {
  const localChapters = getLocalChapters()

  if (localChapters.length > 0) {
    return localChapters
  }

  if (appConfig.useDemoBankWhenEmpty) {
    return defaultChapters
  }

  return []
}

function getSubjectName(subjectId, fallbackName) {
  const subject = subjectStore.getSubjectById(subjectId)

  if (subject && subject.subjectName) {
    return subject.subjectName
  }

  return fallbackName || `科目${subjectId}`
}

function getChapterMeta(subjectId, chapterId) {
  const sid = String(subjectId)
  const cid = padChapterId(chapterId)

  return getBaseChapters().find(item => {
    return String(item.subjectId) === sid && padChapterId(item.chapterId) === cid
  })
}

function getChapterName(subjectId, chapterId, fallbackName) {
  const chapter = getChapterMeta(subjectId, chapterId)

  if (chapter && chapter.chapterName) {
    return chapter.chapterName
  }

  return fallbackName || `第${padChapterId(chapterId)}章`
}

function normalizeOption(option, index) {
  const defaultKey = String.fromCharCode(65 + index)

  if (typeof option === "string") {
    return {
      key: defaultKey,
      text: option
    }
  }

  return {
    key: toStringValue(option.key || defaultKey),
    text: toStringValue(option.text)
  }
}

function normalizeQuestion(question) {
  const subjectId = Number(question.subjectId)
  const chapterId = padChapterId(question.chapterId)

  return {
    ...question,
    id: buildQuestionId(question),
    bankId: question.bankId || DEFAULT_BANK_ID,

    subjectId,
    subjectName: getSubjectName(subjectId, question.subjectName),

    chapterId,
    chapterName: getChapterName(subjectId, chapterId, question.chapterName),

    questionNo: Number(question.questionNo || 0),
    type: question.type || "single",
    question: question.question || question.title || "",

    options: Array.isArray(question.options)
      ? question.options.map((option, index) => normalizeOption(option, index))
      : [],

    answer: normalizeAnswer(question.answer),
    analysis: question.analysis || question.explanation || "",

    enabled: question.enabled !== false
  }
}

function getMergedRawQuestions() {
  const map = {}

  getRawQuestions().forEach(question => {
    const id = buildQuestionId(question)
    map[id] = question
  })

  return Object.values(map)
}

function getAllQuestions() {
  return getMergedRawQuestions()
    .map(normalizeQuestion)
    .filter(item => item.enabled)
}

function getQuestionById(questionId) {
  return getAllQuestions().find(item => item.id === questionId)
}

function getQuestionsByBank(bankId) {
  return getAllQuestions().filter(item => item.bankId === bankId)
}

function getQuestionsBySubject(subjectId) {
  return getAllQuestions().filter(item => String(item.subjectId) === String(subjectId))
}

function getQuestionsByChapter(subjectId, chapterId) {
  const cid = padChapterId(chapterId)

  return getAllQuestions().filter(item => {
    return String(item.subjectId) === String(subjectId) &&
      padChapterId(item.chapterId) === cid
  })
}

function getQuestionCountBySubject(subjectId) {
  return getQuestionsBySubject(subjectId).length
}

function getQuestionCountByChapter(subjectId, chapterId) {
  return getQuestionsByChapter(subjectId, chapterId).length
}

function getEnabledChaptersBySubject(subjectId) {
  return getBaseChapters()
    .filter(item => {
      return String(item.subjectId) === String(subjectId) &&
        item.enabled !== false
    })
    .map(item => ({
      ...item,
      chapterId: padChapterId(item.chapterId),
      sortOrder: Number(item.sortOrder || 9999)
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }

      return Number(a.chapterId) - Number(b.chapterId)
    })
}

function getChaptersFromQuestions(subjectId) {
  const map = {}

  getQuestionsBySubject(subjectId).forEach(item => {
    if (!map[item.chapterId]) {
      map[item.chapterId] = {
        subjectId: item.subjectId,
        chapterId: item.chapterId,
        chapterName: item.chapterName,
        sortOrder: Number(item.chapterId),
        enabled: true
      }
    }
  })

  return Object.values(map)
}

function getChaptersBySubject(subjectId) {
  const chapterMap = {}

  getEnabledChaptersBySubject(subjectId).forEach(item => {
    chapterMap[item.chapterId] = {
      subjectId: Number(item.subjectId),
      chapterId: padChapterId(item.chapterId),
      chapterName: item.chapterName,
      sortOrder: Number(item.sortOrder || 9999),
      enabled: item.enabled !== false
    }
  })

  getChaptersFromQuestions(subjectId).forEach(item => {
    if (!chapterMap[item.chapterId]) {
      chapterMap[item.chapterId] = {
        subjectId: Number(item.subjectId),
        chapterId: padChapterId(item.chapterId),
        chapterName: item.chapterName,
        sortOrder: Number(item.chapterId),
        enabled: true
      }
    }
  })

  return Object.values(chapterMap).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }

    return Number(a.chapterId) - Number(b.chapterId)
  })
}

function getSubjectSortMap() {
  const map = {}

  subjectStore.getAllSubjects().forEach(item => {
    map[item.subjectId] = item.sortOrder
  })

  return map
}

function getChapterSortMap() {
  const map = {}

  getBaseChapters().forEach(item => {
    const key = `${item.subjectId}_${padChapterId(item.chapterId)}`
    map[key] = Number(item.sortOrder || 9999)
  })

  return map
}

function sortQuestions(list) {
  const subjectSortMap = getSubjectSortMap()
  const chapterSortMap = getChapterSortMap()

  return list.slice().sort((a, b) => {
    const sa = subjectSortMap[a.subjectId] || 9999
    const sb = subjectSortMap[b.subjectId] || 9999

    if (sa !== sb) return sa - sb

    const chapterKeyA = `${a.subjectId}_${padChapterId(a.chapterId)}`
    const chapterKeyB = `${b.subjectId}_${padChapterId(b.chapterId)}`

    const ca = chapterSortMap[chapterKeyA] || Number(a.chapterId) || 9999
    const cb = chapterSortMap[chapterKeyB] || Number(b.chapterId) || 9999

    if (ca !== cb) return ca - cb

    return Number(a.questionNo) - Number(b.questionNo)
  })
}

function getTypeText(type) {
  if (type === "multiple") return "多选题"
  if (type === "judge") return "判断题"
  return "单选题"
}

function getQuestionBanks() {
  const localPackages = getLocalBankPackages()

  if (localPackages.length > 0) {
    return localPackages.map(bankPackage => ({
      ...bankPackage.bankInfo,
      enabled: true,
      questionCount: Array.isArray(bankPackage.questions)
        ? bankPackage.questions.length
        : 0
    }))
  }

  if (appConfig.useDemoBankWhenEmpty) {
    return questionBanks.filter(item => item.enabled !== false)
  }

  return []
}

function validateQuestion(question) {
  const errors = []

  if (!question.subjectId) {
    errors.push("缺少 subjectId")
  }

  if (!question.chapterId) {
    errors.push("缺少 chapterId")
  }

  if (!question.questionNo) {
    errors.push("缺少 questionNo")
  }

  if (!question.question && !question.title) {
    errors.push("缺少题干 question")
  }

  if (!Array.isArray(question.options) || question.options.length === 0) {
    errors.push("缺少 options")
  }

  if (!question.answer || normalizeAnswer(question.answer).length === 0) {
    errors.push("缺少 answer")
  }

  return errors
}

function validateQuestionList(questionList) {
  const errors = []

  questionList.forEach((item, index) => {
    const itemErrors = validateQuestion(item)

    if (itemErrors.length > 0) {
      errors.push({
        index,
        questionId: item.id || buildQuestionId(item),
        errors: itemErrors
      })
    }
  })

  return errors
}

function getDuplicateQuestionIds() {
  const countMap = {}

  getRawQuestions().forEach(question => {
    const id = buildQuestionId(question)
    countMap[id] = (countMap[id] || 0) + 1
  })

  return Object.keys(countMap).filter(id => countMap[id] > 1)
}

module.exports = {
  getAllQuestions,
  getQuestionById,
  getQuestionsByBank,
  getQuestionsBySubject,
  getQuestionsByChapter,
  getQuestionCountBySubject,
  getQuestionCountByChapter,
  getChaptersBySubject,
  sortQuestions,
  getTypeText,
  getQuestionBanks,
  normalizeQuestion,
  validateQuestion,
  validateQuestionList,
  getDuplicateQuestionIds
}