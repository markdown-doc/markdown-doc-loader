var fs = require('fs');
var path = require('path');
var removePosition = require('unist-util-remove-position');
var jsYaml = require('js-yaml');

var helper = require('./helper');
var markdownParser = require('./parser');

var demoHeaders = {
  'zh-CN': '代码演示',
  'en-US': 'Demos'
}

var I18N_KEY_REGEXP = /\{i18n\.([^\}]*)\}/;

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
  return jsYaml.load(str.replace(new RegExp('\t', 'g'), '  '));
}

function extractI18N(resource) {
  return resource.split(path.sep).pop().split('.')[0].split('_')[1];
}

function isAPIHeader(node) {
  if (node.type !== 'heading') return false;
  return node.children[0].value === 'API';
}

function isDemoSlot(node) {
  if (node.type !== 'html') return false;
  return /^<!-- demo-slot-\d+ -->$/.test(node.value);
}

function getDemoID(filename) {
  return 'Demo' + filename.split('.')[0].split('-').join('');
}

function extractDemos(demosPath, i18n, ctx) {
  var styles = [];
  var demoDir = path.join(demosPath, 'demos');
  var demos = fs.readdirSync(demoDir).map(filename => {
    var filePath = path.join(demoDir, filename);
    ctx.addDependency(filePath)
    var demoAST = markdownParser.parse(fs.readFileSync(filePath, { encoding: 'utf-8' })),
      yamlPart = (demoAST && demoAST.children && demoAST.children[0]) || {},
      mainContent = (demoAST && demoAST.children && demoAST.children[1])|| {},
      yaml;

    // parse and validate yaml
    if (yamlPart.type === 'yaml') {
      yaml = parseYAML(yamlPart.value);
    } else {
      ctx.emitWarning('\nYaml header in demo.md is required, ' + filePath + ' wasn\'t appended.\n');
      return null;
    }

    // validate main content
    if (mainContent.type !== 'code') {
      ctx.emitWarning('\nThe first 2 sections of demo.md must be yaml header and code block, ' + filePath + ' wasn\'t appended.\n');
      return null;
    }

    removePosition(demoAST, true);

    // extract style if exists
    var copy = demoAST.children.slice();
    copy.forEach(function(block) {
      if (block.type === 'html') {
        mainContent.children = [block];
      }
    });

    // replace i18n variables
    Object.keys(yaml[i18n]).forEach(function(key) {
      mainContent.value = mainContent.value.replace(
        new RegExp('\\{i18n\\.' + key + '\\}', 'g'),
        yaml[i18n][key]
      );
    });

    // check if any {i18n.xxx} exists after replace
    var i18nMatchResult = I18N_KEY_REGEXP.exec(mainContent.value);
    if (i18nMatchResult) {
      var i18nMissingKey = i18nMatchResult[1];
      ctx.emitError(new Error(
        '\nUnrecognized i18n variable {i18n.' + i18nMissingKey + '} in ' + filePath
      ));
      return null;
    }

    // mixin demo and fork title structure
    var demo = Object.assign({ order: yaml.order, demoID: getDemoID(filename) }, mainContent, { yaml: yaml[i18n] || '' });
    return demo;
  }).filter(function(meta) {
    return Boolean(meta);
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
    i18n = extractI18N(ctx.resourcePath),
    scatter = (nodes[0].type === 'yaml' ? parseYAML(nodes[0].value) : {}).scatter,
    demosExists = dirExists(path + '/demos'),
    demos = demosExists ? extractDemos(path, i18n, ctx) : [];

  function saveScattered(node) {
    if (isDemoSlot(node)) {
      saveRoot(contentRoot);
      contentRoot = undefined;

      var order = /^<!-- demo-slot-(\d+) -->$/.exec(node.value)[1];
      // extract validated demos
      addDemo(demos[order - 1]);
      saveRoot(demoRoot);
      demoRoot = undefined;
    } else {
      addContent(node);
    }
  }

  function saveConcentrated(node) {
    if (isAPIHeader(node)) {
      // append title of demos right above API
      addContent({
        type: 'heading',
        depth: 3,
        children: [{ type: 'text', value: demoHeaders[i18n] }]
      });
      saveRoot(contentRoot);
      contentRoot = undefined;

      // append all of the demos
      demos.forEach(function(demo) {
        addDemo(demo);

        // 确保每个demo块只有一段代码
        saveRoot(demoRoot);
        demoRoot = undefined;
      });

      // append API Header
      addContent(nodes[i]);
    } else {
      addContent(nodes[i]);
    }
  }

  while (i < numberOfTopLevelNodes) {
    if (demosExists && scatter) {
      saveScattered(nodes[i]);
    } else if(demosExists) {
      saveConcentrated(nodes[i]);
    } else {
      addContent(nodes[i]);
    }

    i++;
  }

  saveRoot(contentRoot);
  saveRoot(demoRoot);

  return roots;
};
