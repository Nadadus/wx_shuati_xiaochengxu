const quizProgress = require("../../utils/quizProgress")

Page({
  data: {
    mode: "sequence",
    pageTitle: "顺序练习",
    pageDesc: "",
    countLabel: "进度",
    actionText: "继续练习",
    subjectList: []
  },

  onLoad(options) {
    const mode = options.mode || "sequence"

    this.initPage(mode)
  },

  onShow() {
    this.refreshList()
  },

  initPage(mode) {
    let pageDesc = "按考试大纲顺序选择科目开始练习。"
    let actionText = "继续练习"

    if (mode === "wrong") {
      pageDesc = "重做错题，做对后自动移出错题集。"
      actionText = "开始错题"
    }

    if (mode === "favorite") {
      pageDesc = "查看手动收藏和错题自动收藏的题目。"
      actionText = "查看收藏"
    }

    this.setData({
      mode,
      pageTitle: quizProgress.getModeTitle(mode),
      pageDesc,
      countLabel: quizProgress.getModeCountLabel(mode),
      actionText
    })

    this.refreshList()
  },

  refreshList() {
    const oldList = this.data.subjectList || []
    const oldStateMap = {}
  
    oldList.forEach(item => {
      oldStateMap[item.subjectId] = {
        expanded: item.expanded,
        chapterExpanded: item.chapterExpanded
      }
    })
  
    const newList = quizProgress.buildSubjectProgressList(this.data.mode).map(item => {
      const oldState = oldStateMap[item.subjectId]
  
      const safePercent = Math.max(0, Math.min(Number(item.percent) || 0, 100))
  
      const chapters = item.chapters.map(chapter => {
        const chapterPercent = Math.max(0, Math.min(Number(chapter.percent) || 0, 100))
  
        return {
          ...chapter,
          percent: chapterPercent,
          progressStyle: `width:${chapterPercent}%;`
        }
      })
  
      return {
        ...item,
        percent: safePercent,
        chapters,
        progressStyle: `width:${safePercent}%;`,
        expanded: oldState ? oldState.expanded : false,
        chapterExpanded: oldState ? oldState.chapterExpanded : false
      }
    })
  
    this.setData({
      subjectList: newList
    })
  },

  toggleSubject(e) {
    const subjectId = Number(e.currentTarget.dataset.id)

    const subjectList = this.data.subjectList.map(item => {
      if (item.subjectId === subjectId) {
        return {
          ...item,
          expanded: !item.expanded
        }
      }

      return item
    })

    this.setData({
      subjectList
    })
  },

  toggleChapter(e) {
    const subjectId = Number(e.currentTarget.dataset.id)

    const subjectList = this.data.subjectList.map(item => {
      if (item.subjectId === subjectId) {
        return {
          ...item,
          chapterExpanded: !item.chapterExpanded
        }
      }

      return item
    })

    this.setData({
      subjectList
    })
  },

  startPractice(e) {
    const subjectId = Number(e.currentTarget.dataset.id)
  
    wx.navigateTo({
      url: `/pages/practice/practice?mode=${this.data.mode}&subjectId=${subjectId}`
    })
  },
  
  startChapterPractice(e) {
    const subjectId = Number(e.currentTarget.dataset.subjectId)
    const chapterId = e.currentTarget.dataset.chapterId
  
    wx.navigateTo({
      url: `/pages/practice/practice?mode=${this.data.mode}&subjectId=${subjectId}&chapterId=${chapterId}`
    })
  }
})