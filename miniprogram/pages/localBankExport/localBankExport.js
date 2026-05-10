const webdavStore = require("../../utils/webdavStore")
const webdavClient = require("../../utils/webdavClient")
const localBankStore = require("../../utils/localBankStore")
const recordStore = require("../../utils/recordStore")
const subjectStore = require("../../utils/subjectStore")
const bankPackageExportStore = require("../../utils/bankPackageExportStore")
const importValidator = require("../../utils/importValidator")

Page({
  data: {
    config: webdavStore.getDefaultConfig(),
    defaultBackupDir: webdavStore.DEFAULT_BACKUP_DIR,

    passwordHidden: true,
    passwordMasked: "",
    configComplete: false,
    statusText: "",

    backupFileName: "",
    restoreFileName: "",
    restoreRecords: true,
    overwriteRecords: false
  },

  onShow() {
    this.loadConfig()
  },

  loadConfig() {
    const config = webdavStore.getConfig()

    this.setData({
      config,
      defaultBackupDir: webdavStore.DEFAULT_BACKUP_DIR,
      passwordMasked: webdavStore.maskPassword(config.password),
      configComplete: webdavStore.hasConfig()
    })
  },

  refreshStatus() {
    const config = this.data.config
    const configComplete = !!(
      config.serverUrl &&
      config.username &&
      config.password &&
      webdavStore.DEFAULT_BACKUP_DIR
    )

    this.setData({
      passwordMasked: webdavStore.maskPassword(config.password),
      configComplete
    })
  },

  onEnabledChange(e) {
    this.setData({
      config: {
        ...this.data.config,
        enabled: e.detail.value,
        backupDir: webdavStore.DEFAULT_BACKUP_DIR
      }
    })

    this.refreshStatus()
  },

  onServerUrlInput(e) {
    this.setData({
      config: {
        ...this.data.config,
        serverUrl: e.detail.value,
        backupDir: webdavStore.DEFAULT_BACKUP_DIR
      }
    })

    this.refreshStatus()
  },

  onUsernameInput(e) {
    this.setData({
      config: {
        ...this.data.config,
        username: e.detail.value,
        backupDir: webdavStore.DEFAULT_BACKUP_DIR
      }
    })

    this.refreshStatus()
  },

  onPasswordInput(e) {
    this.setData({
      config: {
        ...this.data.config,
        password: e.detail.value,
        backupDir: webdavStore.DEFAULT_BACKUP_DIR
      }
    })

    this.refreshStatus()
  },

  onBackupFileNameInput(e) {
    this.setData({
      backupFileName: e.detail.value
    })
  },

  onRestoreFileNameInput(e) {
    this.setData({
      restoreFileName: e.detail.value
    })
  },

  onRestoreRecordsChange(e) {
    this.setData({
      restoreRecords: e.detail.value
    })
  },

  onOverwriteRecordsChange(e) {
    this.setData({
      overwriteRecords: e.detail.value
    })
  },

  togglePassword() {
    this.setData({
      passwordHidden: !this.data.passwordHidden
    })
  },

  saveConfig() {
    const config = {
      ...this.data.config,
      backupDir: webdavStore.DEFAULT_BACKUP_DIR
    }

    if (!config.serverUrl.trim()) {
      wx.showToast({
        title: "请填写 WebDAV 地址",
        icon: "none"
      })
      return
    }

    if (!config.username.trim()) {
      wx.showToast({
        title: "请填写用户名",
        icon: "none"
      })
      return
    }

    if (!config.password) {
      wx.showToast({
        title: "请填写密码",
        icon: "none"
      })
      return
    }

    const savedConfig = webdavStore.saveConfig(config)

    this.setData({
      config: savedConfig,
      statusText: "配置已保存"
    })

    this.refreshStatus()

    wx.showToast({
      title: "已保存",
      icon: "success"
    })
  },

  clearConfig() {
    wx.showModal({
      title: "确认清除配置？",
      content: "清除后，本机保存的 WebDAV 地址、用户名和密码都会被删除。默认备份目录仍为 /quiz-bank-backup/。",
      confirmText: "确认清除",
      confirmColor: "#d93025",
      success: res => {
        if (!res.confirm) return

        webdavStore.clearConfig()

        this.setData({
          config: webdavStore.getDefaultConfig(),
          passwordHidden: true,
          passwordMasked: "",
          configComplete: false,
          statusText: "配置已清除"
        })

        wx.showToast({
          title: "已清除",
          icon: "success"
        })
      }
    })
  },

  checkConfigBeforeRequest() {
    const config = this.data.config

    if (!config.enabled) {
      wx.showToast({
        title: "请先启用 WebDAV",
        icon: "none"
      })
      return false
    }

    if (!this.data.configComplete) {
      wx.showToast({
        title: "请先填写完整配置",
        icon: "none"
      })
      return false
    }

    return true
  },

  async testConnection() {
    if (!this.checkConfigBeforeRequest()) return

    this.setData({
      statusText: "正在测试 WebDAV 连接..."
    })

    wx.showLoading({
      title: "测试中..."
    })

    try {
      const result = await webdavClient.testConnection({
        ...this.data.config,
        backupDir: webdavStore.DEFAULT_BACKUP_DIR
      })

      wx.hideLoading()

      this.setData({
        statusText: result.message
      })

      wx.showToast({
        title: result.ok ? "连接成功" : "连接失败",
        icon: result.ok ? "success" : "none"
      })
    } catch (err) {
      wx.hideLoading()

      const message = err.errMsg || err.message || String(err)

      this.setData({
        statusText: `连接失败：${message}`
      })

      wx.showToast({
        title: "连接失败",
        icon: "none"
      })
    }
  },

  async backupAllBanks() {
    if (!this.checkConfigBeforeRequest()) return

    const localBanks = localBankStore.getLocalBankIndex()

    if (localBanks.length === 0) {
      wx.showToast({
        title: "暂无本地题库",
        icon: "none"
      })
      return
    }

    const inputName = this.data.backupFileName.trim()
    const finalFileName = inputName
      ? webdavStore.normalizeBackupFileName(inputName)
      : bankPackageExportStore.getBackupFileName()

    wx.showModal({
      title: "备份全部本地题库？",
      content: `将备份到 ${webdavStore.DEFAULT_BACKUP_DIR}${finalFileName}。备份包含题目、答题记录、错题、收藏、备注和练习进度。`,
      confirmText: "开始备份",
      confirmColor: "#2f7cf6",
      success: async res => {
        if (!res.confirm) return

        await this.doBackupAllBanks(finalFileName)
      }
    })
  },

  async doBackupAllBanks(fileName) {
    this.setData({
      statusText: "正在生成完整题库备份包..."
    })

    wx.showLoading({
      title: "备份中..."
    })

    try {
      const buildResult = bankPackageExportStore.buildMergedPackageFromAllLocalBanks({
        bankName: "WebDAV完整备份",
        description: "由本机全部本地题库包合并生成，包含题库和学习记录。",
        sourceType: "webdav_full_backup"
      })

      const text = JSON.stringify(buildResult.package, null, 2)

      this.setData({
        statusText: "正在上传到 WebDAV..."
      })

      const uploadResult = await webdavClient.uploadTextFile(
        {
          ...this.data.config,
          backupDir: webdavStore.DEFAULT_BACKUP_DIR
        },
        fileName,
        text
      )

      wx.hideLoading()

      if (!uploadResult.ok) {
        this.setData({
          statusText: uploadResult.message
        })

        wx.showToast({
          title: "备份失败",
          icon: "none"
        })

        return
      }

      const warningText = buildResult.warnings.length > 0
        ? `\n警告：${buildResult.warnings.join("；")}`
        : ""

      this.setData({
        statusText: `备份成功：${webdavStore.DEFAULT_BACKUP_DIR}${fileName}${warningText}`
      })

      wx.showToast({
        title: "备份成功",
        icon: "success"
      })
    } catch (err) {
      wx.hideLoading()

      const message = err.errMsg || err.message || String(err)

      this.setData({
        statusText: `备份失败：${message}`
      })

      wx.showToast({
        title: "备份失败",
        icon: "none"
      })
    }
  },

  restoreFromWebdav() {
    if (!this.checkConfigBeforeRequest()) return

    const inputName = this.data.restoreFileName.trim()
    const fileName = webdavStore.normalizeBackupFileName(inputName)

    if (!fileName) {
      wx.showToast({
        title: "请填写备份文件名",
        icon: "none"
      })
      return
    }

    wx.showModal({
      title: "确认恢复题库？",
      content: this.data.restoreRecords
        ? `将从 ${webdavStore.DEFAULT_BACKUP_DIR}${fileName} 下载题库包并导入本地，同时恢复 records 学习记录。`
        : `将从 ${webdavStore.DEFAULT_BACKUP_DIR}${fileName} 下载题库包并导入本地，但不恢复 records 学习记录。`,
      confirmText: "开始恢复",
      confirmColor: "#b45309",
      success: async res => {
        if (!res.confirm) return

        await this.doRestoreFromWebdav(fileName)
      }
    })
  },

  async doRestoreFromWebdav(fileName) {
    this.setData({
      statusText: "正在从 WebDAV 下载备份文件..."
    })

    wx.showLoading({
      title: "恢复中..."
    })

    try {
      const downloadResult = await webdavClient.downloadTextFile(
        {
          ...this.data.config,
          backupDir: webdavStore.DEFAULT_BACKUP_DIR
        },
        fileName
      )

      if (!downloadResult.ok) {
        wx.hideLoading()

        this.setData({
          statusText: downloadResult.message
        })

        wx.showToast({
          title: "下载失败",
          icon: "none"
        })

        return
      }

      const parseResult = importValidator.parseBankPackageText(downloadResult.text)

      if (!parseResult.ok) {
        wx.hideLoading()

        this.setData({
          statusText: parseResult.message
        })

        wx.showToast({
          title: "JSON无效",
          icon: "none"
        })

        return
      }

      const validateResult = importValidator.validateBankPackage(parseResult.package)

      if (!validateResult.ok) {
        wx.hideLoading()

        this.setData({
          statusText: `题库格式校验失败：${validateResult.errors.join("；")}`
        })

        wx.showToast({
          title: "格式错误",
          icon: "none"
        })

        return
      }

      const saveResult = localBankStore.saveBankPackage(parseResult.package)

      if (!saveResult.ok) {
        wx.hideLoading()

        this.setData({
          statusText: `保存题库失败：${saveResult.message}`
        })

        wx.showToast({
          title: "保存失败",
          icon: "none"
        })

        return
      }

      if (this.data.restoreRecords && parseResult.package.records) {
        const mode = this.data.overwriteRecords ? "overwrite" : "merge"
        recordStore.importPackageRecords(parseResult.package.records, mode)
      }

      subjectStore.resetSubjectConfig()

      wx.hideLoading()

      const warningText = validateResult.warnings.length > 0
        ? `\n警告：${validateResult.warnings.join("；")}`
        : ""

      this.setData({
        statusText: `恢复成功：${parseResult.package.bankInfo.bankName}${warningText}`
      })

      wx.showToast({
        title: "恢复成功",
        icon: "success"
      })
    } catch (err) {
      wx.hideLoading()

      const message = err.errMsg || err.message || String(err)

      this.setData({
        statusText: `恢复失败：${message}`
      })

      wx.showToast({
        title: "恢复失败",
        icon: "none"
      })
    }
  }
})