const appConfig = {
  // true：测试阶段，如果没有导入本地题库，则使用 data/questions.js 作为测试题库
  // false：正式使用时，如果没有导入题库，则题库为空
  useDemoBankWhenEmpty: true,

  // 本地题库包保存目录名
  localBankDirName: "question_banks",

  // 题库包格式版本
  bankPackageSchemaVersion: "1.0.0"
}

module.exports = appConfig