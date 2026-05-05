import { expect, type Page } from "@playwright/test";
import { AppShellPage } from "../pages/app-shell.page";

export type CharacterScenario = {
  name: string;
};

export async function createCharacterThroughUi(page: Page, character: CharacterScenario) {
  const app = new AppShellPage(page);

  await app.openRightPanel("Characters");
  await page.locator('button[title="New"]').click();
  const dialog = page.getByRole("dialog", { name: "Create Character" });
  await expect(dialog).toBeVisible();
  await page.getByPlaceholder("Character name...").fill(character.name);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(character.name).first()).toBeVisible();

  return character;
}
