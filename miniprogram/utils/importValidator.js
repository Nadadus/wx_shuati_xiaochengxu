function toStringValue(value) {
  if (value === undefined || value === null) {
    return ""
  }

  return String(value)
}

function isEmptyValue(value) {
  return value === undefined || value === null || value === ""
}

function padChapterId(chapterId) {
  return toStringValue(chapterId).padStart(2, "0")
}

function padQuestionNo(questionNo) {
  return toStringValue(questionNo).padStart(3, "0")
}

function buildQuestionId(question) {
  if (question.id) {
    return String(question.id)
  }

  return `${question.subjectId}_${padChapterId(question.chapterId)}_${padQuestionNo(question.questionNo)}`
}

function canBuildQuestionId(question) {
  return !isEmptyValue(question.subjectId) &&
    !isEmptyValue(question.chapterId) &&
    !isEmptyValue(question.questionNo)
}

function buildExpectedQuestionId(question) {
  if (!canBuildQuestionId(question)) {
    return ""
  }

  return `${question.subjectId}_${padChapterId(question.chapterId)}_${padQuestionNo(question.questionNo)}`
}

function buildChapterKey(subjectId, chapterId) {
  return `${toStringValue(subjectId)}_${padChapterId(chapterId)}`
}

function normalizeRecords(records) {
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

function normalizeQuestion(question) {
  const safeQuestion = question || {}
  const normalized = {
    ...safeQuestion
  }

  if (!normalized.question && normalized.title) {
    normalized.question = normalized.title
  }

  if (!normalized.type) {
    normalized.type = "single"
  }

  if (!Array.isArray(normalized.options)) {
    normalized.options = []
  }

  if (!Array.isArray(normalized.answer)) {
    normalized.answer = []
  }

  if (!normalized.id && canBuildQuestionId(normalized)) {
    normalized.id = buildExpectedQuestionId(normalized)
  }

  return normalized
}

function normalizeBankPackage(rawPackage) {
  const now = new Date().toISOString()
  const safePackage = rawPackage || {}
  const bankInfo = safePackage.bankInfo || {}

  return {
    schemaVersion: safePackage.schemaVersion || "1.0.0",
    packageType: safePackage.packageType || "quiz_bank_package",
    bankInfo: {
      bankId: bankInfo.bankId || `bank_${Date.now()}`,
      bankName: bankInfo.bankName || "未命名题库",
      description: bankInfo.description || "",
      sourceType: bankInfo.sourceType || "manual_json",
      createTime: bankInfo.createTime || now,
      updateTime: now
    },
    subjects: Array.isArray(safePackage.subjects) ? safePackage.subjects : [],
    chapters: Array.isArray(safePackage.chapters) ? safePackage.chapters : [],
    questions: Array.isArray(safePackage.questions)
      ? safePackage.questions.map(normalizeQuestion)
      : [],
    records: normalizeRecords(safePackage.records)
  }
}

function parseBankPackageText(text) {
  try {
    const parsed = JSON.parse(text)

    if (Array.isArray(parsed)) {
      return {
        ok: true,
        package: normalizeBankPackage({
          schemaVersion: "1.0.0",
          packageType: "quiz_bank_package",
          bankInfo: {
            bankId: `bank_${Date.now()}`,
            bankName: "从题目数组导入的题库",
            sourceType: "questions_array"
          },
          subjects: [],
          chapters: [],
          questions: parsed,
          records: {}
        })
      }
    }

    if (parsed && typeof parsed === "object") {
      return {
        ok: true,
        package: normalizeBankPackage(parsed)
      }
    }

    return {
      ok: false,
      message: "JSON 最外层必须是对象或题目数组"
    }
  } catch (err) {
    return {
      ok: false,
      message: `JSON 解析失败：${err.message}`
    }
  }
}

function validateSubject(subject, index) {
  const errors = []
  const warnings = []

  if (isEmptyValue(subject.subjectId)) {
    errors.push(`subjects[${index}] 缺少 subjectId`)
  }

  if (!subject.subjectName) {
    errors.push(`subjects[${index}] 缺少 subjectName`)
  }

  if (subject.sortOrder !== undefined && Number.isNaN(Number(subject.sortOrder))) {
    warnings.push(`subjects[${index}] sortOrder 建议使用数字`)
  }

  return {
    errors,
    warnings
  }
}

function validateChapter(chapter, index, subjectIdSet) {
  const errors = []
  const warnings = []

  if (isEmptyValue(chapter.subjectId)) {
    errors.push(`chapters[${index}] 缺少 subjectId`)
  } else if (subjectIdSet && subjectIdSet.size > 0 && !subjectIdSet.has(toStringValue(chapter.subjectId))) {
    errors.push(`chapters[${index}] subjectId=${chapter.subjectId} 在 subjects 中不存在`)
  }

  if (isEmptyValue(chapter.chapterId)) {
    errors.push(`chapters[${index}] 缺少 chapterId`)
  }

  if (!chapter.chapterName) {
    errors.push(`chapters[${index}] 缺少 chapterName`)
  }

  if (chapter.sortOrder !== undefined && Number.isNaN(Number(chapter.sortOrder))) {
    warnings.push(`chapters[${index}] sortOrder 建议使用数字`)
  }

  return {
    errors,
    warnings
  }
}

function getOptionKeys(options) {
  const keys = []

  if (!Array.isArray(options)) {
    return keys
  }

  options.forEach(option => {
    if (option && !isEmptyValue(option.key)) {
      keys.push(toStringValue(option.key))
    }
  })

  return keys
}

function getDuplicateValues(values) {
  const countMap = {}
  const duplicates = []

  values.forEach(value => {
    const key = toStringValue(value)
    countMap[key] = (countMap[key] || 0) + 1

    if (countMap[key] === 2) {
      duplicates.push(key)
    }
  })

  return duplicates
}

function validateOptions(question, index) {
  const errors = []
  const warnings = []
  const options = question.options

  if (!Array.isArray(options) || options.length === 0) {
    errors.push(`questions[${index}] 缺少 options 选项`)
    return {
      errors,
      warnings
    }
  }

  const optionKeys = []

  options.forEach((option, optionIndex) => {
    if (!option || typeof option !== "object") {
      errors.push(`questions[${index}].options[${optionIndex}] 必须是对象`)
      return
    }

    if (isEmptyValue(option.key)) {
      errors.push(`questions[${index}].options[${optionIndex}] 缺少 key`)
    } else {
      optionKeys.push(toStringValue(option.key))
    }

    if (isEmptyValue(option.text)) {
      errors.push(`questions[${index}].options[${optionIndex}] 缺少 text`)
    }
  })

  const duplicateOptionKeys = getDuplicateValues(optionKeys)

  if (duplicateOptionKeys.length > 0) {
    errors.push(`questions[${index}] options.key 存在重复：${duplicateOptionKeys.join("、")}`)
  }

  return {
    errors,
    warnings
  }
}

function validateAnswer(question, index) {
  const errors = []
  const warnings = []
  const type = question.type || "single"
  const answer = Array.isArray(question.answer)
    ? question.answer.map(item => toStringValue(item))
    : []

  if (!Array.isArray(question.answer)) {
    errors.push(`questions[${index}] answer 必须是数组，例如 ["A"]`)
    return {
      errors,
      warnings
    }
  }

  if (answer.length === 0) {
    errors.push(`questions[${index}] 缺少 answer 答案数组`)
    return {
      errors,
      warnings
    }
  }

  const duplicateAnswers = getDuplicateValues(answer)

  if (duplicateAnswers.length > 0) {
    errors.push(`questions[${index}] answer 中存在重复答案：${duplicateAnswers.join("、")}`)
  }

  const optionKeySet = new Set(getOptionKeys(question.options))

  answer.forEach(answerKey => {
    if (!optionKeySet.has(answerKey)) {
      errors.push(`questions[${index}] answer 中的选项 ${answerKey} 不存在于 options.key 中`)
    }
  })

  if (type === "single" && answer.length !== 1) {
    errors.push(`questions[${index}] single 单选题只能有 1 个答案`)
  }

  if (type === "multiple" && answer.length < 1) {
    errors.push(`questions[${index}] multiple 多选题至少需要 1 个答案`)
  }

  if (type === "multiple" && answer.length === 1) {
    warnings.push(`questions[${index}] multiple 多选题当前只有 1 个答案，请确认题型是否应为 single`)
  }

  if (type === "judge") {
    if (answer.length !== 1) {
      errors.push(`questions[${index}] judge 判断题只能有 1 个答案`)
    }

    answer.forEach(answerKey => {
      if (!["A", "B"].includes(answerKey)) {
        errors.push(`questions[${index}] judge 判断题答案只能是 A 或 B`)
      }
    })
  }

  return {
    errors,
    warnings
  }
}

function validateJudgeQuestion(question, index) {
  const errors = []
  const warnings = []

  if ((question.type || "single") !== "judge") {
    return {
      errors,
      warnings
    }
  }

  const options = Array.isArray(question.options) ? question.options : []
  const optionKeys = getOptionKeys(options)

  if (!optionKeys.includes("A") || !optionKeys.includes("B")) {
    errors.push(`questions[${index}] judge 判断题必须包含 A / B 两个选项`)
  }

  if (options.length !== 2) {
    warnings.push(`questions[${index}] judge 判断题建议只保留 A / B 两个选项`)
  }

  const optionTextMap = {}

  options.forEach(option => {
    if (option && !isEmptyValue(option.key)) {
      optionTextMap[toStringValue(option.key)] = toStringValue(option.text)
    }
  })

  if (optionTextMap.A && optionTextMap.A !== "正确") {
    warnings.push(`questions[${index}] judge 判断题 A 选项建议为“正确”`)
  }

  if (optionTextMap.B && optionTextMap.B !== "错误") {
    warnings.push(`questions[${index}] judge 判断题 B 选项建议为“错误”`)
  }

  return {
    errors,
    warnings
  }
}

function validateQuestion(question, index, context) {
  const errors = []
  const warnings = []

  if (isEmptyValue(question.subjectId)) {
    errors.push(`questions[${index}] 缺少 subjectId`)
  } else if (context.subjectIdSet.size > 0 && !context.subjectIdSet.has(toStringValue(question.subjectId))) {
    errors.push(`questions[${index}] subjectId=${question.subjectId} 在 subjects 中不存在`)
  }

  if (isEmptyValue(question.chapterId)) {
    errors.push(`questions[${index}] 缺少 chapterId`)
  } else if (
    context.chapterKeySet.size > 0 &&
    !isEmptyValue(question.subjectId) &&
    !context.chapterKeySet.has(buildChapterKey(question.subjectId, question.chapterId))
  ) {
    errors.push(`questions[${index}] chapterId=${padChapterId(question.chapterId)} 在 chapters 中不存在，或未归属于 subjectId=${question.subjectId}`)
  }

  if (isEmptyValue(question.questionNo)) {
    errors.push(`questions[${index}] 缺少 questionNo`)
  }

  if (!question.question && !question.title) {
    errors.push(`questions[${index}] 缺少 question 题干`)
  }

  const type = question.type || "single"
  const validTypes = ["single", "multiple", "judge"]

  if (!validTypes.includes(type)) {
    errors.push(`questions[${index}] type 只能是 single / multiple / judge`)
  }

  if (question.id && canBuildQuestionId(question)) {
    const expectedId = buildExpectedQuestionId(question)

    if (toStringValue(question.id) !== expectedId) {
      warnings.push(`questions[${index}] id=${question.id} 与推荐格式 ${expectedId} 不一致`)
    }
  }

  const optionResult = validateOptions(question, index)
  errors.push(...optionResult.errors)
  warnings.push(...optionResult.warnings)

  const answerResult = validateAnswer(question, index)
  errors.push(...answerResult.errors)
  warnings.push(...answerResult.warnings)

  const judgeResult = validateJudgeQuestion(question, index)
  errors.push(...judgeResult.errors)
  warnings.push(...judgeResult.warnings)

  return {
    errors,
    warnings
  }
}

function buildSubjectIdSet(subjects) {
  const set = new Set()

  subjects.forEach(subject => {
    if (!isEmptyValue(subject.subjectId)) {
      set.add(toStringValue(subject.subjectId))
    }
  })

  return set
}

function buildChapterKeySet(chapters) {
  const set = new Set()

  chapters.forEach(chapter => {
    if (!isEmptyValue(chapter.subjectId) && !isEmptyValue(chapter.chapterId)) {
      set.add(buildChapterKey(chapter.subjectId, chapter.chapterId))
    }
  })

  return set
}

function getDuplicateSubjectIds(subjects) {
  return getDuplicateValues(
    subjects
      .filter(subject => !isEmptyValue(subject.subjectId))
      .map(subject => toStringValue(subject.subjectId))
  )
}

function getDuplicateChapterKeys(chapters) {
  return getDuplicateValues(
    chapters
      .filter(chapter => !isEmptyValue(chapter.subjectId) && !isEmptyValue(chapter.chapterId))
      .map(chapter => buildChapterKey(chapter.subjectId, chapter.chapterId))
  )
}

function getDuplicateQuestionIds(questions) {
  const ids = []

  questions.forEach(question => {
    if (question.id) {
      ids.push(toStringValue(question.id))
      return
    }

    if (canBuildQuestionId(question)) {
      ids.push(buildExpectedQuestionId(question))
    }
  })

  return getDuplicateValues(ids)
}

function getDuplicateQuestionNos(questions) {
  const keyList = []

  questions.forEach(question => {
    if (
      !isEmptyValue(question.subjectId) &&
      !isEmptyValue(question.chapterId) &&
      !isEmptyValue(question.questionNo)
    ) {
      keyList.push(`${question.subjectId}_${padChapterId(question.chapterId)}_${question.questionNo}`)
    }
  })

  return getDuplicateValues(keyList)
}

function validateRecords(records) {
  const errors = []
  const warnings = []
  const safeRecords = records || {}

  const mapFields = [
    "answers",
    "wrong",
    "favorites",
    "notes",
    "sequenceProgress",
    "wrongProgress",
    "favoriteProgress",
    "deleted"
  ]

  mapFields.forEach(field => {
    if (safeRecords[field] !== undefined && (typeof safeRecords[field] !== "object" || Array.isArray(safeRecords[field]) || safeRecords[field] === null)) {
      errors.push(`records.${field} 必须是对象`)
    }
  })

  if (safeRecords.stats !== undefined && (typeof safeRecords.stats !== "object" || Array.isArray(safeRecords.stats) || safeRecords.stats === null)) {
    errors.push("records.stats 必须是对象")
  }

  if (safeRecords.stats && typeof safeRecords.stats === "object") {
    if (safeRecords.stats.totalAnswered !== undefined && typeof safeRecords.stats.totalAnswered !== "number") {
      warnings.push("records.stats.totalAnswered 建议使用数字")
    }

    if (safeRecords.stats.totalCorrect !== undefined && typeof safeRecords.stats.totalCorrect !== "number") {
      warnings.push("records.stats.totalCorrect 建议使用数字")
    }

    if (safeRecords.stats.dailyStats !== undefined && (typeof safeRecords.stats.dailyStats !== "object" || Array.isArray(safeRecords.stats.dailyStats) || safeRecords.stats.dailyStats === null)) {
      errors.push("records.stats.dailyStats 必须是对象")
    }
  }

  return {
    errors,
    warnings
  }
}

function validateBankPackage(bankPackage) {
  const errors = []
  const warnings = []

  if (!bankPackage || typeof bankPackage !== "object") {
    return {
      ok: false,
      errors: ["题库包必须是 JSON 对象"],
      warnings: []
    }
  }

  if (bankPackage.packageType !== "quiz_bank_package") {
    warnings.push("packageType 不是 quiz_bank_package，系统会按题库包尝试导入")
  }

  if (!bankPackage.bankInfo || !bankPackage.bankInfo.bankName) {
    warnings.push("缺少 bankInfo.bankName，将使用默认题库名称")
  }

  if (!bankPackage.bankInfo || !bankPackage.bankInfo.bankId) {
    warnings.push("缺少 bankInfo.bankId，将使用系统自动生成的题库 ID")
  }

  if (!Array.isArray(bankPackage.subjects)) {
    errors.push("subjects 必须是数组")
  }

  if (!Array.isArray(bankPackage.chapters)) {
    errors.push("chapters 必须是数组")
  }

  if (!Array.isArray(bankPackage.questions) || bankPackage.questions.length === 0) {
    errors.push("questions 必须是非空数组")
  }

  const subjects = Array.isArray(bankPackage.subjects) ? bankPackage.subjects : []
  const chapters = Array.isArray(bankPackage.chapters) ? bankPackage.chapters : []
  const questions = Array.isArray(bankPackage.questions) ? bankPackage.questions : []

  if (subjects.length === 0) {
    warnings.push("subjects 为空，系统会尽量从题目中识别科目，但建议显式提供 subjects")
  }

  if (chapters.length === 0) {
    warnings.push("chapters 为空，系统会尽量从题目中识别章节，但建议显式提供 chapters")
  }

  const subjectIdSet = buildSubjectIdSet(subjects)
  const chapterKeySet = buildChapterKeySet(chapters)

  subjects.forEach((subject, index) => {
    const result = validateSubject(subject, index)
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  })

  chapters.forEach((chapter, index) => {
    const result = validateChapter(chapter, index, subjectIdSet)
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  })

  const duplicateSubjectIds = getDuplicateSubjectIds(subjects)

  if (duplicateSubjectIds.length > 0) {
    errors.push(`subjects 中存在重复 subjectId：${duplicateSubjectIds.join("、")}`)
  }

  const duplicateChapterKeys = getDuplicateChapterKeys(chapters)

  if (duplicateChapterKeys.length > 0) {
    errors.push(`chapters 中存在重复章节：${duplicateChapterKeys.join("、")}`)
  }

  const context = {
    subjectIdSet,
    chapterKeySet
  }

  questions.forEach((question, index) => {
    const result = validateQuestion(question, index, context)
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  })

  const duplicateIds = getDuplicateQuestionIds(questions)

  if (duplicateIds.length > 0) {
    errors.push(`questions 中存在重复题目 id：${duplicateIds.join("、")}`)
  }

  const duplicateQuestionNos = getDuplicateQuestionNos(questions)

  if (duplicateQuestionNos.length > 0) {
    errors.push(`同一章节内 questionNo 存在重复：${duplicateQuestionNos.join("、")}`)
  }

  const recordsResult = validateRecords(bankPackage.records)
  errors.push(...recordsResult.errors)
  warnings.push(...recordsResult.warnings)

  return {
    ok: errors.length === 0,
    errors,
    warnings
  }
}

module.exports = {
  buildQuestionId,
  normalizeBankPackage,
  parseBankPackageText,
  validateBankPackage,
  getDuplicateQuestionIds
}