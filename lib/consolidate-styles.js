var visit = require('unist-util-visit');
var isStyleNode = require('hast-util-is-css-style');
var getText = require('hast-util-to-string');
var unified = require('unified');
var rehypeParser = require('rehype-parse');
var rehypeStringify = require('rehype-stringify');

var helper = require('./helper');

var htmlParser = unified()
  .use(rehypeParser, { fragment: true })
  .use(rehypeStringify)
  .freeze();

function removeNode(action) {
  var parent = action.parent;
  var index = action.index;

  if (parent && parent.children) {
    parent.children.splice(index, 1);
  }
}

module.exports = function consolidateStyles(roots) {
  var styleArray = roots.reduce(function (styles, r) {
    // visit的时候改变树的结构会导致某些节点没有遍历到，因为children的长度变了
    // 所以放到visit之后统一删除
    var nodeForRemove = [];

    visit(r, 'html', function(node, rindex, rparent) {
      var htmlTree = htmlParser.parse(node.value);
      var htmlNodeForRemove = [];

      visit(htmlTree, 'element', function(hnode, index, parent) {
        if (isStyleNode(hnode)) {
          // remove style from html
          htmlNodeForRemove.push({
            parent: parent,
            index: index
          });

          var sText = getText(hnode).trim();
          if (sText) {
            styles.push(sText);
          }
        }
      });
      htmlNodeForRemove.forEach(removeNode);

      // remove empty html if contains only styles
      var htmlWithNoStyle = htmlParser.stringify(htmlTree).trim();
      if (htmlWithNoStyle) {
        rparent.children[rindex].value = htmlWithNoStyle;
      } else {
        nodeForRemove.push({
          parent: rparent,
          index: rindex
        });
      }
    });

    // 删除空的节点
    nodeForRemove.forEach(removeNode);

    return styles;
  }, []);

  var styleText = styleArray.join('\n\n');
  var styleRoot = helper.createRoot({ contentType: 'style' });
  helper.addChild(styleRoot, {
    type: 'style',
    value: styleText
  });
  roots.unshift(styleRoot);

  return roots;
};
