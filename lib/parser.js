var unified = require('unified');
var remarkParser = require('remark-parse');
var frontmatter = require('remark-frontmatter');

module.exports = unified()
  .use(remarkParser)
  .use(frontmatter, ['yaml'])
  .freeze();
