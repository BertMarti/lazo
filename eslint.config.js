import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "dist-demo", "android", "node_modules", ".superpowers", "server/pb/pb_hooks/lib", "server/unfurl/meta.mjs", "server/unfurl/amazon.mjs", ".claude", ".impeccable"] },
  js.configs.recommended,
  { files: ["server/unfurl/**/*.mjs", "server/test/**/*.mjs", "e2e/**/*.mjs"], languageOptions: { globals: globals.node } },
  { files: ["server/pb/**/*.js"], languageOptions: { globals: { migrate: "readonly", Collection: "readonly", TextField: "readonly", Record: "readonly", Command: "readonly", routerAdd: "readonly", routerUse: "readonly", onRecordCreateRequest: "readonly", onRecordCreate: "readonly", onRealtimeSubscribeRequest: "readonly", onBatchRequest: "readonly", $app: "readonly", $apis: "readonly", $security: "readonly", $http: "readonly", $os: "readonly", __hooks: "readonly", require: "readonly", BadRequestError: "readonly", ForbiddenError: "readonly", UnauthorizedError: "readonly", NotFoundError: "readonly", Field: "readonly", onRecordDeleteRequest: "readonly", module: "writable" } } },
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Prohibido (AGENTS.md regla 6)." },
        { selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]", message: "Prohibido (AGENTS.md regla 6)." },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: "Prohibido (AGENTS.md regla 6)." },
      ],
    },
  },
  { files: ["server/pb/**/*.js"], rules: { "@typescript-eslint/triple-slash-reference": "off", "@typescript-eslint/no-require-imports": "off" } },
);
