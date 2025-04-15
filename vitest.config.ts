import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Set timeout to 120 seconds for all tests
    testTimeout: 120000,
    exclude: ["dist/**/*", "node_modules/**/*"],
    // Define test sequence
    sequence: {
      // The kubectl tests will run last
      // @ts-ignore
      sequencer: async (files) => {
        // Separate the kubectl test from other tests
        const kubectlTests = files.filter((file) =>
          file.includes("kubectl.test.ts")
        );
        const otherTests = files.filter(
          (file) => !file.includes("kubectl.test.ts")
        );

        // Return tests with kubectl test at the end
        return [...otherTests, ...kubectlTests];
      },
    },
  },
});
