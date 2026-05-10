const subjectStore = require("../../utils/subjectStore")
const questionStore = require("../../utils/questionStore")
const recordStore = require("../../utils/recordStore")

function getEnabledSubjects() {
  return subjectStore.getEnabledSubjects()
}

function getChaptersBySubject(subjectId) {
  return questionStore.getChaptersBySubject(subjectId)
}

Page({
  data: {
    subjects: [],
    subjectOptions: [],
    subjectNames: [],
    subjectIndex: 0,
    currentSubjectId: "all",
    currentSubjectName: "全部科目",

    chapters: [],
    chapterOptions: [],
    chapterNames: [],
    chapterIndex: 0,
    currentChapterId: "all",
    currentChapterName: "全部章节"
  },

  onLoad() {
    this.initSubjects()
  },

  initSubjects() {
    const subjectList = getEnabledSubjects()

    const subjectOptions = [
      {
        subjectId: "all",
        subjectName: "全部科目"
      },
      ...subjectList
    ]

    this.setData({
      subjects: subjectList,
      subjectOptions,
      subjectNames: subjectOptions.map(item => item.subjectName),
      subjectIndex: 0,
      currentSubjectId: "all",
      currentSubjectName: "全部科目",
      chapters: [],
      chapterOptions: [],
      chapterNames: [],
      chapterIndex: 0,
      currentChapterId: "all",
      currentChapterName: "全部章节"
    })
  },

  onSubjectChange(e) {
    const index = Number(e.detail.value)
    const selected = this.data.subjectOptions[index]

    if (selected.subjectId === "all") {
      this.setData({
        subjectIndex: index,
        currentSubjectId: "all",
        currentSubjectName: "全部科目",
        chapters: [],
        chapterOptions: [],
        chapterNames: [],
        chapterIndex: 0,
        currentChapterId: "all",
        currentChapterName: "全部章节"
      })
      return
    }

    const chapters = getChaptersBySubject(selected.subjectId)

    const chapterOptions = [
      {
        chapterId: "all",
        chapterName: "全部章节"
      },
      ...chapters
    ]

    this.setData({
      subjectIndex: index,
      currentSubjectId: selected.subjectId,
      currentSubjectName: selected.subjectName,
      chapters,
      chapterOptions,
      chapterNames: chapterOptions.map(item => item.chapterName),
      chapterIndex: 0,
      currentChapterId: "all",
      currentChapterName: "全部章节"
    })
  },

  onChapterChange(e) {
    const index = Number(e.detail.value)
    const selected = this.data.chapterOptions[index]

    this.setData({
      chapterIndex: index,
      currentChapterId: selected.chapterId,
      currentChapterName: selected.chapterName
    })
  },

  getScope() {
    if (this.data.currentSubjectId === "all") {
      return {
        type: "all"
      }
    }

    if (this.data.currentChapterId === "all") {
      return {
        type: "subject",
        subjectId: this.data.currentSubjectId
      }
    }

    return {
      type: "chapter",
      subjectId: this.data.currentSubjectId,
      chapterId: this.data.currentChapterId
    }
  },

  getScopeText() {
    if (this.data.currentSubjectId === "all") {
      return "全部科目"
    }

    if (this.data.currentChapterId === "all") {
      return this.data.currentSubjectName
    }

    return `${this.data.currentSubjectName} - ${this.data.currentChapterName}`
  },

  confirmClear(title, content, action) {
    wx.showModal({
      title,
      content,
      confirmText: "确认清空",
      confirmColor: "#d93025",
      success: res => {
        if (!res.confirm) return

        action()

        wx.showToast({
          title: "已清空",
          icon: "success"
        })
      }
    })
  },

  clearSequenceProgress() {
    const scope = this.getScope()
    const scopeText = this.getScopeText()

    this.confirmClear(
      "清空顺序练习进度？",
      `将清空【${scopeText}】的顺序练习进度。不会删除错题、收藏、备注和题库。`,
      () => {
        recordStore.clearSequenceProgress(scope)
      }
    )
  },

  clearWrongPracticeProgress() {
    const scope = this.getScope()
    const scopeText = this.getScopeText()

    this.confirmClear(
      "清空错题练习进度？",
      `将清空【${scopeText}】的错题练习进度。错题仍保留在错题集中。`,
      () => {
        recordStore.clearWrongPracticeProgress(scope)
      }
    )
  },

  clearFavoritePracticeProgress() {
    const scope = this.getScope()
    const scopeText = this.getScopeText()

    this.confirmClear(
      "清空收藏夹练习进度？",
      `将清空【${scopeText}】的收藏夹练习进度。收藏记录不会被删除。`,
      () => {
        recordStore.clearFavoritePracticeProgress(scope)
      }
    )
  },

  clearWrongRecords() {
    const scope = this.getScope()
    const scopeText = this.getScopeText()

    this.confirmClear(
      "清空错题记录？",
      `将清空【${scopeText}】的错题记录。对应题目将不再显示在错题练习中，但收藏和备注不会被删除。`,
      () => {
        recordStore.clearWrongRecords(scope)
      }
    )
  },

  clearFavoriteRecords() {
    const scope = this.getScope()
    const scopeText = this.getScopeText()

    this.confirmClear(
      "清空收藏记录？",
      `将清空【${scopeText}】的收藏记录。对应题目将不再显示在收藏题目中，但错题和备注不会被删除。`,
      () => {
        recordStore.clearFavoriteRecords(scope)
      }
    )
  }
})