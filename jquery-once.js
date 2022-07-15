import {CallExpression, FunctionExpression} from "jscodeshift/src/core";

export default (fileInfo, api) => {
    const j = api.jscodeshift;

    const root = j(fileInfo.source);
    const scoper = root.find(j.CallExpression, node => {
        return node.extra && node.extra.parenthesized && node.callee && node.callee.type === 'FunctionExpression';
    }).get()
    scoper.value.arguments.push(j.identifier('once'))
    scoper.value.callee.params.push(j.identifier('once'))

    root.find(j.CallExpression, {
        callee: {
            property: {
                name: 'once'
            }
        }
    })
        .replaceWith(p => {
            const key = p.value.arguments[0]

            const comments = p.node.comments = p.node.comments || [];

            if (p.node.callee.type !== 'MemberExpression') {
                // @todo support.
                comments.push(j.commentLine('Not yet supported, needs debugging!', true, false))
                return p.node
            }
            if (p.node.callee.object.type !== 'CallExpression') {
                // @todo support.
                comments.push(j.commentLine('Not yet supported, needs debugging!', true, false))
                return p.node;
            }
            const args = [key]

            const onceCalleeNode = p.node.callee.object
            if (onceCalleeNode.callee.property.name === 'find') {
                args.push(onceCalleeNode.arguments[0])
                args.push(onceCalleeNode.callee.object.arguments[0])
            } else {
                // @todo unknown path
                comments.push(j.commentLine('Not yet supported, needs debugging!', true, false))
                return p.node;
            }

            return j.callExpression(
                j.identifier('$'),
                [j.callExpression(j.identifier('once'), args)]
            )
        })

    return root
        .toSource();
};
