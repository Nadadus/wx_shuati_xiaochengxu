const localBankStore = require("../../utils/localBankStore")
const subjectStore = require("../../utils/subjectStore")
const recordStore = require("../../utils/recordStore")

function countMap(map) {
  if (!map || typeof map !== "object") {
    return 0
  }

  return Object.keys(map).length
}

function getUniqueCount(list, key) {
  const set = new Set()

  list.forEach(item => {
    if (item[key] !== undefined && item[key] !== null) {
      set.add(String(item[key]))
    }
  })

  return set.size
}

function cloneObject(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function padChapterId(chapterId) {
  return String(chapterId || "").padStart(2, "0")
}

function buildQuestionId(question) {
  if (question.id) {
    return question.id
  }

  const subjectId = String(question.subjectId)
  const chapterId = String(question.chapterId).padStart(2, "0")
  const questionNo = String(question.questionNo).padStart(3, "0")

  return `${subjectId}_${chapterId}_${questionNo}`
}

function getBankQuestionIds(bankPackage) {
  const questions = Array.isArray(bankPackage.questions)
    ? bankPackage.questions
    : []

  return questions.map(buildQuestionId)
}

function normalizeSubjectList(bankPackage) {
  const subjects = Array.isArray(bankPackage.subjects)
    ? bankPackage.subjects
    : []

  if (subjects.length > 0) {
    return subjects.map((item, index) => ({
      subjectId: item.subjectId,
      subjectName: item.subjectName || `科目${item.subjectId}`,
      sortOrder: item.sortOrder || index + 1,
      enabled: item.enabled !== false
    }))
  }

  const subjectMap = {}

  const questions = Array.isArray(bankPackage.questions)
    ? bankPackage.questions
    : []

  questions.forEach(question => {
    if (question.subjectId === undefined || question.subjectId === null) return

    const subjectId = question.subjectId

    if (!subjectMap[subjectId]) {
      subjectMap[subjectId] = {
        subjectId,
        subjectName: question.subjectName || `科目${subjectId}`,
        sortOrder: Object.keys(subjectMap).length + 1,
        enabled: true
      }
    }
  })

  return Object.values(subjectMap)
}

function normalizeChapterList(bankPackage, subjectList) {
  const questions = Array.isArray(bankPackage.questions)
    ? bankPackage.questions
    : []

  const subjectNameMap = {}

  subjectList.forEach(subject => {
    subjectNameMap[String(subject.subjectId)] = subject.subjectName
  })

  const questionCountMap = {}

  questions.forEach(question => {
    const subjectId = question.subjectId
    const chapterId = padChapterId(question.chapterId)
    const key = `${subjectId}_${chapterId}`

    questionCountMap[key] = (questionCountMap[key] || 0) + 1
  })

  const chapters = Array.isArray(bankPackage.chapters)
    ? bankPackage.chapters
    : []

  const chapterMap = {}

  chapters.forEach((chapter, index) => {
    const subjectId = chapter.subjectId
    const chapterId = padChapterId(chapter.chapterId)
    const key = `${subjectId}_${chapterId}`

    chapterMap[key] = {
      key,
      subjectId,
      subjectName: subjectNameMap[String(subjectId)] || `科目${subjectId}`,
      chapterId,
      chapterName: chapter.chapterName || `第${chapterId}章`,
      sortOrder: chapter.sortOrder || index + 1,
      questionCount: questionCountMap[key] || 0
    }
  })

  questions.forEach(question => {
    const subjectId = question.subjectId
    const chapterId = padChapterId(question.chapterId)
    const key = `${subjectId}_${chapterId}`

    if (!chapterMap[key]) {
      chapterMap[key] = {
        key,
        subjectId,
        subjectName: subjectNameMap[String(subjectId)] || question.subjectName || `科目${subjectId}`,
        chapterId,
        chapterName: question.chapterName || `第${chapterId}章`,
        sortOrder: Number(chapterId) || 9999,
        questionCount: questionCountMap[key] || 0
      }
    }
  })

  return Object.values(chapterMap).sort((a, b) => {
    const sa = Number(a.subjectId) - Number(b.subjectId)

    if (sa !== 0) return sa

    const ca = Number(a.sortOrder || a.chapterId || 9999)
    const cb = Number(b.sortOrder || b.chapterId || 9999)

    if (ca !== cb) return ca - cb

    return Number(a.chapterId) - Number(b.chapterId)
  })
}

function buildSummary(bankPackage) {
  const questions = Array.isArray(bankPackage.questions)
    ? bankPackage.questions
    : []

  const subjects = normalizeSubjectList(bankPackage)

  const chapters = Array.isArray(bankPackage.chapters)
    ? bankPackage.chapters
    : []

  const questionIds = getBankQuestionIds(bankPackage)
  const records = recordStore.getPackageRecordsByQuestionIds(questionIds)

  const chapterCount = chapters.length > 0
    ? chapters.length
    : getUniqueCount(questions, "chapterId")

  return {
    questionCount: questions.length,
    subjectCount: subjects.length,
    chapterCount,

    answerCount: countMap(records.answers),
    wrongCount: countMap(records.wrong),
    favoriteCount: countMap(records.favorites),
    noteCount: countMap(records.notes),
    sequenceProgressCount: countMap(records.sequenceProgress),
    wrongProgressCount: countMap(records.wrongProgress),
    favoriteProgressCount: countMap(records.favoriteProgress),
    deletedCount: countMap(records.deleted)
  }
}

function buildDeleteImpactText(bankInfo, summary) {
  return `将删除本地题库包【${bankInfo.bankName || bankInfo.bankId}】，并清除该题库所属数据：

题目：${summary.questionCount} 道
答题记录：${summary.answerCount} 条
错题记录：${summary.wrongCount} 条
收藏记录：${summary.favoriteCount} 条
备注记录：${summary.noteCount} 条
顺序练习进度：${summary.sequenceProgressCount} 条
错题练习进度：${summary.wrongProgressCount} 条
收藏夹练习进度：${summary.favoriteProgressCount} 条
回收站记录：${summary.deletedCount} 条`
}

function attachCurrentRecords(bankPackage) {
  const newPackage = cloneObject(bankPackage)
  const questionIds = getBankQuestionIds(newPackage)

  newPackage.records = recordStore.getPackageRecordsByQuestionIds(questionIds)

  return newPackage
}

Page({
  data: {
    bankId: "",
    empty: false,
    bankPackage: null,
    bankInfo: {},
    renameBankName: "",
    summary: {},
    subjectList: [],
    chapterList: []
  },

  onLoad(options) {
    const bankId = options.bankId || ""

    this.setData({
      bankId
    })

    this.loadBankDetail()
  },

  loadBankDetail() {
    const bankPackage = localBankStore.getLocalBankPackageById(this.data.bankId)

    if (!bankPackage) {
      this.setData({
        empty: true
      })
      return
    }

    const subjectList = normalizeSubjectList(bankPackage)

    this.setData({
      empty: false,
      bankPackage,
      bankInfo: bankPackage.bankInfo || {},
      renameBankName: bankPackage.bankInfo && bankPackage.bankInfo.bankName
        ? bankPackage.bankInfo.bankName
        : "",
      summary: buildSummary(bankPackage),
      subjectList,
      chapterList: normalizeChapterList(bankPackage, subjectList)
    })
  },

  onBankNameInput(e) {
    this.setData({
      renameBankName: e.detail.value
    })
  },

  saveBankName() {
    const newName = String(this.data.renameBankName || "").trim()

    if (!newName) {
      wx.showToast({
        title: "题库名称不能为空",
        icon: "none"
      })
      return
    }

    const bankPackage = this.data.bankPackage

    if (!bankPackage) {
      wx.showToast({
        title: "题库不存在",
        icon: "none"
      })
      return
    }

    wx.showModal({
      title: "保存题库名称？",
      content: `将题库名称修改为：${newName}`,
      confirmText: "确认保存",
      confirmColor: "#2f7cf6",
      success: res => {
        if (!res.confirm) return

        const newPackage = attachCurrentRecords(bankPackage)

        newPackage.bankInfo = {
          ...(newPackage.bankInfo || {}),
          bankName: newName,
          updateTime: new Date().toISOString()
        }

        const saveResult = localBankStore.saveBankPackage(newPackage)

        if (!saveResult.ok) {
          wx.showToast({
            title: saveResult.message || "保存失败",
            icon: "none"
          })
          return
        }

        wx.showToast({
          title: "已保存",
          icon: "success"
        })

        this.loadBankDetail()
      }
    })
  },

  copyBankPackage() {
    const bankPackage = this.data.bankPackage

    if (!bankPackage) {
      wx.showToast({
        title: "题库不存在",
        icon: "none"
      })
      return
    }

    const exportPackage = attachCurrentRecords(bankPackage)

    wx.setClipboardData({
      data: JSON.stringify(exportPackage, null, 2),
      success: () => {
        wx.showToast({
          title: "题库JSON已复制",
          icon: "success"
        })
      }
    })
  },

  deleteBankPackage() {
    const bankInfo = this.data.bankInfo || {}
    const bankId = this.data.bankId
    const bankPackage = this.data.bankPackage
    const summary = this.data.summary || {}

    if (!bankId || !bankPackage) {
      wx.showToast({
        title: "题库不存在",
        icon: "none"
      })
      return
    }

    wx.showModal({
      title: "确认删除题库？",
      content: buildDeleteImpactText(bankInfo, summary),
      confirmText: "确认删除",
      confirmColor: "#d93025",
      success: res => {
        if (!res.confirm) return

        const questionIds = getBankQuestionIds(bankPackage)

        recordStore.clearRecordsByQuestionIds(questionIds)
        localBankStore.deleteLocalBank(bankId)
        subjectStore.resetSubjectConfig()

        wx.showToast({
          title: "已删除题库",
          icon: "success"
        })

        setTimeout(() => {
          wx.navigateBack()
        }, 500)
      }
    })
  }
})