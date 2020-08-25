
//<--for.webpack.begin-->
//针对在 webpack 环境中，自动引入样式。
if ('webpackPolyfill' in module) {
    require('./modules/Masker.less');
}
//<--for.webpack.end-->

module.exports = require('./modules/Masker');
module.exports.defaults = require('./modules/Masker.defaults');