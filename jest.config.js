export default {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^~/(.*)\\.js$": "<rootDir>/src/$1.ts",
    "^~/(.*)$": "<rootDir>/src/$1",
    "^@core/(.*)\\.js$": "<rootDir>/src/core/$1.ts",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@figma/(.*)\\.js$": "<rootDir>/src/figma/$1.ts",
    "^@figma/(.*)$": "<rootDir>/src/figma/$1",
    "^@mcp/(.*)\\.js$": "<rootDir>/src/mcp/$1.ts",
    "^@mcp/(.*)$": "<rootDir>/src/mcp/$1",
    "^@shared/(.*)\\.js$": "<rootDir>/src/shared/$1.ts",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@extractors/(.*)\\.js$": "<rootDir>/src/extractors/$1.ts",
    "^@extractors/(.*)$": "<rootDir>/src/extractors/$1",
    "^@transformers/(.*)\\.js$": "<rootDir>/src/transformers/$1.ts",
    "^@transformers/(.*)$": "<rootDir>/src/transformers/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  modulePaths: ["<rootDir>/src"],
};
