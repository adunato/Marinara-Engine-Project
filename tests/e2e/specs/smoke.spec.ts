import { test, expect } from "../fixtures/app";
import { createCharacterThroughUi } from "../macros/scenarios";

test("[ui] boots the app and creates a character through reusable scenario steps", async ({ page, app }) => {
  const health = await page.request.get("/api/health");
  await expect(health).toBeOK();

  await app.dismissOnboarding();

  await createCharacterThroughUi(page, {
    name: `E2E Character ${Date.now()}`,
  });
});
