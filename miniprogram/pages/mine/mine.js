Page({
  goStudySettings() {
    wx.navigateTo({
      url: "/pages/studySettings/studySettings"
    })
  },

  goBankManage() {
    wx.navigateTo({
      url: "/pages/bankManage/bankManage"
    })
  },

  goRecordManage() {
    wx.navigateTo({
      url: "/pages/recordManage/recordManage"
    })
  },

  goRecycleBin() {
    wx.navigateTo({
      url: "/pages/recycleBin/recycleBin"
    })
  }
})