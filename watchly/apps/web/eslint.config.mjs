import base from "@watchly/config/eslint";
export default [...base, { ignores: [".next/**", "next-env.d.ts"] }];
