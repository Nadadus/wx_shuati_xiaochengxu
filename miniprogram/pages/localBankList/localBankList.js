const localBankStore = require("../../utils/localBankStore")
const subjectStore = require("../../utils/subjectStore")
const recordStore = require("../../utils/recordStore")

function formatShortTime(timeText) {
  if (!timeText) {
    return "-"
  }

  const date = new Date(timeText)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${month}-${day}`
}

function countMap(map) {
  if (!map || typeof map !== "object") {
    return 0
  }

  return Object.keys(map).length
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

function buildDeleteImpact(bankPackage) {
  const questions = Array.isArray(bankPackage.questions)
    ? bankPackage.questions
    : []

  const questionIds = getBankQuestionIds(bankPackage)
  const records = recordStore.getPackageRecordsByQuestionIds(questionIds)

  return {
    questionCount: questions.length,
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

function buildDeleteImpactText(bankName, impact) {
  return `将删除本地题库包【${bankName}】，并清除该题库所属数据：

题目：${impact.questionCount} 道
答题记录：${impact.answerCount} 条
错题记录：${impact.wrongCount} 条
收藏记录：${impact.favoriteCount} 条
备注记录：${impact.noteCount} 条
顺序练习进度：${impact.sequenceProgressCount} 条
错题练习进度：${impact.wrongProgressCount} 条
收藏夹练习进度：${impact.favoriteProgressCount} 条
回收站记录：${impact.deletedCount} 条`
}

Page({
  data: {
    localBankList: []
  },

  onShow() {
    this.loadLocalBanks()
  },

  loadLocalBanks() {
    const localBankList = localBankStore.getLocalBankIndex().map(item => ({
      ...item,
      subjectCount: Array.isArray(item.subjectIds) ? item.subjectIds.length : 0,
      shortTime: formatShortTime(item.updateTime || item.createTime)
    }))

    this.setData({
      localBankList
    })
  },

  goBankExport() {
    wx.navigateTo({
      url: "/pages/localBankExport/localBankExport"
    })
  },

  goBankDetail(e) {
    const bankId = e.currentTarget.dataset.id

    wx.navigateTo({
      url: `/pages/localBankDetail/localBankDetail?bankId=${bankId}`
    })
  },

  copyBankPackage(e) {
    const bankId = e.currentTarget.dataset.id
    const bankPackage = localBankStore.getLocalBankPackageById(bankId)

    if (!bankPackage) {
      wx.showToast({
        title: "题库文件不存在",
        icon: "none"
      })
      return
    }

    const questionIds = getBankQuestionIds(bankPackage)

    bankPackage.records = recordStore.getPackageRecordsByQuestionIds(questionIds)

    wx.setClipboardData({
      data: JSON.stringify(bankPackage, null, 2),
      success: () => {
        wx.showToast({
          title: "题库JSON已复制",
          icon: "success"
        })
      }
    })
  },

  deleteBankPackage(e) {
    const bankId = e.currentTarget.dataset.id
    const target = this.data.localBankList.find(item => item.bankId === bankId)

    if (!target) {
      wx.showToast({
        title: "题库不存在",
        icon: "none"
      })
      return
    }

    const bankPackage = localBankStore.getLocalBankPackageById(bankId)

    if (!bankPackage) {
      wx.showToast({
        title: "题库文件不存在",
        icon: "none"
      })
      return
    }

    const questionIds = getBankQuestionIds(bankPackage)
    const impact = buildDeleteImpact(bankPackage)

    wx.showModal({
      title: "确认删除题库？",
      content: buildDeleteImpactText(target.bankName, impact),
      confirmText: "确认删除",
      confirmColor: "#d93025",
      success: res => {
        if (!res.confirm) return

        recordStore.clearRecordsByQuestionIds(questionIds)
        localBankStore.deleteLocalBank(bankId)
        subjectStore.resetSubjectConfig()

        this.loadLocalBanks()

        wx.showToast({
          title: "已删除题库",
          icon: "success"
        })
      }
    })
  }
})