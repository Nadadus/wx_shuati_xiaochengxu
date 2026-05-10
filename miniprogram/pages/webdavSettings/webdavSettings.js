const webdavStore = require("../../utils/webdavStore")
const webdavClient = require("../../utils/webdavClient")
const localBankStore = require("../../utils/localBankStore")
const recordStore = require("../../utils/recordStore")
const subjectStore = require("../../utils/subjectStore")
const bankPackageExportStore = require("../../utils/bankPackageExportStore")
const importValidator = require("../../utils/importValidator")
const webdavBackupService = require("../../utils/webdavBackupService")

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
    restoreDisplayText: "未选择，暂无上一次备份文件",
    restoreRecords: true,
    overwriteRecords: false,

    backupFilePickerVisible: false,
    backupFileList: []
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
      configComplete: webdavStore.hasConfig(),
      restoreDisplayText: this.buildRestoreDisplayText(this.data.restoreFileName, config)
    })
  },

  buildRestoreDisplayText(fileName, config) {
    if (fileName) {
      return fileName
    }

    const safeConfig = config || this.data.config

    if (safeConfig && safeConfig.lastBackupFileName) {
      return `未选择，默认恢复上次备份：${safeConfig.lastBackupFileName}`
    }

    return "未选择，暂无上一次备份文件"
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
      configComplete,
      restoreDisplayText: this.buildRestoreDisplayText(this.data.restoreFileName, config)
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

  onAutoBackupEnabledChange(e) {
    this.setData({
      config: {
        ...this.data.config,
        autoBackupEnabled: e.detail.value,
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
      statusText: savedConfig.autoBackupEnabled
        ? "配置已保存，自动备份已开启。小程序下次启动时会检查是否需要自动备份。"
        : "配置已保存",
      restoreDisplayText: this.buildRestoreDisplayText(this.data.restoreFileName, savedConfig)
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

        const defaultConfig = webdavStore.getDefaultConfig()

        this.setData({
          config: defaultConfig,
          passwordHidden: true,
          passwordMasked: "",
          configComplete: false,
          statusText: "配置已清除",
          restoreFileName: "",
          restoreDisplayText: this.buildRestoreDisplayText("", defaultConfig),
          backupFileList: [],
          backupFilePickerVisible: false
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

  backupAllBanks() {
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
      title: "手动备份全部本地题库？",
      content: `将备份到 ${webdavStore.DEFAULT_BACKUP_DIR}${finalFileName}。备份内容包含题库本体、答题记录、错题记录、收藏记录、备注记录、顺序练习进度、错题练习进度和收藏夹练习进度。`,
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
      const result = await webdavBackupService.backupAllLocalBanks({
        config: {
          ...this.data.config,
          backupDir: webdavStore.DEFAULT_BACKUP_DIR
        },
        fileName,
        isAuto: false
      })

      wx.hideLoading()

      if (!result.ok) {
        this.setData({
          statusText: result.message
        })

        wx.showToast({
          title: "备份失败",
          icon: "none"
        })

        return
      }

      const warningText = result.warnings && result.warnings.length > 0
        ? `\n警告：${result.warnings.join("；")}`
        : ""

      this.loadConfig()

      this.setData({
        statusText: `手动备份成功：${result.path}${warningText}`
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

  async openBackupFilePicker() {
    if (!this.checkConfigBeforeRequest()) return

    this.setData({
      statusText: "正在读取 WebDAV 备份文件列表..."
    })

    wx.showLoading({
      title: "读取中..."
    })

    try {
      const result = await webdavClient.listJsonFiles({
        ...this.data.config,
        backupDir: webdavStore.DEFAULT_BACKUP_DIR
      })

      wx.hideLoading()

      if (!result.ok) {
        this.setData({
          statusText: result.message,
          backupFilePickerVisible: true,
          backupFileList: []
        })

        wx.showToast({
          title: "读取失败",
          icon: "none"
        })

        return
      }

      const backupFileList = result.files.map(item => ({
        ...item,
        lastModifiedText: this.formatLastModified(item.lastModified),
        sizeText: this.formatFileSize(item.size)
      }))

      this.setData({
        statusText: `读取成功，共 ${backupFileList.length} 个 JSON 备份文件`,
        backupFilePickerVisible: true,
        backupFileList
      })
    } catch (err) {
      wx.hideLoading()

      const message = err.errMsg || err.message || String(err)

      this.setData({
        statusText: `读取失败：${message}`,
        backupFilePickerVisible: true,
        backupFileList: []
      })

      wx.showToast({
        title: "读取失败",
        icon: "none"
      })
    }
  },

  closeBackupFilePicker() {
    this.setData({
      backupFilePickerVisible: false
    })
  },

  selectBackupFile(e) {
    const fileName = e.currentTarget.dataset.name

    if (!fileName) return

    this.setData({
      restoreFileName: fileName,
      restoreDisplayText: fileName,
      backupFilePickerVisible: false,
      statusText: `已选择备份文件：${fileName}`
    })

    wx.showToast({
      title: "已选择",
      icon: "success"
    })
  },

  useLastBackup() {
    this.setData({
      restoreFileName: "",
      restoreDisplayText: this.buildRestoreDisplayText("", this.data.config),
      backupFilePickerVisible: false,
      statusText: "已设置为默认恢复上一次备份内容"
    })
  },

  formatFileSize(size) {
    const n = Number(size || 0)

    if (n <= 0) {
      return "-"
    }

    if (n < 1024) {
      return `${n} B`
    }

    if (n < 1024 * 1024) {
      return `${Math.round(n / 1024)} KB`
    }

    return `${(n / 1024 / 1024).toFixed(1)} MB`
  },

  formatLastModified(timeText) {
    if (!timeText) {
      return "时间未知"
    }

    const date = new Date(timeText)

    if (Number.isNaN(date.getTime())) {
      return "时间未知"
    }

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    const h = String(date.getHours()).padStart(2, "0")
    const min = String(date.getMinutes()).padStart(2, "0")

    return `${y}-${m}-${d} ${h}:${min}`
  },

  restoreFromWebdav() {
    if (!this.checkConfigBeforeRequest()) return

    const fileName = this.data.restoreFileName
      ? webdavStore.normalizeBackupFileName(this.data.restoreFileName)
      : this.data.config.lastBackupFileName

    if (!fileName) {
      wx.showToast({
        title: "没有可恢复的上次备份",
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
  },

  noop() {}
})