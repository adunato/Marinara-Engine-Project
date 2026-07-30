import { expect, test, type Locator, type Page } from "@playwright/test";

export class ConversationSummaryControlsPage {
  constructor(readonly page: Page) {}

  async openChat(chatId: string) {
    await test.step("Open the isolated CR017 Conversation", async () => {
      await this.page.addInitScript((id) => window.localStorage.setItem("marinara-active-chat-id", id), chatId);
      await this.page.goto("/");
      await expect(this.page.locator('[data-component="ChatSidebar"]')).toBeVisible();
      for (const name of ["Skip Tutorial", "Got it", "Close chats"] as const) {
        const button = this.page.getByRole("button", { name, exact: true });
        if (await button.isVisible().catch(() => false)) await button.click();
      }
    });
  }

  async openControls() {
    await test.step("Open Automatic Summarization in Conversation Chat Settings", async () => {
      await this.page.getByTitle("Chat Settings").click();
      const section = this.settingsPanel().getByRole("button", {
        name: /^Automatic Summarization/,
      });
      if ((await section.getAttribute("aria-expanded")) !== "true") await section.click();
      await expect(this.summaryConnection()).toBeVisible();
      await expect(this.memoryToggle()).toBeVisible();
    });
  }

  settingsPanel(): Locator {
    return this.page.locator(".mari-chat-settings-drawer");
  }

  summaryConnection(): Locator {
    return this.settingsPanel().getByText("Summary Connection", { exact: true }).locator("..").getByRole("combobox");
  }

  memoryToggle(): Locator {
    return this.settingsPanel().getByRole("button", {
      name: /^Include Summary Memories in Prompts/,
    });
  }
}
