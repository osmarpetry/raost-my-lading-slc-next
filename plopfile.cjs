module.exports = function (plop) {
  plop.setGenerator("component", {
    description: "Generate a reusable UI component with test and story files",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Component name:",
      },
    ],
    actions: [
      {
        type: "add",
        path: "src/components/{{kebabCase name}}/{{kebabCase name}}.tsx",
        templateFile: "generators/templates/component/component.hbs",
      },
      {
        type: "add",
        path: "src/components/{{kebabCase name}}/{{kebabCase name}}.variants.ts",
        templateFile: "generators/templates/component/variants.hbs",
      },
      {
        type: "add",
        path: "tests/unit/components/{{kebabCase name}}.test.tsx",
        templateFile: "generators/templates/component/test.hbs",
      },
      {
        type: "add",
        path: "src/stories/{{pascalCase name}}.stories.tsx",
        templateFile: "generators/templates/component/story.hbs",
      },
    ],
  });

  plop.setGenerator("server-module", {
    description: "Generate a server module with a unit test and route stub",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Server module name:",
      },
      {
        type: "input",
        name: "routeSegment",
        message: "Route segment (leave empty to skip route stub):",
      },
    ],
    actions: [
      {
        type: "add",
        path: "src/server/{{kebabCase name}}.ts",
        templateFile: "generators/templates/server-module/module.hbs",
      },
      {
        type: "add",
        path: "tests/unit/server/{{kebabCase name}}.test.ts",
        templateFile: "generators/templates/server-module/test.hbs",
      },
      {
        type: "add",
        path: "src/app/api/{{kebabCase routeSegment}}/route.ts",
        templateFile: "generators/templates/server-module/route.hbs",
        skip: function ({ routeSegment }) {
          return routeSegment ? false : "Skipping route stub.";
        },
      },
    ],
  });

  plop.setGenerator("feature", {
    description: "Generate a Playwright BDD feature file and step definition",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Feature name:",
      },
    ],
    actions: [
      {
        type: "add",
        path: "tests/e2e/features/{{kebabCase name}}.feature",
        templateFile: "generators/templates/feature/feature.hbs",
      },
      {
        type: "add",
        path: "tests/e2e/steps/{{kebabCase name}}.steps.ts",
        templateFile: "generators/templates/feature/steps.hbs",
      },
    ],
  });
};
