import nextVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextVitals,
  {
    ignores: ["**/node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];
