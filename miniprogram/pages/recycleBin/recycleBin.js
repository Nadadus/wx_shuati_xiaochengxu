const questionStore = require("../../utils/questionStore")
const recordStore = require("../../utils/recordStore")

function formatShortTime(timeText) {
  if (!timeText) return "-"

  const date = new Date(timeText)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${month}-${day} ${hour}:${minute}`
}

function buildSubjectFilterList(list, currentSubjectId) {
  const subjectMap = {}

  list.forEach(item => {
    const subjectId = item.subjectId

    if (subjectId === undefined || subjectId === null) return

    const key = String(subjectId)

    if (!subjectMap[key]) {
      subjectMap[key] = {
        value: key,
        label: item.subjectName || `科目${subjectId}`,
        count: 0,
        active: false
      }
    }

    subjectMap[key].count += 1
  })

  const subjectList = Object.values(subjectMap).sort((a, b) => {
    return Number(a.value) - Number(b.value)
  })

  const filterList = [
    {
      value: "all",
      label: "全部",
      count: list.length,
      active: currentSubjectId === "all"
    },
    ...subjectList.map(item => ({
      ...item,
      active: String(currentSubjectId) === String(item.value)
    }))
  ]

  return filterList
}

function buildImpactText(title, questionCount, impact) {
  return `${title}

题目：${questionCount} 道
答题记录：${impact.answerCount} 条
错题记录：${impact.wrongCount} 条
收藏记录：${impact.favoriteCount} 条
备注记录：${impact.noteCount} 条
顺序练习进度：${impact.sequenceProgressCount} 条
错题练习进度：${impact.wrongProgressCount} 条
收藏夹练习进度：${impact.favoriteProgressCount} 条
回收站记录：${impact.deletedCount} 条

彻底删除后，本题不会再出现在顺序练习、错题练习、收藏题目和回收站中。`
}

Page({
  data: {
    allList: [],
    list: [],
    subjectFilterList: [],
    currentSubjectId: "all",

    batchMode: false,
    selectedMap: {},
    selectedCount: 0,

    emptyText: "暂无回收站题目"
  },

  onShow() {
    this.loadRecycleList()
  },

  loadRecycleList() {
    const deletedMap = recordStore.getDeletedMap()
    const oldSelectedMap = this.data.selectedMap || {}

    const allList = Object.keys(deletedMap)
      .filter(questionId => deletedMap[questionId].deleteStatus === "recycle")
      .map(questionId => {
        const question = questionStore.getQuestionById(questionId)

        if (!question) return null

        const deletedRecord = deletedMap[questionId] || {}

        return {
          ...question,
          selected: !!oldSelectedMap[question.id],
          deletedAtText: formatShortTime(deletedRecord.deletedAt)
        }
      })
      .filter(Boolean)

    const selectedMap = {}

    allList.forEach(item => {
      if (oldSelectedMap[item.id]) {
        selectedMap[item.id] = true
      }
    })

    this.setData({
      allList,
      selectedMap,
      selectedCount: Object.keys(selectedMap).length
    })

    this.applyFilter()
  },

  applyFilter() {
    const currentSubjectId = this.data.currentSubjectId
    const selectedMap = this.data.selectedMap || {}

    let list = this.data.allList.slice()

    if (currentSubjectId !== "all") {
      list = list.filter(item => String(item.subjectId) === String(currentSubjectId))
    }

    list = list.map(item => ({
      ...item,
      selected: !!selectedMap[item.id]
    }))

    let emptyText = "暂无回收站题目"

    if (this.data.allList.length > 0 && list.length === 0) {
      emptyText = "当前科目暂无回收站题目"
    }

    this.setData({
      list,
      emptyText,
      subjectFilterList: buildSubjectFilterList(this.data.allList, currentSubjectId),
      selectedCount: Object.keys(selectedMap).length
    })
  },

  setSubjectFilter(e) {
    const subjectId = e.currentTarget.dataset.id || "all"

    this.setData({
      currentSubjectId: String(subjectId)
    })

    this.applyFilter()
  },

  toggleBatchMode() {
    const batchMode = !this.data.batchMode

    this.setData({
      batchMode,
      selectedMap: batchMode ? this.data.selectedMap : {},
      selectedCount: batchMode ? this.data.selectedCount : 0
    })

    this.applyFilter()
  },

  toggleSelect(e) {
    if (!this.data.batchMode) return

    const questionId = e.currentTarget.dataset.id

    if (!questionId) return

    const selectedMap = {
      ...this.data.selectedMap
    }

    if (selectedMap[questionId]) {
      delete selectedMap[questionId]
    } else {
      selectedMap[questionId] = true
    }

    this.setData({
      selectedMap,
      selectedCount: Object.keys(selectedMap).length
    })

    this.applyFilter()
  },

  selectAllVisible() {
    if (!this.data.batchMode) {
      this.setData({
        batchMode: true
      })
    }

    const selectedMap = {
      ...this.data.selectedMap
    }

    this.data.list.forEach(item => {
      selectedMap[item.id] = true
    })

    this.setData({
      selectedMap,
      selectedCount: Object.keys(selectedMap).length
    })

    this.applyFilter()
  },

  clearSelected() {
    this.setData({
      selectedMap: {},
      selectedCount: 0
    })

    this.applyFilter()
  },

  getSelectedIds() {
    return Object.keys(this.data.selectedMap || {})
  },

  viewQuestion(e) {
    const questionId = e.currentTarget.dataset.id

    wx.navigateTo({
      url: `/pages/practice/practice?mode=recycleView&questionId=${questionId}`
    })
  },

  restoreQuestion(e) {
    const questionId = e.currentTarget.dataset.id

    wx.showModal({
      title: "确认恢复题目？",
      content: "恢复后，本题将重新出现在顺序练习中。如果它仍然是错题，也会重新出现在错题练习中。收藏和备注记录不会改变。",
      confirmText: "确认恢复",
      confirmColor: "#2f7cf6",
      success: res => {
        if (!res.confirm) return

        recordStore.restoreQuestion(questionId)

        wx.showToast({
          title: "已恢复",
          icon: "success"
        })

        this.loadRecycleList()
      }
    })
  },

  batchRestore() {
    const ids = this.getSelectedIds()

    if (ids.length === 0) {
      wx.showToast({
        title: "请先选择题目",
        icon: "none"
      })
      return
    }

    wx.showModal({
      title: "确认批量恢复？",
      content: `将恢复 ${ids.length} 道题目。恢复后，这些题目会重新出现在顺序练习中。`,
      confirmText: "确认恢复",
      confirmColor: "#2f7cf6",
      success: res => {
        if (!res.confirm) return

        ids.forEach(questionId => {
          recordStore.restoreQuestion(questionId)
        })

        wx.showToast({
          title: "已恢复",
          icon: "success"
        })

        this.setData({
          selectedMap: {},
          selectedCount: 0
        })

        this.loadRecycleList()
      }
    })
  },

  hardDeleteQuestion(e) {
    const questionId = e.currentTarget.dataset.id
    const impact = recordStore.getRecordImpactByQuestionIds([questionId])

    wx.showModal({
      title: "确认彻底删除？",
      content: buildImpactText("将彻底删除本题，并同步清除本题相关学习记录：", 1, impact),
      confirmText: "彻底删除",
      confirmColor: "#d93025",
      success: res => {
        if (!res.confirm) return

        recordStore.hardDeleteQuestionAndRecords(questionId)

        wx.showToast({
          title: "已彻底删除",
          icon: "success"
        })

        this.loadRecycleList()
      }
    })
  },

  batchHardDelete() {
    const ids = this.getSelectedIds()

    if (ids.length === 0) {
      wx.showToast({
        title: "请先选择题目",
        icon: "none"
      })
      return
    }

    const impact = recordStore.getRecordImpactByQuestionIds(ids)

    wx.showModal({
      title: "确认批量彻底删除？",
      content: buildImpactText(`将彻底删除 ${ids.length} 道题目，并同步清除相关学习记录：`, ids.length, impact),
      confirmText: "彻底删除",
      confirmColor: "#d93025",
      success: res => {
        if (!res.confirm) return

        recordStore.hardDeleteQuestionsAndRecords(ids)

        wx.showToast({
          title: "已彻底删除",
          icon: "success"
        })

        this.setData({
          selectedMap: {},
          selectedCount: 0
        })

        this.loadRecycleList()
      }
    })
  }
})