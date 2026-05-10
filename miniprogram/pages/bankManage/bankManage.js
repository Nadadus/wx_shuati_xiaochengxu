Page({
  goBankImport() {
    wx.navigateTo({
      url: "/pages/bankImport/bankImport"
    })
  },

  goSubjectOrder() {
    wx.navigateTo({
      url: "/pages/subjectOrder/subjectOrder"
    })
  },

  goLocalBankList() {
    wx.navigateTo({
      url: "/pages/localBankList/localBankList"
    })
  }
})