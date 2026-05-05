import { expect, type Locator, type Page } from "@playwright/test";

export type RightPanelName =
  | "Browser"
  | "Characters"
  | "Lorebooks"
  | "Presets"
  | "Connections"
  | "Agents"
  | "Personas"
  | "Settings";

export class AppShellPage {
  constructor(readonly page: Page) {}

  async waitForReady() {
    await expect(this.page.locator('[data-component="ChatSidebar"]')).toBeVisible();
  }

  async dismissOnboarding() {
    const skipTutorial = this.page.getByRole("button", { name: "Skip Tutorial" });
    if (await skipTutorial.isVisible().catch(() => false)) {
      await skipTutorial.click();
      return;
    }

    const skip = this.page.getByRole("button", { name: "Skip" });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
    }
  }

  panelButton(name: RightPanelName): Locator {
    return this.page.locator(`button[title="${name}"]`).first();
  }

  async openRightPanel(name: RightPanelName) {
    await this.panelButton(name).click();
    await expect(this.page.getByLabel(name)).toBeVisible();
  }
}
