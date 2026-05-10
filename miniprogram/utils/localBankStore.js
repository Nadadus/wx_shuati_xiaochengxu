const appConfig = require("../config/appConfig")
const importValidator = require("./importValidator")

const KEY_LOCAL_BANK_INDEX = "quiz_local_bank_index"
const KEY_LOCAL_BANK_PACKAGE_PREFIX = "quiz_local_bank_package_"

function getFs() {
  return wx.getFileSystemManager()
}

function getBankDirPath() {
  return `${wx.env.USER_DATA_PATH}/${appConfig.localBankDirName}`
}

function getBankFilePath(bankId) {
  return `${getBankDirPath()}/${bankId}.json`
}

function getPackageStorageKey(bankId) {
  return `${KEY_LOCAL_BANK_PACKAGE_PREFIX}${bankId}`
}

function ensureBankDir() {
  const fs = getFs()
  const dirPath = getBankDirPath()

  try {
    fs.accessSync(dirPath)
  } catch (err) {
    try {
      fs.mkdirSync(dirPath, true)
    } catch (mkdirErr) {
      try {
        fs.mkdirSync(dirPath)
      } catch (finalErr) {
        throw finalErr
      }
    }
  }
}

function getLocalBankIndex() {
  const index = wx.getStorageSync(KEY_LOCAL_BANK_INDEX)

  if (!Array.isArray(index)) {
    return []
  }

  return index
}

function saveLocalBankIndex(index) {
  wx.setStorageSync(KEY_LOCAL_BANK_INDEX, index)
}

function readBankPackageByFilePath(filePath) {
  if (!filePath) return null

  const fs = getFs()

  try {
    const text = fs.readFileSync(filePath, "utf8")
    const parsed = JSON.parse(text)
    return importValidator.normalizeBankPackage(parsed)
  } catch (err) {
    return null
  }
}

function readBankPackageByStorageKey(storageKey) {
  if (!storageKey) return null

  try {
    const data = wx.getStorageSync(storageKey)

    if (!data) return null

    return importValidator.normalizeBankPackage(data)
  } catch (err) {
    return null
  }
}

function readBankPackageByIndexItem(item) {
  if (!item) return null

  if (item.saveType === "storage" && item.storageKey) {
    return readBankPackageByStorageKey(item.storageKey)
  }

  if (item.saveType === "file" && item.filePath) {
    return readBankPackageByFilePath(item.filePath)
  }

  // 兼容旧版本索引：旧版本只有 filePath
  if (item.filePath) {
    return readBankPackageByFilePath(item.filePath)
  }

  if (item.storageKey) {
    return readBankPackageByStorageKey(item.storageKey)
  }

  return null
}

function getAllLocalBankPackages() {
  const index = getLocalBankIndex()

  return index
    .map(item => readBankPackageByIndexItem(item))
    .filter(Boolean)
}

function getLocalBankPackageById(bankId) {
  const index = getLocalBankIndex()
  const item = index.find(bank => bank.bankId === bankId)

  return readBankPackageByIndexItem(item)
}

function buildBankIndexItem(bankPackage, saveInfo) {
  const questions = Array.isArray(bankPackage.questions)
    ? bankPackage.questions
    : []

  const subjectIds = Array.from(new Set(
    questions
      .map(item => item.subjectId)
      .filter(item => item !== undefined && item !== null)
  ))

  return {
    bankId: bankPackage.bankInfo.bankId,
    bankName: bankPackage.bankInfo.bankName,
    description: bankPackage.bankInfo.description || "",
    sourceType: bankPackage.bankInfo.sourceType || "manual_json",

    saveType: saveInfo.saveType,
    filePath: saveInfo.filePath || "",
    storageKey: saveInfo.storageKey || "",

    questionCount: questions.length,
    subjectIds,
    createTime: bankPackage.bankInfo.createTime,
    updateTime: bankPackage.bankInfo.updateTime
  }
}

function trySaveAsFile(normalizedPackage) {
  try {
    ensureBankDir()

    const fs = getFs()
    const bankId = normalizedPackage.bankInfo.bankId
    const filePath = getBankFilePath(bankId)

    fs.writeFileSync(
      filePath,
      JSON.stringify(normalizedPackage, null, 2),
      "utf8"
    )

    return {
      ok: true,
      saveType: "file",
      filePath,
      storageKey: ""
    }
  } catch (err) {
    return {
      ok: false,
      message: err.message || String(err)
    }
  }
}

function trySaveAsStorage(normalizedPackage) {
  try {
    const bankId = normalizedPackage.bankInfo.bankId
    const storageKey = getPackageStorageKey(bankId)

    wx.setStorageSync(storageKey, normalizedPackage)

    return {
      ok: true,
      saveType: "storage",
      filePath: "",
      storageKey
    }
  } catch (err) {
    return {
      ok: false,
      message: err.message || String(err)
    }
  }
}

function saveBankPackage(bankPackage) {
  const normalizedPackage = importValidator.normalizeBankPackage(bankPackage)
  const validateResult = importValidator.validateBankPackage(normalizedPackage)

  if (!validateResult.ok) {
    return {
      ok: false,
      message: "题库格式校验失败",
      errors: validateResult.errors,
      warnings: validateResult.warnings
    }
  }

  const warnings = validateResult.warnings || []

  let saveInfo = trySaveAsFile(normalizedPackage)

  if (!saveInfo.ok) {
    warnings.push(`本地文件保存失败：${saveInfo.message}`)
    warnings.push("系统已尝试改用本地缓存保存题库。")

    saveInfo = trySaveAsStorage(normalizedPackage)
  }

  if (!saveInfo.ok) {
    return {
      ok: false,
      message: `保存题库失败：${saveInfo.message}`,
      errors: [saveInfo.message],
      warnings
    }
  }

  const index = getLocalBankIndex()
  const newItem = buildBankIndexItem(normalizedPackage, saveInfo)
  const existIndex = index.findIndex(item => item.bankId === newItem.bankId)

  if (existIndex >= 0) {
    index[existIndex] = newItem
  } else {
    index.push(newItem)
  }

  saveLocalBankIndex(index)

  return {
    ok: true,
    message: saveInfo.saveType === "file"
      ? "题库已保存到本地文件"
      : "题库已保存到本地缓存",
    bank: newItem,
    package: normalizedPackage,
    warnings
  }
}

function saveBankPackageFromText(text) {
  const parseResult = importValidator.parseBankPackageText(text)

  if (!parseResult.ok) {
    return {
      ok: false,
      message: parseResult.message,
      errors: [parseResult.message],
      warnings: []
    }
  }

  return saveBankPackage(parseResult.package)
}

function deleteFileIfExists(filePath) {
  if (!filePath) return

  try {
    getFs().unlinkSync(filePath)
  } catch (err) {
    // 文件不存在或删除失败时忽略
  }
}

function deleteStorageIfExists(storageKey) {
  if (!storageKey) return

  try {
    wx.removeStorageSync(storageKey)
  } catch (err) {
    // 删除失败时忽略
  }
}

function deleteLocalBank(bankId) {
  const index = getLocalBankIndex()
  const item = index.find(bank => bank.bankId === bankId)

  if (item) {
    deleteFileIfExists(item.filePath)
    deleteStorageIfExists(item.storageKey)
  }

  const newIndex = index.filter(bank => bank.bankId !== bankId)
  saveLocalBankIndex(newIndex)

  return {
    ok: true
  }
}

function clearAllLocalBanks() {
  const index = getLocalBankIndex()

  index.forEach(item => {
    deleteFileIfExists(item.filePath)
    deleteStorageIfExists(item.storageKey)
  })

  saveLocalBankIndex([])

  return {
    ok: true
  }
}

function hasLocalBanks() {
  return getLocalBankIndex().length > 0
}

module.exports = {
  getLocalBankIndex,
  saveLocalBankIndex,
  getAllLocalBankPackages,
  getLocalBankPackageById,
  saveBankPackage,
  saveBankPackageFromText,
  deleteLocalBank,
  clearAllLocalBanks,
  hasLocalBanks
}