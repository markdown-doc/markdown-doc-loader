var fs = require('fs');
var removePosition = require('unist-util-remove-position');
var u = require('unist-builder');
var _ = require('lodash');

var helper = require('./helper');
var markdownParser = require('./parser');

// var beautyConsole = require('./lib').beautyConsole;

/**
 *
 *
 * @param {String} str : yaml in md parsed by AST  astexplorer.net
 * @returns {Object} result -- only support 2 level yaml in format below
 *
 * key1: value1
 * key2:
 *  subKey1: subValue1
 *  subKey2: subValue2
 * key3: value3
 *
 */
function parseYAML(str) {
  var result = {},
    tempKey = '',
    attrs = str.split('\n');
  attrs.forEach(function(kvPair, index) {
    var key = kvPair.split(':')[0],
      value = kvPair.split(':')[1].trim();
    if (key.length === key.trim().length) {
      result[key] = value || {};
      tempKey = key;
    } else {
      result[tempKey][key.trim()] = value;
    }
  });
  return result;
}

function extractI18N(resource) {
  return resource.split('/').pop().split('.')[0].split('_')[1];
}

function isAPIHeader(node) {
  if (node.type !== 'heading') return false;
  return node.children[0].value === 'API';
}

function getDemoID(filename) {
  var name = filename.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function extractDemos(demosPath, i18n) {
  var styles = [];
  var demos = fs.readdirSync(demosPath + '/demos').map(filename => {
    var demoAST = markdownParser.parse(fs.readFileSync(demosPath + '/demos/' + filename, { encoding: 'utf-8' })),
      yaml;
    removePosition(demoAST, true);

    // parse yaml
    if (demoAST.children[0].type === 'yaml') {
      yaml = parseYAML(demoAST.children[0].value);
    } else {
      throw new Error('yaml part in demo.md is needed');
    }

    // extract style
    var copy = demoAST.children.slice();
    copy.forEach(function(block) {
      if (block.type === 'html') {
        demoAST.children[1].children = [block];
      }
    });

    // replace i18n variables
    Object.keys(yaml[i18n]).forEach(function(key) {
      demoAST.children[1].value = demoAST.children[1].value.replace(
        new RegExp('\\{i18n\\[' + key + '\\]\\}', 'g'),
        yaml[i18n][key]
      );
    });


    // mixin demo and fork title structure
    var demo = Object.assign({ order: yaml.order, demoID: getDemoID(filename) }, demoAST.children[1], { yaml: yaml[i18n] || '' });
    return demo;
  }).sort(function(a, b) {
    return +a.order - +b.order;
  });
  return demos;
}

module.exports = function transformer(tree, ctx) {
  var roots = [],
    i = 0,
    contentRoot,
    demoRoot;
  function addDemo(demo) {
    if (!demoRoot) {
      demoRoot = helper.createRoot({ contentType: 'demo' });
    }

    helper.addChild(demoRoot, demo);
  }

  function addContent(content) {
    if (!contentRoot) {
      contentRoot = helper.createRoot({ contentType: 'markdown' });
    }

    helper.addChild(contentRoot, content);
  }

  function saveRoot(r) {
    if (r) {
      roots.push(r);
    }
  }

  removePosition(tree, true);
  var nodes = tree.children,
    numberOfTopLevelNodes = nodes.length,
    path = ctx.context,
    i18n = extractI18N(ctx.resourcePath);
  ctx.addContextDependency(path + '/demos');

  while (i < numberOfTopLevelNodes) {
    if (isAPIHeader(nodes[i])) {
      saveRoot(contentRoot);
      contentRoot = undefined;
      var demos = extractDemos(path, i18n);
      demos.forEach(function(demo) {
        addDemo(demo);

        // 确保每个demo块只有一段代码
        saveRoot(demoRoot);
        demoRoot = undefined;
      });
      addContent(nodes[i]);
    } else {
      addContent(nodes[i]);
    }

    i++;
  }
  // save the last section
  saveRoot(contentRoot);
  saveRoot(demoRoot);
  return roots;
};
