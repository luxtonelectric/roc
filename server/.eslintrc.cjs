module.exports = {
  env: {
    node: true
  },
  extends: ['eslint:recommended'],
  overrides: [
    {
      env: {
        node: true
      },
      files: [
        '.eslintrc.{js,cjs}'
      ],
      parserOptions: {
        sourceType: 'script'
      }
    },
    {
      "files": ["tests/**/*"],
      "plugins": ["jest"],
      "env": {
        "jest/globals": true
      }
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    indent: ['error', 2]
  }
}
