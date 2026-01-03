import type { FigmaScreenData, DocsData } from "./types";

interface MergedContext {
    figma: FigmaScreenData;
    docs: DocsData;
}

const utPromptTemplate = `# Unit Test Generation for {{SCREEN_NAME}}

## 📋 Context

### Screen Information
- **Screen Name**: {{SCREEN_NAME}}
- **UI Components**: {{COMPONENTS}}
- **Form Fields**: 
{{FIELDS}}
- **User Actions**: {{ACTIONS}}

### Business Rules & Requirements
{{RULES}}

### User Flows & Scenarios
{{FLOWS}}

{{FACTS_SECTION}}

{{ROLES_SECTION}}

---

## 🎯 Task

You are working inside **Cursor IDE** with full access to the source code repository.

Your task is to:
1. **Analyze the source code** to understand the implementation of the **{{SCREEN_NAME}}** screen
2. **Map the UI components** to actual code components/services
3. **Identify the API endpoints** and service methods used
4. **Generate comprehensive unit test cases** in Markdown format

### Requirements

✅ **Cover all validation rules** mentioned in the business rules above
✅ **Test success scenarios** for all user flows
✅ **Test failure scenarios** (invalid inputs, error cases)
✅ **Test edge cases** based on the constraints and facts
✅ **Assume backend logic** exists - test what the code actually does
✅ **Use role context** to understand who can perform which actions

### Test Structure

Each test case should include:
- **Test Name**: Clear description of what is being tested
- **Scenario**: What user action or system event triggers this test
- **Given**: Initial state/conditions
- **When**: Action performed
- **Then**: Expected outcome
- **Test Data**: Sample inputs/outputs

---

## 📝 Output Format

Generate the unit tests in Markdown format and save to:

\`\`\`
ut-docs/{{SCREEN_NAME_LOWER}}/{{SCREEN_NAME_LOWER}}.ut.md
\`\`\`

### Expected Output Structure

\`\`\`markdown
# Unit Tests: {{SCREEN_NAME}}

## Test Suite Overview
- Total test cases: [number]
- Coverage: [validation rules, flows, edge cases]

## Test Cases

### TC-001: [Test Name]
**Scenario**: [Description]
**Given**: [Initial state]
**When**: [Action]
**Then**: [Expected result]

**Test Data**:
- Input: [example]
- Expected Output: [example]

...
\`\`\`

---

## 🔍 Important Notes

- **Read the actual source code** - don't assume, verify the implementation
- **Follow existing test patterns** if tests already exist in the codebase
- **Use the component/field names** from the screen information above
- **Reference the business rules** when writing validation tests
- **Consider the roles** - different users may have different permissions
- **Be specific** - include actual field names, error messages, and expected behaviors

Start by exploring the codebase to find the relevant files for {{SCREEN_NAME}} screen.
`;

const codePromptTemplate = `# Code Implementation for {{SCREEN_NAME}}

## 📋 Context

### Screen Information
- **Screen Name**: {{SCREEN_NAME}}
- **UI Components**: {{COMPONENTS}}
- **Form Fields**: 
{{FIELDS}}
- **User Actions**: {{ACTIONS}}

### Business Rules & Requirements
{{RULES}}

### User Flows & Scenarios
{{FLOWS}}

{{FACTS_SECTION}}

{{ROLES_SECTION}}

---

## 🎯 Task

You are working inside **Cursor IDE** with full access to the source code repository.

Your task is to:
1. **Implement or update** the **{{SCREEN_NAME}}** screen based on the Figma design and business rules
2. **Create/update components** matching the UI components listed above
3. **Implement form fields** with proper validation based on business rules
4. **Handle user actions** (submit, click, navigation) according to the flows
5. **Apply role-based access** if roles are specified

### Requirements

✅ **Follow the component/field names** exactly as specified in Figma
✅ **Implement all validation rules** from business rules
✅ **Handle all user flows** correctly
✅ **Respect role permissions** - different users may have different access
✅ **Follow existing code patterns** in the codebase
✅ **Use proper error handling** and user feedback

### Implementation Structure

- **Components**: Create/update React/Vue/etc components matching Figma components
- **Forms**: Implement form fields with validation
- **API Integration**: Connect to backend APIs as needed
- **State Management**: Handle form state and user interactions
- **Error Handling**: Show appropriate error messages
- **Loading States**: Handle async operations gracefully

---

## 🔍 Important Notes

- **Read existing code** - understand the current architecture and patterns
- **Use component/field names** from the screen information above exactly
- **Reference business rules** when implementing validations
- **Consider roles** - implement role-based access control if needed
- **Be consistent** - follow existing code style and patterns
- **Test your implementation** - ensure it works with the described flows

Start by exploring the codebase to find where to implement the {{SCREEN_NAME}} screen.
`;

export function buildPrompt(context: MergedContext, mode: "ut" | "code" = "ut"): string {
    const screenName = context.figma.screen;
    const screenNameLower = screenName.toLowerCase().replace(/\s+/g, "-");
    
    const components = context.figma.components.length > 0
        ? context.figma.components.join(", ")
        : "None";
    
    const fields = context.figma.fields.length > 0
        ? context.figma.fields.map(f => `  - ${f.name} (${f.type})`).join("\n")
        : "  None";
    
    const actions = context.figma.actions.length > 0
        ? context.figma.actions.join(", ")
        : "None";
    
    const rules = context.docs.rules.length > 0
        ? context.docs.rules.map(r => `- ${r}`).join("\n")
        : "- No specific rules extracted";
    
    const flows = context.docs.flows.length > 0
        ? context.docs.flows.map(f => `- ${f}`).join("\n")
        : "- No specific flows extracted";

    let factsSection = "";
    if (context.docs.facts && context.docs.facts.length > 0) {
        const factsByCategory = new Map<string, NonNullable<DocsData["facts"]>>();
        for (const fact of context.docs.facts.slice(0, 20)) {
            const category = fact.category;
            if (!factsByCategory.has(category)) {
                factsByCategory.set(category, []);
            }
            factsByCategory.get(category)!.push(fact);
        }

        const factsLines: string[] = ["### Key Facts"];
        for (const [category, facts] of factsByCategory.entries()) {
            factsLines.push(`\n**${category.charAt(0).toUpperCase() + category.slice(1)}**:`);
            for (const fact of facts.slice(0, 5)) {
                factsLines.push(`- ${fact.text}${fact.source ? ` (from: ${fact.source})` : ""}`);
            }
        }
        factsSection = factsLines.join("\n");
    }

    let rolesSection = "";
    if (context.docs.roles && context.docs.roles.length > 0) {
        const relevantRoles = context.docs.roles.filter((r: string) => r !== "unknown");
        if (relevantRoles.length > 0) {
            rolesSection = `### Relevant Roles\n\nThis screen involves: ${relevantRoles.join(", ")}`;
        }
    }

    const template = mode === "ut" ? utPromptTemplate : codePromptTemplate;
    
    let prompt = template
        .replace(/{{SCREEN_NAME}}/g, screenName)
        .replace(/{{SCREEN_NAME_LOWER}}/g, screenNameLower)
        .replace(/{{COMPONENTS}}/g, components)
        .replace(/{{FIELDS}}/g, fields)
        .replace(/{{ACTIONS}}/g, actions)
        .replace(/{{RULES}}/g, rules)
        .replace(/{{FLOWS}}/g, flows)
        .replace(/{{FACTS_SECTION}}/g, factsSection || "")
        .replace(/{{ROLES_SECTION}}/g, rolesSection || "");

    return prompt;
}

