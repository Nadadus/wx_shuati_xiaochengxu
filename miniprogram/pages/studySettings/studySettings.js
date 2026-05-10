const study = require("../../utils/study")

Page({
  data: {
    examDate: "2026-12-01"
  },

  onLoad() {
    const settings = study.getSettings()

    this.setData({
      examDate: settings.examDate
    })
  },

  onExamDateChange(e) {
    this.setData({
      examDate: e.detail.value
    })
  },

  saveSettings() {
    const settings = study.getSettings()

    settings.examDate = this.data.examDate
    settings.updateTime = new Date().toISOString()

    study.saveSettings(settings)

    wx.showToast({
      title: "已保存",
      icon: "success"
    })
  }
})