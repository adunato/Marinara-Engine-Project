import { expect, test, type Page } from "@playwright/test";

export class ChatSummaryPage {
  constructor(readonly page: Page) {}

  async openChat(chatId: string) {
    await test.step("Open seeded chat in browser", async () => {
      await this.page.addInitScript((id) => {
        window.localStorage.setItem("marinara-active-chat-id", id);
      }, chatId);
      await this.page.goto("/");
      await expect(this.page.locator('[data-component="ChatSidebar"]')).toBeVisible();
    });
  }

  async openSummaryPopover() {
    await test.step("Open chat summary popover", async () => {
      await this.page.getByTitle("Chat Summary").first().click();
      await expect(this.page.getByText("Chat Summary").last()).toBeVisible();
    });
  }

  async expectSummaryVisible(summary: string) {
    await test.step("Assert summary text is visible", async () => {
      await expect(this.page.getByText(summary, { exact: false })).toBeVisible();
    });
  }
}
