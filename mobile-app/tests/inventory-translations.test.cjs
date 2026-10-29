const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const parser = require("@babel/parser");
const generate = require("@babel/generator").default;
const traverse = require("@babel/traverse").default;

const root = path.resolve(__dirname, "..");
const parse = (file) =>
  parser.parse(fs.readFileSync(path.join(root, file), "utf8"), {
    sourceType: "module",
    plugins: ["jsx"],
  });
// Exercise the actual dictionary and formatter without mounting React Native.
const ast = parse("src/components/LocalizedText.js");
const definitions = ast.program.body.filter(
  (node) =>
    (node.type === "VariableDeclaration" &&
      node.declarations.some((d) => d.id.name === "phrases")) ||
    (node.type === "ExpressionStatement" &&
      node.expression.callee?.object?.name === "Object" &&
      node.expression.arguments?.[0]?.object?.name === "phrases"),
);
const formatter = ast.program.body.find(
  (node) =>
    node.type === "ExportNamedDeclaration" &&
    node.declaration?.id?.name === "localizeText",
).declaration;
const { phrases, localizeText } = vm.runInNewContext(
  `(() => {
  ${definitions.map((node) => generate(node).code).join("\n")}
  ${generate(formatter).code}
  return { phrases, localizeText };
})()`,
  { __DEV__: false },
);

test("both languages cover inventory text and retain every template value", () => {
  const keys = new Set();
  for (const file of [
    "src/components/InventoryTools.js",
    "src/components/InventoryScanner.js",
    "src/components/InventoryMenuLinks.js",
    "src/components/InventoryRecipeEditor.js",
    "src/components/InventoryCamera.web.js",
    "src/screens/InventoryScreen.js",
  ]) {
    traverse(parse(file), {
      CallExpression(p) {
        if (
          p.node.callee.name === "tr" &&
          p.node.arguments[0]?.type === "StringLiteral"
        )
          keys.add(p.node.arguments[0].value.trim());
      },
      JSXText(p) {
        if (p.parent.openingElement?.name?.name === "LocalizedText") {
          const text = p.node.value.replace(/\s+/g, " ").trim();
          if (/[A-Za-z]/.test(text)) keys.add(text);
        }
      },
    });
  }
  for (const key of keys) {
    const tokens = (value) => (value.match(/\{\w+\}/g) || []).sort();
    for (const language of ["mr", "hi"]) {
      assert.ok(phrases[language][key], `${language} missing: ${key}`);
      assert.deepEqual(
        tokens(phrases[language][key]),
        tokens(key),
        `${language} changed a value: ${key}`,
      );
    }
  }
});

test("formatting preserves names, zero counts and literal braces in supplied values", () => {
  assert.equal(
    localizeText("Save {count} dish recipes", "en", { count: 0 }),
    "Save 0 dish recipes",
  );
  assert.equal(
    localizeText("{count} selected", "hi", { count: 2 }),
    "2 चुने गए",
  );
  assert.equal(
    localizeText("{count} selected", "mr", { count: 2 }),
    "2 निवडले",
  );
  assert.equal(
    localizeText("Quantity of {name}", "hi", { name: "Tomato {count}" }),
    "Tomato {count} की मात्रा",
  );
  assert.equal(localizeText("Kingfisher 650ml", "mr"), "Kingfisher 650ml");
  assert.equal(localizeText("  Save  ", "en"), "  Save  ");
  assert.equal(
    localizeText("Unknown phrase {count}", "hi", { count: 7 }),
    "Unknown phrase 7",
  );
  assert.equal(localizeText("{count} selected", "mr", {}), "{count} निवडले");
});
