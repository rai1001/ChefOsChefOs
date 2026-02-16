import {
  getDefaultTemplateForService,
  getTaskTemplateById,
  getTaskTemplatesByService,
} from "@/lib/taskTemplates";

describe("taskTemplates", () => {
  it("returns templates by service type", () => {
    const breakfast = getTaskTemplatesByService("breakfast");
    const event = getTaskTemplatesByService("event");

    expect(breakfast.length).toBeGreaterThan(0);
    expect(event.length).toBeGreaterThan(0);
    expect(breakfast.every((template) => template.serviceType === "breakfast")).toBe(true);
    expect(event.every((template) => template.serviceType === "event")).toBe(true);
  });

  it("returns template by id", () => {
    const template = getTaskTemplateById("breakfast-mise-en-place");
    expect(template?.title).toContain("desayuno");
  });

  it("returns default template per service", () => {
    const breakfast = getDefaultTemplateForService("breakfast");
    const event = getDefaultTemplateForService("event");

    expect(breakfast).not.toBeNull();
    expect(event).not.toBeNull();
  });
});
