var unified = require('unified');
var remarkParser = require('remark-parse');

var extractDemo = require('./extract-demo');
var consolidateStyles = require('./consolidate-styles');

var markdownParser = unified()
  .use(remarkParser)
  .freeze();

/**
 * 输出的sections中:
 *
 * style只有一个且只有一个child;
 * demo一个代码块，对应一个示例
 * markdown包含一段文案
 */
module.exports = function (content) {
  var ast = markdownParser.parse(content);
  var sections = extractDemo(ast);
  sections = consolidateStyles(sections);

  return sections;
};
