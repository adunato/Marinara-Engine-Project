import { expect, test, type Page } from "@playwright/test";

export class DailyIntentionsPage {
  constructor(readonly page: Page) {}

  async openChat(chatId: string) {
    await test.step("Open the isolated Daily Intentions Conversation", async () => {
      await this.page.addInitScript(
        (id) => window.localStorage.setItem("marinara-active-chat-id", id),
        chatId,
      );
      await this.page.goto("/");
      await expect(this.page.locator('[data-component="ChatSidebar"]')).toBeVisible();
      const skip = this.page.getByRole("button", { name: "Skip Tutorial" });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      const gotIt = this.page.getByRole("button", { name: "Got it", exact: true });
      if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
      const closeChats = this.page.getByRole("button", { name: "Close chats" });
      if (await closeChats.isVisible().catch(() => false)) await closeChats.click();
    });
  }

  async openConfiguration() {
    await test.step("Open Conversation-scoped Daily Intentions configuration", async () => {
      await this.page.getByTitle("Chat Settings").click();
      await this.page.getByRole("button", { name: /^Agents Show help/ }).click();
      await this.page.getByTestId("configure-daily-intentions").click();
      await expect(this.configuration()).toBeVisible();
    });
  }

  async openEditor() {
    await test.step("Open current Daily Intentions", async () => {
      const sectionButton = this.page.getByRole("button", { name: /^Daily Intentions Show help/ });
      if (await sectionButton.isVisible().catch(() => false)) await sectionButton.click();
      await this.page.getByTestId("open-daily-intentions").click();
      await expect(this.editor()).toBeVisible();
    });
  }

  configuration() {
    return this.page.getByRole("dialog", { name: "Configure Daily Intentions" });
  }

  editor() {
    return this.page.getByRole("dialog", { name: "Daily Intentions", exact: true });
  }
}
