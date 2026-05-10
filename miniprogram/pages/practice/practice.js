const questionStore = require("../../utils/questionStore")
const recordStore = require("../../utils/recordStore")

function isVisibleQuestion(question, mode) {
  if (!question) return false

  if (recordStore.isHardDeleted(question.id)) {
    return false
  }

  if (mode === "favorite") {
    return true
  }

  if (recordStore.isInRecycleBin(question.id)) {
    return false
  }

  return true
}

function getEmptyTextByMode(mode) {
  if (mode === "wrong") {
    return "当前范围暂无错题"
  }

  if (mode === "favorite") {
    return "当前范围暂无收藏题"
  }

  return "当前范围暂无题目"
}

Page({
  data: {
    mode: "sequence",
    subjectId: 0,
    chapterId: "",
    queue: [],
    currentIndex: 0,
    question: null,
    recycleView: false,
    typeText: "单选题",
    displayOptions: [],
    selected: [],
    submitted: false,
    result: null,
    isFavorite: false,
    canRemoveWrong: false,
    noteInput: "",
    noteSaveText: "保存备注",
    noteSaved: false,
    empty: false,
    emptyText: "",
    showAnswerCard: false,
    answerCardFilter: "all",
    answerCardFilterList: [
      {
        value: "all",
        label: "全部"
      },
      {
        value: "done",
        label: "已做"
      },
      {
        value: "undone",
        label: "未做"
      },
      {
        value: "wrong",
        label: "错题"
      },
      {
        value: "favorite",
        label: "收藏"
      }
    ],
    answerCardList: []
  },

  onLoad(options) {
    const mode = options.mode || "sequence"
    const subjectId = Number(options.subjectId || 0)
    const chapterId = options.chapterId || ""
    const questionId = options.questionId || ""

    this.setData({
      mode,
      subjectId,
      chapterId,
      recycleView: mode === "recycleView"
    })

    if (mode === "recycleView" && questionId) {
      this.buildRecycleViewQueue(questionId)
      return
    }

    this.buildQueue(mode, subjectId, chapterId)
  },

  onUnload() {
    if (this.noteSaveTimer) {
      clearTimeout(this.noteSaveTimer)
      this.noteSaveTimer = null
    }
  },

  buildRecycleViewQueue(questionId) {
    const question = questionStore.getQuestionById(questionId)

    if (!question || recordStore.isHardDeleted(questionId)) {
      this.setData({
        empty: true,
        emptyText: "题目不存在或已被彻底删除",
        queue: []
      })
      return
    }

    this.setData({
      empty: false,
      queue: [questionId],
      currentIndex: 0,
      recycleView: true
    })

    this.loadCurrentQuestion()

    const result = {
      isCorrect: true,
      userAnswerText: "回收站查看模式",
      correctAnswerText: recordStore.formatAnswer(question.answer),
      previousAnswerText: "未选择"
    }

    this.setData({
      submitted: true,
      result
    })

    this.refreshOptions()
  },

  buildQueue(mode, subjectId, chapterId) {
    const wrongMap = recordStore.getWrongMap()
    const favoriteMap = recordStore.getFavoriteMap()
    const progressMap = recordStore.getModeProgressMap(mode)

    let list = questionStore.getAllQuestions().filter(q => {
      if (subjectId && q.subjectId !== subjectId) {
        return false
      }

      if (chapterId && q.chapterId !== chapterId) {
        return false
      }

      if (!isVisibleQuestion(q, mode)) {
        return false
      }

      if (mode === "wrong") {
        return !!wrongMap[q.id]
      }

      if (mode === "favorite") {
        return !!favoriteMap[q.id]
      }

      return true
    })

    list = questionStore.sortQuestions(list)

    const queue = list.map(item => item.id)

    if (queue.length === 0) {
      this.setData({
        empty: true,
        emptyText: getEmptyTextByMode(mode),
        queue: [],
        answerCardList: []
      })

      return
    }

    const unfinishedIndex = queue.findIndex(id => {
      return !progressMap[id] || !progressMap[id].done
    })

    const currentIndex = unfinishedIndex >= 0 ? unfinishedIndex : 0

    this.setData({
      empty: false,
      queue,
      currentIndex
    })

    this.loadCurrentQuestion()
  },

  loadCurrentQuestion() {
    const questionId = this.data.queue[this.data.currentIndex]
    const question = questionStore.getQuestionById(questionId)

    if (!question) {
      this.removeCurrentFromQueue("题目不存在")
      return
    }

    if (recordStore.isHardDeleted(question.id)) {
      this.removeCurrentFromQueue("题目已被彻底删除")
      return
    }

    if (this.data.mode !== "favorite" && recordStore.isInRecycleBin(question.id)) {
      this.removeCurrentFromQueue("题目已进入回收站")
      return
    }

    this.setData({
      question,
      typeText: questionStore.getTypeText(question.type),
      selected: [],
      submitted: false,
      result: null,
      isFavorite: recordStore.isFavorite(question.id),
      canRemoveWrong: this.data.mode === "wrong" && recordStore.isWrong(question.id),
      noteInput: recordStore.getNote(question.id),
      noteSaveText: "保存备注",
      noteSaved: false
    })

    this.refreshOptions()
    this.buildAnswerCardList()
  },

  removeCurrentFromQueue(toastText) {
    const queue = this.data.queue.slice()
    const oldIndex = this.data.currentIndex

    queue.splice(oldIndex, 1)

    if (queue.length === 0) {
      this.setData({
        empty: true,
        emptyText: getEmptyTextByMode(this.data.mode),
        queue: [],
        currentIndex: 0,
        question: null,
        answerCardList: [],
        showAnswerCard: false
      })

      if (toastText) {
        wx.showToast({
          title: toastText,
          icon: "none"
        })
      }

      return
    }

    const nextIndex = oldIndex >= queue.length
      ? queue.length - 1
      : oldIndex

    this.setData({
      empty: false,
      queue,
      currentIndex: nextIndex
    })

    if (toastText) {
      wx.showToast({
        title: toastText,
        icon: "none"
      })
    }

    this.loadCurrentQuestion()
  },

  buildAnswerCardList() {
    const progressMap = recordStore.getModeProgressMap(this.data.mode)
    const wrongMap = recordStore.getWrongMap()
    const favoriteMap = recordStore.getFavoriteMap()
    const filter = this.data.answerCardFilter

    const fullList = this.data.queue.map((questionId, index) => {
      const progress = progressMap[questionId]
      const done = !!(progress && progress.done)
      const lastIsCorrect = !!(progress && progress.lastIsCorrect)
      const isWrong = !!wrongMap[questionId]
      const isFavorite = !!favoriteMap[questionId]

      let statusClass = "card-item-unanswered"

      if (index === this.data.currentIndex) {
        statusClass = "card-item-current"
      } else if (done) {
        statusClass = lastIsCorrect
          ? "card-item-right"
          : "card-item-wrong"
      }

      return {
        questionId,
        index,
        number: index + 1,
        statusClass,
        done,
        isWrong,
        isFavorite
      }
    })

    const answerCardList = fullList.filter(item => {
      if (filter === "done") {
        return item.done
      }

      if (filter === "undone") {
        return !item.done
      }

      if (filter === "wrong") {
        return item.isWrong
      }

      if (filter === "favorite") {
        return item.isFavorite
      }

      return true
    })

    this.setData({
      answerCardList
    })
  },

  refreshOptions() {
    const question = this.data.question

    if (!question) return

    const selected = this.data.selected
    const submitted = this.data.submitted

    const displayOptions = question.options.map(item => {
      const isSelected = selected.includes(item.key)
      const isCorrect = submitted && question.answer.includes(item.key)
      const isWrong = submitted && isSelected && !question.answer.includes(item.key)

      return {
        ...item,
        selected: isSelected,
        correct: isCorrect,
        wrong: isWrong
      }
    })

    this.setData({
      displayOptions
    })
  },

  onSelectOption(e) {
    if (this.data.submitted || this.data.recycleView) {
      return
    }

    const key = e.currentTarget.dataset.key
    const question = this.data.question

    if (!question) return

    let selected = this.data.selected.slice()

    if (question.type === "multiple") {
      if (selected.includes(key)) {
        selected = selected.filter(item => item !== key)
      } else {
        selected.push(key)
      }
    } else {
      selected = [key]
    }

    this.setData({
      selected
    })

    this.refreshOptions()
  },

  onSubmit() {
    if (this.data.recycleView) {
      wx.showToast({
        title: "回收站查看模式不记录答题",
        icon: "none"
      })
      return
    }

    const question = this.data.question

    if (!question) {
      wx.showToast({
        title: "题目不存在",
        icon: "none"
      })
      return
    }

    if (this.data.selected.length === 0) {
      wx.showToast({
        title: "请先选择答案",
        icon: "none"
      })
      return
    }

    const selected = this.data.selected
    const submitResult = recordStore.submitAnswer(question, selected, this.data.mode)

    const result = {
      isCorrect: submitResult.isCorrect,
      userAnswerText: recordStore.formatAnswer(selected),
      correctAnswerText: recordStore.formatAnswer(question.answer),
      previousAnswerText: recordStore.formatAnswer(submitResult.previousUserAnswer)
    }

    this.setData({
      submitted: true,
      result,
      isFavorite: recordStore.isFavorite(question.id),
      canRemoveWrong: this.data.mode === "wrong" && recordStore.isWrong(question.id)
    })

    this.refreshOptions()
    this.buildAnswerCardList()
  },

  onToggleFavorite() {
    const question = this.data.question

    if (!question) return

    const isFavorite = recordStore.toggleFavorite(question)

    this.setData({
      isFavorite
    })

    if (this.data.mode === "favorite" && !isFavorite && !this.data.recycleView) {
      wx.showToast({
        title: "已取消收藏",
        icon: "success"
      })

      setTimeout(() => {
        this.removeCurrentFromQueue("")
      }, 400)

      return
    }

    this.buildAnswerCardList()
  },

  goPrev() {
    if (this.data.recycleView) {
      wx.showToast({
        title: "回收站查看模式无上一题",
        icon: "none"
      })
      return
    }

    if (this.data.currentIndex <= 0) {
      wx.showToast({
        title: "已经是第一题",
        icon: "none"
      })
      return
    }

    this.setData({
      currentIndex: this.data.currentIndex - 1
    })

    this.loadCurrentQuestion()
  },

  goNext() {
    if (this.data.recycleView) {
      wx.showToast({
        title: "回收站查看模式无下一题",
        icon: "none"
      })
      return
    }

    if (this.data.currentIndex >= this.data.queue.length - 1) {
      wx.showToast({
        title: "已经是最后一题",
        icon: "none"
      })
      return
    }

    this.setData({
      currentIndex: this.data.currentIndex + 1
    })

    this.loadCurrentQuestion()
  },

  onNoteInput(e) {
    this.setData({
      noteInput: e.detail.value
    })
  },

  onSaveNote() {
    const question = this.data.question

    if (!question) return

    recordStore.saveNote(question.id, this.data.noteInput)

    this.setData({
      noteSaveText: "已保存",
      noteSaved: true
    })

    if (this.noteSaveTimer) {
      clearTimeout(this.noteSaveTimer)
    }

    this.noteSaveTimer = setTimeout(() => {
      this.setData({
        noteSaveText: "保存备注",
        noteSaved: false
      })
    }, 2000)
  },

  onRemoveWrong() {
    const question = this.data.question

    if (!question) return

    wx.showModal({
      title: "确认移出错题？",
      content: "移出后，本题将不再显示在错题练习中，也不会计入错题统计。收藏和备注不会受到影响。",
      confirmText: "确认移出",
      confirmColor: "#b45309",
      success: res => {
        if (!res.confirm) return

        recordStore.removeWrong(question.id)

        wx.showToast({
          title: "已移出错题",
          icon: "success"
        })

        if (this.data.mode === "wrong") {
          setTimeout(() => {
            this.removeCurrentFromQueue("")
          }, 400)
        } else {
          this.setData({
            canRemoveWrong: false
          })

          this.buildAnswerCardList()
        }
      }
    })
  },

  onDeleteQuestion() {
    const question = this.data.question

    if (!question) return

    wx.showModal({
      title: "确认删除题目？",
      content: "删除后，本题将进入题库回收站。顺序练习和错题练习中将不再显示；如果本题已收藏，收藏题目中仍可查看。",
      confirmText: "确认删除",
      confirmColor: "#d93025",
      success: res => {
        if (!res.confirm) return

        recordStore.moveQuestionToRecycle(question)

        wx.showToast({
          title: "已进入回收站",
          icon: "success"
        })

        setTimeout(() => {
          this.removeCurrentFromQueue("")
        }, 400)
      }
    })
  },

  openAnswerCard() {
    this.buildAnswerCardList()

    this.setData({
      showAnswerCard: true
    })
  },

  closeAnswerCard() {
    this.setData({
      showAnswerCard: false
    })
  },

  setAnswerCardFilter(e) {
    const filter = e.currentTarget.dataset.filter || "all"

    this.setData({
      answerCardFilter: filter
    })

    this.buildAnswerCardList()
  },

  jumpToQuestion(e) {
    const index = Number(e.currentTarget.dataset.index)

    this.setData({
      currentIndex: index,
      showAnswerCard: false
    })

    this.loadCurrentQuestion()
  },

  noop() {}
})