/**
 * 后续 PDF / JSON 转换出的题目统一放在这里。
 *
 * 注意：
 * 1. importedQuestions 当前为空，不影响小程序运行。
 * 2. 后续从 PDF 转题库后，把生成的题目数组粘贴到 importedQuestions 中即可。
 * 3. 题目 id 建议使用 subjectId_chapterId_questionNo，例如：3_01_001。
 * 4. 如果不写 id，系统会根据 subjectId、chapterId、questionNo 自动生成。
 * 5. importedQuestions 中的同 id 题目会覆盖内置 questions.js 中的题目。
 */

const importedQuestions = [
]

module.exports = {
  importedQuestions
}