const subjectStore = require("./subjectStore")
const questionStore = require("./questionStore")
const recordStore = require("./recordStore")

function getEnabledSubjects() {
  return subjectStore.getEnabledSubjects()
}

function isNormalQuestion(questionId) {
  if (recordStore.isHardDeleted(questionId)) return false
  if (recordStore.isInRecycleBin(questionId)) return false
  return true
}

function isVisibleInMode(question, mode) {
  if (!question) return false

  if (mode === "sequence") {
    return isNormalQuestion(question.id)
  }

  if (mode === "wrong") {
    return isNormalQuestion(question.id)
  }

  if (mode === "favorite") {
    if (recordStore.isHardDeleted(question.id)) return false
    return true
  }

  return true
}

function getModeTitle(mode) {
  if (mode === "wrong") return "错题练习"
  if (mode === "favorite") return "收藏题目"
  return "顺序练习"
}

function getModeCountLabel(mode) {
  if (mode === "wrong") return "错题"
  if (mode === "favorite") return "收藏"
  return "进度"
}

function getModeQuestionPool(questionList, mode) {
  const wrongMap = recordStore.getWrongMap()
  const favoriteMap = recordStore.getFavoriteMap()

  return questionList.filter(q => {
    if (!isVisibleInMode(q, mode)) return false

    if (mode === "wrong") {
      return !!wrongMap[q.id]
    }

    if (mode === "favorite") {
      return !!favoriteMap[q.id]
    }

    return true
  })
}

function getDoneCount(questionPool, mode) {
  const progressMap = recordStore.getModeProgressMap(mode)

  return questionPool.filter(q => {
    return progressMap[q.id] && progressMap[q.id].done
  }).length
}

function buildChapters(subjectQuestions, mode) {
  const chapterMap = {}
  const modeQuestionPool = getModeQuestionPool(subjectQuestions, mode)

  modeQuestionPool.forEach(q => {
    if (!chapterMap[q.chapterId]) {
      chapterMap[q.chapterId] = {
        chapterId: q.chapterId,
        chapterName: q.chapterName,
        totalCount: 0,
        doneCount: 0,
        percent: 0
      }
    }

    chapterMap[q.chapterId].totalCount += 1
  })

  const chapters = Object.values(chapterMap).sort((a, b) => {
    return Number(a.chapterId) - Number(b.chapterId)
  })

  chapters.forEach(chapter => {
    const chapterPool = modeQuestionPool.filter(q => q.chapterId === chapter.chapterId)

    chapter.doneCount = getDoneCount(chapterPool, mode)
    chapter.percent = chapter.totalCount === 0
      ? 0
      : Math.round((chapter.doneCount / chapter.totalCount) * 100)
  })

  return chapters
}

function buildSubjectProgressList(mode) {
  const enabledSubjects = getEnabledSubjects()

  return enabledSubjects.map(subject => {
    const allSubjectQuestions = questionStore.getQuestionsBySubject(subject.subjectId)
    const modeQuestionPool = getModeQuestionPool(allSubjectQuestions, mode)

    const totalCount = modeQuestionPool.length
    const doneCount = getDoneCount(modeQuestionPool, mode)
    const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

    return {
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      sortOrder: subject.sortOrder,
      totalCount,
      doneCount,
      percent,
      expanded: false,
      chapterExpanded: false,
      chapters: buildChapters(allSubjectQuestions, mode)
    }
  })
}

module.exports = {
  getModeTitle,
  getModeCountLabel,
  buildSubjectProgressList
}