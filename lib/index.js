var markdownParser = require('./parser');
var insertDemos = require('./insert-demos');
var consolidateStyles = require('./consolidate-styles');

/**
 * 输出的sections中:
 *
 * style只有一个且只有一个child;
 * demo一个代码块，对应一个示例
 * markdown包含一段文案
 */

module.exports = function(content) {
  var ast = markdownParser.parse(content);
  var sections = insertDemos(ast, this);
  sections = consolidateStyles(sections);
  return sections;
};
