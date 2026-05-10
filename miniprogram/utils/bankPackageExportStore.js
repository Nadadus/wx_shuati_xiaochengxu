const localBankStore = require("./localBankStore")
const recordStore = require("./recordStore")

function buildQuestionId(question) {
  if (question.id) {
    return question.id
  }

  const subjectId = String(question.subjectId)
  const chapterId = String(question.chapterId).padStart(2, "0")
  const questionNo = String(question.questionNo).padStart(3, "0")

  return `${subjectId}_${chapterId}_${questionNo}`
}

function getTimestampText() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const h = String(now.getHours()).padStart(2, "0")
  const min = String(now.getMinutes()).padStart(2, "0")
  const s = String(now.getSeconds()).padStart(2, "0")

  return `${y}${m}${d}_${h}${min}${s}`
}

function getUniqueSubjectKey(subject) {
  return String(subject.subjectId)
}

function getUniqueChapterKey(chapter) {
  return `${chapter.subjectId}_${String(chapter.chapterId).padStart(2, "0")}`
}

function addDerivedMetaFromQuestions(subjectMap, chapterMap, questions) {
  questions.forEach(question => {
    if (question.subjectId !== undefined && question.subjectId !== null) {
      const subjectKey = String(question.subjectId)

      if (!subjectMap[subjectKey]) {
        subjectMap[subjectKey] = {
          subjectId: Number(question.subjectId),
          subjectName: question.subjectName || `科目${question.subjectId}`,
          sortOrder: 9999,
          enabled: true
        }
      }
    }

    if (
      question.subjectId !== undefined &&
      question.subjectId !== null &&
      question.chapterId !== undefined &&
      question.chapterId !== null
    ) {
      const chapterId = String(question.chapterId).padStart(2, "0")
      const chapterKey = `${question.subjectId}_${chapterId}`

      if (!chapterMap[chapterKey]) {
        chapterMap[chapterKey] = {
          subjectId: Number(question.subjectId),
          chapterId,
          chapterName: question.chapterName || `第${chapterId}章`,
          sortOrder: Number(chapterId) || 9999,
          enabled: true
        }
      }
    }
  })
}

function sortSubjects(subjects) {
  return subjects.slice().sort((a, b) => {
    const sa = Number(a.sortOrder || 9999)
    const sb = Number(b.sortOrder || 9999)

    if (sa !== sb) return sa - sb

    return Number(a.subjectId) - Number(b.subjectId)
  })
}

function sortChapters(chapters) {
  return chapters.slice().sort((a, b) => {
    const sa = Number(a.subjectId) - Number(b.subjectId)

    if (sa !== 0) return sa

    const ca = Number(a.sortOrder || a.chapterId || 9999)
    const cb = Number(b.sortOrder || b.chapterId || 9999)

    if (ca !== cb) return ca - cb

    return Number(a.chapterId) - Number(b.chapterId)
  })
}

function sortQuestions(questions) {
  return questions.slice().sort((a, b) => {
    const sa = Number(a.subjectId) - Number(b.subjectId)

    if (sa !== 0) return sa

    const ca = Number(a.chapterId) - Number(b.chapterId)

    if (ca !== 0) return ca

    return Number(a.questionNo || 0) - Number(b.questionNo || 0)
  })
}

function buildMergedPackage(packages, options) {
  const safeOptions = options || {}
  const timestamp = getTimestampText()
  const now = new Date().toISOString()

  const subjectMap = {}
  const chapterMap = {}
  const questionMap = {}
  const questionCountMap = {}
  const duplicateQuestionIds = []

  packages.forEach(bankPackage => {
    const subjects = Array.isArray(bankPackage.subjects)
      ? bankPackage.subjects
      : []

    subjects.forEach(subject => {
      if (subject.subjectId === undefined || subject.subjectId === null) return
      subjectMap[getUniqueSubjectKey(subject)] = subject
    })

    const chapters = Array.isArray(bankPackage.chapters)
      ? bankPackage.chapters
      : []

    chapters.forEach(chapter => {
      if (
        chapter.subjectId === undefined ||
        chapter.subjectId === null ||
        chapter.chapterId === undefined ||
        chapter.chapterId === null
      ) {
        return
      }

      chapterMap[getUniqueChapterKey(chapter)] = {
        ...chapter,
        chapterId: String(chapter.chapterId).padStart(2, "0")
      }
    })

    const questions = Array.isArray(bankPackage.questions)
      ? bankPackage.questions
      : []

    addDerivedMetaFromQuestions(subjectMap, chapterMap, questions)

    questions.forEach(question => {
      const questionId = buildQuestionId(question)

      questionCountMap[questionId] = (questionCountMap[questionId] || 0) + 1

      if (questionCountMap[questionId] > 1 && !duplicateQuestionIds.includes(questionId)) {
        duplicateQuestionIds.push(questionId)
      }

      questionMap[questionId] = {
        ...question,
        id: questionId
      }
    })
  })

  const questions = sortQuestions(Object.values(questionMap))
  const questionIds = questions.map(item => item.id)

  const warnings = []

  if (duplicateQuestionIds.length > 0) {
    warnings.push(`检测到重复题号：${duplicateQuestionIds.join("、")}。导出时后读取的题目会覆盖前面的同 ID 题目。`)
  }

  const mergedPackage = {
    schemaVersion: "1.0.0",
    packageType: "quiz_bank_package",
    bankInfo: {
      bankId: safeOptions.bankId || `merged_bank_${timestamp}`,
      bankName: safeOptions.bankName || `合并导出题库_${timestamp}`,
      description: safeOptions.description || "由多个本地题库包合并导出。",
      sourceType: safeOptions.sourceType || "local_merge_export",
      createTime: now,
      updateTime: now
    },
    subjects: sortSubjects(Object.values(subjectMap)),
    chapters: sortChapters(Object.values(chapterMap)),
    questions,
    records: recordStore.getPackageRecordsByQuestionIds(questionIds)
  }

  return {
    package: mergedPackage,
    warnings
  }
}

function getPackagesByBankIds(bankIds) {
  return bankIds
    .map(bankId => localBankStore.getLocalBankPackageById(bankId))
    .filter(Boolean)
}

function buildMergedPackageByBankIds(bankIds, options) {
  const packages = getPackagesByBankIds(bankIds)
  return buildMergedPackage(packages, options)
}

function buildMergedPackageFromAllLocalBanks(options) {
  const bankIds = localBankStore.getLocalBankIndex().map(item => item.bankId)
  return buildMergedPackageByBankIds(bankIds, {
    bankId: options && options.bankId,
    bankName: options && options.bankName,
    description: options && options.description,
    sourceType: options && options.sourceType
      ? options.sourceType
      : "webdav_full_backup"
  })
}

function getBackupFileName() {
  return `quiz_full_backup_${getTimestampText()}.json`
}

module.exports = {
  buildQuestionId,
  getTimestampText,
  buildMergedPackage,
  buildMergedPackageByBankIds,
  buildMergedPackageFromAllLocalBanks,
  getBackupFileName
}