const webdavStore = require("./webdavStore")
const webdavClient = require("./webdavClient")
const localBankStore = require("./localBankStore")
const bankPackageExportStore = require("./bankPackageExportStore")

function checkConfigComplete(config) {
  return !!(
    config &&
    config.enabled &&
    config.serverUrl &&
    config.username &&
    config.password &&
    config.backupDir
  )
}

function getAutoBackupFileName() {
  const baseName = bankPackageExportStore.getBackupFileName()
  return baseName.replace("quiz_full_backup_", "quiz_auto_backup_")
}

async function backupAllLocalBanks(options) {
  const safeOptions = options || {}
  const config = safeOptions.config || webdavStore.getConfig()

  if (!checkConfigComplete(config)) {
    return {
      ok: false,
      skipped: true,
      message: "WebDAV 配置不完整或未启用"
    }
  }

  const localBanks = localBankStore.getLocalBankIndex()

  if (localBanks.length === 0) {
    return {
      ok: false,
      skipped: true,
      message: "暂无本地题库，无法备份"
    }
  }

  const fileName = safeOptions.fileName ||
    (safeOptions.isAuto ? getAutoBackupFileName() : bankPackageExportStore.getBackupFileName())

  const buildResult = bankPackageExportStore.buildMergedPackageFromAllLocalBanks({
    bankName: safeOptions.isAuto ? "WebDAV自动备份" : "WebDAV手动备份",
    description: "由本机全部本地题库包合并生成，包含题库和学习记录。",
    sourceType: safeOptions.isAuto ? "webdav_auto_backup" : "webdav_manual_backup"
  })

  const text = JSON.stringify(buildResult.package, null, 2)

  const uploadResult = await webdavClient.uploadTextFile(
    {
      ...config,
      backupDir: webdavStore.DEFAULT_BACKUP_DIR
    },
    fileName,
    text
  )

  if (!uploadResult.ok) {
    return uploadResult
  }

  webdavStore.markBackupSuccess(fileName, !!safeOptions.isAuto)

  return {
    ok: true,
    message: "备份成功",
    fileName,
    path: `${webdavStore.DEFAULT_BACKUP_DIR}${fileName}`,
    warnings: buildResult.warnings || []
  }
}

async function runAutoBackupIfNeeded() {
  const config = webdavStore.getConfig()

  if (!webdavStore.isAutoBackupDue(config)) {
    return {
      ok: false,
      skipped: true,
      message: "无需自动备份"
    }
  }

  return await backupAllLocalBanks({
    config,
    isAuto: true
  })
}

module.exports = {
  backupAllLocalBanks,
  runAutoBackupIfNeeded
}