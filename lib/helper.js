var clone = require('rfdc/default');

exports.createRoot = function createRoot(opts) {
  return Object.assign(opts, {
    type: 'root',
    children: []
  });
};

exports.addChild = function addChild(root, child) {
  root.children.push(clone(child));
};
