import { expect, test, type Locator, type Page } from "@playwright/test";

export class ConversationTwoPassPage {
  constructor(readonly page: Page) {}

  async openChat(chatId: string) {
    await test.step("Open the isolated CR032 Conversation", async () => {
      await this.page.addInitScript(
        (id) => window.localStorage.setItem("marinara-active-chat-id", id),
        chatId,
      );
      await this.page.goto("/");
      await expect(
        this.page.locator('[data-component="ChatSidebar"]'),
      ).toBeVisible();
      for (const name of ["Skip Tutorial", "Got it", "Close chats"] as const) {
        const button = this.page.getByRole("button", { name, exact: true });
        if (await button.isVisible().catch(() => false)) await button.click();
      }
    });
  }

  async openTwoPassControls() {
    await test.step("Open the Conversation pipeline and prompt controls", async () => {
      await this.page.getByTitle("Chat Settings").click();
      await this.expandSection("Message generation pipeline");
      await this.expandSection("Prompt Preset");
      await expect(this.pipelineSelect()).toBeVisible();
    });
  }

  async expandSection(name: string) {
    const section = this.settingsPanel().getByRole("button", {
      name: new RegExp(`^${name}`),
    });
    if ((await section.getAttribute("aria-expanded")) !== "true")
      await section.click();
  }

  settingsPanel(): Locator {
    return this.page.locator(".mari-chat-settings-drawer");
  }

  pipelineSelect(): Locator {
    return this.section("Message generation pipeline").getByRole("combobox");
  }

  curatorConnection(): Locator {
    return this.settingsPanel()
      .getByText("Context curator connection", { exact: true })
      .locator("..")
      .getByRole("combobox");
  }

  curatorMaxTokens(): Locator {
    return this.settingsPanel()
      .getByText("Curator maximum output tokens", { exact: true })
      .locator("..")
      .getByRole("spinbutton");
  }

  briefingPromptButton(): Locator {
    return this.settingsPanel().getByTitle("Edit Conversation Briefing prompt");
  }

  writerPromptButton(): Locator {
    return this.settingsPanel().getByTitle("Edit Conversation Writer prompt");
  }

  readyStatus(): Locator {
    return this.settingsPanel().getByText("Two-pass configuration is ready.", {
      exact: true,
    });
  }

  private section(name: string): Locator {
    return this.settingsPanel()
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .locator("..");
  }
}
