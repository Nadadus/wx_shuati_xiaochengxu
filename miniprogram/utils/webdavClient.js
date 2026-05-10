function base64Encode(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const str = unescape(encodeURIComponent(input))
  let output = ""
  let i = 0

  while (i < str.length) {
    const c1 = str.charCodeAt(i++)
    const c2 = str.charCodeAt(i++)
    const c3 = str.charCodeAt(i++)

    const e1 = c1 >> 2
    const e2 = ((c1 & 3) << 4) | (c2 >> 4)
    let e3 = ((c2 & 15) << 2) | (c3 >> 6)
    let e4 = c3 & 63

    if (Number.isNaN(c2)) {
      e3 = 64
      e4 = 64
    } else if (Number.isNaN(c3)) {
      e4 = 64
    }

    output += chars.charAt(e1)
    output += chars.charAt(e2)
    output += e3 === 64 ? "=" : chars.charAt(e3)
    output += e4 === 64 ? "=" : chars.charAt(e4)
  }

  return output
}

function normalizeBaseUrl(serverUrl) {
  const url = String(serverUrl || "").trim()

  if (!url) return ""

  return url.endsWith("/") ? url : `${url}/`
}

function normalizePath(path) {
  return String(path || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
}

function joinWebdavUrl(serverUrl, path) {
  const baseUrl = normalizeBaseUrl(serverUrl)
  const safePath = normalizePath(path)

  if (!safePath) {
    return baseUrl
  }

  return `${baseUrl}${safePath}`
}

function buildAuthHeader(config) {
  const token = base64Encode(`${config.username}:${config.password}`)

  return {
    Authorization: `Basic ${token}`
  }
}

function request(config, options) {
  return new Promise((resolve, reject) => {
    const headers = {
      ...buildAuthHeader(config),
      ...(options.header || {})
    }

    wx.request({
      url: options.url,
      method: options.method,
      data: options.data || "",
      header: headers,
      timeout: options.timeout || 15000,
      success: res => {
        resolve(res)
      },
      fail: err => {
        reject(err)
      }
    })
  })
}

function isSuccessStatus(statusCode) {
  return statusCode >= 200 && statusCode < 300
}

function safeDecodeURIComponent(text) {
  try {
    return decodeURIComponent(text)
  } catch (err) {
    return text
  }
}

function getFileNameFromHref(href) {
  const cleanHref = safeDecodeURIComponent(String(href || ""))
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "")

  const parts = cleanHref.split("/").filter(Boolean)

  if (parts.length === 0) {
    return ""
  }

  return parts[parts.length - 1]
}

function parseWebdavFileList(xmlText) {
  const text = String(xmlText || "")
  const responseRegex = /<[^>]*response[^>]*>([\s\S]*?)<\/[^>]*response>/gi
  const fileList = []

  let match

  while ((match = responseRegex.exec(text)) !== null) {
    const block = match[1]

    const hrefMatch = block.match(/<[^>]*href[^>]*>([\s\S]*?)<\/[^>]*href>/i)

    if (!hrefMatch) continue

    const href = hrefMatch[1].trim()
    const fileName = getFileNameFromHref(href)

    if (!fileName) continue
    if (!fileName.toLowerCase().endsWith(".json")) continue

    const lastModifiedMatch = block.match(/<[^>]*getlastmodified[^>]*>([\s\S]*?)<\/[^>]*getlastmodified>/i)
    const sizeMatch = block.match(/<[^>]*getcontentlength[^>]*>([\s\S]*?)<\/[^>]*getcontentlength>/i)

    fileList.push({
      fileName,
      href,
      lastModified: lastModifiedMatch ? lastModifiedMatch[1].trim() : "",
      size: sizeMatch ? Number(sizeMatch[1].trim()) || 0 : 0
    })
  }

  const uniqueMap = {}

  fileList.forEach(item => {
    uniqueMap[item.fileName] = item
  })

  return Object.values(uniqueMap).sort((a, b) => {
    const ta = new Date(a.lastModified).getTime()
    const tb = new Date(b.lastModified).getTime()

    if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
      return tb - ta
    }

    return a.fileName < b.fileName ? 1 : -1
  })
}

async function testConnection(config) {
  const url = joinWebdavUrl(config.serverUrl, config.backupDir || "")

  const res = await request(config, {
    url,
    method: "GET"
  })

  if (isSuccessStatus(res.statusCode)) {
    return {
      ok: true,
      message: "WebDAV 地址可访问"
    }
  }

  if (res.statusCode === 401 || res.statusCode === 403) {
    return {
      ok: false,
      message: "WebDAV 认证失败，请检查用户名、密码或应用密码"
    }
  }

  if (res.statusCode === 404) {
    return {
      ok: false,
      message: "WebDAV 地址或备份目录不存在"
    }
  }

  return {
    ok: false,
    message: `WebDAV 连接失败，HTTP 状态码：${res.statusCode}`
  }
}

async function uploadTextFile(config, fileName, text) {
  const dir = normalizePath(config.backupDir || "")
  const filePath = dir ? `${dir}/${fileName}` : fileName
  const url = joinWebdavUrl(config.serverUrl, filePath)

  const res = await request(config, {
    url,
    method: "PUT",
    data: text,
    header: {
      "Content-Type": "application/json;charset=utf-8"
    },
    timeout: 30000
  })

  if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
    return {
      ok: true,
      message: "上传成功",
      fileName,
      url
    }
  }

  return {
    ok: false,
    message: `上传失败，HTTP 状态码：${res.statusCode}`
  }
}

async function downloadTextFile(config, fileName) {
  const dir = normalizePath(config.backupDir || "")
  const safeFileName = normalizePath(fileName)

  if (!safeFileName) {
    return {
      ok: false,
      message: "缺少备份文件名"
    }
  }

  const filePath = dir ? `${dir}/${safeFileName}` : safeFileName
  const url = joinWebdavUrl(config.serverUrl, filePath)

  const res = await request(config, {
    url,
    method: "GET",
    timeout: 30000
  })

  if (!isSuccessStatus(res.statusCode)) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      return {
        ok: false,
        message: "下载失败：WebDAV 认证失败"
      }
    }

    if (res.statusCode === 404) {
      return {
        ok: false,
        message: "下载失败：备份文件不存在"
      }
    }

    return {
      ok: false,
      message: `下载失败，HTTP 状态码：${res.statusCode}`
    }
  }

  if (typeof res.data === "string") {
    return {
      ok: true,
      message: "下载成功",
      text: res.data,
      fileName: safeFileName
    }
  }

  return {
    ok: true,
    message: "下载成功",
    text: JSON.stringify(res.data),
    fileName: safeFileName
  }
}

async function listJsonFiles(config) {
  const url = joinWebdavUrl(config.serverUrl, config.backupDir || "")

  const res = await request(config, {
    url,
    method: "PROPFIND",
    data: `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:">
  <prop>
    <resourcetype/>
    <getlastmodified/>
    <getcontentlength/>
  </prop>
</propfind>`,
    header: {
      Depth: "1",
      "Content-Type": "application/xml;charset=utf-8"
    },
    timeout: 30000
  })

  if (res.statusCode === 207 || isSuccessStatus(res.statusCode)) {
    const fileList = parseWebdavFileList(res.data)

    return {
      ok: true,
      message: "读取备份文件列表成功",
      files: fileList
    }
  }

  if (res.statusCode === 401 || res.statusCode === 403) {
    return {
      ok: false,
      message: "读取失败：WebDAV 认证失败",
      files: []
    }
  }

  if (res.statusCode === 404) {
    return {
      ok: false,
      message: "读取失败：备份目录不存在",
      files: []
    }
  }

  return {
    ok: false,
    message: `读取失败，HTTP 状态码：${res.statusCode}`,
    files: []
  }
}

module.exports = {
  testConnection,
  uploadTextFile,
  downloadTextFile,
  listJsonFiles
}