/** @type {import('eslint').Linter.Config} */
const base = require('./base');

module.exports = {
  ...base,
  rules: {
    ...base.rules,
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    // NestJS uses emitDecoratorMetadata — constructor parameter types must be
    // real (not type-only) imports so Reflect.getMetadata sees the class ref.
    '@typescript-eslint/consistent-type-imports': 'off',
  },
};
