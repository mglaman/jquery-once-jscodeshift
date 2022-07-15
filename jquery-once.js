// jscodeshift --extensions=es6.js -P -t scripts/js/codemod/once.js scripts/js/codemod/once.sample.es6.js
// https://www.drupal.org/files/issues/2021-02-25/core-once-3183149-29.patch
module.exports = (fileInfo, { jscodeshift: j }) => {
    const methodsReplacement = {
        once: 'once',
        findOnce: 'once.filter',
        removeOnce: 'once.remove',
    };

    function fixScoping(ast) {
        ast.find(j.CallExpression, node => {
            return node.extra && node.extra.parenthesized && node.callee && node.callee.type === 'FunctionExpression';
        }).replaceWith(p => {
            const args = [...p.value.arguments || [], j.identifier('once')];
            const params = [...p.value.callee.params || [], j.identifier('once')];
            return j.callExpression(j.functionExpression(null, params, p.value.callee.body), args)
        })
    }

    function findjQuery(node) {
        // Check if '$' is used in the expression or if find is used.
        const jqUsed = /(\$|find)/.test(j(node).toSource());
        // Don't select calls to $(window), $(document), or $(this).
        const excluded =
            node.arguments &&
            node.arguments.length > 0 &&
            node.arguments[0].type === 'Identifier' &&
            ['window', 'document'].includes(node.arguments[0].name);

        return jqUsed && !excluded;
    }

    /**
     * Select all expressions until '.once()' to be replaced.
     *
     * Skip once calls on the 'window' and 'document'.
     */
    function isOnceExpression(node) {
        return (
            node.type === 'CallExpression' &&
            node.callee.type === 'MemberExpression' &&
            node.callee.property &&
            Object.keys(methodsReplacement).includes(node.callee.property.name) &&
            node.callee.object &&
            // Only match jQuery calls, not _.once().
            findjQuery(node.callee.object)
        );
    }

    // @todo Replace $('selector', context) by $(context).find('selector');

    /**
     * Match selectors of type `'selector' and `#${dynamicId}`.
     */
    function isTemplateLiteral(node) {
        const sizzleSelector = /:(input|button|checkbox|file|image|password|radio|reset|submit|text|parent|header)/;
        return (
            // Selector string that doesn't have a sizzle selector.
            (node.type === 'Literal' && !sizzleSelector.test(node.value)) ||
            // Match dynamic Ids such as `#${id}`.
            (node.type === 'TemplateLiteral' && j(node).toSource()[1] === '#')
        );
    }

    function isContextIdentifier(node) {
        return (
            node.type === 'Identifier' &&
            (node.name === 'context' || node.name === '$context')
        );
    }

    /**
     * Match $('selector') code.
     */
    function isBareSelector(node) {
        return (
            node.callee.type === 'Identifier' &&
            node.arguments.length === 1 &&
            isTemplateLiteral(node.arguments[0]) &&
            // Make sure this is a selector and not an HTMLElement.
            !/(<\w+)/.test(node.arguments[0].value)
        );
    }

    /**
     * Match $(context).find('selector') code and
     * $('selector', context) code.
     */
    function isContextSelector(node) {
        // This is a $('selector', context) situation
        if (node.arguments && node.arguments.length === 2) {
            return (
                isTemplateLiteral(node.arguments[0]) &&
                isContextIdentifier(node.arguments[1])
            );
        }
        // It's a $(context).find('selector') or $context.find('selector') situation
        const { object, property } = node.callee;
        return (
            node.arguments &&
            property &&
            property.type === 'Identifier' &&
            property.name === 'find' &&
            // Make sure the .find is a simple selector.
            isTemplateLiteral(node.arguments[0]) &&
            // and that is is called on $(context) or $context.
            object &&
            // Match $context.
            (isContextIdentifier(object) ||
                // Match $(context).
                (object.type === 'CallExpression' &&
                    isContextIdentifier(object.arguments[0])))
        );
    }

    /**
     * Process and replace a few jQuery patterns.
     *
     * Transformations:
     *   - $('selector') => ['selector']
     *   - $(context).find('selector') => ['selector', context]
     *   - $context.find('selector') => ['selector', context]
     */
    function processSelector(node) {
        if (node.callee) {
            // Transforms $('selector') => document.querySelectorAll('selector').
            if (isBareSelector(node)) {
                return [node.arguments[0]];
            }
            // Transforms $(context).find('select') => context.querySelectorAll('select').
            // Transforms $('select', context) => context.querySelectorAll('select').
            if (isContextSelector(node)) {
                return [node.arguments[0], j.identifier('context')];
            }
        }
        // Don't change anything.
        return [node];
    }

    function wrapWithjQuery(node) {
        return j.callExpression(j.identifier('$'), [node]);
    }

    function newMethod(oldName) {
        return j.identifier(methodsReplacement[oldName]);
    }

    /**
     * Transforms:
     *   - $('selector').once('id') => $(once('id', 'selector'))
     *   - $(context).find('selector').once('id') => $(once('id', 'selector', context))
     *   - $context.find('selector').once('id') =>  $(once('id', 'selector', context))
     *   - $some.jquery.once('id') => $(once('id', $some.jquery))
     *   - $(variable).method().once('id') => $(once('id', $(variable).method()))
     *
     *  'selector' can be a string or a template literal that starts with '#'.
     */
    function replacejQueryOnce(ast) {
        const method = ast.node.callee.property.name;
        // wrap the once call in a jQuery object to make sure chaining still works.
        j(ast).replaceWith(
            wrapWithjQuery(
                j.callExpression(
                    // Replace jQuery method with suitable once method.
                    newMethod(method),
                    [
                        // once id
                        ast.node.arguments[0],
                        // once elements, apply some transformations.
                        ...processSelector(ast.node.callee.object),
                    ],
                ),
            ),
        );
    }

    const ast = j(fileInfo.source);
    fixScoping(ast)
    ast.find(j.CallExpression, isOnceExpression).forEach(replacejQueryOnce);

    return ast.toSource();
};
