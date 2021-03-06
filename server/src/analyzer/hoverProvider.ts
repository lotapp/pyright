/*
* hoverProvider.ts
* Copyright (c) Microsoft Corporation.
* Licensed under the MIT license.
* Author: Eric Traut
*
* Logic that maps a position within a Python program file into
* markdown text that is displayed when the user hovers over that
* position within a smart editor.
*/

import { DiagnosticTextPosition } from '../common/diagnostic';
import { convertPositionToOffset } from '../common/positionUtils';
import { ModuleNameNode, NameNode, ParseNode } from '../parser/parseNodes';
import { ParseResults } from '../parser/parser';
import { AnalyzerNodeInfo } from './analyzerNodeInfo';
import { ImportType } from './importResult';
import { ParseTreeUtils } from './parseTreeUtils';
import { SymbolCategory } from './symbol';

export class HoverProvider {
    static getHoverForPosition(parseResults: ParseResults,
            position: DiagnosticTextPosition): string | undefined {

        let offset = convertPositionToOffset(position, parseResults.lines);
        if (offset === undefined) {
            return undefined;
        }

        let node = ParseTreeUtils.findNodeByOffset(parseResults.parseTree, offset);
        if (node === undefined) {
            return undefined;
        }

        if (node instanceof ModuleNameNode) {
            // If this is an imported module name, try to map the position
            // to the resolved import path.
            let importInfo = AnalyzerNodeInfo.getImportInfo(node);
            if (!importInfo) {
                return undefined;
            }

            let pathOffset = node.nameParts.findIndex(range => {
                return offset! >= range.start && offset! < range.end;
            });

            if (pathOffset < 0) {
                return undefined;
            }

            if (pathOffset >= importInfo.resolvedPaths.length) {
                pathOffset = importInfo.resolvedPaths.length - 1;
            }

            if (importInfo.resolvedPaths[pathOffset]) {
                let typeStubWarning = '';
                if (importInfo.importType === ImportType.ThirdParty && !importInfo.isStubFile) {
                    typeStubWarning = '\nNo type stub found for this module. Imported symbol types are unknown.';
                }

                return '```\n(module) "' + importInfo.resolvedPaths[pathOffset] + '"```' + typeStubWarning;
            }

            return undefined;
        }

        const declaration = AnalyzerNodeInfo.getDeclaration(node);

        if (declaration) {
            switch (declaration.category) {
                case SymbolCategory.Variable: {
                    if (node instanceof NameNode) {
                        return '```\n(variable) ' + node.nameToken.value +
                            this._getTypeText(node) + '```';
                    }
                    break;
                }

                case SymbolCategory.Parameter: {
                    if (node instanceof NameNode) {
                        return '```\n(parameter) ' + node.nameToken.value +
                            this._getTypeText(node) + '```';
                    }
                    break;
                }

                case SymbolCategory.Class: {
                    if (node instanceof NameNode) {
                        return '```\n(class) ' + this._getTypeText(node) + '```';
                    }
                    break;
                }

                case SymbolCategory.Function: {
                    if (node instanceof NameNode) {
                        return '```\n(function) ' + node.nameToken.value +
                            this._getTypeText(node) + '\n```';
                    }
                    break;
                }

                case SymbolCategory.Method: {
                    if (node instanceof NameNode) {
                        return '```\n(method) ' + node.nameToken.value +
                            this._getTypeText(node) + '```';
                    }
                    break;
                }

                case SymbolCategory.Module: {
                    if (node instanceof NameNode) {
                        return '```\n(module) ' + node.nameToken.value + '```';
                    }
                    break;
                }
            }
        }

        // If we had no declaration, see if we can provide a minimal tooltip.
        if (node instanceof NameNode) {
            if (node instanceof NameNode) {
                return '```\n' + node.nameToken.value + ' : Unknown```';
            }
        }

        return undefined;
    }

    private static _getTypeText(node: ParseNode): string {
        let type = AnalyzerNodeInfo.getExpressionType(node);
        let typeString = '';

        // If there was no type information cached, see if we
        // can get it from the declaration.
        if (!type) {
            const declaration = AnalyzerNodeInfo.getDeclaration(node);
            if (declaration && declaration.declaredType) {
                type = declaration.declaredType;
            }
        }

        if (type) {
            typeString = type.asString();
        }

        return ': ' + typeString;
    }
}
