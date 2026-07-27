import { expect, test, type Page } from "@playwright/test";

export class DailyMemoriesPage {
  constructor(readonly page: Page) {}

  async openChat(chatId: string) {
    await test.step("Open the isolated Conversation chat", async () => {
      await this.page.addInitScript((id) => window.localStorage.setItem("marinara-active-chat-id", id), chatId);
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

  async openEditor() {
    await test.step("Open Daily Memories from Conversation settings", async () => {
      await this.page.getByTitle("Chat Settings").click();
      await this.page.getByRole("button", { name: /^Daily Memories Show help/ }).click();
      await this.page.getByTestId("open-daily-memories").click();
      await expect(this.editor()).toBeVisible();
    });
  }

  async editFirstMemoryAndAddAnother(date: string) {
    await test.step("Edit importance and add a memory for the completed day", async () => {
      const editor = this.editor();
      const firstMemory = editor.getByRole("textbox", { name: `Memory 1 for ${date}` });
      if (!(await firstMemory.isVisible().catch(() => false))) {
        await editor.getByRole("button", { name: new RegExp(date.replaceAll(".", "\\.")) }).click();
      }
      await firstMemory.fill("The user treasures jasmine tea for serious planning conversations.");
      await editor.getByRole("combobox", { name: `Importance for memory 1 on ${date}` }).selectOption("4");
      await editor.getByRole("button", { name: "Add memory" }).click();
      await editor.getByRole("textbox", { name: `Memory 3 for ${date}` }).fill(
        "Mira agreed to revisit their hiking plans after tea.",
      );
      await editor.getByRole("button", { name: "Save changes" }).click();
      await expect(editor.getByRole("button", { name: "Save changes" })).toBeDisabled();
    });
  }

  editor() {
    return this.page.getByRole("dialog", { name: "Daily Memories" });
  }
}
