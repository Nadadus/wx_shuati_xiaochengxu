const localBankStore = require("../../utils/localBankStore")
const recordStore = require("../../utils/recordStore")
const subjectStore = require("../../utils/subjectStore")
const importValidator = require("../../utils/importValidator")
const {
  getBankPackageTemplateText,
  getBankPackageGuideText,
  getAiGenerationPromptText
} = require("../../data/bankPackageTemplate")

function countMap(map) {
  if (!map || typeof map !== "object") {
    return 0
  }

  return Object.keys(map).length
}

function getUniqueCount(list, keyBuilder) {
  const set = {}

  list.forEach(item => {
    const key = keyBuilder(item)

    if (key) {
      set[key] = true
    }
  })

  return Object.keys(set).length
}

function getTimestampText() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const h = String(now.getHours()).padStart(2, "0")
  const min = String(now.getMinutes()).padStart(2, "0")
  const s = String(now.getSeconds()).padStart(2, "0")

  return `${y}${m}${d}_${h}${min}${s}`
}

function cloneObject(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function buildImportPreview(bankPackage) {
  const bankInfo = bankPackage.bankInfo || {}
  const subjects = Array.isArray(bankPackage.subjects) ? bankPackage.subjects : []
  const chapters = Array.isArray(bankPackage.chapters) ? bankPackage.chapters : []
  const questions = Array.isArray(bankPackage.questions) ? bankPackage.questions : []
  const records = bankPackage.records || {}

  const subjectCount = subjects.length > 0
    ? subjects.length
    : getUniqueCount(questions, item => {
      if (item.subjectId === undefined || item.subjectId === null) return ""
      return String(item.subjectId)
    })

  const chapterCount = chapters.length > 0
    ? chapters.length
    : getUniqueCount(questions, item => {
      if (item.subjectId === undefined || item.subjectId === null) return ""
      if (item.chapterId === undefined || item.chapterId === null) return ""
      return `${item.subjectId}_${item.chapterId}`
    })

  return {
    bankId: bankInfo.bankId || "",
    bankName: bankInfo.bankName || "未命名题库",

    subjectCount,
    chapterCount,
    questionCount: questions.length,

    singleCount: questions.filter(item => (item.type || "single") === "single").length,
    multipleCount: questions.filter(item => item.type === "multiple").length,
    judgeCount: questions.filter(item => item.type === "judge").length,

    answerCount: countMap(records.answers),
    wrongCount: countMap(records.wrong),
    favoriteCount: countMap(records.favorites),
    noteCount: countMap(records.notes),
    sequenceProgressCount: countMap(records.sequenceProgress),
    wrongProgressCount: countMap(records.wrongProgress),
    favoriteProgressCount: countMap(records.favoriteProgress)
  }
}

function buildNewBankPackageFromConflict(bankPackage) {
  const newPackage = cloneObject(bankPackage)
  const oldBankInfo = newPackage.bankInfo || {}
  const timestamp = getTimestampText()

  newPackage.bankInfo = {
    ...oldBankInfo,
    bankId: `${oldBankInfo.bankId || "bank"}_${timestamp}`,
    bankName: `${oldBankInfo.bankName || "未命名题库"}（副本）`,
    sourceType: oldBankInfo.sourceType || "local_import_copy",
    updateTime: new Date().toISOString()
  }

  return newPackage
}

Page({
  data: {
    importRecords: true,

    pendingPackage: null,
    pendingSourceType: "",
    previewVisible: false,
    preview: {},
    conflictExists: false,

    resultVisible: false,
    result: {
      ok: false,
      message: "",
      bankName: "",
      bankId: "",
      questionCount: null
    },
    warnings: [],
    errors: [],
    showHelp: false
  },

  onImportRecordsChange(e) {
    this.setData({
      importRecords: e.detail.value
    })
  },

  importFromClipboard() {
    wx.getClipboardData({
      success: res => {
        const text = res.data || ""

        if (!text.trim()) {
          wx.showToast({
            title: "剪贴板为空",
            icon: "none"
          })
          return
        }

        this.parseImportText(text, "clipboard")
      },
      fail: err => {
        wx.showToast({
          title: err.errMsg || "读取剪贴板失败",
          icon: "none"
        })
      }
    })
  },

  importFromFile() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["json"],
      success: res => {
        const file = res.tempFiles && res.tempFiles[0]

        if (!file || !file.path) {
          wx.showToast({
            title: "未选择文件",
            icon: "none"
          })
          return
        }

        this.readJsonFile(file.path)
      },
      fail: err => {
        wx.showToast({
          title: err.errMsg || "选择文件失败",
          icon: "none"
        })
      }
    })
  },

  readJsonFile(filePath) {
    const fs = wx.getFileSystemManager()

    try {
      const text = fs.readFileSync(filePath, "utf8")
      this.parseImportText(text, "file")
    } catch (err) {
      this.setImportResult({
        ok: false,
        message: `读取 JSON 文件失败：${err.message || err}`,
        errors: [err.message || String(err)],
        warnings: []
      })
    }
  },

  parseImportText(text, sourceType) {
    wx.showLoading({
      title: "正在解析..."
    })

    const parseResult = importValidator.parseBankPackageText(text)

    if (!parseResult.ok) {
      wx.hideLoading()

      this.setImportResult({
        ok: false,
        message: parseResult.message || "JSON 解析失败",
        errors: [parseResult.message || "JSON 解析失败"],
        warnings: []
      })
      return
    }

    const bankPackage = parseResult.package
    const validateResult = importValidator.validateBankPackage(bankPackage)

    wx.hideLoading()

    if (!validateResult.ok) {
      this.setImportResult({
        ok: false,
        message: "题库格式校验失败",
        errors: validateResult.errors || [],
        warnings: validateResult.warnings || []
      })
      return
    }

    const bankId = bankPackage.bankInfo && bankPackage.bankInfo.bankId
      ? bankPackage.bankInfo.bankId
      : ""

    const conflictExists = !!localBankStore.getLocalBankPackageById(bankId)

    this.setData({
      pendingPackage: bankPackage,
      pendingSourceType: sourceType,
      previewVisible: true,
      resultVisible: false,
      preview: buildImportPreview(bankPackage),
      conflictExists,
      warnings: validateResult.warnings || [],
      errors: []
    })
  },

  confirmImport(e) {
    const mode = e.currentTarget.dataset.mode || "overwrite"
    const pendingPackage = this.data.pendingPackage

    if (!pendingPackage) {
      wx.showToast({
        title: "没有待导入题库",
        icon: "none"
      })
      return
    }

    const finalPackage = mode === "new"
      ? buildNewBankPackageFromConflict(pendingPackage)
      : pendingPackage

    wx.showModal({
      title: mode === "new" ? "另存为新题库？" : "确认导入题库？",
      content: mode === "new"
        ? `将另存为新题库：${finalPackage.bankInfo.bankName}。`
        : `将导入题库：${finalPackage.bankInfo.bankName}。如果本地已有相同 bankId，会覆盖原题库包。`,
      confirmText: "确认导入",
      confirmColor: "#2f7cf6",
      success: res => {
        if (!res.confirm) return

        this.saveParsedPackage(finalPackage, mode)
      }
    })
  },

  saveParsedPackage(bankPackage, mode) {
    wx.showLoading({
      title: "正在导入..."
    })

    const saveResult = localBankStore.saveBankPackage(bankPackage)

    wx.hideLoading()

    if (!saveResult.ok) {
      this.setImportResult({
        ok: false,
        message: saveResult.message || "导入失败",
        errors: saveResult.errors || [],
        warnings: saveResult.warnings || []
      })
      return
    }

    if (this.data.importRecords && bankPackage.records) {
      recordStore.importPackageRecords(bankPackage.records, "merge")
    }

    subjectStore.resetSubjectConfig()

    this.setImportResult({
      ok: true,
      message: mode === "new" ? "已另存为新题库" : "题库导入成功",
      bankName: bankPackage.bankInfo.bankName,
      bankId: bankPackage.bankInfo.bankId,
      questionCount: Array.isArray(bankPackage.questions)
        ? bankPackage.questions.length
        : 0,
      errors: [],
      warnings: saveResult.warnings || []
    })

    this.setData({
      pendingPackage: null,
      pendingSourceType: "",
      previewVisible: false,
      preview: {},
      conflictExists: false
    })

    wx.showToast({
      title: "导入成功",
      icon: "success"
    })
  },

  cancelPreview() {
    this.setData({
      pendingPackage: null,
      pendingSourceType: "",
      previewVisible: false,
      preview: {},
      conflictExists: false,
      warnings: [],
      errors: []
    })
  },

  setImportResult(payload) {
    this.setData({
      previewVisible: false,
      resultVisible: true,
      result: {
        ok: !!payload.ok,
        message: payload.message || "",
        bankName: payload.bankName || "",
        bankId: payload.bankId || "",
        questionCount: payload.questionCount === undefined
          ? null
          : payload.questionCount
      },
      errors: payload.errors || [],
      warnings: payload.warnings || []
    })
  },

  openHelp() {
    this.setData({
      showHelp: true
    })
  },

  closeHelp() {
    this.setData({
      showHelp: false
    })
  },

  copyTemplate() {
    wx.setClipboardData({
      data: getBankPackageTemplateText(),
      success: () => {
        wx.showToast({
          title: "模板已复制",
          icon: "success"
        })
      }
    })
  },

  copyGuide() {
    wx.setClipboardData({
      data: getBankPackageGuideText(),
      success: () => {
        wx.showToast({
          title: "字段说明已复制",
          icon: "success"
        })
      }
    })
  },

  copyAiPrompt() {
    wx.setClipboardData({
      data: getAiGenerationPromptText(),
      success: () => {
        wx.showToast({
          title: "AI规范已复制",
          icon: "success"
        })
      }
    })
  },

  noop() {}
})