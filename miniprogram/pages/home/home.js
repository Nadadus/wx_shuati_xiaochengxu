const study = require("../../utils/study")

Page({
  data: {
    summary: {
      countdownDays: 0,
      learningDays: 0,
      todayChecked: false,
      totalAnswered: 0,
      accuracyRate: 0
    }
  },

  onShow() {
    this.loadSummary()
  },

  loadSummary() {
    this.setData({
      summary: study.getHomeSummary()
    })
  },

  onCheckin() {
    if (this.data.summary.todayChecked) {
      wx.showToast({
        title: "今天已经签到",
        icon: "none"
      })
      return
    }

    study.checkinToday()

    wx.showToast({
      title: "签到成功",
      icon: "success"
    })

    this.loadSummary()
  },

  goSequence() {
    wx.navigateTo({
      url: "/pages/subjectList/subjectList?mode=sequence"
    })
  },

  goWrong() {
    wx.navigateTo({
      url: "/pages/subjectList/subjectList?mode=wrong"
    })
  },

  goFavorite() {
    wx.navigateTo({
      url: "/pages/subjectList/subjectList?mode=favorite"
    })
  },

  goMine() {
    wx.navigateTo({
      url: "/pages/mine/mine"
    })
  }
})