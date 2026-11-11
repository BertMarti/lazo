import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "dist-demo", "android", "node_modules", ".superpowers", "server/pb/pb_hooks/lib", "server/unfurl/meta.mjs"] },
  js.configs.recommended,
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
);
