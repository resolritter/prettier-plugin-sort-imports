import { parse as parser, ParserOptions } from '@babel/parser';
import { merge } from 'lodash';
import { loadPartialConfig } from '@babel/core';
import traverse, { NodePath } from '@babel/traverse';
import { removeComments, ImportDeclaration } from '@babel/types';
import {
    PrettierParserOptions,
    getCodeFromAst,
    getAllGeneratedImportCodeTogether,
    handleImportSeparation,
    getSortedNodesByImportOrder,
    getSortedNodesNotInTheImportOrder,
    removeImportsFromOriginalCode,
} from './utils';

export function preprocessor(code: string, options: PrettierParserOptions) {
    const { importOrder, importOrderSeparation } = options;
    let importNodes: ImportDeclaration[] = [];

    const defaultConfig = {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
    } as ParserOptions;
    const babelConfig = loadPartialConfig() as ParserOptions;
    const mergedOptions = merge(defaultConfig, babelConfig);

    const ast = parser(code, mergedOptions);

    traverse(ast, {
        enter(path: NodePath) {
            removeComments(path.node);
        },
        ImportDeclaration(path: NodePath<ImportDeclaration>) {
            importNodes.push(path.node);
        },
    });

    const thirdPartyImports = getSortedNodesNotInTheImportOrder(
        importNodes,
        importOrder,
    );
    const localImports = getSortedNodesByImportOrder(importNodes, importOrder);

    const thirdPartyImportsAsCode = getCodeFromAst(thirdPartyImports);
    const localImportsAsCode = localImports
        .map(getCodeFromAst)
        .join(handleImportSeparation(importOrderSeparation));

    const importsStart = importNodes[0]
        ? importNodes[0].start !== null
            ? importNodes[0].start
            : 0
        : 0;

    const modifiedCode = removeImportsFromOriginalCode(code, importNodes);

    const initialCodeBlock = modifiedCode.substring(0, importsStart);

    const middleCodeBlock = getAllGeneratedImportCodeTogether(
        thirdPartyImportsAsCode,
        localImportsAsCode,
        importOrderSeparation,
    );

    const endCodeBlock = modifiedCode.substring(importsStart);

    return `${initialCodeBlock}${middleCodeBlock}${endCodeBlock}`;
}
