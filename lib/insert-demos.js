var fs = require('fs');
var removePosition = require('unist-util-remove-position');
var u = require('unist-builder');
var _ = require('lodash');
var jsYaml = require('js-yaml');

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

/**
 * js-yaml dont support tab, replace them with space in this function
 */
function parseYAML(str) {
  return jsYaml.safeLoad(str.replace(new RegExp('\t', 'g'), '  '));
}

function extractI18N(resource) {
  return resource.split('/').pop().split('.')[0].split('_')[1];
}

function isAPIHeader(node) {
  if (node.type !== 'heading') return false;
  return node.children[0].value === 'API';
}

function getDemoID(filename) {
  var names = filename.split('.')[0].split('-');
  return names.map(name => name.charAt(0).toUpperCase() + name.slice(1)).join('');
}

function extractDemos(demosPath, i18n) {
  var styles = [];
  var demos = fs.readdirSync(demosPath + '/demos').map(filename => {
    var demoAST = markdownParser.parse(fs.readFileSync(demosPath + '/demos/' + filename, { encoding: 'utf-8' })),
      yaml;
    removePosition(demoAST, true);

    // 分成yaml配置和正文(demo 代码)两个部分处理demo
    var yamlPart = demoAST.children[0];
    var mainContent = demoAST.children[1];

    // parse yaml
    if (yamlPart.type === 'yaml') {
      yaml = parseYAML(yamlPart.value);
    } else {
      throw new Error('yaml part in demo.md is needed');
    }

    // extract style
    var copy = demoAST.children.slice();
    copy.forEach(function(block) {
      if (block.type === 'html') {
        mainContent.children = [block];
      }
    });

    // replace i18n variables
    Object.keys(yaml[i18n]).forEach(function(key) {
      mainContent.value = demoAST.children[1].value.replace(
        new RegExp('\\{i18n\\.' + key + '\\}', 'g'),
        yaml[i18n][key]
      );
    });


    // mixin demo and fork title structure
    var demo = Object.assign({ order: yaml.order, demoID: getDemoID(filename) }, mainContent, { yaml: yaml[i18n] || '' });
    return demo;
  }).sort(function(a, b) {
    return +a.order - +b.order;
  });
  return demos;
}

function dirExists(path) {
  try{
    fs.statSync(path);
  }catch(e){
    return false;
  }
  return true;
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

  while (i < numberOfTopLevelNodes) {
    if (isAPIHeader(nodes[i]) && dirExists(path + '/demos')) {
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
