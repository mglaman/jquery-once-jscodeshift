const {resolve} = require('path');
const {run: jscodeshift} = require('jscodeshift/src/Runner')


const transformPath = resolve('./jquery-once.js');
const paths = process.argv.slice(2);
const options = {
    dry: false,
    print: false,
    verbose: 0,
}
jscodeshift(transformPath, paths, options);
