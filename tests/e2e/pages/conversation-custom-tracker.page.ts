import { expect, test, type Page } from "@playwright/test";

export class ConversationCustomTrackerPage {
  constructor(readonly page: Page) {}

  async openChat(chatId: string) {
    await test.step("Open isolated Conversation chat", async () => {
      await this.page.addInitScript((id) => window.localStorage.setItem("marinara-active-chat-id", id), chatId);
      await this.page.goto("/");
      await expect(this.page.locator('[data-component="ChatSidebar"]')).toBeVisible();
      await this.dismissStartupOverlays();
      await expect(this.page.getByTitle("Chat Settings")).toBeVisible();
      await this.page.getByRole("button", { name: "Close chats" }).click();
    });
  }

  async addCustomTrackerToChat() {
    await test.step("Add Custom Tracker from Conversation Chat Settings", async () => {
      await this.page.getByTitle("Chat Settings").click();
      const drawer = this.page.locator("[data-chat-floating-panel]").filter({ hasText: "Chat Settings" });
      await expect(drawer).toBeVisible();
      await drawer.getByRole("button", { name: /^Agents Show help/ }).click();
      const trackerCategory = drawer.getByRole("button", { name: /^Tracker Agents/ });
      await expect(trackerCategory).toBeVisible();
      await trackerCategory.click();
      const trackerEntry = drawer.locator('[data-chat-agent-entry="custom-tracker"]');
      await expect(trackerEntry).toContainText("Custom Tracker");
      await trackerEntry.click();

      const addDialog = this.page.getByRole("dialog", { name: "Add Custom Tracker" });
      await expect(addDialog).toBeVisible();
      await addDialog.getByRole("button", { name: "Add", exact: true }).click();
      await expect(addDialog).toBeHidden();
      await drawer.getByRole("button", { name: "Close chat settings" }).click();
      await this.ensureTrackerToolbarButtonVisible();
    });
  }

  async openTrackerPanel() {
    await test.step("Open Conversation Custom Tracker panel", async () => {
      await this.ensureTrackerToolbarButtonVisible();
      await this.page.locator('button[title="Custom Tracker"]:visible').click();
      await expect(this.panel()).toBeVisible();
      await expect(this.panel().getByRole("button", { name: "Custom Stats" })).toBeVisible();
    });
  }

  async addAndEditTwoFields() {
    await test.step("Add, rename, and edit two Custom Tracker fields", async () => {
      const panel = this.panel();
      await panel.getByRole("button", { name: "Open tracker settings" }).click();
      await panel.getByRole("button", { name: "Enter tracker add mode" }).click();
      const addStat = panel.getByRole("button", { name: "Add custom stat" });
      await addStat.click();
      await addStat.click();

      const newFieldButtons = panel.getByRole("button", { name: "New Field", exact: true });
      await expect(newFieldButtons).toHaveCount(2);
      await newFieldButtons.nth(0).click();
      await panel.getByRole("textbox", { name: "Field" }).fill("Trust");
      await panel.getByRole("textbox", { name: "Field" }).press("Enter");
      await panel.getByRole("button", { name: "New Field", exact: true }).click();
      await panel.getByRole("textbox", { name: "Field" }).fill("Promise");
      await panel.getByRole("textbox", { name: "Field" }).press("Enter");

      const valueButtons = panel.getByRole("button", { name: "Value", exact: true });
      await expect(valueButtons).toHaveCount(2);
      await valueButtons.nth(0).click();
      await panel.getByRole("textbox", { name: "Value" }).fill("Medium");
      await panel.getByRole("textbox", { name: "Value" }).press("Enter");
      await panel.getByRole("button", { name: "Value", exact: true }).click();
      await panel.getByRole("textbox", { name: "Value" }).fill("Kept");
      await panel.getByRole("textbox", { name: "Value" }).press("Enter");

      await expect(panel.getByRole("button", { name: "Trust", exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: "Medium", exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: "Promise", exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: "Kept", exact: true })).toBeVisible();
    });
  }

  async removePromiseField() {
    await test.step("Remove one Custom Tracker field from the UI", async () => {
      const panel = this.panel();
      const openSettings = panel.getByRole("button", { name: "Open tracker settings" });
      if (await openSettings.isVisible()) await openSettings.click();
      const exitAddMode = panel.getByRole("button", { name: "Exit tracker add mode" });
      if (await exitAddMode.isVisible()) await exitAddMode.click();
      await panel.getByRole("button", { name: "Enter tracker delete mode" }).click();
      await panel.getByRole("button", { name: "Remove Promise" }).click();
      await expect(panel.getByRole("button", { name: "Promise", exact: true })).toBeHidden();
    });
  }

  async closeTrackerPanel() {
    const close = this.panel().getByRole("button", { name: "Close tracker panel" });
    if (await close.isVisible()) await close.click();
  }

  panel() {
    return this.page.getByRole("complementary", { name: "Tracker data panel" });
  }

  async ensureTrackerToolbarButtonVisible() {
    const trackerButton = this.page.locator('button[title="Custom Tracker"]:visible');
    if (!(await trackerButton.isVisible().catch(() => false))) {
      await this.page.getByRole("button", { name: "More options" }).click();
    }
    await expect(trackerButton).toBeVisible();
  }

  private async dismissStartupOverlays() {
    const skip = this.page.getByRole("button", { name: "Skip Tutorial" });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    const gotIt = this.page.getByRole("button", { name: "Got it", exact: true });
    if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
  }
}
