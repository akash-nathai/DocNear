/** @type {import('eslint').Linter.Config} */
const base = require('./base');

module.exports = {
  ...base,
  extends: [...(base.extends || []), 'next/core-web-vitals'],
  env: { ...base.env, browser: true },
  rules: {
    ...base.rules,
    'react/no-unescaped-entities': 'off',
    '@next/next/no-html-link-for-pages': 'off',
  },
};
