import { generateFixtures } from "./generate-fixtures.mjs";

export default async function globalSetup() {
  await generateFixtures();
}
