const { subjects: defaultSubjects } = require("../data/subjects")
const appConfig = require("../config/appConfig")
const localBankStore = require("./localBankStore")

const KEY_SUBJECT_CONFIG = "quiz_subject_config"

function getDefaultSubjects() {
  return defaultSubjects.map((item, index) => ({
    ...item,
    sortOrder: item.sortOrder || index + 1,
    enabled: item.enabled !== false
  }))
}

function getSubjectsFromLocalPackages() {
  const subjectMap = {}
  const packages = localBankStore.getAllLocalBankPackages()

  packages.forEach(bankPackage => {
    const subjects = Array.isArray(bankPackage.subjects)
      ? bankPackage.subjects
      : []

    subjects.forEach(subject => {
      if (subject.subjectId === undefined || subject.subjectId === null) return

      subjectMap[String(subject.subjectId)] = {
        subjectId: Number(subject.subjectId),
        subjectName: subject.subjectName || `科目${subject.subjectId}`,
        sortOrder: Number(subject.sortOrder || 9999),
        enabled: subject.enabled !== false
      }
    })

    const questions = Array.isArray(bankPackage.questions)
      ? bankPackage.questions
      : []

    questions.forEach(question => {
      if (question.subjectId === undefined || question.subjectId === null) return

      const key = String(question.subjectId)

      if (!subjectMap[key]) {
        subjectMap[key] = {
          subjectId: Number(question.subjectId),
          subjectName: question.subjectName || `科目${question.subjectId}`,
          sortOrder: 9999,
          enabled: true
        }
      }
    })
  })

  return Object.values(subjectMap).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }

    return Number(a.subjectId) - Number(b.subjectId)
  })
}

function getBaseSubjects() {
  const localSubjects = getSubjectsFromLocalPackages()

  if (localSubjects.length > 0) {
    return localSubjects
  }

  if (appConfig.useDemoBankWhenEmpty) {
    return getDefaultSubjects()
  }

  return []
}

function saveSubjects(list) {
  const normalized = list.map((item, index) => ({
    ...item,
    subjectId: Number(item.subjectId),
    sortOrder: index + 1,
    enabled: item.enabled !== false
  }))

  wx.setStorageSync(KEY_SUBJECT_CONFIG, normalized)
  return normalized
}

function getAllSubjects() {
  const saved = wx.getStorageSync(KEY_SUBJECT_CONFIG)
  const baseList = getBaseSubjects()

  if (!saved || !Array.isArray(saved) || saved.length === 0) {
    return saveSubjects(baseList)
  }

  const savedMap = {}

  saved.forEach(item => {
    savedMap[String(item.subjectId)] = item
  })

  const merged = baseList.map((item, index) => {
    const savedItem = savedMap[String(item.subjectId)]

    if (!savedItem) {
      return {
        ...item,
        sortOrder: item.sortOrder || index + 1,
        enabled: item.enabled !== false
      }
    }

    return {
      ...item,
      subjectName: item.subjectName,
      sortOrder: Number(savedItem.sortOrder) || item.sortOrder || index + 1,
      enabled: savedItem.enabled !== false
    }
  })

  const sorted = merged.sort((a, b) => a.sortOrder - b.sortOrder)

  return saveSubjects(sorted)
}

function getEnabledSubjects() {
  return getAllSubjects()
    .filter(item => item.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function getSubjectById(subjectId) {
  return getAllSubjects().find(item => String(item.subjectId) === String(subjectId))
}

function moveSubject(subjectId, direction) {
  const list = getAllSubjects()
  const index = list.findIndex(item => String(item.subjectId) === String(subjectId))

  if (index < 0) {
    return list
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1

  if (targetIndex < 0 || targetIndex >= list.length) {
    return list
  }

  const temp = list[index]
  list[index] = list[targetIndex]
  list[targetIndex] = temp

  return saveSubjects(list)
}

function setSubjectEnabled(subjectId, enabled) {
  const list = getAllSubjects().map(item => {
    if (String(item.subjectId) === String(subjectId)) {
      return {
        ...item,
        enabled: !!enabled
      }
    }

    return item
  })

  return saveSubjects(list)
}

function resetSubjectConfig() {
  return saveSubjects(getBaseSubjects())
}

module.exports = {
  getAllSubjects,
  getEnabledSubjects,
  getSubjectById,
  moveSubject,
  setSubjectEnabled,
  resetSubjectConfig
}