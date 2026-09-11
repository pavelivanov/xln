import { posix } from 'node:path';
import ts from 'typescript';

/** Parse syntax, including type imports/re-exports and literal lazy imports. */
export const importSpecifiers = (source: string): readonly string[] => {
  const file = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) imports.push(argument.text);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    )
      imports.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return imports;
};

export const resolveSourceImport = (importer: string, specifier: string): string => {
  if (specifier === '$lib' || specifier.startsWith('$lib/'))
    return posix.normalize(`frontend/src/lib${specifier.slice(4)}`);
  if (specifier.startsWith('@xln/')) return posix.normalize(specifier.slice(5));
  if (specifier.startsWith('.')) return posix.normalize(posix.join(posix.dirname(importer), specifier));
  return posix.normalize(specifier.replace(/^\/+/, ''));
};
