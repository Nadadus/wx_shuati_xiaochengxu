const questionStore = require("../../utils/questionStore")
const subjectStore = require("../../utils/subjectStore")

function getQuestionCount(subjectId) {
  return questionStore.getQuestionCountBySubject(subjectId)
}

Page({
  data: {
    subjectList: []
  },

  onShow() {
    this.loadSubjects()
  },

  loadSubjects() {
    const subjectList = subjectStore.getAllSubjects().map(item => ({
      ...item,
      questionCount: getQuestionCount(item.subjectId)
    }))

    this.setData({
      subjectList
    })
  },

  moveUp(e) {
    const subjectId = e.currentTarget.dataset.id

    subjectStore.moveSubject(subjectId, "up")
    this.loadSubjects()
  },

  moveDown(e) {
    const subjectId = e.currentTarget.dataset.id

    subjectStore.moveSubject(subjectId, "down")
    this.loadSubjects()
  },

  toggleEnable(e) {
    const subjectId = e.currentTarget.dataset.id
    const target = this.data.subjectList.find(item => String(item.subjectId) === String(subjectId))

    if (!target) return

    const enabledCount = this.data.subjectList.filter(item => item.enabled).length

    if (target.enabled && enabledCount <= 1) {
      wx.showToast({
        title: "至少保留一个启用科目",
        icon: "none"
      })
      return
    }

    subjectStore.setSubjectEnabled(subjectId, !target.enabled)
    this.loadSubjects()
  },

  resetConfig() {
    wx.showModal({
      title: "恢复默认科目顺序？",
      content: "将恢复当前题库中的科目顺序，并重新启用所有科目。答题记录、错题、收藏和备注不会被清除。",
      confirmText: "确认恢复",
      confirmColor: "#d93025",
      success: res => {
        if (!res.confirm) return

        subjectStore.resetSubjectConfig()
        this.loadSubjects()

        wx.showToast({
          title: "已恢复",
          icon: "success"
        })
      }
    })
  }
})