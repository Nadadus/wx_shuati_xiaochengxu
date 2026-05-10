const bankPackageTemplate = {
  schemaVersion: "1.0.0",
  packageType: "quiz_bank_package",
  bankInfo: {
    bankId: "communication_exam_001",
    bankName: "通信类考试题库",
    description: "用于通信类考试刷题的本地题库示例",
    sourceType: "manual_json",
    createTime: "2026-05-08T00:00:00.000Z",
    updateTime: "2026-05-08T00:00:00.000Z"
  },
  subjects: [
    {
      subjectId: 3,
      subjectName: "通信原理",
      sortOrder: 1,
      enabled: true
    }
  ],
  chapters: [
    {
      subjectId: 3,
      chapterId: "01",
      chapterName: "通信系统基础",
      sortOrder: 1,
      enabled: true
    }
  ],
  questions: [
    {
      id: "3_01_001",
      subjectId: 3,
      chapterId: "01",
      questionNo: 1,
      type: "single",
      question: "通信系统的基本任务是（ ）。",
      options: [
        {
          key: "A",
          text: "产生噪声"
        },
        {
          key: "B",
          text: "传输信息"
        },
        {
          key: "C",
          text: "降低带宽"
        },
        {
          key: "D",
          text: "增加失真"
        }
      ],
      answer: ["B"],
      analysis: "通信系统的基本任务是在信源和信宿之间可靠、有效地传输信息。"
    },
    {
      id: "3_01_002",
      subjectId: 3,
      chapterId: "01",
      questionNo: 2,
      type: "multiple",
      question: "通信系统的主要性能指标包括（ ）。",
      options: [
        {
          key: "A",
          text: "有效性"
        },
        {
          key: "B",
          text: "可靠性"
        },
        {
          key: "C",
          text: "经济性"
        },
        {
          key: "D",
          text: "噪声越大越好"
        }
      ],
      answer: ["A", "B", "C"],
      analysis: "通信系统通常关注有效性、可靠性和经济性。"
    },
    {
      id: "3_01_003",
      subjectId: 3,
      chapterId: "01",
      questionNo: 3,
      type: "judge",
      question: "信道容量与信道带宽和信噪比有关。（ ）",
      options: [
        {
          key: "A",
          text: "正确"
        },
        {
          key: "B",
          text: "错误"
        }
      ],
      answer: ["A"],
      analysis: "根据香农公式，信道容量与带宽和信噪比有关。"
    }
  ],
  records: {
    answers: {},
    wrong: {},
    favorites: {},
    notes: {},
    sequenceProgress: {},
    wrongProgress: {},
    favoriteProgress: {},
    deleted: {},
    stats: {
      totalAnswered: 0,
      totalCorrect: 0,
      dailyStats: {}
    }
  }
}

const bankPackageGuideText = `题库 JSON 字段说明

一、总体结构
schemaVersion：题库包格式版本，例如 "1.0.0"
packageType：固定为 "quiz_bank_package"
bankInfo：题库基本信息
subjects：科目列表
chapters：章节列表
questions：题目本体
records：学习记录

二、bankInfo 字段
bankId：题库唯一编号，例如 "communication_exam_001"
bankName：题库名称，例如 "通信类考试题库"
description：题库说明
sourceType：题库来源，例如 "manual_json"
createTime：创建时间
updateTime：更新时间

三、subjects 科目字段
subjectId：科目编号
subjectName：科目名称
sortOrder：科目显示顺序，数字越小越靠前
enabled：是否启用，true 为启用，false 为停用

四、chapters 章节字段
subjectId：所属科目编号，需要与 subjects 中的 subjectId 对应
chapterId：章节编号，建议使用 "01"、"02" 这种格式
chapterName：章节名称
sortOrder：章节显示顺序，数字越小越靠前
enabled：是否启用，true 为启用，false 为停用

五、questions 题目字段
id：题目唯一编号，建议使用 subjectId_chapterId_questionNo，例如 "3_01_001"
subjectId：所属科目编号
chapterId：所属章节编号
questionNo：题目序号
type：题型
question：题干
options：选项数组
answer：答案数组，例如 ["A"] 或 ["A", "B"]
analysis：题目解析

六、type 题型说明
single：单选题
multiple：多选题
judge：判断题

七、options 选项格式
每个选项建议使用：
{
  "key": "A",
  "text": "选项内容"
}

八、records 学习记录说明
answers：答题记录
wrong：错题记录
favorites：收藏记录
notes：备注记录
sequenceProgress：顺序练习进度
wrongProgress：错题练习进度
favoriteProgress：收藏夹练习进度
deleted：回收站 / 删除标记
stats：学习统计

九、重要规则
1. questions 只保存题目本体。
2. records 保存题目对应的学习数据。
3. 备注、正确错误、收藏与否、错题记录、进度等数据都放在 records 中。
4. JSON 文件中不能写注释，否则可能导入失败。`

const aiGenerationPromptText = `请根据我提供的 PDF / 图片 / 文本资料，生成微信刷题小程序可导入的 quiz_bank_package JSON。

必须严格遵守以下要求：

一、输出格式要求
1. 最外层必须是一个 JSON 对象。
2. packageType 固定为 "quiz_bank_package"。
3. schemaVersion 使用 "1.0.0"。
4. 输出必须是纯 JSON。
5. 不要输出 Markdown。
6. 不要输出代码块标记。
7. 不要输出解释文字。
8. 不要在 JSON 中添加注释。

二、题库总体结构
必须包含以下字段：
{
  "schemaVersion": "1.0.0",
  "packageType": "quiz_bank_package",
  "bankInfo": {},
  "subjects": [],
  "chapters": [],
  "questions": [],
  "records": {}
}

三、bankInfo 要求
bankInfo 必须包含：
bankId：题库唯一编号，使用英文、数字、下划线，例如 "communication_exam_001"
bankName：题库名称
description：题库说明
sourceType：填写 "ai_generated"
createTime：ISO 时间字符串
updateTime：ISO 时间字符串

四、subjects 要求
subjects 用于保存科目列表。
每个科目格式如下：
{
  "subjectId": 3,
  "subjectName": "通信原理",
  "sortOrder": 1,
  "enabled": true
}

字段说明：
subjectId：科目编号，必须是数字
subjectName：科目名称
sortOrder：显示顺序，数字越小越靠前
enabled：是否启用，默认为 true

五、chapters 要求
chapters 用于保存章节列表。
每个章节格式如下：
{
  "subjectId": 3,
  "chapterId": "01",
  "chapterName": "通信系统基础",
  "sortOrder": 1,
  "enabled": true
}

字段说明：
subjectId：所属科目编号，必须与 subjects 中的 subjectId 对应
chapterId：章节编号，建议使用 "01"、"02"、"03"
chapterName：章节名称
sortOrder：章节顺序
enabled：是否启用，默认为 true

六、questions 要求
questions 只保存题目本体，不保存用户学习记录。
每道题格式如下：
{
  "id": "3_01_001",
  "subjectId": 3,
  "chapterId": "01",
  "questionNo": 1,
  "type": "single",
  "question": "通信系统的基本任务是（ ）。",
  "options": [
    { "key": "A", "text": "产生噪声" },
    { "key": "B", "text": "传输信息" },
    { "key": "C", "text": "降低带宽" },
    { "key": "D", "text": "增加失真" }
  ],
  "answer": ["B"],
  "analysis": "通信系统的基本任务是在信源和信宿之间可靠、有效地传输信息。"
}

七、题目 id 规则
题目 id 必须使用：
subjectId_chapterId_questionNo

例如：
3_01_001
3_01_002
3_02_001

其中：
subjectId = 3
chapterId = "01"
questionNo = 1 时，id 为 "3_01_001"

questionNo 需要按章节从 1 开始递增。
id 中 questionNo 建议补足 3 位，例如 001、002、003。

八、题型 type 规则
type 只能使用以下三种：
single：单选题
multiple：多选题
judge：判断题

不要使用中文题型作为 type。

九、答案 answer 规则
answer 必须是数组。

单选题：
"answer": ["B"]

多选题：
"answer": ["A", "B", "C"]

判断题：
"answer": ["A"]

十、判断题选项规则
判断题统一使用：
"options": [
  { "key": "A", "text": "正确" },
  { "key": "B", "text": "错误" }
]

十一、records 要求
首次生成题库时，records 中所有学习记录为空。

records 必须使用下面结构：
"records": {
  "answers": {},
  "wrong": {},
  "favorites": {},
  "notes": {},
  "sequenceProgress": {},
  "wrongProgress": {},
  "favoriteProgress": {},
  "deleted": {},
  "stats": {
    "totalAnswered": 0,
    "totalCorrect": 0,
    "dailyStats": {}
  }
}

十二、解析 analysis 要求
1. 如果资料中有解析，尽量保留原解析。
2. 如果资料中没有解析，可以生成简短解析。
3. 解析应说明正确选项为什么正确，错误选项为什么不适合。
4. 不要把解析写进 question 题干中。

十三、质量检查要求
生成 JSON 前请自检：
1. JSON 能被 JSON.parse 正常解析。
2. 所有 questions 都有 id、subjectId、chapterId、questionNo、type、question、options、answer。
3. answer 中的选项必须存在于 options 的 key 中。
4. single 单选题只能有一个答案。
5. multiple 多选题可以有多个答案。
6. judge 判断题只能使用 A / B。
7. 同一题库中不能出现重复 id。
8. subjectId 必须能在 subjects 中找到。
9. chapterId 必须能在 chapters 中找到。
10. 不要输出任何 JSON 以外的内容。`

function getBankPackageTemplateObject() {
  return JSON.parse(JSON.stringify(bankPackageTemplate))
}

function getBankPackageTemplateText() {
  return JSON.stringify(bankPackageTemplate, null, 2)
}

function getBankPackageGuideText() {
  return bankPackageGuideText
}

function getAiGenerationPromptText() {
  return aiGenerationPromptText
}

module.exports = {
  bankPackageTemplate,
  getBankPackageTemplateObject,
  getBankPackageTemplateText,
  getBankPackageGuideText,
  getAiGenerationPromptText
}